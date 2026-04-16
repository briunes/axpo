#!/usr/bin/env node
/**
 * Seed email-logs section permission for all roles
 * Run this after adding the email logs feature
 */

import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Seeding email-logs section permission...\n");

  const permissions = [
    {
      id: "rp_admin_sec_email_logs",
      role: UserRole.ADMIN,
      permissionKey: "section.email-logs",
      allowed: true,
    },
    {
      id: "rp_agent_sec_email_logs",
      role: UserRole.AGENT,
      permissionKey: "section.email-logs",
      allowed: false,
    },
    {
      id: "rp_commercial_sec_email_logs",
      role: UserRole.COMMERCIAL,
      permissionKey: "section.email-logs",
      allowed: false,
    },
  ];

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { id: perm.id },
      update: {
        allowed: perm.allowed,
      },
      create: perm,
    });
    console.log(`✅ ${perm.role}: section.email-logs = ${perm.allowed}`);
  }

  console.log("\n✨ Email logs permission seeded successfully!");
  console.log("   Admins can now access the Email Logs section.");
  console.log("   You can configure other role permissions via the Configurations UI.");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
