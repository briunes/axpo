import { PrismaClient } from "@prisma/client";
import { CalculationService } from "../src/application/services/calculationService.js";

const prisma = new PrismaClient();

async function main() {
  const activeSet = await prisma.baseValueSet.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
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

  const pIdx = results.find((r) => r.productKey === "PERSONALIZADA_INDEX");
  const pOmie = results.find((r) => r.productKey === "PERSONALIZADA_OMIE_B");

  console.log(
    "PERSONALIZADA INDEX:",
    JSON.stringify({
      totalFactura: pIdx?.totalFactura,
      terminoEnergia: pIdx?.desglose?.terminoEnergia,
      terminoPotencia: pIdx?.desglose?.terminoPotencia,
    }),
  );
  console.log(
    "Expected: totalFactura=1163.34, potencia=165.56, energia=760.52",
  );

  console.log(
    "\nPERSONALIZADA OMIE+B:",
    JSON.stringify({
      totalFactura: pOmie?.totalFactura,
      terminoEnergia: pOmie?.desglose?.terminoEnergia,
      terminoPotencia: pOmie?.desglose?.terminoPotencia,
    }),
  );
  console.log(
    "Expected: totalFactura=1151.14, potencia=280.22, energia=635.84",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
