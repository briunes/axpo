import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { BaseValueScope, type SimulationPayload } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";
import {
  CalculationService,
  type PriceMap,
} from "@/application/services/calculationService";
import { SimulationService } from "@/application/services/simulationService";
import { AuditService } from "@/application/services/auditService";
import {
  defaultExcelParserProductConfigs,
  productDefinitionsFromParserConfigs,
  withMissingDefaultExcelParserProductConfigs,
  type ExcelParserProductConfigItem,
  type ExcelParserProductConfigScope,
} from "@/domain/excelParserProductConfig";
import type { ProductDefinition } from "@/domain/productRegistry";

const PRICE_MAP_CACHE_TTL_MS = 60_000;
const PRODUCT_DEFINITIONS_CACHE_TTL_MS = 60_000;

interface ActorContext {
  userId: string;
  role: import("@/domain/types").UserRole;
  agencyId: string;
}

interface CalculateAndPersistInput {
  actor: ActorContext;
  simulationId: string;
  baseValueSetId?: string;
  selectedMonth?: string;
  payloadJson?: SimulationPayload;
}

interface CachedPriceMap {
  expiresAt: number;
  itemCount: number;
  priceMap: PriceMap;
}

interface CachedProductDefinitions {
  expiresAt: number;
  definitions: ProductDefinition[] | undefined;
}

const priceMapCache = new Map<string, CachedPriceMap>();
const productDefinitionsCache = new Map<string, CachedProductDefinitions>();

