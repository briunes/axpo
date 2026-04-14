import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { UserRole } from "@/domain/types";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const PRODUCT_LABELS: Record<string, string> = {
  "DINAMICA:N1": "Dinámica N1",
  "DINAMICA:N2": "Dinámica N2",
  "DINAMICA:N3": "Dinámica N3",
  "DINAMICA_PLUS:N1": "Dinámica Plus N1",
  "DINAMICA_PLUS:N2": "Dinámica Plus N2",
  "DINAMICA_PLUS:N3": "Dinámica Plus N3",
  "DINAMICA_CONTROL:N1": "Dinámica Control N1",
  "DINAMICA_CONTROL:N2": "Dinámica Control N2",
  "DINAMICA_CONTROL:N3": "Dinámica Control N3",
  "DINAMICA_CONTROL_PLUS:N1": "Dinámica Control Plus N1",
  "DINAMICA_CONTROL_PLUS:N2": "Dinámica Control Plus N2",
  "DINAMICA_CONTROL_PLUS:N3": "Dinámica Control Plus N3",
  "DINAMICA_CONTROL_TECHO:N1": "Dinámica Control Techo N1",
  "DINAMICA_CONTROL_TECHO:N2": "Dinámica Control Techo N2",
  "DINAMICA_CONTROL_TECHO:N3": "Dinámica Control Techo N3",
};

function generateLast12Months(): { label: string; key: string }[] {
  const now = new Date();
  const months: { label: string; key: string }[] = [];
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label, key });
  }
  return months;
}

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/price-history:
 *   get:
 *     summary: Get indexed price history data for a simulation
 *     tags: [Simulations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Price history data including indexed margins per product/tariff/period
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const { id } = await params;

    const simulation = await SimulationService.assertSimulationAccess(auth, id);

    // Get latest simulation version to find base value set and payload
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestVersion) {
      return NextResponse.json({
        tarifaAcceso: "2.0TD",
        perfilCarga: "NORMAL",
        products: [],
        months: generateLast12Months(),
        omieHistory: {},
      });
    }

    const payload = latestVersion.payloadJson as Record<string, any>;
    const baseValueSetId =
      latestVersion.baseValueSetId ??
      (payload?.results as any)?.baseValueSetId ??
      null;

    // Load base value items
    let baseValueItems: { key: string; valueNumeric: any }[] = [];
    if (baseValueSetId) {
      const bvSet = await prisma.baseValueSet.findUnique({
        where: { id: baseValueSetId },
        include: { items: { select: { key: true, valueNumeric: true } } },
      });
      baseValueItems = bvSet?.items ?? [];
    }

    // Fall back to active global base value set if nothing was found
    if (baseValueItems.length === 0) {
      const globalSet = await prisma.baseValueSet.findFirst({
        where: { isActive: true, isDeleted: false, scopeType: "GLOBAL" },
        include: { items: { select: { key: true, valueNumeric: true } } },
        orderBy: { updatedAt: "desc" },
      });
      baseValueItems = globalSet?.items ?? [];
    }

    // Filter indexed electricity margin items
    // Key format: ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN
    const marginItems = baseValueItems.filter(
      (item) =>
        item.key.startsWith("ELEC:INDEX:") && item.key.endsWith(":MARGEN"),
    );

    // Build structure: productTierKey -> { productKey, productLabel, tariffs: { tariff -> { period -> value } } }
    const productData: Record<
      string,
      {
        productKey: string;
        productLabel: string;
        tariffs: Record<string, Record<string, number>>;
      }
    > = {};

    for (const item of marginItems) {
      // Split: ELEC : INDEX : PRODUCT : TIER : TARIFA : PERIODO : MARGEN
      const parts = item.key.split(":");
      if (parts.length < 7) continue;

      const product = parts[2];
      const tier = parts[3];
      const tariff = parts[4];
      const period = parts[5];
      const productTierKey = `${product}:${tier}`;

      if (!productData[productTierKey]) {
        productData[productTierKey] = {
          productKey: productTierKey,
          productLabel:
            PRODUCT_LABELS[productTierKey] ??
            `${product.replace(/_/g, " ")} ${tier}`,
          tariffs: {},
        };
      }

      if (!productData[productTierKey].tariffs[tariff]) {
        productData[productTierKey].tariffs[tariff] = {};
      }

      productData[productTierKey].tariffs[tariff][period] =
        Number(item.valueNumeric) ?? 0;
    }

    // Prioritise products that appear in the simulation results
    const indexedResults = (
      (payload?.results as any)?.electricity ?? []
    ).filter((r: any) => r.pricingType === "INDEXED");

    const simulationProducts =
      indexedResults.length > 0
        ? indexedResults
            .map((r: any) => productData[r.productKey] ?? null)
            .filter(Boolean)
        : Object.values(productData);

    // Collect OMIE historical data (monthly averages)
    const omieItems = baseValueItems.filter((item) =>
      item.key.startsWith("OMIE:"),
    );
    const omieHistory: Record<string, number> = {};
    for (const item of omieItems) {
      const monthKey = item.key.replace("OMIE:", "");
      omieHistory[monthKey] = Number(item.valueNumeric) ?? 0;
    }

    const electricity = payload?.electricity as any;
    const tarifaAcceso = electricity?.tarifaAcceso ?? "2.0TD";
    const perfilCarga = electricity?.perfilCarga ?? "NORMAL";

    return NextResponse.json({
      tarifaAcceso,
      perfilCarga,
      products: simulationProducts,
      months: generateLast12Months(),
      omieHistory,
    });
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode ?? 500;
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status },
    );
  }
}
