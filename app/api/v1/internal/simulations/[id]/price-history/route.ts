import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const PRODUCT_LABELS: Record<string, string> = {
  "ESTABLE:N1": "Estable N1",
  "ESTABLE:N2": "Estable N2",
  "ESTABLE:N3": "Estable N3",
  "ESTABLE_PLUS:N1": "Estable Plus N1",
  "ESTABLE_PLUS:N2": "Estable Plus N2",
  "ESTABLE_PLUS:N3": "Estable Plus N3",
  "1P_PLUS:N1": "1P Plus N1",
  "1P_PLUS:N2": "1P Plus N2",
  "1P_PLUS:N3": "1P Plus N3",
  "1P_PLUS_XL:N1": "1P Plus XL N1",
  "1P_PLUS_XL:N2": "1P Plus XL N2",
  "1P_PLUS_XL:N3": "1P Plus XL N3",
  "1P_PLUS_SSCC_LIBRES:N1": "1P Plus SSCC Libres N1",
  "1P_PLUS_SSCC_LIBRES:N2": "1P Plus SSCC Libres N2",
  "1P_PLUS_SSCC_LIBRES:N3": "1P Plus SSCC Libres N3",
  "ESTABLE_TALLERES:N1": "Estable Talleres N1",
  "ESTABLE_TALLERES:N2": "Estable Talleres N2",
  "ESTABLE_TALLERES:N3": "Estable Talleres N3",
  "ESTABLE_PLUS_TALLERES:N1": "Estable Plus Talleres N1",
  "ESTABLE_PLUS_TALLERES:N2": "Estable Plus Talleres N2",
  "ESTABLE_PLUS_TALLERES:N3": "Estable Plus Talleres N3",
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
  "FIJO:N1": "Gas Fijo N1",
  "FIJO:N2": "Gas Fijo N2",
  "FIJO:N3": "Gas Fijo N3",
  "ESTABLE_PLUS:N1": "Gas Estable Plus N1",
  "ESTABLE_PLUS:N2": "Gas Estable Plus N2",
  "ESTABLE_PLUS:N3": "Gas Estable Plus N3",
  "INDEXADO:N1": "Gas Dinámica N1",
  "INDEXADO:N2": "Gas Dinámica N2",
  "INDEXADO:N3": "Gas Dinámica N3",
  "DINAMICA_PLUS:N1": "Gas Dinámica Plus N1",
  "DINAMICA_PLUS:N2": "Gas Dinámica Plus N2",
  "DINAMICA_PLUS:N3": "Gas Dinámica Plus N3",
};

