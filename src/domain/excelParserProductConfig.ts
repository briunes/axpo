import type {
  ProductDefinition,
  ProductCommodity,
  ProductPricingType,
  ProductTier,
} from "./productRegistry";
import type { AxpoImportProfile } from "@/infrastructure/excel/axpo-parser";

export interface ExcelParserProductConfigItem {
  id?: string;
  scopeType: ExcelParserProductConfigScope;
  sourceLabel: string;
  productKey: string;
  displayName: string;
  commodity: ProductCommodity;
  pricingType: ProductPricingType;
  enabled: boolean;
  singlePeriod: boolean;
  eligibilityMin?: number | null;
  eligibilityMax?: number | null;
  sortOrder: number;
}

export type ExcelParserConfigScope = "GLOBAL" | "TLV";
export type ExcelParserProductConfigScope = "GLOBAL" | "AGENCY" | "TLV";

const GLOBAL_FIXED: Array<Omit<ExcelParserProductConfigItem, "scopeType">> = [
  row("ESTABLE", "ESTABLE", "Estable", 10),
  row("ESTABLE PLUS", "ESTABLE_PLUS", "Estable Plus", 20),
  row("1P PLUS (Periodo Único)", "1P_PLUS", "1P Plus", 30, true, null, 50000),
  row("1P PLUS XL (Periodo Único)", "1P_PLUS_XL", "1P Plus XL", 40, true, 50000, 100000),
  row("1P PLUS SSCC LIBRES (Periodo Único)", "1P_PLUS_SSCC_LIBRES", "1P Plus SSCC Libres", 50, true, null, 50000),
  row("1P PLUS SSAA LIBRES (Periodo Único)", "1P_PLUS_SSCC_LIBRES", "1P Plus SSCC Libres", 51, true, null, 50000),
  row("ESTABLE TALLERES", "ESTABLE_TALLERES", "Estable Talleres", 60),
  row("ESTABLE PLUS TALLERES", "ESTABLE_PLUS_TALLERES", "Estable Plus Talleres", 70),
];

const TLV_FIXED: Array<Omit<ExcelParserProductConfigItem, "scopeType">> = [
  row("ESTABLE", "ESTABLE", "Estable", 10),
  row("ESTABLE PLUS", "ESTABLE_PLUS", "Estable Plus", 20),
  row("1PT PLUS (Periodo Único)", "1P_PLUS", "1PT", 30, true, null, 100000),
  row("1PT PLUS", "1P_PLUS", "1PT", 31, true, null, 100000),
  row("1P PLUS (Periodo Único)", "1P_PLUS", "1PT", 32, true, null, 100000),
  row("1P PLUS XL (Periodo Único)", "1P_PLUS_XL", "1P XL", 40, true, 50000, 150000),
  row("ESTABLE TALLERES", "ESTABLE_TALLERES", "Estable Talleres", 60),
  row("ESTABLE PLUS TALLERES", "ESTABLE_PLUS_TALLERES", "Estable Plus Talleres", 70),
];

const INDEXED: Array<Omit<ExcelParserProductConfigItem, "scopeType">> = [
  row("Dinamica", "DINAMICA", "Dinámica", 100, false, null, null, "INDEXED"),
  row("Dinamica Plus", "DINAMICA_PLUS", "Dinámica Plus", 110, false, null, null, "INDEXED"),
  row("Dinamica Control", "DINAMICA_CONTROL", "Dinámica Control", 120, false, null, null, "INDEXED"),
  row("Dinamica Control Plus", "DINAMICA_CONTROL_PLUS", "Dinámica Control Plus", 130, false, null, null, "INDEXED"),
  row("Dinamica Control Techo", "DINAMICA_CONTROL_TECHO", "Dinámica Control Techo", 140, false, null, null, "INDEXED"),
];

const GAS_FIXED: Array<Omit<ExcelParserProductConfigItem, "scopeType">> = [
  row("Fijo N1", "FIJO", "Gas Estable", 200, false, null, null, "FIXED", "GAS"),
  row("Fijo N2", "FIJO", "Gas Estable", 201, false, null, null, "FIXED", "GAS"),
  row("Fijo N3", "FIJO", "Gas Estable", 202, false, null, null, "FIXED", "GAS"),
  row("ESTABLE PLUS N1", "ESTABLE_PLUS", "Gas Estable Plus", 210, false, null, null, "FIXED", "GAS"),
  row("ESTABLE PLUS N2", "ESTABLE_PLUS", "Gas Estable Plus", 211, false, null, null, "FIXED", "GAS"),
  row("ESTABLE PLUS N3", "ESTABLE_PLUS", "Gas Estable Plus", 212, false, null, null, "FIXED", "GAS"),
];

