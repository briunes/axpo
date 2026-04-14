import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const defaults = [
  { role: 'AGENT', permissionKey: 'section.simulations', allowed: true },
  { role: 'AGENT', permissionKey: 'section.users', allowed: false },
  { role: 'AGENT', permissionKey: 'section.agencies', allowed: false },
  { role: 'AGENT', permissionKey: 'section.clients', allowed: true },
  { role: 'AGENT', permissionKey: 'section.base-values', allowed: true },
  { role: 'AGENT', permissionKey: 'section.audit-logs', allowed: true },
  { role: 'AGENT', permissionKey: 'section.analytics', allowed: true },
  { role: 'AGENT', permissionKey: 'section.configurations', allowed: false },
  { role: 'AGENT', permissionKey: 'simulations.create', allowed: true },
  { role: 'AGENT', permissionKey: 'simulations.share', allowed: true },
  { role: 'AGENT', permissionKey: 'simulations.duplicate', allowed: true },
  { role: 'AGENT', permissionKey: 'simulations.archive', allowed: true },
  { role: 'AGENT', permissionKey: 'simulations.delete', allowed: false },
  { role: 'AGENT', permissionKey: 'simulations.edit_payload', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'section.simulations', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'section.users', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.agencies', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.clients', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.base-values', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.audit-logs', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.analytics', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'section.configurations', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'simulations.create', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'simulations.share', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'simulations.duplicate', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'simulations.archive', allowed: true },
  { role: 'COMMERCIAL', permissionKey: 'simulations.delete', allowed: false },
  { role: 'COMMERCIAL', permissionKey: 'simulations.edit_payload', allowed: true },
];

async function seed() {
  for (const d of defaults) {
    await prisma.rolePermission.upsert({
      where: { role_permissionKey: { role: d.role, permissionKey: d.permissionKey } },
      update: { allowed: d.allowed },
      create: d,
    });
  }
  console.log('Seeded', defaults.length, 'role permission records');
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
