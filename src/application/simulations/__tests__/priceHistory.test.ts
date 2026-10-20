import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulations/[id]/price-history/route";
import reference from "@/lib/__tests__/fixtures/personalizada-index-history.json";

jest.mock("@/application/middleware/auth", () => ({ requireAuth: jest.fn().mockResolvedValue({ userId: "user" }) }));
jest.mock("@/application/middleware/rbac", () => ({ assertPermission: jest.fn() }));
jest.mock("@/application/services/simulationService", () => ({
  SimulationService: { assertSimulationAccess: jest.fn().mockResolvedValue({ id: "simulation", agencyId: "agency" }) },
}));
jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: { findUnique: jest.fn().mockResolvedValue({ isTlv: false }) },
    simulationVersion: { findFirst: jest.fn() },
    baseValueSet: { findUnique: jest.fn().mockResolvedValue({ id: "saved-prices" }) },
    baseValueItem: { findMany: jest.fn() },
  },
}));
import { prisma } from "@/infrastructure/database/prisma";

describe("Fixed electricity history API", () => {
  const months = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
    "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

  it.each([
    ["NORMAL", "Peninsula", "2.0TD", undefined],
    ["DIURNO", "Peninsula", "3.0TD", "PERSONALIZADA_INDEX"],
    ["NORMAL", "Canarias", "6.1TD", "ESTABLE:N1"],
    ["DIURNO", "Baleares", "3.0TD", "ESTABLE:N3"],
  ])("uses workbook months for %s/%s/%s with saved offer %s", async (perfilCarga, zonaGeografica, tarifaAcceso, productKey) => {
    (prisma.simulationVersion.findFirst as jest.Mock).mockResolvedValue({
      baseValueSetId: "saved-prices",
      payloadJson: {
        type: "ELECTRICITY",
        selectedOffer: productKey ? { productKey } : undefined,
        electricity: { tarifaAcceso, perfilCarga, zonaGeografica },
      },
    });
    (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue([
      ...months.map((month) => ({ key: `META:BILLING_MONTH:${month}`, valueText: month, valueNumeric: null })),
      // Unrelated commodity dates must not override the workbook's reference months.
      { key: "GAS:INDEX:INDEXADO:N1:RL01:PEN:MARGEN:2027-01", valueNumeric: 0.1 },
      { key: "ELEC:FIJO:ESTABLE:N1:2.0TD:P1:ENERGIA", valueNumeric: 0.269618 },
      ...["2.0TD", "3.0TD", "6.1TD"].flatMap((tariff) =>
        Array.from({ length: tariff === "2.0TD" ? 3 : 6 }, (_, i) => ({
          key: `ELEC:FIJO:ESTABLE:N1:${tariff}:P${i + 1}:ENERGIA:ZONE:${zonaGeografica.toUpperCase()}`,
          valueNumeric: 0.269618,
        }))),
    ]);

    const response = await GET(new NextRequest("http://localhost/api/v1/internal/simulations/simulation/price-history"),
      { params: Promise.resolve({ id: "simulation" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.months.map((month: { key: string }) => month.key)).toEqual(months);
    expect(body.months[0].label).toBe("Septiembre 25");
    expect(body.months[11].label).toBe("Agosto 26");
    expect(body.products.find((product: any) => product.productKey === "ESTABLE:N1")
      .tariffs[tarifaAcceso].P1).toBe(0.269618);
    expect(prisma.baseValueItem.findMany).toHaveBeenLastCalledWith({
      where: { baseValueSetId: "saved-prices" },
      select: { key: true, valueNumeric: true, valueText: true },
    });
  });

  it("keeps fixed products available for legacy imports without metadata or a saved offer", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-20T12:00:00Z"));
    try {
      (prisma.simulationVersion.findFirst as jest.Mock).mockResolvedValue({
        baseValueSetId: "saved-prices",
        payloadJson: { type: "ELECTRICITY", electricity: { tarifaAcceso: "2.0TD" } },
      });
      (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue([
        { key: "ELEC:FIJO:ESTABLE:N1:2.0TD:P1:ENERGIA", valueNumeric: 0.269618 },
      ]);

      const response = await GET(new NextRequest("http://localhost/api/v1/internal/simulations/simulation/price-history"),
        { params: Promise.resolve({ id: "simulation" }) });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.months).toHaveLength(12);
      expect(body.months[0].key).toBe("2025-11");
      expect(body.months[11].key).toBe("2026-10");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Personalizada Index history API", () => {
  it("returns the Excel reference prices and September 2025–August 2026 without September 2026", async () => {
    (prisma.simulationVersion.findFirst as jest.Mock).mockResolvedValue({
      baseValueSetId: "saved-prices",
      payloadJson: {
        type: "ELECTRICITY",
        selectedOffer: { productKey: "PERSONALIZADA_INDEX" },
        electricity: { tarifaAcceso: "3.0TD", perfilCarga: "NORMAL", zonaGeografica: "Peninsula",
          periodo: { fechaInicio: "2026-08-01", fechaFin: "2026-08-31" },
          personalizadaIndex: { margenEnergia: { P1: 5, P2: 5, P3: 5, P4: 5, P5: 5, P6: 5 } } },
      },
    });
    (prisma.baseValueItem.findMany as jest.Mock).mockResolvedValue(reference.baseRows.flatMap((row) =>
      row.values.map((valueNumeric, i) => ({
        key: `ELEC:INDEX:PERSONALIZADA_INDEX::${row.tariff}:P${i + 1}:MARGEN:${row.month}:ZONE:PENINSULA`, valueNumeric,
      }))));
    const response = await GET(new NextRequest("http://localhost/api/v1/internal/simulations/simulation/price-history"),
      { params: Promise.resolve({ id: "simulation" }) });
    if (response.status !== 200) throw new Error(await response.text());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.months).toHaveLength(12);
    expect(body.months[0]).toEqual({ key: "2025-09", label: "Septiembre 25" });
    expect(body.months[11]).toEqual({ key: "2026-08", label: "Agosto 26" });
    const product = body.products.find((entry: any) => entry.productKey === "PERSONALIZADA_INDEX");
    for (const row of reference.expectedRows) {
      row.values.forEach((expected, i) => {
        expect(product.tariffs[row.tariff][`P${i + 1}`].monthly[row.month]).toBeCloseTo(expected, 8);
      });
    }
  });
});
