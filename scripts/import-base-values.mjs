/**
 * import-base-values.mjs
 *
 * Reads scripts/base-values-seed.json (produced by parse-xlsm-prices.py)
 * and upserts a BaseValueSet + all BaseValueItems into the database via Prisma.
 *
 * Usage:
 *   set -a && . ./.env.local && set +a
 *   node scripts/import-base-values.mjs
 *
 * Or via package.json script:
 *   pnpm run db:import-prices
 *
 * The script is idempotent: if a set with the same name already exists and
 * --replace flag is passed it will delete all existing items and re-insert.
 * Without --replace it creates a new version.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEED_FILE = resolve(__dirname, "base-values-seed.json");
const REPLACE = process.argv.includes("--replace");
const DRY_RUN = process.argv.includes("--dry-run");

// The createdBy user must exist in the database.
// Falls back to the seed admin user id; override with SEED_ACTOR_ID env var.
const SEED_ACTOR_ID = process.env.SEED_ACTOR_ID ?? "seed-user-admin";

const prisma = new PrismaClient();

async function main() {
  // ── Verify actor exists ───────────────────────────────────────────────────
  const actor = await prisma.user.findUnique({ where: { id: SEED_ACTOR_ID } });
  if (!actor) {
    console.error(`ERROR: Actor user not found: ${SEED_ACTOR_ID}`);
    console.error("Run 'pnpm run db:seed' first, or set SEED_ACTOR_ID to an existing user id.");
    process.exit(1);
  }
  console.log(`Actor: ${actor.fullName} (${actor.id})\n`);

  // ── Read seed file ────────────────────────────────────────────────────────
  let seed;
  try {
    seed = JSON.parse(readFileSync(SEED_FILE, "utf-8"));
  } catch (err) {
    console.error(`ERROR: Could not read ${SEED_FILE}`);
    console.error("Run 'python3 scripts/parse-xlsm-prices.py' first.");
    process.exit(1);
  }

  const { name, scopeType, sourceWorkbookRef, sourceScope, items } = seed;

  console.log(`\nSeed file: ${SEED_FILE}`);
  console.log(`  Name          : ${name}`);
  console.log(`  Scope         : ${scopeType}`);
  console.log(`  Items         : ${items.length}`);
  console.log(`  Replace mode  : ${REPLACE}`);
  console.log(`  Dry run       : ${DRY_RUN}\n`);

  if (DRY_RUN) {
    console.log("Dry run – nothing written to database.");
    printStats(items);
    return;
  }

  // ── Resolve existing set ──────────────────────────────────────────────────
  const existing = await prisma.baseValueSet.findFirst({
    where: { name, scopeType, agencyId: null, isDeleted: false },
    orderBy: { version: "desc" },
  });

  let set;

  if (existing && REPLACE) {
    console.log(
      `Found existing set v${existing.version} (id: ${existing.id}). Replacing items...`
    );
    // Delete all existing items and re-insert in a transaction
    set = existing;
    await prisma.$transaction([
      prisma.baseValueItem.deleteMany({ where: { baseValueSetId: set.id } }),
      prisma.baseValueItem.createMany({
        data: items.map((item) => ({
          baseValueSetId: set.id,
          key: item.key,
          valueNumeric: item.valueNumeric,
          valueText: item.valueText ?? null,
          unit: item.unit ?? null,
        })),
      }),
    ]);
    await prisma.baseValueSet.update({
      where: { id: set.id },
      data: { sourceWorkbookRef, sourceScope, isActive: true },
    });
    console.log(`✓ Replaced ${items.length} items in set ${set.id}`);
  } else {
    // Create a new version
    const nextVersion = existing ? existing.version + 1 : 1;
    if (existing) {
      console.log(
        `Found existing set v${existing.version}. Creating new version v${nextVersion}...`
      );
    } else {
      console.log(`No existing set found. Creating v${nextVersion}...`);
    }

    set = await prisma.baseValueSet.create({
      data: {
        name,
        scopeType,
        agencyId: null,
        sourceWorkbookRef,
        sourceScope,
        version: nextVersion,
        isActive: true,
        createdBy: SEED_ACTOR_ID,
        items: {
          create: items.map((item) => ({
            key: item.key,
            valueNumeric: item.valueNumeric,
            valueText: item.valueText ?? null,
            unit: item.unit ?? null,
          })),
        },
      },
    });

    console.log(`✓ Created BaseValueSet id=${set.id} v${set.version}`);
    console.log(`✓ Inserted ${items.length} BaseValueItems`);
  }

  printStats(items);

  // ── Deactivate older versions ────────────────────────────────────────────
  const deactivated = await prisma.baseValueSet.updateMany({
    where: {
      name,
      scopeType,
      agencyId: null,
      isActive: true,
      id: { not: set.id },
    },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`\n✓ Deactivated ${deactivated.count} older version(s).`);
  }

  console.log(`\nDone. Active set: id=${set.id} version=${set.version}`);
}

function printStats(items) {
  const byPrefix = {};
  for (const item of items) {
    const prefix = item.key.split(":").slice(0, 2).join(":");
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  console.log("\nItem breakdown by category:");
  for (const [prefix, count] of Object.entries(byPrefix).sort()) {
    console.log(`  ${prefix.padEnd(22)} ${count}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
