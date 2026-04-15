/**
 * db-demo-cleanup.mjs
 *
 * Cleans up transient demo/test data so the app is ready for a fresh demo:
 *   ✅  Deletes ALL simulations  (cascades to versions & access attempts)
 *   ✅  Deletes ALL clients
 *   🔒  Does NOT touch base values, agencies, users, or system config
 *
 * Usage:
 *   pnpm db:demo-cleanup            ← dry run (shows what would be deleted)
 *   pnpm db:demo-cleanup -- --force ← actually deletes data
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");

async function main() {
  // ── Count what exists ──────────────────────────────────────────────────────
  const [simulationCount, clientCount] = await Promise.all([
    prisma.simulation.count(),
    prisma.client.count(),
  ]);

  console.log("🧹  Demo Cleanup");
  console.log("─".repeat(40));
  console.log(`   Simulations : ${simulationCount}`);
  console.log(`   Clients     : ${clientCount}`);
  console.log("─".repeat(40));
  console.log("   Base values, agencies, users → untouched");
  console.log("");

  if (simulationCount === 0 && clientCount === 0) {
    console.log("✅  Nothing to clean up — database is already empty of demo data.");
    return;
  }

  if (!FORCE) {
    console.log("⚠️   DRY RUN — no data was deleted.");
    console.log("    Run with --force to actually delete:");
    console.log("    pnpm db:demo-cleanup -- --force\n");
    return;
  }

  // ── Delete simulations first (cascades to simulation_versions & access_attempts)
  const deletedSims = await prisma.simulation.deleteMany({});
  console.log(`🗑️   Deleted ${deletedSims.count} simulation(s)  (versions & access attempts cascaded)`);

  // ── Delete clients ─────────────────────────────────────────────────────────
  const deletedClients = await prisma.client.deleteMany({});
  console.log(`🗑️   Deleted ${deletedClients.count} client(s)`);

  console.log("");
  console.log("✅  Demo cleanup complete.");
  console.log("    Run 'pnpm db:seed' to re-seed demo clients if needed.");
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
