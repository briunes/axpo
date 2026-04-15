import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

let agency = await prisma.agency.findFirst({ where: { name: "AXPO Seed Agency" } });
if (!agency) {
  agency = await prisma.agency.create({ data: { name: "AXPO Seed Agency", isActive: true } });
} else {
  agency = await prisma.agency.update({ where: { id: agency.id }, data: { isActive: true } });
}

const [adminPin, agentPin, commercialPin, adminPw, agentPw, commercialPw] = await Promise.all([
  bcrypt.hash("1234", 10),
  bcrypt.hash("2345", 10),
  bcrypt.hash("3456", 10),
  bcrypt.hash("AxpoAdmin#2026", 10),
  bcrypt.hash("AxpoAgent#2026", 10),
  bcrypt.hash("AxpoCommercial#2026", 10),
]);

await prisma.user.upsert({
  where: { email: "admin@axpo.local" },
  update: { fullName: "Seed Admin", role: "ADMIN", agencyId: agency.id, passwordHash: adminPw, pinHash: adminPin, isActive: true },
  create: { fullName: "Seed Admin", role: "ADMIN", agencyId: agency.id, email: "admin@axpo.local", passwordHash: adminPw, pinHash: adminPin, isActive: true },
});

await prisma.user.upsert({
  where: { email: "agent@axpo.local" },
  update: { fullName: "Seed Agent", role: "AGENT", agencyId: agency.id, passwordHash: agentPw, pinHash: agentPin, isActive: true },
  create: { fullName: "Seed Agent", role: "AGENT", agencyId: agency.id, email: "agent@axpo.local", passwordHash: agentPw, pinHash: agentPin, isActive: true },
});

await prisma.user.upsert({
  where: { email: "commercial@axpo.local" },
  update: { fullName: "Seed Commercial", role: "COMMERCIAL", agencyId: agency.id, passwordHash: commercialPw, pinHash: commercialPin, isActive: true },
  create: { fullName: "Seed Commercial", role: "COMMERCIAL", agencyId: agency.id, email: "commercial@axpo.local", passwordHash: commercialPw, pinHash: commercialPin, isActive: true },
});

console.log("seeded_prod=OK");
await prisma.$disconnect();
