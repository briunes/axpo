import { calculateAndPersistSimulation } from "../simulationCalculationRunner";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "../simulationService";
import { getBaseValueBillingMonths } from "../baseValueBillingMonths";
import { UserRole, type SimulationPayload } from "@/domain/types";

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulationVersion: { findFirst: jest.fn(), create: jest.fn() },
    baseValueSet: { findUnique: jest.fn(), findFirst: jest.fn() },
    baseValueItem: { findMany: jest.fn() },
    systemConfig: { findFirst: jest.fn() },
    agencyTariff: { findMany: jest.fn() },
    excelParserProductConfig: { findMany: jest.fn() },
    agencyProductConfig: { findMany: jest.fn() },
  },
}));
jest.mock("../simulationService", () => ({
  SimulationService: { assertSimulationAccess: jest.fn() },
}));
jest.mock("../auditService", () => ({ AuditService: { logEvent: jest.fn() } }));
jest.mock("../baseValueBillingMonths");

let sequence = 0;
let payload: SimulationPayload;
beforeEach(() => {
  jest.clearAllMocks();
  sequence++;
  payload = {
    electricity: {
      tarifaAcceso: "2.0TD", zonaGeografica: "Peninsula", perfilCarga: "NORMAL",
      potenciaContratada: { P1: 5, P2: 5 }, consumo: { P1: 100, P2: 100, P3: 100 },
      periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-30", dias: 30 },
      facturaActual: 150, extras: {},
      personalizadaIndex: { margenEnergia: { P1: 10, P2: 10, P3: 10 }, margenPotencia: {} },
      personalizadaOmieB: { terminoB: { P1: 10, P2: 10, P3: 10 }, margenPotencia: {} },
    },
    selectedOffer: {
      productKey: "DINAMICA:N1", commodity: "ELECTRICITY", pricingType: "INDEXED",
      selectedAt: "2026-10-01",
    },
  };
  (SimulationService.assertSimulationAccess as jest.Mock).mockResolvedValue({
    agencyId: "agency", agency: { isTlv: false }, ownerUser: { agencyId: "agency" },
  });
  (prisma.simulationVersion.findFirst as jest.Mock).mockResolvedValue({
    payloadJson: payload, baseValueSetId: null,
  });
  (prisma.baseValueSet.findFirst as jest.Mock).mockResolvedValue({ id: `latest-${sequence}` });
  (prisma.baseValueSet.findUnique as jest.Mock).mockResolvedValue({ scopeType: "GLOBAL", agencyId: null });
  (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue(
    ["P1", "P2", "P3"].flatMap(period => [
      { key: `ELEC:FIJO:ESTABLE:N1:2.0TD:${period}:ENERGIA`, valueNumeric: { toNumber: () => 0.1 } },
      { key: `ELEC:FIJO:ESTABLE:N1:2.0TD:${period}:POTENCIA`, valueNumeric: { toNumber: () => 36.5 } },
      { key: `ELEC:INDEX:DINAMICA:N1:2.0TD:${period}:MARGEN:2026-11`, valueNumeric: { toNumber: () => 0.12 } },
      { key: `ELEC:INDEX:DINAMICA:N1:2.0TD:${period}:POTENCIA`, valueNumeric: { toNumber: () => 36.5 } },
      ...["PERSONALIZADA_INDEX", "PERSONALIZADA_OMIE_B"].map(product => ({
        key: `ELEC:INDEX:${product}::2.0TD:${period}:MARGEN:2026-11`,
        valueNumeric: { toNumber: () => 0.12 },
      })),
    ]),
  );
  (prisma.systemConfig.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.agencyTariff.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.excelParserProductConfig.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.agencyProductConfig.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.simulationVersion.create as jest.Mock).mockResolvedValue({ id: "version" });
  (getBaseValueBillingMonths as jest.Mock).mockResolvedValue(["2026-10", "2026-09"]);
});

const calculate = (selectedMonth?: string) => calculateAndPersistSimulation({
  actor: { userId: "user", role: UserRole.ADMIN, agencyId: "agency" },
  simulationId: "simulation", selectedMonth,
});

it("calculates November fixed offers from the latest uploaded snapshot and persists the notice", async () => {
  const { results, baseValueSetId } = await calculate();
  expect(baseValueSetId).toBe(`latest-${sequence}`);
  expect(results.fixedOnlyFallback).toEqual({ requestedMonth: "2026-11", sourceMonth: "2026-10" });
  expect(results.electricity!.length).toBeGreaterThan(0);
  expect(results.electricity!.every(result => result.pricingType === "FIXED")).toBe(true);
  expect(results.electricity![0].desglose?.terminoEnergia).toBe(30);
  const saved = (prisma.simulationVersion.create as jest.Mock).mock.calls[0][0].data.payloadJson;
  expect(saved.results).toEqual(results);
  expect(saved.electricity.periodo).toEqual(payload.electricity!.periodo);
  expect(saved.electricity.billingMonth).toBe("2026-11");
  expect(saved.selectedOffer).toBeNull();
});

it("restores regular and personalized indexed offers once the month is available", async () => {
  (getBaseValueBillingMonths as jest.Mock).mockResolvedValue(["2026-11", "2026-10"]);
  const { results } = await calculate();
  expect(results.fixedOnlyFallback).toBeUndefined();
  expect(results.electricity).toEqual(expect.arrayContaining([
    expect.objectContaining({ productKey: "DINAMICA:N1", pricingType: "INDEXED" }),
    expect.objectContaining({ productKey: "PERSONALIZADA_INDEX", pricingType: "INDEXED" }),
    expect.objectContaining({ productKey: "PERSONALIZADA_OMIE_B", pricingType: "INDEXED" }),
  ]));
});

it("uses the latest loaded month even when the requested month is older", async () => {
  const { results } = await calculate("2026-08");
  expect(results.fixedOnlyFallback).toEqual({ requestedMonth: "2026-08", sourceMonth: "2026-10" });
});

describe("gas", () => {
  const num = (value: number) => ({ toNumber: () => value });
  const gasRows = [
    { key: "GAS:FIJO:FIJO:N1:RL01:PEN:ENERGIA", valueNumeric: num(0.05) },
    { key: "GAS:FIJO:FIJO:N1:RL01:TERMINO_DIA", valueNumeric: num(0.2) },
    { key: "GAS:INDEX:INDEXADO:N1:RL01:PEN:MARGEN", valueNumeric: num(0.01) },
    { key: "MIBGAS:2026-10", valueNumeric: num(0.03) },
    { key: "MIBGAS:2026-09", valueNumeric: num(0.03) },
  ];
  const useGasPeriod = (fechaInicio: string, fechaFin: string) => {
    payload = {
      gas: {
        tarifaAcceso: "RL01", zonaGeografica: "Peninsula", consumo: 1000, telemedida: "NO",
        periodo: { fechaInicio, fechaFin, dias: 30 }, facturaActual: 150, extras: {},
      },
      selectedOffer: {
        productKey: "INDEXADO:N1", commodity: "GAS", pricingType: "INDEXED",
        selectedAt: "2026-10-01",
      },
    };
    (prisma.simulationVersion.findFirst as jest.Mock).mockResolvedValue({
      payloadJson: payload, baseValueSetId: null,
    });
  };

  beforeEach(() => {
    (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue(gasRows);
  });

  it("calculates only fixed offers when the MIBGAS month has not been uploaded", async () => {
    useGasPeriod("2026-11-01", "2026-11-30");
    const { results } = await calculate();
    expect(results.fixedOnlyFallback).toEqual({ requestedMonth: "2026-11", sourceMonth: "2026-10" });
    expect(results.gas!.length).toBeGreaterThan(0);
    expect(results.gas!.every(result => result.pricingType === "FIXED")).toBe(true);
    const saved = (prisma.simulationVersion.create as jest.Mock).mock.calls[0][0].data.payloadJson;
    expect(saved.results.fixedOnlyFallback).toEqual(results.fixedOnlyFallback);
    expect(saved.gas.periodo.fechaInicio).toBe("2026-11-01");
    expect(saved.selectedOffer).toBeNull();
  });

  it("uses the period's dominant month, not the end date's month", async () => {
    // 2026-10-05 → 2026-11-02: 27 days in October, 2 in November.
    useGasPeriod("2026-10-05", "2026-11-02");
    const { results } = await calculate();
    expect(results.fixedOnlyFallback).toBeUndefined();
    expect(results.gas).toEqual(expect.arrayContaining([
      expect.objectContaining({ pricingType: "INDEXED" }),
    ]));
  });

  it("keeps indexed offers when the MIBGAS month is uploaded", async () => {
    useGasPeriod("2026-10-01", "2026-10-31");
    const { results } = await calculate();
    expect(results.fixedOnlyFallback).toBeUndefined();
    expect(results.gas).toEqual(expect.arrayContaining([
      expect.objectContaining({ pricingType: "FIXED" }),
      expect.objectContaining({ pricingType: "INDEXED" }),
    ]));
  });

  it("falls back for a month older than the uploaded MIBGAS range", async () => {
    useGasPeriod("2026-08-01", "2026-08-31");
    const { results } = await calculate();
    expect(results.fixedOnlyFallback).toEqual({ requestedMonth: "2026-08", sourceMonth: "2026-10" });
  });

  it("retains legacy calculation for sets without MIBGAS months", async () => {
    (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue(
      gasRows.filter(row => !row.key.startsWith("MIBGAS:")),
    );
    useGasPeriod("2026-11-01", "2026-11-30");
    const { results } = await calculate();
    expect(results.fixedOnlyFallback).toBeUndefined();
    expect(results.gas!.some(result => result.pricingType === "INDEXED")).toBe(true);
  });
});

it("retains legacy calculation for sets without monthly metadata", async () => {
  (getBaseValueBillingMonths as jest.Mock).mockResolvedValue([]);
  const { results } = await calculate();
  expect(results.fixedOnlyFallback).toBeUndefined();
  expect(results.electricity!.some(result => result.pricingType === "INDEXED")).toBe(true);
});

it.each(
  (["2.0TD", "3.0TD", "6.1TD"] as const).flatMap(tariff =>
    (["Peninsula", "Canarias", "Baleares"] as const).flatMap(zone =>
      (["NORMAL", "DIURNO"] as const).map(profile => ({ tariff, zone, profile })),
    ),
  ),
)("keeps fixed prices across $tariff / $zone / $profile and all tiers", async ({ tariff, zone, profile }) => {
  payload.electricity!.tarifaAcceso = tariff;
  payload.electricity!.zonaGeografica = zone;
  payload.electricity!.perfilCarga = profile;
  const originalRows = await (prisma.baseValueItem.findMany as jest.Mock)();
  const rows = originalRows.flatMap((row: { key: string; valueNumeric: unknown }) =>
    ["N1", "N2", "N3"].flatMap(tier => {
      const key = row.key.replace("2.0TD", tariff).replace(":N1:", `:${tier}:`);
      const periods = key.includes(":P3:") ? ["P3", "P4", "P5", "P6"] : [];
      return periods.length
        ? periods.map(period => ({ ...row, key: key.replace(":P3:", `:${period}:`) }))
        : [{ ...row, key }];
    }),
  );
  (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue(rows);
  const { results } = await calculate();
  expect(results.fixedOnlyFallback?.sourceMonth).toBe("2026-10");
  expect(results.electricity!.every(result => result.pricingType === "FIXED")).toBe(true);
  for (const tier of ["N1", "N2", "N3"]) {
    expect(results.electricity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        productKey: `ESTABLE:${tier}`,
        desglose: expect.objectContaining({ terminoEnergia: 30 }),
      }),
    ]));
  }
});
