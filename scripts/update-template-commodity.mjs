/**
 * update-template-commodity.mjs
 *
 * Updates existing PDF templates to set commodity field to "BOTH" if not already set.
 * Run with:
 *   node scripts/update-template-commodity.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating PDF templates with commodity field...");

  // Update all templates without a commodity to "ELECTRICITY"
  const result = await prisma.pdfTemplate.updateMany({
    where: {
      commodity: null,
    },
    data: {
      commodity: "ELECTRICITY",
    },
  });

  console.log(`✓ Updated ${result.count} template(s) to commodity "ELECTRICITY"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
