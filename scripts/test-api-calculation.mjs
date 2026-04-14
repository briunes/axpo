/**
 * test-api-calculation.mjs
 * 
 * Tests the calculation service directly with FEBRERO-26 data from Excel
 * to verify it matches the expected result of 299.80€ for DINAMICA N1
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get base values
  const baseValueSet = await prisma.baseValueSet.findFirst({
    where: { isActive: true, scopeType: "GLOBAL" },
    include: { items: true },
  });

  if (!baseValueSet) {
    console.error("ERROR: No active base value set found!");
    process.exit(1);
  }

  console.log(`Using base value set: ${baseValueSet.name} (v${baseValueSet.version})`);
  console.log(`Total items: ${baseValueSet.items.length}\n`);

  // Import calculationService with ts-node or tsx
  const { CalculationService } = await import("../src/application/services/calculationService.ts");
  
  // Build price map
  const priceMap = CalculationService.buildPriceMap(
    baseValueSet.items.map(item => ({
      key: item.key,
      valueNumeric: item.valueNumeric,
      unit: item.unit,
    }))
  );

  // Prepare electricity input matching Excel FEBRERO-26
  const electricityInput = {
    tarifaAcceso: "2.0TD",
    zonaGeografica: "PENINSULA",
    perfilCarga: "DOMESTICO",
    
    // Periodo (billing period) - 29 days from Feb 1 to Mar 1
    periodo: {
      fechaInicio: "2026-02-01",
      fechaFin: "2026-03-01",
      dias: 29,  // Excel shows 29 days
    },
    
    // Potencia Contratada (Contracted Power in kW)
    potenciaContratada: {
      P1: 9.86,
      P2: 9.86,
    },
    
    //Exceso potencia (no excess)
    excesoPotencia: {},
    
    // Consumo (Consumption in kWh)
    consumo: {
      P1: 468,
      P2: 449,
      P3: 1023,
    },
    
    // Current invoice amount
    facturaActual: 493.79,
    
    // OMIE prices from Excel (for indexed products)
    omieEstimado: {
      P1: 0.17623088,
      P2: 0.10728798,
      P3: 0.079728737,
    },
    
    // Products to compare
    productosComparar: ["DINAMICA:N1", "DINAMICA:N3"],
    
    // Extras (rental and other charges)
    extras: {
      alquilerEquipos: 1.3,  // Rental as shown in Excel
      otrosCargos: 0,
      reactiva: 0,
    },
  };

  // Run calculation
  const results = CalculationService.calculate(
    {
      electricity: electricityInput,
      gas: null,
    },
    priceMap,
    baseValueSet.id
  );

  console.log("DEBUG: Calculation input:", {
    electricity: electricityInput,
  });
  console.log("DEBUG: Results:", JSON.stringify(results, null, 2));

  console.log("\n═══════════════════════════════════════════════");
  console.log("CALCULATION RESULTS");
  console.log("═══════════════════════════════════════════════\n");

  if (results.electricity?.length > 0) {
    for (const result of results.electricity) {
      const product = result.productKey || `${result.productType}:${result.productTier}`;
      console.log(`\n${product} - ${result.productLabel}`);
      console.log("─".repeat(50));
      console.log(`  Término Energía:        ${result.desglose.terminoEnergia.toFixed(2)}€`);
      console.log(`  Término Potencia:       ${result.desglose.terminoPotencia.toFixed(2)}€`);
      console.log(`  Término Exceso:         ${(result.desglose.excesoPotencia || 0).toFixed(2)}€`);
      console.log(`  Impuesto Eléctrico:     ${result.desglose.impuestoElectrico.toFixed(2)}€`);
      console.log(`  IVA (21%):              ${result.desglose.iva.toFixed(2)}€`);
      console.log(`  ───────────────────────────────────────`);
      console.log(`  TOTAL:                  ${result.totalFactura.toFixed(2)}€`);
      console.log(`  Ahorro:                 ${result.ahorro.toFixed(2)}€ (${result.pctAhorro.toFixed(1)}%)`);
      
      // Compare with Excel expected value for DINAMICA N1
      if (result.productKey === "DINAMICA:N1") {
        const expected = 299.80;
        const diff = result.totalFactura - expected;
        console.log(`\n  Excel Expected:         ${expected.toFixed(2)}€`);
        console.log(`  Difference:             ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}€`);
        
        if (Math.abs(diff) < 0.05) {
          console.log(`  ✓ MATCH (within 0.05€)`);
        } else {
          console.log(`  ✗ MISMATCH`);
        }
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
