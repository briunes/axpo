import fs from "node:fs";
import { Client } from "pg";

const SOURCE_ENV = process.env.SOURCE_ENV || ".env.preview";
const DEST_ENV = process.env.DEST_ENV || "vars";

const BASE_TABLES = [
  "agencies",
  "users",
  "user_preferences",
  "agency_tariffs",
  "clients",
  "pdf_templates",
  "pdf_template_translations",
  "email_templates",
  "email_template_translations",
  "system_config",
  "role_permissions",
  "template_variables",
  "invoice_provider_prompts",
  "base_value_sets",
  "base_value_items",
  "ocr_model_prices",
];

const EMPTY_TABLES = [
  "user_sessions",
  "simulations",
  "simulation_versions",
  "access_attempts",
  "audit_logs",
  "email_logs",
  "cron_logs",
  "ocr_logs",
  "ocr_log_files",
  "app_error_logs",
  "ocr_usage_invoices",
];

const DEFERRED_COLUMNS = {
  agencies: ["createdByUserId", "updatedByUserId"],
  users: ["createdByUserId", "updatedByUserId"],
};

function readEnvFile(path) {
  const result = {};
  const text = fs.readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function connectionUrl(env, label) {
  const url = env.DATABASE_URL || env.DIRECT_URL;
  if (!url) throw new Error(`${label} is missing DIRECT_URL/DATABASE_URL`);
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

function q(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function tableColumns(client, table) {
  const { rows } = await client.query(
    `
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table],
  );
  return rows.map((row) => ({
    name: row.column_name,
    udtName: row.udt_name,
  }));
}

async function copyRows(source, dest, table, options = {}) {
  const columnInfo = await tableColumns(source, table);
  const columns = columnInfo.map((column) => column.name);
  const jsonColumns = new Set(
    columnInfo
      .filter((column) => column.udtName === "json" || column.udtName === "jsonb")
      .map((column) => column.name),
  );
  const { rows } = await source.query(
    `SELECT ${columns.map(q).join(", ")} FROM public.${q(table)}`,
  );

  if (rows.length === 0) return 0;

  const insertColumns = columns;
  const updateSet = insertColumns
    .filter((column) => column !== "id")
    .map((column) => `${q(column)} = EXCLUDED.${q(column)}`)
    .join(", ");

  const deferred = new Set(options.deferColumns || []);
  const columnsPerRow = insertColumns.length;
  const batchSize = Math.max(1, Math.min(500, Math.floor(60000 / columnsPerRow)));

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const rowPlaceholders = batch.map((row, rowIndex) => {
      const placeholders = insertColumns.map((column, columnIndex) => {
        values.push(
          deferred.has(column)
            ? null
            : jsonColumns.has(column) && row[column] !== null
              ? JSON.stringify(row[column])
              : row[column],
        );
        return `$${rowIndex * columnsPerRow + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const sql = `
      INSERT INTO public.${q(table)} (${insertColumns.map(q).join(", ")})
      VALUES ${rowPlaceholders.join(", ")}
      ON CONFLICT ("id") DO UPDATE SET ${updateSet || '"id" = EXCLUDED."id"'}
    `;

    await dest.query(sql, values);
  }

  return rows.length;
}

async function restoreDeferredColumns(source, dest, table, columns) {
  if (columns.length === 0) return;

  const selected = ["id", ...columns];
  const { rows } = await source.query(
    `SELECT ${selected.map(q).join(", ")} FROM public.${q(table)}`,
  );
  if (rows.length === 0) return;

  const setSql = columns
    .map((column, index) => `${q(column)} = $${index + 2}`)
    .join(", ");
  const sql = `UPDATE public.${q(table)} SET ${setSql} WHERE "id" = $1`;

  for (const row of rows) {
    await dest.query(sql, [row.id, ...columns.map((column) => row[column])]);
  }
}

async function countRows(client, tables) {
  const counts = {};
  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS count FROM public.${q(table)}`,
    );
    counts[table] = rows[0].count;
  }
  return counts;
}

async function main() {
  const sourceEnv = readEnvFile(SOURCE_ENV);
  const destEnv = readEnvFile(DEST_ENV);

  const source = new Client({
    connectionString: connectionUrl(sourceEnv, SOURCE_ENV),
    ssl: { rejectUnauthorized: false },
  });
  const dest = new Client({
    connectionString: connectionUrl(destEnv, DEST_ENV),
    ssl: { rejectUnauthorized: false },
  });

  await source.connect();
  await dest.connect();

  try {
    const allTables = [...BASE_TABLES, ...EMPTY_TABLES];
    await dest.query("BEGIN");
    await dest.query(
      `TRUNCATE TABLE ${allTables.map((table) => `public.${q(table)}`).join(", ")} RESTART IDENTITY CASCADE`,
    );

    const imported = {};
    for (const table of BASE_TABLES) {
      imported[table] = await copyRows(source, dest, table, {
        deferColumns: DEFERRED_COLUMNS[table] || [],
      });
    }

    for (const [table, columns] of Object.entries(DEFERRED_COLUMNS)) {
      await restoreDeferredColumns(source, dest, table, columns);
    }

    await dest.query("COMMIT");

    const emptyCounts = await countRows(dest, EMPTY_TABLES);
    console.log(JSON.stringify({ imported, emptyCounts }, null, 2));
  } catch (error) {
    await dest.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await dest.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
