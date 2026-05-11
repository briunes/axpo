import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
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

const GAS_PRODUCT_LABELS: Record<string, string> = {
  "INDEXADO:N1": "Gas Dinámica N1",
  "INDEXADO:N2": "Gas Dinámica N2",
  "INDEXADO:N3": "Gas Dinámica N3",
  "DINAMICA_PLUS:N1": "Gas Dinámica Plus N1",
  "DINAMICA_PLUS:N2": "Gas Dinámica Plus N2",
  "DINAMICA_PLUS:N3": "Gas Dinámica Plus N3",
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
    await assertPermission(auth, "section.simulations");

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

    // Determine simulation type
    const isGas = payload?.type === "GAS" || !!payload?.gas;

    // Filter all indexed electricity margin items:
    //   12-month average: ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN
    //   Per-month:        ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN:{YYYY-MM}
    const marginItems = baseValueItems.filter(
      (item) =>
        item.key.startsWith("ELEC:INDEX:") && item.key.includes(":MARGEN"),
    );

    // Build electricity structure:
    // productTierKey -> {
    //   productKey, productLabel,
    //   tariffs: { tariff -> { period -> { avg: number; monthly: { YYYY-MM: number } } } }
    // }
    const productData: Record<
      string,
      {
        productKey: string;
        productLabel: string;
        tariffs: Record<
          string,
          Record<string, { avg: number; monthly: Record<string, number> }>
        >;
      }
    > = {};

    for (const item of marginItems) {
      // Split: ELEC : INDEX : PRODUCT : TIER : TARIFA : PERIODO : MARGEN [: YYYY-MM]
      const parts = item.key.split(":");
      if (parts.length < 7) continue;

      const product = parts[2];
      const tier = parts[3];
      const tariff = parts[4];
      const period = parts[5];
      // parts[6] === 'MARGEN'; parts[7] (if present) === 'YYYY-MM'
      const monthKey = parts.length >= 8 ? parts[7] : null;
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

      if (!productData[productTierKey].tariffs[tariff][period]) {
        productData[productTierKey].tariffs[tariff][period] = {
          avg: 0,
          monthly: {},
        };
      }

      const entry = productData[productTierKey].tariffs[tariff][period];
      const v = Number(item.valueNumeric) ?? 0;

      if (monthKey) {
        entry.monthly[monthKey] = v;
      } else {
        entry.avg = v;
      }
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

    // ── Gas indexed margin items ──────────────────────────────────────────
    // Key format: GAS:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{ZONE}:MARGEN
    // Zone is PEN (Peninsula) or BAL (Baleares)
    const gasMarginItems = baseValueItems.filter(
      (item) =>
        item.key.startsWith("GAS:INDEX:") && item.key.endsWith(":MARGEN"),
    );

    const gasProductData: Record<
      string,
      {
        productKey: string;
        productLabel: string;
        /** tariff -> { zone -> margin } */
        tariffs: Record<string, Record<string, number>>;
        type: "GAS";
      }
    > = {};

    for (const item of gasMarginItems) {
      // Split: GAS : INDEX : PRODUCT : TIER : TARIFA : ZONE : MARGEN
      const parts = item.key.split(":");
      if (parts.length < 7) continue;

      const product = parts[2];
      const tier = parts[3];
      const tariff = parts[4];
      const zone = parts[5]; // PEN or BAL
      const productTierKey = `GAS:${product}:${tier}`;

      if (!gasProductData[productTierKey]) {
        const labelKey = `${product}:${tier}`;
        gasProductData[productTierKey] = {
          productKey: productTierKey,
          productLabel:
            GAS_PRODUCT_LABELS[labelKey] ??
            `Gas ${product.replace(/_/g, " ")} ${tier}`,
          tariffs: {},
          type: "GAS",
        };
      }

      if (!gasProductData[productTierKey].tariffs[tariff]) {
        gasProductData[productTierKey].tariffs[tariff] = {};
      }

      gasProductData[productTierKey].tariffs[tariff][zone] =
        Number(item.valueNumeric) ?? 0;
    }

    // Prioritise gas products that appear in simulation results
    const gasIndexedResults = ((payload?.results as any)?.gas ?? []).filter(
      (r: any) => r.pricingType === "INDEXED",
    );

    const gasSimulationProducts =
      gasIndexedResults.length > 0
        ? gasIndexedResults
            .map((r: any) => {
              const key = `GAS:${r.productKey}`;
              return gasProductData[key] ?? null;
            })
            .filter(Boolean)
        : Object.values(gasProductData);

    const electricity = payload?.electricity as any;
    const tarifaAcceso = electricity?.tarifaAcceso ?? "2.0TD";
    const perfilCarga = electricity?.perfilCarga ?? "NORMAL";

    const gas = payload?.gas as any;
    const gasTarifaAcceso = gas?.tarifaAcceso ?? "";

    return NextResponse.json({
      tarifaAcceso,
      perfilCarga,
      products: simulationProducts,
      months: generateLast12Months(),
      // Gas-specific fields
      isGas,
      gasTarifaAcceso,
      gasProducts: gasSimulationProducts,
    });
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode ?? 500;
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status },
    );
  }
}
