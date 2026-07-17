export type ProductRegistryScope = "GLOBAL" | "AGENCY" | "TLV";
export type ProductCommodity = "ELECTRICITY" | "GAS";
export type ProductPricingType = "FIXED" | "INDEXED";
export type ProductTier = "N1" | "N2" | "N3";

export interface ProductEligibilityRule {
  field: "annualConsumption";
  minExclusive?: number;
  maxExclusive?: number;
}

export interface ProductDefinition {
  productKey: string;
  displayName: string;
  commodity: ProductCommodity;
  pricingType: ProductPricingType;
  tiers: ProductTier[];
  singlePeriod?: boolean;
  eligibility?: ProductEligibilityRule;
}

const TIERS: ProductTier[] = ["N1", "N2", "N3"];

const GLOBAL_ELEC_FIXED: ProductDefinition[] = [
  fixedElec("ESTABLE", "Estable"),
  fixedElec("ESTABLE_PLUS", "Estable Plus"),
  fixedElec("1P_PLUS", "1P Plus", {
    singlePeriod: true,
    eligibility: { field: "annualConsumption", maxExclusive: 50000 },
  }),
  fixedElec("1P_PLUS_XL", "1P Plus XL", {
    singlePeriod: true,
    eligibility: {
      field: "annualConsumption",
      minExclusive: 50000,
      maxExclusive: 100000,
    },
  }),
  fixedElec("1P_PLUS_SSCC_LIBRES", "1P Plus SSCC Libres", {
    singlePeriod: true,
    eligibility: { field: "annualConsumption", maxExclusive: 50000 },
  }),
  fixedElec("ESTABLE_TALLERES", "Estable Talleres"),
  fixedElec("ESTABLE_PLUS_TALLERES", "Estable Plus Talleres"),
];

const TLV_ELEC_FIXED: ProductDefinition[] = [
  fixedElec("ESTABLE", "Estable"),
  fixedElec("ESTABLE_PLUS", "Estable Plus"),
  fixedElec("1P_PLUS", "1P Plus", {
    singlePeriod: true,
    eligibility: { field: "annualConsumption", maxExclusive: 100000 },
  }),
  fixedElec("1P_PLUS_XL", "1P Plus XL", {
    singlePeriod: true,
    eligibility: {
      field: "annualConsumption",
      minExclusive: 50000,
      maxExclusive: 150000,
    },
  }),
  fixedElec("ESTABLE_TALLERES", "Estable Talleres"),
  fixedElec("ESTABLE_PLUS_TALLERES", "Estable Plus Talleres"),
];

const ELEC_INDEXED: ProductDefinition[] = [
  indexedElec("DINAMICA", "Dinámica"),
  indexedElec("DINAMICA_PLUS", "Dinámica Plus"),
  indexedElec("DINAMICA_CONTROL", "Dinámica Control"),
  indexedElec("DINAMICA_CONTROL_PLUS", "Dinámica Control Plus"),
  indexedElec("DINAMICA_CONTROL_TECHO", "Dinámica Control Techo"),
];

const GAS_FIXED: ProductDefinition[] = [
  fixedGas("FIJO", "Gas Estable"),
  fixedGas("ESTABLE_PLUS", "Gas Estable Plus"),
];

const GAS_INDEXED: ProductDefinition[] = [
  indexedGas("INDEXADO", "Gas Dinámica"),
  indexedGas("DINAMICA_PLUS", "Gas Dinámica Plus"),
];

function fixedElec(
  productKey: string,
  displayName: string,
  config: Partial<ProductDefinition> = {},
): ProductDefinition {
  return {
    productKey,
    displayName,
    commodity: "ELECTRICITY",
    pricingType: "FIXED",
    tiers: TIERS,
    ...config,
  };
}

function indexedElec(productKey: string, displayName: string): ProductDefinition {
  return {
    productKey,
    displayName,
    commodity: "ELECTRICITY",
    pricingType: "INDEXED",
    tiers: TIERS,
  };
}

function fixedGas(productKey: string, displayName: string): ProductDefinition {
  return {
    productKey,
    displayName,
    commodity: "GAS",
    pricingType: "FIXED",
    tiers: TIERS,
  };
}

function indexedGas(productKey: string, displayName: string): ProductDefinition {
  return {
    productKey,
    displayName,
    commodity: "GAS",
    pricingType: "INDEXED",
    tiers: TIERS,
  };
}

export function getProductDefinitions(params: {
  scopeType?: ProductRegistryScope;
  commodity: ProductCommodity;
  pricingType: ProductPricingType;
}): ProductDefinition[] {
  if (params.commodity === "ELECTRICITY" && params.pricingType === "FIXED") {
    return params.scopeType === "TLV" ? TLV_ELEC_FIXED : GLOBAL_ELEC_FIXED;
  }
  if (params.commodity === "ELECTRICITY" && params.pricingType === "INDEXED") {
    return ELEC_INDEXED;
  }
  if (params.commodity === "GAS" && params.pricingType === "FIXED") {
    return GAS_FIXED;
  }
  return GAS_INDEXED;
}

export function isProductEligible(
  definition: ProductDefinition,
  values: { annualConsumption?: number | null },
): boolean {
  const rule = definition.eligibility;
  if (!rule) return true;

  const value = values.annualConsumption;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return true;
  }

  if (rule.minExclusive !== undefined && value <= rule.minExclusive) {
    return false;
  }
  if (rule.maxExclusive !== undefined && value >= rule.maxExclusive) {
    return false;
  }
  return true;
}
