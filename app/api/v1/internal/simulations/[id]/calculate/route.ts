import { NextRequest } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { CalculationService } from "@/application/services/calculationService";
import { AuditService } from "@/application/services/auditService";
import { BaseValueScope } from "@/domain/types";
import type { SimulationPayload } from "@/domain/types";
import {
  defaultExcelParserProductConfigs,
  productDefinitionsFromParserConfigs,
  withMissingDefaultExcelParserProductConfigs,
  type ExcelParserProductConfigScope,
  type ExcelParserProductConfigItem,
} from "@/domain/excelParserProductConfig";
import type { ProductDefinition } from "@/domain/productRegistry";

const calculateSchema = z.object({
  /** Override which BaseValueSet to use. Defaults to the version's baseValueSetId or the latest active global set. */
  baseValueSetId: z.string().min(1).optional(),
  /**
   * Optional billing month override (YYYY-MM).
   * When provided, indexed electricity calculations use the prices and days for
   * this specific month. Fixed calculations always use the billing period days.
   */
  selectedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/calculate:
 *   post:
 *     tags: [Simulations]
 *     summary: Run price calculation against the latest simulation version
 *     description: |
 *       Loads the latest SimulationVersion's payloadJson (typed as SimulationPayload),
 *       fetches BaseValueItems for the resolved price set, runs CalculationService,
 *       and persists the results into a new SimulationVersion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseValueSetId:
 *                 type: string
 *                 description: Optional override for the price set to use
 *     responses:
 *       200:
 *         description: Calculation results
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Simulation id parameter is required");

    // Verify access
    await SimulationService.assertSimulationAccess(auth, id);

    // Parse optional body
    let baseValueSetIdOverride: string | undefined;
    let selectedMonthOverride: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = calculateSchema.safeParse(body);
      if (parsed.success) {
        baseValueSetIdOverride = parsed.data.baseValueSetId;
        selectedMonthOverride = parsed.data.selectedMonth;
      }
    } catch {
      // body is optional — ignore parse errors
    }

    // Load the latest version
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestVersion) {
      throw new ValidationError(
        "Simulation has no versions — save inputs first",
      );
    }

    // Fetch simulation to get agencyId for tariff validation and price scope.
    const simulation = await prisma.simulation.findUnique({
      where: { id },
      select: { agencyId: true, agency: { select: { isTlv: true } } },
    });

    if (!simulation) {
      throw new ValidationError("Simulation not found");
    }

    // Resolve which BaseValueSet to use
    const baseValueSetId =
      baseValueSetIdOverride ??
      latestVersion.baseValueSetId ??
      (await resolveDefaultBaseValueSetId(simulation.agency.isTlv));

    if (!baseValueSetId) {
      throw new ValidationError(
        "No active price set found. Create and activate a BaseValueSet first.",
      );
    }

    // Load price items and scope metadata.
    const baseValueSet = await prisma.baseValueSet.findUnique({
      where: { id: baseValueSetId },
      select: {
        agencyId: true,
        scopeType: true,
      },
    });

    if (!baseValueSet) {
      throw new ValidationError(`BaseValueSet ${baseValueSetId} not found`);
    }

    if (simulation.agency.isTlv) {
      if (baseValueSet.scopeType !== BaseValueScope.TLV) {
        throw new ValidationError(
          "TLV simulations can only use TLV base value sets",
        );
      }
    } else if (
      baseValueSet.scopeType === BaseValueScope.TLV ||
      (baseValueSet.scopeType === BaseValueScope.AGENCY &&
        baseValueSet.agencyId !== simulation.agencyId)
    ) {
      throw new ValidationError(
        "This base value set is not available for the simulation agency",
      );
    }

    const priceItems = baseValueSet
      ? await prisma.baseValueItem.findMany({
          where: { baseValueSetId },
          select: { key: true, valueNumeric: true },
        })
      : [];

    if (priceItems.length === 0) {
      throw new ValidationError(
        `BaseValueSet ${baseValueSetId} has no price items`,
      );
    }

    // Build price map
    const priceMap = CalculationService.buildPriceMap(
      priceItems.map((i) => ({
        key: i.key,
        valueNumeric:
          i.valueNumeric !== null ? i.valueNumeric.toNumber() : null,
      })),
    );

    // Deserialize payload
    const payload = (latestVersion.payloadJson ?? {}) as SimulationPayload;

    if (!payload.electricity && !payload.gas) {
      throw new ValidationError(
        "Simulation payload has no electricity or gas inputs to calculate",
      );
    }

    // Validate tariff availability for agency
    await validateTariffAvailability(simulation.agencyId, payload);

    // Fetch system config to get the configured tax rates
    const systemConfig = await prisma.systemConfig.findFirst({
      select: {
        ivaRate: true,
        electricityTaxRate: true,
        hydrocarbonTaxRate: true,
      },
    });

    // Inject system-configured tax rates into the payload extras so they override
    // the hardcoded constants in CalculationService. Per-simulation overrides
    // (already present in extras) take precedence over system config.
    const payloadWithTaxRates: SimulationPayload = {
      ...payload,
      electricity: payload.electricity
        ? {
            ...payload.electricity,
            ...(selectedMonthOverride
              ? { billingMonth: selectedMonthOverride }
              : {}),
            extras: {
              ...payload.electricity.extras,
              ivaTasa:
                payload.electricity.extras?.ivaTasa ??
                (systemConfig?.ivaRate != null
                  ? Number(systemConfig.ivaRate) * 100
                  : undefined),
              impuestoElectricoTasa:
                payload.electricity.extras?.impuestoElectricoTasa ??
                (systemConfig?.electricityTaxRate != null
                  ? Number(systemConfig.electricityTaxRate) * 100
                  : undefined),
            },
          }
        : undefined,
      gas: payload.gas
        ? {
            ...payload.gas,
            ivaTasa:
              payload.gas.ivaTasa ??
              (systemConfig?.ivaRate != null
                ? Number(systemConfig.ivaRate) * 100
                : undefined),
            impuestoHidrocarburo:
              payload.gas.impuestoHidrocarburo ??
              (systemConfig?.hydrocarbonTaxRate != null
                ? Number(systemConfig.hydrocarbonTaxRate)
                : undefined),
          }
        : undefined,
    };

    const productDefinitions = await loadProductDefinitions(
      (baseValueSet?.scopeType ?? "GLOBAL") as ExcelParserProductConfigScope,
      simulation.agency.isTlv ? simulation.agencyId : undefined,
    );

    // Run calculation
    const results = CalculationService.calculate(
      payloadWithTaxRates,
      priceMap,
      baseValueSetId,
      {
        baseValueScope: (baseValueSet?.scopeType ?? "GLOBAL") as
          | "GLOBAL"
          | "AGENCY"
          | "TLV",
        productDefinitions,
      },
    );

    // Merge results back into payload and create a new version
    const updatedPayload: SimulationPayload = {
      ...payload,
      results,
    };

    const newVersion = await prisma.simulationVersion.create({
      data: {
        simulationId: id,
        payloadJson: updatedPayload as object,
        baseValueSetId,
        createdBy: auth.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "SIMULATION_CALCULATED",
      targetType: "SIMULATION",
      targetId: id,
      metadataJson: {
        baseValueSetId,
        versionId: newVersion.id,
        electricityProducts: results.electricity?.length ?? 0,
        gasProducts: results.gas?.length ?? 0,
      },
    });

    return ResponseHandler.ok(
      {
        simulationId: id,
        versionId: newVersion.id,
        baseValueSetId,
        results,
      },
      200,
    );
  },
);

