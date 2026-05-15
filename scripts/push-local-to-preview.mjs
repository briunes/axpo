/**
 * push-local-to-preview.mjs
 *
 * Wipes the Supabase preview DB (all tables) and replaces it entirely
 * with data from the local database.
 *
 * Usage:
 *   node scripts/push-local-to-preview.mjs
 *   node scripts/push-local-to-preview.mjs --dry-run
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";
import pg from "pg";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read preview DATABASE_URL from ../.env.preview ────────────────────────
const envPath = resolve(__dirname, "../.env.preview");
let previewUrl;
try {
  const content = readFileSync(envPath, "utf-8");
  // Use the pooler DATABASE_URL (works from outside Supabase network)
  const match = content.match(/^(?!#)DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.preview");
  previewUrl = match[1].trim().replace(/^['"]|['"]$/g, "")
    .replace("pgbouncer=true", "pgbouncer=false"); // disable pgbouncer for multi-statement sessions
} catch (err) {
  console.error(`❌ Could not read .env.preview at ${envPath}:`, err.message);
  process.exit(1);
}

const LOCAL_URL = "postgresql://axpo:axpo_dev_password@localhost:5432/axpo_simulator";

// ── CLI args ──────────────────────────────────────────────────────────────
const dryRun = process.argv.includes("--dry-run");

// ── Colours ───────────────────────────────────────────────────────────────
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const BOLD   = "\x1b[1m";
const NC     = "\x1b[0m";

const log  = (m) => console.log(m);
const ok   = (m) => console.log(`${GREEN}  ✔ ${m}${NC}`);
const warn = (m) => console.log(`${YELLOW}  ⚠ ${m}${NC}`);
const step = (m) => console.log(`\n${CYAN}${BOLD}${m}${NC}`);

function confirm(question) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); res(a.trim().toLowerCase()); });
  });
}

// ── Tables to copy, in dependency order (parents before children) ─────────
// _prisma_migrations and cron_logs are skipped intentionally
const TABLES = [
  "system_config",
  "role_permissions",
  "template_variables",
  "users",
  "agencies",
  "clients",
  "base_value_sets",
  "base_value_items",
  "email_templates",
  "email_template_translations",
  "pdf_templates",
  "pdf_template_translations",
  "agency_tariffs",
  "simulations",
  "simulation_versions",
  "audit_logs",
  "email_logs",
  "access_attempts",
  "user_preferences",
];

async function getColumns(client, table) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return res.rows.map((r) => r.column_name);
}

async function copyTable(localClient, previewClient, table) {
  // Get columns that exist on BOTH sides to handle schema drift
  const [localCols, previewCols] = await Promise.all([
    getColumns(localClient, table),
    getColumns(previewClient, table),
  ]);

  const cols = localCols.filter((c) => previewCols.includes(c));
  if (cols.length === 0) {
    warn(`Skipping ${table} — no common columns`);
    return 0;
  }

  const colList = cols.map((c) => `"${c}"`).join(", ");
  const { rows } = await localClient.query(`SELECT ${colList} FROM "${table}"`);
  if (rows.length === 0) return 0;

  // Detect which columns contain JSON/JSONB values (pg returns them as objects)
  const sampleRow = rows[0];
  const jsonCols = new Set(
    cols.filter((c) => {
      const v = sampleRow[c];
      return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
    })
  );

  const BATCH = 500; // rows per INSERT statement
  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH);
    const allVals = [];
    const valueClauses = batch.map((row, rowIdx) => {
      const ph = cols.map((c, colIdx) => {
        const v = row[c];
        allVals.push(
          (jsonCols.has(c) && v !== null) ? JSON.stringify(v) :
          Array.isArray(v)               ? JSON.stringify(v) :
          v
        );
        return `$${rowIdx * cols.length + colIdx + 1}`;
      });
      return `(${ph.join(", ")})`;
    });
    await previewClient.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${valueClauses.join(", ")} ON CONFLICT DO NOTHING`,
      allVals
    );
    inserted += batch.length;
  }
  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
  log(`${BOLD}  🚀  Push Entire DB: Local → Preview${NC}`);
  log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
  if (dryRun) warn("DRY RUN — no data will be written");

  const localClient   = new Client({ connectionString: LOCAL_URL });
  const previewClient = new Client({ connectionString: previewUrl });

  await localClient.connect();
  await previewClient.connect();

  try {
    // ── Count local rows ──────────────────────────────────────────────────
    step("1/3  Counting local data...");
    const counts = {};
    for (const table of TABLES) {
      const res = await localClient.query(`SELECT COUNT(*) FROM "${table}"`);
      counts[table] = parseInt(res.rows[0].count, 10);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    log(`  Local DB has ${BOLD}${total}${NC} total rows across ${TABLES.length} tables:`);
    for (const [t, c] of Object.entries(counts)) {
      if (c > 0) log(`    ${t.padEnd(30)} ${c}`);
    }

    if (dryRun) {
      warn("\nDry run complete — nothing written.");
      return;
    }

    // ── Confirm ───────────────────────────────────────────────────────────
    const answer = await confirm(
      `\n${YELLOW}${BOLD}  ⚠  This will WIPE the preview DB and replace it with local data.\n  Type "yes" to continue: ${NC}`
    );
    if (answer !== "yes") { warn("Aborted."); return; }

    // ── Wipe preview (reverse order to respect FK constraints) ────────────
    step("2/3  Wiping preview DB...");
    await previewClient.query("SET session_replication_role = replica"); // disable FK checks
    for (const table of [...TABLES].reverse()) {
      await previewClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }
    await previewClient.query("SET session_replication_role = DEFAULT");
    ok("Preview DB wiped");

    // ── Push tables ───────────────────────────────────────────────────────
    step("3/3  Pushing data to preview...");
    await previewClient.query("SET session_replication_role = replica"); // disable FK checks during inserts
    const results = {};
    for (const table of TABLES) {
      if (counts[table] === 0) continue;
      const n = await copyTable(localClient, previewClient, table);
      results[table] = n;
      ok(`${table.padEnd(30)} ${n} row(s)`);
    }

    await previewClient.query("SET session_replication_role = DEFAULT");
    const pushedTotal = Object.values(results).reduce((a, b) => a + b, 0);
    log(`\n${GREEN}${BOLD}🎉 Push complete! ${pushedTotal} rows pushed to preview.${NC}`);

  } finally {
    await localClient.end();
    await previewClient.end();
  }
}

main().catch((err) => {
  console.error(`\n${RED}❌ Push failed:${NC}`, err);
  process.exit(1);
}); 