export const calculateAndPersistSchema = z.object({
  baseValueSetId: z.string().min(1).optional(),
  payloadJson: z.record(z.unknown()).optional(),
  selectedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export async function calculateAndPersistSimulation(
  input: CalculateAndPersistInput,
) {
  const [simulation, latestVersion] = await Promise.all([
    SimulationService.assertSimulationAccess(input.actor, input.simulationId),
    prisma.simulationVersion.findFirst({
      where: { simulationId: input.simulationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!latestVersion) {
    throw new ValidationError("Simulation has no versions — save inputs first");
  }

  const baseValueSetId =
    input.baseValueSetId ??
    latestVersion.baseValueSetId ??
    (await resolveDefaultBaseValueSetId(simulation.agency.isTlv));

  if (!baseValueSetId) {
    throw new ValidationError(
      "No active price set found. Create and activate a BaseValueSet first.",
    );
  }

  const payload =
    input.payloadJson ?? ((latestVersion.payloadJson ?? {}) as SimulationPayload);

  if (!payload.electricity && !payload.gas) {
    throw new ValidationError(
      "Simulation payload has no electricity or gas inputs to calculate",
    );
  }

  const [baseValueSet, priceMapResult, systemConfig] = await Promise.all([
    prisma.baseValueSet.findUnique({
      where: { id: baseValueSetId },
      select: {
        agencyId: true,
        scopeType: true,
      },
    }),
    getPriceMapForBaseValueSet(baseValueSetId),
    prisma.systemConfig.findFirst({
      select: {
        ivaRate: true,
        electricityTaxRate: true,
        hydrocarbonTaxRate: true,
      },
    }),
    validateTariffAvailability(simulation.agencyId, payload),
  ]);

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

  if (priceMapResult.itemCount === 0) {
    throw new ValidationError(
      `BaseValueSet ${baseValueSetId} has no price items`,
    );
  }

  const payloadWithTaxRates: SimulationPayload = {
    ...payload,
    electricity: payload.electricity
      ? {
          ...payload.electricity,
          ...(input.selectedMonth ? { billingMonth: input.selectedMonth } : {}),
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
    (baseValueSet.scopeType ?? "GLOBAL") as ExcelParserProductConfigScope,
    // Product access follows the simulation owner's current agency. Older
    // simulations retain their original agencyId when their owner is moved,
    // which must not preserve access to the old agency's full catalogue.
    simulation.ownerUser.agencyId,
  );

  const results = CalculationService.calculate(
    payloadWithTaxRates,
    priceMapResult.priceMap,
    baseValueSetId,
    {
      baseValueScope: (baseValueSet.scopeType ?? "GLOBAL") as
        | "GLOBAL"
        | "AGENCY"
        | "TLV",
      productDefinitions,
    },
  );

  const updatedPayload: SimulationPayload = {
    ...payload,
    results,
  };

  const newVersion = await prisma.simulationVersion.create({
    data: {
      simulationId: input.simulationId,
      payloadJson: updatedPayload as object,
      baseValueSetId,
      createdBy: input.actor.userId,
    },
  });

  await AuditService.logEvent({
    actorUserId: input.actor.userId,
    eventType: "SIMULATION_CALCULATED",
    targetType: "SIMULATION",
    targetId: input.simulationId,
    metadataJson: {
      baseValueSetId,
      versionId: newVersion.id,
      productAccessAgencyId: simulation.ownerUser.agencyId,
      electricityProducts: results.electricity?.length ?? 0,
      gasProducts: results.gas?.length ?? 0,
    },
  });

  return {
    simulationId: input.simulationId,
    versionId: newVersion.id,
    baseValueSetId,
    results,
  };
}

async function getPriceMapForBaseValueSet(
  baseValueSetId: string,
): Promise<{ itemCount: number; priceMap: PriceMap }> {
  const now = Date.now();
  const cached = priceMapCache.get(baseValueSetId);
  if (cached && cached.expiresAt > now) {
    return {
      itemCount: cached.itemCount,
      priceMap: cached.priceMap,
    };
  }

  const priceItems = await prisma.baseValueItem.findMany({
    where: { baseValueSetId },
    select: { key: true, valueNumeric: true },
  });

  const priceMap = CalculationService.buildPriceMap(
    priceItems.map((i) => ({
      key: i.key,
      valueNumeric:
        i.valueNumeric !== null ? i.valueNumeric.toNumber() : null,
    })),
  );

  priceMapCache.set(baseValueSetId, {
    expiresAt: now + PRICE_MAP_CACHE_TTL_MS,
    itemCount: priceItems.length,
    priceMap,
  });

  return { itemCount: priceItems.length, priceMap };
}

async function loadProductDefinitions(
  scopeType: ExcelParserProductConfigScope,
  agencyId?: string,
): Promise<ProductDefinition[] | undefined> {
  if (scopeType !== "GLOBAL" && scopeType !== "TLV") {
    return undefined;
  }

  // Cache only the scope-level parser definitions. Agency enablement is access
  // control and must be read fresh on every calculation.
  const cacheKey = scopeType;
  const now = Date.now();
  const cached = productDefinitionsCache.get(cacheKey);
  let definitions = cached?.expiresAt && cached.expiresAt > now
    ? cached.definitions
    : undefined;
  if (!definitions) {
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
    definitions = productDefinitionsFromParserConfigs(configs);
    productDefinitionsCache.set(cacheKey, {
      expiresAt: now + PRODUCT_DEFINITIONS_CACHE_TTL_MS,
      definitions,
    });
  }

  if (!agencyId) {
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
  const filteredDefinitions = definitions.filter(
    (definition) =>
      enabledByProductKey.get(
        `${definition.commodity}:${definition.pricingType}:${definition.productKey}`,
      ) ?? true,
  );
  return filteredDefinitions;
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

async function resolveDefaultBaseValueSetId(
  isTlvAgency: boolean,
): Promise<string | null> {
  const scopeType = isTlvAgency ? "TLV" : "GLOBAL";
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

  const set = await prisma.baseValueSet.findFirst({
    where: { isActive: true, isDeleted: false, scopeType },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return set?.id ?? null;
}

async function validateTariffAvailability(
  agencyId: string,
  payload: SimulationPayload,
): Promise<void> {
  const tariffsToCheck: string[] = [];

  if (payload.electricity?.tarifaAcceso) {
    tariffsToCheck.push(`ELEC:${payload.electricity.tarifaAcceso}`);
  }

  if (payload.gas?.tarifaAcceso) {
    tariffsToCheck.push(`GAS:${payload.gas.tarifaAcceso}`);
  }

  if (tariffsToCheck.length === 0) {
    return;
  }

  const agencyTariffs = await prisma.agencyTariff.findMany({
    where: {
      agencyId,
      tariffType: { in: tariffsToCheck },
    },
  });

  const disabledTariffs: string[] = [];
  for (const tariffType of tariffsToCheck) {
    const setting = agencyTariffs.find((t) => t.tariffType === tariffType);
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
