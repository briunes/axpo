/**
 * seed-template-variable-commodities.mjs
 *
 * 1. Tags existing electricity-only template variables with commodity="ELECTRICITY"
 *    and templateTypes="simulation-output,simulation-detailed"
 * 2. Tags common variables (client, simulation, user) with commodity=null, templateTypes=null
 * 3. Inserts GAS-specific simulation variables
 *
 * Run with:
 *   node scripts/seed-template-variable-commodities.mjs
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

// Keys that are electricity-specific (period breakdown & electricity cost components)
const ELECTRICITY_ONLY_KEYS = [
  // Period data
  "CURRENT_POWER_P1", "CURRENT_POWER_P2", "CURRENT_POWER_P3",
  "CURRENT_POWER_P4", "CURRENT_POWER_P5", "CURRENT_POWER_P6",
  "CURRENT_ENERGY_P1", "CURRENT_ENERGY_P2", "CURRENT_ENERGY_P3",
  "CURRENT_ENERGY_P4", "CURRENT_ENERGY_P5", "CURRENT_ENERGY_P6",
  "AXPO_POWER_P1", "AXPO_POWER_P2", "AXPO_POWER_P3",
  "AXPO_POWER_P4", "AXPO_POWER_P5", "AXPO_POWER_P6",
  "AXPO_ENERGY_P1", "AXPO_ENERGY_P2", "AXPO_ENERGY_P3",
  "AXPO_ENERGY_P4", "AXPO_ENERGY_P5", "AXPO_ENERGY_P6",
  // Electricity cost breakdown
  "CURRENT_POWER_COST", "CURRENT_ENERGY_COST", "CURRENT_EXCESS_COST",
  "CURRENT_RENTAL_COST",
  "AXPO_POWER_COST", "AXPO_ENERGY_COST", "AXPO_EXCESS_COST",
  "AXPO_RENTAL_COST",
  // Electricity consumption
  "ANNUAL_CONSUMPTION",
  // Electricity cups identifier
  "CUPS_NUMBER",
];

// Keys that apply to simulation templates but are commodity-agnostic
const SIMULATION_COMMON_KEYS = [
  "CURRENT_TAX_COST", "CURRENT_OTHER_COST", "CURRENT_VAT", "CURRENT_TOTAL",
  "AXPO_TAX_COST", "AXPO_OTHER_COST", "AXPO_VAT", "AXPO_TOTAL",
  "SAVINGS_AMOUNT", "PRODUCT_NAME",
];

// New GAS-specific simulation variables
const GAS_SIMULATION_VARIABLES = [
  {
    key: "GAS_ANNUAL_CONSUMPTION_KWH",
    label: "Annual Gas Consumption (kWh)",
    description: "Estimated annual gas consumption in kWh",
    category: "calculation",
    example: "45000",
    sortOrder: 300,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "GAS_ANNUAL_CONSUMPTION_M3",
    label: "Annual Gas Consumption (m³)",
    description: "Estimated annual gas consumption in cubic metres",
    category: "calculation",
    example: "4500",
    sortOrder: 301,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "CURRENT_GAS_FIXED_COST",
    label: "Current Gas Fixed Term Cost",
    description: "Current supplier fixed term (capacity) cost (€)",
    category: "calculation",
    example: "450.00",
    sortOrder: 310,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "CURRENT_GAS_VARIABLE_COST",
    label: "Current Gas Variable Term Cost",
    description: "Current supplier variable term (consumption) cost (€)",
    category: "calculation",
    example: "1200.00",
    sortOrder: 311,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "CURRENT_GAS_TAX",
    label: "Current Gas Tax (IEH)",
    description: "Current supplier Impuesto Especial sobre Hidrocarburos (€)",
    category: "calculation",
    example: "95.00",
    sortOrder: 312,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "CURRENT_GAS_VAT",
    label: "Current Gas VAT",
    description: "Current supplier VAT (€)",
    category: "calculation",
    example: "357.00",
    sortOrder: 313,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "CURRENT_GAS_TOTAL",
    label: "Current Gas Total Cost",
    description: "Total current gas cost including all taxes (€)",
    category: "calculation",
    example: "2102.00",
    sortOrder: 314,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "AXPO_GAS_FIXED_COST",
    label: "AXPO Gas Fixed Term Cost",
    description: "AXPO fixed term (capacity) cost (€)",
    category: "calculation",
    example: "390.00",
    sortOrder: 320,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "AXPO_GAS_VARIABLE_COST",
    label: "AXPO Gas Variable Term Cost",
    description: "AXPO variable term (consumption) cost (€)",
    category: "calculation",
    example: "1050.00",
    sortOrder: 321,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "AXPO_GAS_TAX",
    label: "AXPO Gas Tax (IEH)",
    description: "AXPO Impuesto Especial sobre Hidrocarburos (€)",
    category: "calculation",
    example: "85.00",
    sortOrder: 322,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "AXPO_GAS_VAT",
    label: "AXPO Gas VAT",
    description: "AXPO VAT (€)",
    category: "calculation",
    example: "305.00",
    sortOrder: 323,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
  {
    key: "AXPO_GAS_TOTAL",
    label: "AXPO Gas Total Cost",
    description: "AXPO total gas cost including all taxes (€)",
    category: "calculation",
    example: "1830.00",
    sortOrder: 324,
    commodity: "GAS",
    templateTypes: "simulation-output,simulation-detailed",
  },
];

async function main() {
  console.log("──────────────────────────────────────────────────────");
  console.log("  Template variable commodity seeder");
  console.log("──────────────────────────────────────────────────────\n");

  // 1. Tag electricity-only variables
  console.log("⚡  Tagging electricity-only variables…");
  const elecResult = await prisma.templateVariable.updateMany({
    where: { key: { in: ELECTRICITY_ONLY_KEYS } },
    data: {
      commodity: "ELECTRICITY",
      templateTypes: "simulation-output,simulation-detailed",
    },
  });
  console.log(`   ✓ Updated ${elecResult.count} electricity variables`);

  // 2. Tag simulation-common variables (no commodity, simulation types only)
  console.log("\n🔗  Tagging common simulation variables…");
  const commonResult = await prisma.templateVariable.updateMany({
    where: { key: { in: SIMULATION_COMMON_KEYS } },
    data: {
      commodity: null,
      templateTypes: "simulation-output,simulation-detailed",
    },
  });
  console.log(`   ✓ Updated ${commonResult.count} common simulation variables`);

  // 3. Insert (or update) GAS simulation variables
  console.log("\n🔥  Inserting/updating GAS simulation variables…");
  let inserted = 0;
  let updated = 0;
  for (const v of GAS_SIMULATION_VARIABLES) {
    const existing = await prisma.templateVariable.findUnique({ where: { key: v.key } });
    if (existing) {
      await prisma.templateVariable.update({
        where: { key: v.key },
        data: v,
      });
      updated++;
    } else {
      await prisma.templateVariable.create({ data: { ...v, active: true } });
      inserted++;
    }
  }
  console.log(`   ✓ Inserted ${inserted}, updated ${updated} gas simulation variables`);

  console.log("\n✅  Done!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
