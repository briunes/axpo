/**
 * sync-simulations-from-preview.mjs
 *
 * Pulls all simulations (and their versions) from the Supabase preview DB
 * into the local database, without touching any other tables.
 *
 * Usage:
 *   node scripts/sync-simulations-from-preview.mjs
 *
 * Options:
 *   --since YYYY-MM-DD   Only pull simulations updated on or after this date
 *   --dry-run            Print what would be synced without writing anything
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read DATABASE_URL (pooler) from ../.env.preview ──────────────────────
const varsPath = resolve(__dirname, "../.env.preview");
let previewUrl;
try {
  const varsContent = readFileSync(varsPath, "utf-8");
  // Use the first non-commented DATABASE_URL line (pooler, port 6543)
  const match = varsContent.match(/^(?!#)DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.preview");
  previewUrl = match[1].trim().replace(/^['"]|['"]$/g, "");
} catch (err) {
  console.error(`❌ Could not read .env.preview at ${varsPath}:`, err.message);
  process.exit(1);
}

// ── Parse CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const sinceIdx = args.indexOf("--since");
const sinceDate = sinceIdx !== -1 ? new Date(args[sinceIdx + 1]) : null;
const dryRun = args.includes("--dry-run");

if (sinceDate && isNaN(sinceDate.getTime())) {
  console.error("❌ Invalid --since date. Use format: YYYY-MM-DD");
  process.exit(1);
}

// ── DB clients ────────────────────────────────────────────────────────────
const previewDb = new PrismaClient({
  datasources: { db: { url: previewUrl } },
});

const localDb = new PrismaClient({
  datasources: {
    db: { url: "postgresql://axpo:axpo_dev_password@localhost:5432/axpo_simulator" },
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────
const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED   = "\x1b[31m";
const BOLD  = "\x1b[1m";
const NC    = "\x1b[0m";

function log(msg)   { console.log(msg); }
function ok(msg)    { console.log(`${GREEN}  ✔ ${msg}${NC}`); }
function warn(msg)  { console.log(`${YELLOW}  ⚠ ${msg}${NC}`); }
function step(msg)  { console.log(`\n${CYAN}${BOLD}${msg}${NC}`); }

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
  log(`${BOLD}  🔄  Sync Simulations: Preview → Local${NC}`);
  log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);

  if (dryRun)   warn("DRY RUN — no data will be written");
  if (sinceDate) log(`  Filter: simulations updated since ${sinceDate.toISOString().slice(0, 10)}`);

  // ── Fetch from preview ──────────────────────────────────────────────────
  step("1/4  Fetching simulations from preview DB...");

  const where = sinceDate ? { updatedAt: { gte: sinceDate } } : {};
  const simulations = await previewDb.simulation.findMany({
    where,
    include: { versions: true },
    orderBy: { createdAt: "asc" },
  });

  log(`  Found ${BOLD}${simulations.length}${NC} simulation(s) in preview`);
  if (simulations.length === 0) {
    warn("Nothing to import. Exiting.");
    return;
  }

  if (dryRun) {
    log(`\n  Would wipe local simulations and import ${simulations.length} simulation(s) and their versions.`);
    simulations.forEach((s) => {
      log(`    - [${s.referenceNumber ?? s.id}] (${s.status}) — ${s.versions.length} version(s)`);
    });
    warn("Dry run complete — nothing written.");
    return;
  }

  // ── Wipe local simulations ──────────────────────────────────────────────
  step("2/4  Clearing local simulations...");
  await localDb.$executeRaw`TRUNCATE TABLE "simulation_versions" CASCADE`;
  await localDb.$executeRaw`TRUNCATE TABLE "simulations" CASCADE`;
  ok("Local simulations and versions cleared");

  // ── Ensure required foreign keys exist locally ──────────────────────────
  step("3/4  Ensuring foreign-key dependencies exist locally...");

  const clientIds = [...new Set(simulations.map((s) => s.clientId).filter(Boolean))];
  const userIds   = [...new Set(simulations.map((s) => s.ownerUserId).filter(Boolean))];
  const agencyIds = [...new Set(simulations.map((s) => s.agencyId).filter(Boolean))];
  const baseValueSetIds = [...new Set(
    simulations.flatMap((s) => s.versions.map((v) => v.baseValueSetId).filter(Boolean))
  )];

  // Base Value Sets
  let missingBaseValueSets = 0;
  for (const bvsId of baseValueSetIds) {
    const exists = await localDb.baseValueSet.findUnique({ where: { id: bvsId } });
    if (!exists) {
      const src = await previewDb.baseValueSet.findUnique({ where: { id: bvsId } });
      if (src) { await localDb.baseValueSet.create({ data: src }); missingBaseValueSets++; }
    }
  }
  if (missingBaseValueSets) ok(`Imported ${missingBaseValueSets} missing baseValueSet(s)`);

  // Clients
  let missingClients = 0;
  for (const clientId of clientIds) {
    const exists = await localDb.client.findUnique({ where: { id: clientId } });
    if (!exists) {
      const src = await previewDb.client.findUnique({ where: { id: clientId } });
      if (src) { await localDb.client.create({ data: src }); missingClients++; }
    }
  }
  if (missingClients) ok(`Imported ${missingClients} missing client(s)`);

  // Agencies
  let missingAgencies = 0;
  for (const agencyId of agencyIds) {
    const exists = await localDb.agency.findUnique({ where: { id: agencyId } });
    if (!exists) {
      const src = await previewDb.agency.findUnique({ where: { id: agencyId } });
      if (src) { await localDb.agency.create({ data: src }); missingAgencies++; }
    }
  }
  if (missingAgencies) ok(`Imported ${missingAgencies} missing agenc(y/ies)`);

  // Users
  let missingUsers = 0;
  for (const userId of userIds) {
    const exists = await localDb.user.findUnique({ where: { id: userId } });
    if (!exists) {
      const src = await previewDb.user.findUnique({ where: { id: userId } });
      if (src) {
        const { createdByUserId, updatedByUserId, ...userData } = src;
        await localDb.user.create({ data: { ...userData, createdByUserId: null, updatedByUserId: null } });
        missingUsers++;
      }
    }
  }
  if (missingUsers) ok(`Imported ${missingUsers} missing user(s)`);

  // ── Import simulations & versions ──────────────────────────────────────
  step("4/4  Importing simulations & versions locally...");

  let created = 0;
  let versionsCreated = 0;

  for (const sim of simulations) {
    const { versions, ...simData } = sim;
    await localDb.simulation.create({ data: simData });
    created++;

    for (const version of versions) {
      const { id, ...versionData } = version;
      await localDb.simulationVersion.create({ data: { id, ...versionData } });
      versionsCreated++;
    }
  }

  log("");
  ok(`Imported : ${created} simulation(s)`);
  ok(`Versions : ${versionsCreated} version(s) imported`);

  log(`\n${GREEN}${BOLD}🎉 Import complete!${NC}`);
  log(`   Total simulations in local DB: ${created}`);
}

main()
  .catch((err) => {
    console.error(`\n${RED}❌ Sync failed:${NC}`, err);
    process.exit(1);
  })
  .finally(async () => {
    await previewDb.$disconnect();
    await localDb.$disconnect();
  });