async function loadProductDefinitions(
  scopeType: ExcelParserProductConfigScope,
  agencyId?: string,
): Promise<ProductDefinition[] | undefined> {
  if (scopeType !== "GLOBAL" && scopeType !== "TLV") {
    return undefined;
  }

  const rows = await prisma.excelParserProductConfig.findMany({
    where: { scopeType },
    orderBy: [{ sortOrder: "asc" }, { sourceLabel: "asc" }],
  });
  const configs =
    rows.length > 0
      ? withMissingDefaultExcelParserProductConfigs(
          scopeType,
          rows.map(toParserConfigItem),
        )
      : defaultExcelParserProductConfigs(scopeType);

  const definitions = productDefinitionsFromParserConfigs(configs);
  if (scopeType !== "TLV" || !agencyId) {
    return definitions;
  }

  const agencyProducts = await prisma.agencyProductConfig.findMany({
    where: { agencyId },
    select: {
      productKey: true,
      commodity: true,
      pricingType: true,
      isEnabled: true,
    },
  });
  if (agencyProducts.length === 0) {
    return definitions;
  }

  const enabledByProductKey = new Map(
    agencyProducts.map((product) => [
      `${product.commodity}:${product.pricingType}:${product.productKey}`,
      product.isEnabled,
    ]),
  );
  return definitions.filter(
    (definition) =>
      enabledByProductKey.get(
        `${definition.commodity}:${definition.pricingType}:${definition.productKey}`,
      ) ?? true,
  );
}

