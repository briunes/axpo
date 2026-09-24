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