const MONTH_NAMES = [
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

/**
 * Generate the last 12 months ending at `anchor` (inclusive).
 * If no anchor is provided, defaults to the current month.
 */
function generateLast12Months(anchor?: Date): { label: string; key: string }[] {
  const ref = anchor ?? new Date();
  const months: { label: string; key: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const label = `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label, key });
  }
  return months;
}

/**
 * Given a list of base-value items, find the latest YYYY-MM that has
 * per-month margin data (keys ending in :MARGEN:YYYY-MM) and return it
 * as a Date anchored to the first of that month.
 * Returns undefined when no per-month data exists.
 */
function latestDataMonth(items: { key: string }[]): Date | undefined {
  let latest: string | undefined;
  for (const item of items) {
    // Both ELEC and GAS per-month keys end with :MARGEN:YYYY-MM
    const match = item.key.match(/:MARGEN:(\d{4}-\d{2})$/);
    if (match) {
      const ym = match[1];
      if (!latest || ym > latest) latest = ym;
    }
  }
  if (!latest) return undefined;
  const [y, m] = latest.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

async function loadCommodityBaseValueItems(
  commodity: "ELEC" | "GAS",
  agencyId?: string | null,
): Promise<{ key: string; valueNumeric: any }[]> {
  const matchingItems = await prisma.baseValueItem.findMany({
    where: { key: { startsWith: `${commodity}:` } },
    select: { baseValueSetId: true },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const setIds = [...new Set(matchingItems.map((item) => item.baseValueSetId))];
  if (setIds.length === 0) return [];

  const sets = await prisma.baseValueSet.findMany({
    where: {
      id: { in: setIds },
      isDeleted: false,
      OR: [
        { scopeType: "GLOBAL" },
        ...(agencyId ? [{ agencyId }] : []),
      ],
    },
    select: {
      id: true,
      isActive: true,
      isProduction: true,
      version: true,
      updatedAt: true,
    },
    orderBy: [
      { isProduction: "desc" },
      { isActive: "desc" },
      { version: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const selectedSet = sets[0];
  if (!selectedSet) return [];

  return prisma.baseValueItem.findMany({
    where: { baseValueSetId: selectedSet.id },
    select: { key: true, valueNumeric: true },
  });
}

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/price-history:Menu 'Comunicações':
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
    const isGas = payload?.type === "GAS" || !!payload?.gas;
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

    // Older simulation versions can point to a base-value set containing only
    // the other commodity. For history, fall back to the active global set
    // when the attached set has no entries for this simulation's commodity.
    const hasCommodityHistory = (
      items: Array<{ key: string }>,
    ): boolean =>
      items.some((item) =>
        isGas
          ? item.key.startsWith("GAS:") &&
            (item.key.endsWith(":MARGEN") ||
              item.key.endsWith(":ENERGIA"))
          : item.key.startsWith("ELEC:") &&
            (item.key.includes(":MARGEN") ||
              item.key.endsWith(":ENERGIA")),
      );

    if (!hasCommodityHistory(baseValueItems)) {
      const commodityItems = await loadCommodityBaseValueItems(
        isGas ? "GAS" : "ELEC",
        auth.agencyId,
      );
      if (hasCommodityHistory(commodityItems)) {
        baseValueItems = commodityItems;
      }
    }

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
          Record<
            string,
            { avg: number; monthly: Record<string, number> } | number
          >
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
      if (typeof entry === "number") continue;
      const v = Number(item.valueNumeric) ?? 0;

      if (monthKey) {
        entry.monthly[monthKey] = v;
      } else {
        entry.avg = v;
      }
    }

    // Fixed electricity products have one current price per tariff/period,
    // rather than month-specific snapshots. Store them as plain numeric
    // period values; the history renderer displays that fixed value for each
    // month while indexed products retain their real monthly series.
    const fixedElectricityItems = baseValueItems.filter(
      (item) =>
        item.key.startsWith("ELEC:FIJO:") && item.key.endsWith(":ENERGIA"),
    );

    for (const item of fixedElectricityItems) {
      // ELEC : FIJO : PRODUCT : TIER : TARIFA : PERIODO : ENERGIA
      const parts = item.key.split(":");
      if (parts.length !== 7) continue;

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

    // History is a catalogue view, so expose every product for which the
    // imported base-value set contains historical data. Restricting this to
    // the current simulation results hid valid product families.
    const simulationProducts = Object.values(productData);

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

    const fixedGasItems = baseValueItems.filter(
      (item) =>
        item.key.startsWith("GAS:FIJO:") && item.key.endsWith(":ENERGIA"),
    );

    for (const item of fixedGasItems) {
      // GAS : FIJO : PRODUCT : TIER : TARIFA : ZONE : ENERGIA
      const parts = item.key.split(":");
      if (parts.length !== 7) continue;

      const product = parts[2];
      const tier = parts[3];
      const tariff = parts[4];
      const zone = parts[5];
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

    const gasSimulationProducts = Object.values(gasProductData);

    const electricity = payload?.electricity as any;
    const tarifaAcceso = electricity?.tarifaAcceso ?? "2.0TD";
    const perfilCarga = electricity?.perfilCarga ?? "NORMAL";

    const gas = payload?.gas as any;
    const gasTarifaAcceso = gas?.tarifaAcceso ?? "";

    // Anchor months to the latest month that actually has per-month data in
    // the base value set, so we never show future months without data.
    const dataAnchor = latestDataMonth(baseValueItems);

    return NextResponse.json({
      tarifaAcceso,
      perfilCarga,
      products: simulationProducts,
      months: generateLast12Months(dataAnchor),
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
