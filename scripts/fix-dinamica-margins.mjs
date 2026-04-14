import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_VALUE_SET_ID = "cmnsq30ox00157qdpp4llrsxi";

const TARIFF_PERIODS = {
  "2.0TD": ["P1", "P2", "P3"],
  "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
  "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

const PRODUCTS = {
  "DINAMICA:N1": 0.030,
  "DINAMICA:N2": 0.01399,
  "DINAMICA:N3": 0.009,
};

const updates = [];
for (const [productKey, value] of Object.entries(PRODUCTS)) {
  const [product, tier] = productKey.split(":");
  for (const [tariff, periods] of Object.entries(TARIFF_PERIODS)) {
    for (const period of periods) {
      updates.push({
        key: `ELEC:INDEX:${product}:${tier}:${tariff}:${period}:MARGEN`,
        value,
      });
    }
  }
}

console.log(`Updating ${updates.length} margin items...`);

const results = await Promise.all(
  updates.map((u) =>
    prisma.baseValueItem.updateMany({
      where: { baseValueSetId: BASE_VALUE_SET_ID, key: u.key },
      data: { valueNumeric: u.value },
    })
  )
);

const total = results.reduce((s, r) => s + r.count, 0);
console.log(`Done — updated ${total} items`);
console.log("  DINAMICA:N1 → 0.030 €/kWh (all periods)");
console.log("  DINAMICA:N2 → 0.01399 €/kWh (all periods)");
console.log("  DINAMICA:N3 → 0.009 €/kWh (all periods)");

await prisma.$disconnect();
