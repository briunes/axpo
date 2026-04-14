/**
 * Migrates existing templates from old camelCase variables to the new
 * uppercase {{VARIABLE}} format, and inserts any missing variable definitions.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping from old camelCase → new UPPER_SNAKE_CASE
const VAR_MAP: Record<string, string> = {
  clientName: "CLIENT_NAME",
  contactPerson: "CONTACT_PERSON",
  simulationCode: "SIMULATION_ID",
  simulationLink: "SIMULATION_LINK",
  productName: "PRODUCT_NAME",
  totalCost: "AXPO_TOTAL",
  pin: "PIN",
  expirationDays: "EXPIRES_IN_DAYS",
  commercialName: "OWNER_NAME",
  commercialEmail: "OWNER_EMAIL",
  commercialPhone: "OWNER_PHONE",
  userName: "OWNER_NAME",
  userEmail: "OWNER_EMAIL",
  magicLink: "MAGIC_LINK",
};

// Variables that are missing from the DB and need to be inserted
const MISSING_VARIABLES = [
  {
    key: "CONTACT_PERSON",
    label: "Contact Person",
    description: "Client contact person name",
    category: "client",
    example: "Juan García",
    sortOrder: 25,
  },
  {
    key: "SIMULATION_LINK",
    label: "Simulation Link",
    description: "Public URL for the client to view the simulation",
    category: "simulation",
    example: "https://app.axpo.com/s/abc123",
    sortOrder: 150,
  },
  {
    key: "PIN",
    label: "Access PIN",
    description: "PIN code required to access the simulation",
    category: "simulation",
    example: "4829",
    sortOrder: 160,
  },
  {
    key: "EXPIRES_IN_DAYS",
    label: "Expires In (Days)",
    description: "Number of days until the simulation expires",
    category: "simulation",
    example: "30",
    sortOrder: 170,
  },
  {
    key: "OWNER_PHONE",
    label: "Owner Phone",
    description: "Simulation owner / commercial phone number",
    category: "user",
    example: "+34 600 123 456",
    sortOrder: 220,
  },
  {
    key: "MAGIC_LINK",
    label: "Magic Link",
    description: "One-time login link for internal users",
    category: "user",
    example: "https://app.axpo.com/auth/magic/xyz",
    sortOrder: 230,
  },
];

function migrateVars(html: string): string {
  let result = html;
  for (const [old, newKey] of Object.entries(VAR_MAP)) {
    // Replace both {{camelCase}} and any stray {camelCase} patterns
    result = result.replace(
      new RegExp(`\\{\\{${old}\\}\\}`, "g"),
      `{{${newKey}}}`,
    );
    result = result.replace(new RegExp(`\\{${old}\\}`, "g"), `{{${newKey}}}`);
  }
  return result;
}

async function main() {
  console.log("──────────────────────────────────────────────");
  console.log("  Template variable migration");
  console.log("──────────────────────────────────────────────\n");

  // 1. Insert missing variable definitions
  console.log("📦 Inserting missing variable definitions…");
  for (const v of MISSING_VARIABLES) {
    const existing = await prisma.templateVariable.findUnique({
      where: { key: v.key },
    });
    if (existing) {
      console.log(`  ⚠  ${v.key} already exists – skipped`);
    } else {
      await prisma.templateVariable.create({ data: { ...v, active: true } });
      console.log(`  ✅ Created: ${v.key} (${v.label})`);
    }
  }

  // 2. Migrate PDF templates
  console.log("\n📄 Migrating PDF templates…");
  const pdfTemplates = await prisma.pdfTemplate.findMany();
  for (const t of pdfTemplates) {
    const migrated = migrateVars(t.htmlContent);
    if (migrated !== t.htmlContent) {
      await prisma.pdfTemplate.update({
        where: { id: t.id },
        data: { htmlContent: migrated },
      });
      console.log(`  ✅ Updated: "${t.name}" (${t.id})`);
      // Show what changed
      const oldVars = [...t.htmlContent.matchAll(/\{\{(\w+)\}\}/g)].map(
        (m) => m[1],
      );
      const newVars = [...migrated.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      console.log(`     Before: ${[...new Set(oldVars)].join(", ")}`);
      console.log(`     After:  ${[...new Set(newVars)].join(", ")}`);
    } else {
      console.log(`  — No changes: "${t.name}"`);
    }
  }

  // 3. Migrate Email templates
  console.log("\n📧 Migrating Email templates…");
  const emailTemplates = await prisma.emailTemplate.findMany();
  for (const t of emailTemplates) {
    const migratedHtml = migrateVars(t.htmlContent);
    const migratedSubject = migrateVars(t.subject);
    if (migratedHtml !== t.htmlContent || migratedSubject !== t.subject) {
      await prisma.emailTemplate.update({
        where: { id: t.id },
        data: { htmlContent: migratedHtml, subject: migratedSubject },
      });
      console.log(`  ✅ Updated: "${t.name}" (${t.id})`);
      const oldVars = [
        ...(t.htmlContent + t.subject).matchAll(/\{\{(\w+)\}\}/g),
      ].map((m) => m[1]);
      const newVars = [
        ...(migratedHtml + migratedSubject).matchAll(/\{\{(\w+)\}\}/g),
      ].map((m) => m[1]);
      console.log(`     Before: ${[...new Set(oldVars)].join(", ")}`);
      console.log(`     After:  ${[...new Set(newVars)].join(", ")}`);
    } else {
      console.log(`  — No changes: "${t.name}"`);
    }
  }

  console.log("\n✅ Migration complete.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
