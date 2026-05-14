/**
 * push-simulations-to-preview.mjs
 *
 * Wipes simulations on the Supabase preview DB and replaces them
 * with everything from the local database.
 *
 * Usage:
 *   node scripts/push-simulations-to-preview.mjs
 *   node scripts/push-simulations-to-preview.mjs --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read preview DATABASE_URL from ../.env.preview ────────────────────────
const envPath = resolve(__dirname, "../.env.preview");
let previewUrl;
try {
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^(?!#)DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.preview");
  previewUrl = match[1].trim().replace(/^['"]|['"]$/g, "");
} catch (err) {
  console.error(`❌ Could not read .env.preview at ${envPath}:`, err.message);
  process.exit(1);
}

// ── CLI args ──────────────────────────────────────────────────────────────
const dryRun = process.argv.includes("--dry-run");

// ── DB clients ────────────────────────────────────────────────────────────
const localDb = new PrismaClient({
  datasources: { db: { url: "postgresql://axpo:axpo_dev_password@localhost:5432/axpo_simulator" } },
});

const previewDb = new PrismaClient({
  datasources: { db: { url: previewUrl } },
});

// ── Helpers ───────────────────────────────────────────────────────────────
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
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
  log(`${BOLD}  🚀  Push Simulations: Local → Preview${NC}`);
  log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);

  if (dryRun) warn("DRY RUN — no data will be written");

  // ── Fetch from local ────────────────────────────────────────────────────
  step("1/4  Fetching simulations from local DB...");

  const simulations = await localDb.simulation.findMany({
    include: { versions: true },
    orderBy: { createdAt: "asc" },
  });

  log(`  Found ${BOLD}${simulations.length}${NC} simulation(s) locally`);

  if (simulations.length === 0) {
    warn("Nothing to push. Exiting.");
    return;
  }

  if (dryRun) {
    log(`\n  Would wipe preview simulations and push ${simulations.length} simulation(s).`);
    simulations.forEach((s) => {
      log(`    - [${s.referenceNumber ?? s.id}] (${s.status}) — ${s.versions.length} version(s)`);
    });
    warn("Dry run complete — nothing written.");
    return;
  }

  // ── Confirm ─────────────────────────────────────────────────────────────
  const [previewCount] = await previewDb.$queryRawUnsafe(`SELECT COUNT(*) FROM simulations`);
  log(`\n  Preview currently has ${BOLD}${previewCount.count}${NC} simulation(s).`);
  const answer = await confirm(`\n${YELLOW}${BOLD}  ⚠  This will WIPE all preview simulations and replace them with local data.\n  Type "yes" to continue: ${NC}`);
  if (answer !== "yes") {
    warn("Aborted.");
    return;
  }

  // ── Wipe preview simulations ────────────────────────────────────────────
  step("2/4  Clearing preview simulations...");
  await previewDb.$executeRaw`TRUNCATE TABLE "simulation_versions" CASCADE`;
  await previewDb.$executeRaw`TRUNCATE TABLE "simulations" CASCADE`;
  ok("Preview simulations and versions cleared");

  // ── Ensure foreign-key dependencies exist on preview ───────────────────
  step("3/4  Ensuring foreign-key dependencies exist on preview...");

  const clientIds = [...new Set(simulations.map((s) => s.clientId).filter(Boolean))];
  const userIds   = [...new Set(simulations.map((s) => s.ownerUserId).filter(Boolean))];
  const agencyIds = [...new Set(simulations.map((s) => s.agencyId).filter(Boolean))];

  // Agencies
  let missingAgencies = 0;
  for (const agencyId of agencyIds) {
    const [exists] = await previewDb.$queryRawUnsafe(`SELECT id FROM agencies WHERE id = $1`, agencyId);
    if (!exists) {
      const src = await localDb.agency.findUnique({ where: { id: agencyId } });
      if (src) {
        const cols = Object.keys(src).map((c) => `"${c}"`).join(", ");
        const vals = Object.values(src);
        const ph   = vals.map((_, i) => `$${i + 1}`).join(", ");
        await previewDb.$queryRawUnsafe(`INSERT INTO agencies (${cols}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING`, ...vals);
        missingAgencies++;
      }
    }
  }
  if (missingAgencies) ok(`Pushed ${missingAgencies} missing agenc(y/ies)`);

  // Users
  let missingUsers = 0;
  for (const userId of userIds) {
    const [exists] = await previewDb.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1`, userId);
    if (!exists) {
      const src = await localDb.user.findUnique({ where: { id: userId } });
      if (src) {
        const data = { ...src, createdByUserId: null, updatedByUserId: null };
        const cols = Object.keys(data).map((c) => `"${c}"`).join(", ");
        const vals = Object.values(data);
        const ph   = vals.map((_, i) => `$${i + 1}`).join(", ");
        await previewDb.$queryRawUnsafe(`INSERT INTO users (${cols}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING`, ...vals);
        missingUsers++;
      }
    }
  }
  if (missingUsers) ok(`Pushed ${missingUsers} missing user(s)`);

  // Clients
  let missingClients = 0;
  for (const clientId of clientIds) {
    const [exists] = await previewDb.$queryRawUnsafe(`SELECT id FROM clients WHERE id = $1`, clientId);
    if (!exists) {
      const src = await localDb.client.findUnique({ where: { id: clientId } });
      if (src) {
        const cols = Object.keys(src).map((c) => `"${c}"`).join(", ");
        const vals = Object.values(src);
        const ph   = vals.map((_, i) => `$${i + 1}`).join(", ");
        await previewDb.$queryRawUnsafe(`INSERT INTO clients (${cols}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING`, ...vals);
        missingClients++;
      }
    }
  }
  if (missingClients) ok(`Pushed ${missingClients} missing client(s)`);

  // ── Push simulations & versions ─────────────────────────────────────────
  step("4/4  Pushing simulations & versions to preview...");

  let pushed = 0;
  let versionsPushed = 0;

  for (const sim of simulations) {
    const { versions, ...simData } = sim;

    // Insert simulation using only columns that exist on preview
    await previewDb.$queryRawUnsafe(
      `INSERT INTO simulations (
         id, "agencyId", "ownerUserId", status, "expiresAt", "publicToken",
         "pinHashSnapshot", "isDeleted", "deletedAt", "sharedAt", "createdAt",
         "updatedAt", "clientId", "pinSnapshot", "invoiceFilePath", "invoiceFileData",
         "invoiceFileMimeType", "invoiceFileName", "invoiceFileSize",
         "clientOpenedAt", "sharedVia", "referenceNumber"
       ) VALUES ($1,$2,$3,$4::\"SimulationStatus\",$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      simData.id, simData.agencyId ?? null, simData.ownerUserId ?? null,
      simData.status, simData.expiresAt ?? null, simData.publicToken ?? null,
      simData.pinHashSnapshot ?? null, simData.isDeleted ?? false,
      simData.deletedAt ?? null, simData.sharedAt ?? null,
      simData.createdAt, simData.updatedAt,
      simData.clientId ?? null, simData.pinSnapshot ?? null,
      simData.invoiceFilePath ?? null, simData.invoiceFileData ?? null,
      simData.invoiceFileMimeType ?? null, simData.invoiceFileName ?? null,
      simData.invoiceFileSize ?? null, simData.clientOpenedAt ?? null,
      simData.sharedVia ?? null, simData.referenceNumber ?? null
    );
    pushed++;

    // Insert versions using preview schema columns
    for (const version of versions) {
      await previewDb.$queryRawUnsafe(
        `INSERT INTO simulation_versions (id, "simulationId", "payloadJson", "baseValueSetId", "createdBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        version.id,
        version.simulationId,
        version.payloadJson ?? null,
        version.baseValueSetId ?? null,
        version.createdByUserId ?? null,
        version.createdAt
      );
      versionsPushed++;
    }
  }

  log("");
  ok(`Pushed   : ${pushed} simulation(s)`);
  ok(`Versions : ${versionsPushed} version(s) pushed`);

  log(`\n${GREEN}${BOLD}🎉 Push complete!${NC}`);
  log(`   Preview now has ${pushed} simulation(s) from local.`);
}

main()
  .catch((err) => {
    console.error(`\n${RED}❌ Push failed:${NC}`, err);
    process.exit(1);
  })
  .finally(async () => {
    await localDb.$disconnect();
    await previewDb.$disconnect();
  });
