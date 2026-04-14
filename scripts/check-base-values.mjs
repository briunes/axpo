import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.baseValueItem.findMany({
    where: {
      key: {
        startsWith: "ELEC:INDEX:DINAMICA:N1:2.0TD",
      },
    },
    orderBy: { key: "asc" },
  });

  console.log(`\nFound ${items.length} items for DINAMICA N1 2.0TD:\n`);
  for (const item of items) {
    console.log(`${item.key.padEnd(50)} ${item.valueNumeric} ${item.unit || ""}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
