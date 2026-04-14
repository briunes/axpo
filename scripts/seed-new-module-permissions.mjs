import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const newPerms = [
  // ── Client actions ─────────────────────────────────────────────────────
  { role: "AGENT", key: "clients.view", allowed: true },
  { role: "AGENT", key: "clients.create", allowed: true },
  { role: "AGENT", key: "clients.edit", allowed: true },
  { role: "AGENT", key: "clients.delete", allowed: false },
  { role: "COMMERCIAL", key: "clients.view", allowed: true },
  { role: "COMMERCIAL", key: "clients.create", allowed: false },
  { role: "COMMERCIAL", key: "clients.edit", allowed: false },
  { role: "COMMERCIAL", key: "clients.delete", allowed: false },
  // ── User management ────────────────────────────────────────────────────
  { role: "AGENT", key: "users.view", allowed: false },
  { role: "AGENT", key: "users.create", allowed: false },
  { role: "AGENT", key: "users.edit", allowed: false },
  { role: "AGENT", key: "users.deactivate", allowed: false },
  { role: "COMMERCIAL", key: "users.view", allowed: false },
  { role: "COMMERCIAL", key: "users.create", allowed: false },
  { role: "COMMERCIAL", key: "users.edit", allowed: false },
  { role: "COMMERCIAL", key: "users.deactivate", allowed: false },
  // ── Agency management ──────────────────────────────────────────────────
  { role: "AGENT", key: "agencies.view", allowed: false },
  { role: "AGENT", key: "agencies.create", allowed: false },
  { role: "AGENT", key: "agencies.edit", allowed: false },
  { role: "AGENT", key: "agencies.deactivate", allowed: false },
  { role: "COMMERCIAL", key: "agencies.view", allowed: false },
  { role: "COMMERCIAL", key: "agencies.create", allowed: false },
  { role: "COMMERCIAL", key: "agencies.edit", allowed: false },
  { role: "COMMERCIAL", key: "agencies.deactivate", allowed: false },
];

async function main() {
  let seeded = 0;
  for (const p of newPerms) {
    await prisma.rolePermission.upsert({
      where: { role_permissionKey: { role: p.role, permissionKey: p.key } },
      update: { allowed: p.allowed },
      create: { role: p.role, permissionKey: p.key, allowed: p.allowed },
    });
    seeded++;
  }
  console.log(`✅ Seeded ${seeded} new module permission records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
