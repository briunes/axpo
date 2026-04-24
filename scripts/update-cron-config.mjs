#!/usr/bin/env node

/**
 * Update existing system configuration with cron settings
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating system configuration with cron settings...");

  const config = await prisma.systemConfig.findFirst();

  if (!config) {
    console.log("No system configuration found. Creating default configuration...");
    await prisma.systemConfig.create({
      data: {
        cronExpirationEnabled: true,
        cronExpirationSchedule: "0 2 * * *",
        cronExpirationTimezone: "UTC",
      },
    });
    console.log("✅ System configuration created with cron settings");
  } else {
    console.log("Updating existing configuration...");
    await prisma.systemConfig.update({
      where: { id: config.id },
      data: {
        cronExpirationEnabled: config.cronExpirationEnabled ?? true,
        cronExpirationSchedule: config.cronExpirationSchedule ?? "0 2 * * *",
        cronExpirationTimezone: config.cronExpirationTimezone ?? "UTC",
      },
    });
    console.log("✅ System configuration updated with cron settings");
  }

  console.log("\nCurrent cron configuration:");
  const updated = await prisma.systemConfig.findFirst({
    select: {
      cronExpirationEnabled: true,
      cronExpirationSchedule: true,
      cronExpirationTimezone: true,
    },
  });
  console.log(updated);
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
