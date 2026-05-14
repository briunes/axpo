import { PrismaClient } from "@prisma/client";
import { CalculationService } from "../src/application/services/calculationService.js";

const prisma = new PrismaClient();

async function main() {
  const activeSet = await prisma.baseValueSet.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!activeSet) throw new Error("No active set");
  const items = await prisma.baseValueItem.findMany({
    where: { baseValueSetId: activeSet.id },
  });
  const map = CalculationService.buildPriceMap(
    items.map((i) => ({
      key: i.key,
      valueNumeric: i.valueNumeric != null ? Number(i.valueNumeric) : null,
    })),
  );

  const inputs = {
    tarifaAcceso: "3.0TD" as const,
    zonaGeografica: "Peninsula" as const,
    perfilCarga: "NORMAL" as const,
    potenciaContratada: { P1: 45, P2: 45, P3: 45, P4: 45, P5: 45, P6: 45 },
    consumo: { P1: 0, P2: 2321, P3: 2014, P4: 0, P5: 0, P6: 2385 },
    periodo: { fechaInicio: "2026-03-01", fechaFin: "2026-03-31", dias: 31 },
    facturaActual: 1156.38,
    extras: {
      reactiva: 12.82,
      alquilerEquipoMedida: 7.48,
      otrosCargos: 23.13,
      ivaTasa: 21,
      impuestoElectricoTasa: 0.5,
    },
    omieEstimado: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
    personalizadaIndex: {
      margenEnergia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
      margenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
    },
    personalizadaOmieB: {
      terminoB: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
      margenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
    },
  };

  const results = CalculationService.calculateElectricity(inputs, map);

  // Excel expected values (3.0TD, 62000 kWh, MARZO-26)
  const expected: Record<string, number> = {
    // FIJAS
    ESTABLE_N1: 1599.06,
    ESTABLE_N2: 1502.49,
    ESTABLE_N3: 1451.22,
    // INDEXADAS
    DINAMICA_N1: 1449.58,
    DINAMICA_N2: 1316.75,
    DINAMICA_N3: 1275.35,
    DINAMICA_CONTROL_N3: 1134.78,
    DINAMICA_CONTROL_PLUS_N3: 1214.04,
    // PERSONALIZADAS
    PERSONALIZADA_INDEX: 1163.34,
    PERSONALIZADA_OMIE_B: 1151.14,
  };

  console.log("Product verification (3.0TD, MARZO-26, 62000 kWh):");
  let allOk = true;
  for (const r of results) {
    const key = r.productKey.replace(":", "_");
    const exp = expected[key];
    if (exp !== undefined) {
      const ok = Math.abs(r.totalFactura - exp) < 0.05;
      if (!ok) allOk = false;
      console.log(
        `  ${ok ? "✅" : "❌"} ${key}: app=${r.totalFactura} expected=${exp} diff=${(r.totalFactura - exp).toFixed(2)}`,
      );
    }
  }
  if (allOk) console.log("\n✅ All products match!");
  else console.log("\n❌ Some products do not match");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
