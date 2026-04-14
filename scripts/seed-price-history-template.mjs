/**
 * seed-price-history-template.mjs
 *
 * Upserts the default "Price History" PDF template into the database.
 * Run with:
 *   node scripts/seed-price-history-template.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const htmlContent = readFileSync(
  join(__dirname, "price-history-template.html"),
  "utf-8",
);

async function main() {
  const existing = await prisma.pdfTemplate.findFirst({
    where: { type: "price-history", name: "Histórico Indexado — Plantilla AXPO" },
  });

  if (existing) {
    await prisma.pdfTemplate.update({
      where: { id: existing.id },
      data: { htmlContent, active: true },
    });
    console.log("✓ Price-history template updated.");
  } else {
    await prisma.pdfTemplate.create({
      data: {
        name: "Histórico Indexado — Plantilla AXPO",
        description:
          "Histórico de márgenes indexados últimos 12 meses. Usa {{HISTORY_TABLES}} para insertar las tablas de todas las tarifas, o {{HISTORY_TABLE_2TD}} / {{HISTORY_TABLE_3TD}} / {{HISTORY_TABLE_6TD}} para insertar cada tarifa por separado.",
        type: "price-history",
        active: true,
        htmlContent,
      },
    });
    console.log("✓ Price-history template created.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
