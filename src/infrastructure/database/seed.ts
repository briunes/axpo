import { PrismaClient, UserRole } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PinService } = require("../../application/services/pinService");
const { PasswordService } = require("../../application/services/passwordService");

const prisma = new PrismaClient();

async function main() {
  const agency = await prisma.agency.upsert({
    where: { id: "seed-agency-main" },
    update: { name: "AXPO Seed Agency", isActive: true },
    create: {
      id: "seed-agency-main",
      name: "AXPO Seed Agency",
      isActive: true,
    },
  });

  const adminPin = await PinService.hash("1234");
  const agentPin = await PinService.hash("2345");
  const commercialPin = await PinService.hash("3456");

  const adminPassword = await PasswordService.hash("AxpoAdmin#2026");
  const agentPassword = await PasswordService.hash("AxpoAgent#2026");
  const commercialPassword = await PasswordService.hash("AxpoCommercial#2026");

  await prisma.user.upsert({
    where: { email: "admin@axpo.local" },
    update: {
      fullName: "Seed Admin",
      role: UserRole.ADMIN,
      agencyId: agency.id,
      passwordHash: adminPassword,
      pinHash: adminPin,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.ADMIN,
      fullName: "Seed Admin",
      email: "admin@axpo.local",
      passwordHash: adminPassword,
      pinHash: adminPin,
    },
  });

  await prisma.user.upsert({
    where: { email: "agent@axpo.local" },
    update: {
      fullName: "Seed Agent",
      role: UserRole.AGENT,
      agencyId: agency.id,
      passwordHash: agentPassword,
      pinHash: agentPin,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.AGENT,
      fullName: "Seed Agent",
      email: "agent@axpo.local",
      passwordHash: agentPassword,
      pinHash: agentPin,
    },
  });

  await prisma.user.upsert({
    where: { email: "commercial@axpo.local" },
    update: {
      fullName: "Seed Commercial",
      role: UserRole.COMMERCIAL,
      agencyId: agency.id,
      passwordHash: commercialPassword,
      pinHash: commercialPin,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.COMMERCIAL,
      fullName: "Seed Commercial",
      email: "commercial@axpo.local",
      passwordHash: commercialPassword,
      pinHash: commercialPin,
    },
  });

  console.log("Seed completed: agency + admin/agent/commercial users created with password auth");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