function toParserConfigItem(row: {
  id: string;
  scopeType: string;
  sourceLabel: string;
  productKey: string;
  displayName: string;
  commodity: string;
  pricingType: string;
  enabled: boolean;
  singlePeriod: boolean;
  eligibilityMin: { toNumber?: () => number } | number | null;
  eligibilityMax: { toNumber?: () => number } | number | null;
  sortOrder: number;
}): ExcelParserProductConfigItem {
  const toNumber = (
    value: { toNumber?: () => number } | number | null,
  ): number | null => {
    if (value == null) return null;
    return typeof value === "number" ? value : (value.toNumber?.() ?? null);
  };

  return {
    id: row.id,
    scopeType: row.scopeType as ExcelParserProductConfigItem["scopeType"],
    sourceLabel: row.sourceLabel,
    productKey: row.productKey,
    displayName: row.displayName,
    commodity: row.commodity as ExcelParserProductConfigItem["commodity"],
    pricingType: row.pricingType as ExcelParserProductConfigItem["pricingType"],
    enabled: row.enabled,
    singlePeriod: row.singlePeriod,
    eligibilityMin: toNumber(row.eligibilityMin),
    eligibilityMax: toNumber(row.eligibilityMax),
    sortOrder: row.sortOrder,
  };
}

/**
 * Find the default BaseValueSet to use for calculations.
 * Prioritizes production sets, falls back to active sets.
 */
async function resolveDefaultBaseValueSetId(
  isTlvAgency: boolean,
): Promise<string | null> {
  const scopeType = isTlvAgency ? "TLV" : "GLOBAL";
  // Try production set first
  const productionSet = await prisma.baseValueSet.findFirst({
    where: {
      isProduction: true,
      isActive: true,
      isDeleted: false,
      scopeType,
    },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  if (productionSet) return productionSet.id;

  // Fallback to any active set
  const set = await prisma.baseValueSet.findFirst({
    where: { isActive: true, isDeleted: false, scopeType },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return set?.id ?? null;
}

/**
 * Validate that the tariffs used in the simulation are enabled for the agency.
 * Throws ValidationError if any tariff is disabled.
 */
async function validateTariffAvailability(
  agencyId: string,
  payload: SimulationPayload,
): Promise<void> {
  const tariffsToCheck: string[] = [];

  // Collect electricity tariffs
  if (payload.electricity?.tarifaAcceso) {
    tariffsToCheck.push(`ELEC:${payload.electricity.tarifaAcceso}`);
  }

  // Collect gas tariffs
  if (payload.gas?.tarifaAcceso) {
    tariffsToCheck.push(`GAS:${payload.gas.tarifaAcceso}`);
  }

  if (tariffsToCheck.length === 0) {
    return; // Nothing to validate
  }

  // Load tariff settings for this agency
  const agencyTariffs = await prisma.agencyTariff.findMany({
    where: {
      agencyId,
      tariffType: { in: tariffsToCheck },
    },
  });

  // Check each tariff
  const disabledTariffs: string[] = [];
  for (const tariffType of tariffsToCheck) {
    const setting = agencyTariffs.find((t) => t.tariffType === tariffType);
    // If no setting exists, tariff is enabled by default
    // If setting exists and isEnabled = false, tariff is disabled
    if (setting && !setting.isEnabled) {
      disabledTariffs.push(tariffType);
    }
  }

  if (disabledTariffs.length > 0) {
    throw new ValidationError(
      `The following tariffs are not enabled for this agency: ${disabledTariffs.join(", ")}`,
    );
  }
}
