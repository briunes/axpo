/**
 * Copy data from preview database to local database
 * One-time operation to initialize local dev environment
 */

import { PrismaClient } from "@prisma/client";

// Preview database
const previewDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.phgcujuexybguiducwcs:LPhwzkppwZhPmjjO@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    },
  },
});

// Local database
const localDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://axpo:axpo_dev_password@localhost:5432/axpo_simulator",
    },
  },
});

async function main() {
  console.log("🚀 Starting database copy from preview to local...\n");

  try {
    // 1. Clear local database (except migrations)
    console.log("1️⃣  Clearing local database...");
    await localDb.$executeRaw`TRUNCATE TABLE "email_logs" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "audit_logs" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "simulation_versions" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "simulations" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "access_attempts" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "clients" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "base_value_items" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "base_value_sets" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "agencies" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "role_permissions" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "email_templates" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "pdf_templates" CASCADE`;
    await localDb.$executeRaw`TRUNCATE TABLE "system_config" CASCADE`;
    console.log("   ✅ Local database cleared\n");

    // 2. Copy System Config
    console.log("2️⃣  Copying system configuration...");
    const systemConfigs = await previewDb.systemConfig.findMany();
    for (const config of systemConfigs) {
      await localDb.systemConfig.create({ data: config });
    }
    console.log(`   ✅ Copied ${systemConfigs.length} system config(s)\n`);

    // 3. Copy Role Permissions
    console.log("3️⃣  Copying role permissions...");
    const permissions = await previewDb.rolePermission.findMany();
    for (const perm of permissions) {
      await localDb.rolePermission.create({ data: perm });
    }
    console.log(`   ✅ Copied ${permissions.length} permissions\n`);

    // 4. Copy Email Templates
    console.log("4️⃣  Copying email templates...");
    const emailTemplates = await previewDb.emailTemplate.findMany();
    for (const template of emailTemplates) {
      await localDb.emailTemplate.create({ data: template });
    }
    console.log(`   ✅ Copied ${emailTemplates.length} email template(s)\n`);

    // 5. Copy PDF Templates
    console.log("5️⃣  Copying PDF templates...");
    const pdfTemplates = await previewDb.pdfTemplate.findMany();
    for (const template of pdfTemplates) {
      await localDb.pdfTemplate.create({ data: template });
    }
    console.log(`   ✅ Copied ${pdfTemplates.length} PDF template(s)\n`);

    // 6. Copy Agencies
    console.log("6️⃣  Copying agencies...");
    const agencies = await previewDb.agency.findMany();
    for (const agency of agencies) {
      await localDb.agency.create({ data: agency });
    }
    console.log(`   ✅ Copied ${agencies.length} agency/agencies\n`);

    // 7. Copy Users (preserving relationships)
    console.log("8️⃣  Copying users...");
    const users = await previewDb.user.findMany();
    
    // First pass: create users without relationships
    for (const user of users) {
      const { createdByUserId, updatedByUserId, ...userData } = user;
      await localDb.user.create({
        data: {
          ...userData,
          createdByUserId: null,
          updatedByUserId: null,
        },
      });
    }
    
    // Second pass: update relationships
    for (const user of users) {
      if (user.createdByUserId || user.updatedByUserId) {
        await localDb.user.update({
          where: { id: user.id },
          data: {
            createdByUserId: user.createdByUserId,
            updatedByUserId: user.updatedByUserId,
          },
        });
      }
    }
    console.log(`   ✅ Copied ${users.length} user(s)\n`);

    // 8. Copy Base Value Sets & Items
    console.log("8️⃣  Copying base value sets...");
    const baseValueSets = await previewDb.baseValueSet.findMany({
      include: { items: true },
    });
    
    for (const set of baseValueSets) {
      const { items, ...setData } = set;
      const newSet = await localDb.baseValueSet.create({ data: setData });
      
      // Copy items
      for (const item of items) {
        const { id, ...itemData } = item;
        await localDb.baseValueItem.create({
          data: {
            ...itemData,
            baseValueSetId: newSet.id,
          },
        });
      }
    }
    console.log(`   ✅ Copied ${baseValueSets.length} base value set(s)\n`);

    // 9. Copy Clients
    console.log("9️⃣  Copying clients...");
    const clients = await previewDb.client.findMany();
    for (const client of clients) {
      await localDb.client.create({ data: client });
    }
    console.log(`   ✅ Copied ${clients.length} client(s)\n`);

    // 10. Copy Simulations
    console.log("🔟 Copying simulations...");
    const simulations = await previewDb.simulation.findMany({
      include: { versions: true },
    });
    
    for (const sim of simulations) {
      const { versions, ...simData } = sim;
      const newSim = await localDb.simulation.create({ data: simData });
      
      // Copy versions
      for (const version of versions) {
        const { id, ...versionData } = version;
        await localDb.simulationVersion.create({
          data: {
            ...versionData,
            simulationId: newSim.id,
          },
        });
      }
    }
    console.log(`   ✅ Copied ${simulations.length} simulation(s)\n`);

    // 11. Copy Audit Logs
    console.log("1️⃣1️⃣  Copying audit logs...");
    const auditLogs = await previewDb.auditLog.findMany();
    for (const log of auditLogs) {
      await localDb.auditLog.create({ data: log });
    }
    console.log(`   ✅ Copied ${auditLogs.length} audit log(s)\n`);

    // 12. Copy Email Logs
    console.log("1️⃣2️⃣  Copying email logs...");
    const emailLogs = await previewDb.emailLog.findMany();
    for (const log of emailLogs) {
      await localDb.emailLog.create({ data: log });
    }
    console.log(`   ✅ Copied ${emailLogs.length} email log(s)\n`);

    // 13. Copy Access Attempts
    console.log("1️⃣3️⃣  Copying access attempts...");
    const accessAttempts = await previewDb.accessAttempt.findMany();
    for (const attempt of accessAttempts) {
      await localDb.accessAttempt.create({ data: attempt });
    }
    console.log(`   ✅ Copied ${accessAttempts.length} access attempt(s)\n`);

    console.log("🎉 Database copy completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Agencies: ${agencies.length}`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Clients: ${clients.length}`);
    console.log(`   - Simulations: ${simulations.length}`);
    console.log(`   - Base Value Sets: ${baseValueSets.length}`);
    console.log(`   - Email Templates: ${emailTemplates.length}`);
    console.log(`   - PDF Templates: ${pdfTemplates.length}`);
    console.log(`   - Permissions: ${permissions.length}`);
    console.log(`   - Audit Logs: ${auditLogs.length}`);
    console.log(`   - Email Logs: ${emailLogs.length}`);
    console.log("\n✅ Your local database now has all the preview data!");

  } catch (error) {
    console.error("❌ Error copying database:", error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await previewDb.$disconnect();
    await localDb.$disconnect();
  });