const GAS_INDEXED: Array<Omit<ExcelParserProductConfigItem, "scopeType">> = [
  row("Indexado N1", "INDEXADO", "Gas Dinámica", 300, false, null, null, "INDEXED", "GAS"),
  row("Indexado N2", "INDEXADO", "Gas Dinámica", 301, false, null, null, "INDEXED", "GAS"),
  row("Indexado N3", "INDEXADO", "Gas Dinámica", 302, false, null, null, "INDEXED", "GAS"),
  row("Dinamica plus N1", "DINAMICA_PLUS", "Gas Dinámica Plus", 310, false, null, null, "INDEXED", "GAS"),
  row("Dinamica plus N2", "DINAMICA_PLUS", "Gas Dinámica Plus", 311, false, null, null, "INDEXED", "GAS"),
  row("Dinamica plus N3", "DINAMICA_PLUS", "Gas Dinámica Plus", 312, false, null, null, "INDEXED", "GAS"),
];

export function defaultExcelParserProductConfigs(
  scopeType: ExcelParserProductConfigScope,
): ExcelParserProductConfigItem[] {
  const fixed = scopeType === "TLV" ? TLV_FIXED : GLOBAL_FIXED;
  return [...fixed, ...INDEXED, ...GAS_FIXED, ...GAS_INDEXED].map((item) => ({
    ...item,
    scopeType,
  }));
}

export function withMissingDefaultExcelParserProductConfigs(
  scopeType: ExcelParserProductConfigScope,
  configs: ExcelParserProductConfigItem[],
): ExcelParserProductConfigItem[] {
  const existingLabels = new Set(
    configs.map((item) => `${item.scopeType}:${item.sourceLabel}`),
  );
  const missing = defaultExcelParserProductConfigs(scopeType).filter(
    (item) => !existingLabels.has(`${item.scopeType}:${item.sourceLabel}`),
  );
  return [...configs, ...missing].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.sourceLabel.localeCompare(b.sourceLabel),
  );
}

export function buildAxpoImportProfileFromConfigs(
  scopeType: ExcelParserConfigScope,
  configs: ExcelParserProductConfigItem[],
): AxpoImportProfile {
  const fixedProductNames: Record<string, string> = {};
  const indexProductNames: Record<string, string> = {};
  const gasFixedProductNames: Record<string, string> = {};
  const gasIndexProductNames: Record<string, string> = {};

  for (const item of configs.filter((config) => config.enabled)) {
    if (item.commodity === "ELECTRICITY" && item.pricingType === "FIXED") {
      fixedProductNames[item.sourceLabel] = item.productKey;
    } else if (item.commodity === "ELECTRICITY" && item.pricingType === "INDEXED") {
      indexProductNames[item.sourceLabel] = item.productKey;
    } else if (item.commodity === "GAS" && item.pricingType === "FIXED") {
      gasFixedProductNames[item.sourceLabel] = item.productKey;
    } else if (item.commodity === "GAS" && item.pricingType === "INDEXED") {
      gasIndexProductNames[item.sourceLabel] = item.productKey;
    }
  }

  return {
    scopeType,
    sourceScope: scopeType,
    fixedProductNames,
    indexProductNames,
    gasFixedProductNames,
    gasIndexProductNames,
  };
}

export function productDefinitionsFromParserConfigs(
  configs: ExcelParserProductConfigItem[],
): ProductDefinition[] {
  const sorted = [...configs]
    .filter((item) => item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.sourceLabel.localeCompare(b.sourceLabel));
  const seen = new Set<string>();
  const definitions: ProductDefinition[] = [];

  for (const item of sorted) {
    const identity = `${item.commodity}:${item.pricingType}:${item.productKey}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const eligibility =
      item.eligibilityMin != null || item.eligibilityMax != null
        ? {
            field: "annualConsumption" as const,
            ...(item.eligibilityMin != null
              ? { minExclusive: item.eligibilityMin }
              : {}),
            ...(item.eligibilityMax != null
              ? { maxExclusive: item.eligibilityMax }
              : {}),
          }
        : undefined;

    definitions.push({
      productKey: item.productKey,
      displayName: item.displayName,
      commodity: item.commodity,
      pricingType: item.pricingType,
      tiers: tiers(),
      singlePeriod: item.singlePeriod,
      eligibility,
    });
  }

  return definitions;
}

function row(
  sourceLabel: string,
  productKey: string,
  displayName: string,
  sortOrder: number,
  singlePeriod = false,
  eligibilityMin: number | null = null,
  eligibilityMax: number | null = null,
  pricingType: ProductPricingType = "FIXED",
  commodity: ProductCommodity = "ELECTRICITY",
): Omit<ExcelParserProductConfigItem, "scopeType"> {
  return {
    sourceLabel,
    productKey,
    displayName,
    commodity,
    pricingType,
    enabled: true,
    singlePeriod,
    eligibilityMin,
    eligibilityMax,
    sortOrder,
  };
}

export function tiers(): ProductTier[] {
  return ["N1", "N2", "N3"];
}
