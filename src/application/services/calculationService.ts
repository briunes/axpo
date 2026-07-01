/**
 * CalculationService
 *
 * Computes ProductResult[] from SimulationPayload + a Map of BaseValueItem prices.
 *
 * Spanish electricity bill structure:
 *   baseImponible = Σ(terminoEnergia_Pi) + Σ(terminoPotencia_Pi × días/365) + excesos + reactiva
 *   impuestoElectrico = 5.11269% × baseImponible
 *   baseIVA = baseImponible + IE + alquilerMedida + otrosCargos
 *   IVA = 21% × baseIVA
 *   total = baseIVA + IVA
 *
 * Spanish gas bill structure:
 *   subtotal = (energia × consumo) + (terminoDia × días) + (terminoAnio × días/365)
 *   impuestoHidrocarburo = 0.00234 €/kWh × consumo
 *   baseIVA = subtotal + IH + alquilerMedida + otrosCargos
 *   IVA = 21% × baseIVA
 *   total = baseIVA + IVA
 */

import type {
  SimulationPayload,
  ElectricityInputs,
  GasInputs,
  ProductResult,
  SimulationResults,
} from "@/domain/types";
import {
  getProductDefinitions,
  isProductEligible,
  type ProductDefinition,
  type ProductRegistryScope,
} from "@/domain/productRegistry";

export type PriceMap = Map<string, number>;

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPUESTO_ELECTRICO = 0.0511; // matches Excel E51 default (5.11%)
const IVA_RATE = 0.21;
const IMPUESTO_HIDROCARBURO = 0.00234; // €/kWh — Ley de Hidrocarburos
const PERSONALIZADA_INDEX_ENERGY_MARGIN_FACTOR = 1.01528;

/** Energy periods consumed per access tariff. */
const ENERGY_PERIODS: Record<string, string[]> = {
  "2.0TD": ["P1", "P2", "P3"],
  "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
  "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

/** Contracted power periods per access tariff. */
const POWER_PERIODS: Record<string, string[]> = {
  "2.0TD": ["P1", "P2"],
  "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
  "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

export interface CalculationOptions {
  baseValueScope?: ProductRegistryScope;
  productDefinitions?: ProductDefinition[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to 2 decimal places. */
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function pv(map: Record<string, number | undefined>, period: string): number {
  return map[period] ?? 0;
}

function priceOf(map: PriceMap, key: string): number | undefined {
  return map.get(key);
}

function singlePeriodPriceOf(
  map: PriceMap,
  product: string,
  tier: string,
  tariff: string,
  kind: "ENERGIA" | "POTENCIA",
): number | undefined {
  return priceOf(map, `ELEC:FIJO:${product}:${tier}:${tariff}:P1:${kind}`);
}

/**
 * Returns the calendar month (YYYY-MM) that has the most days overlapping
 * with the billing period [fechaInicio, fechaFin].  This mirrors the Excel
 * "MES" field and is used to look up the correct MIBGAS reference price when
 * the billing period spans multiple months.
 */
function dominantBillingMonth(fechaInicio: string, fechaFin: string): string {
  const start = new Date(fechaInicio + "T00:00:00");
  const end = new Date(fechaFin + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return fechaInicio.slice(0, 7);
  }

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  let bestMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  let maxDays = -1;

  while (cursor <= endMonth) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const overlapStart = start > monthStart ? start : monthStart;
    const overlapEnd = end < monthEnd ? end : monthEnd;
    const overlapDays =
      overlapEnd >= overlapStart
        ? Math.floor(
            (overlapEnd.getTime() - overlapStart.getTime()) / 86400000,
          ) + 1
        : 0;

    if (overlapDays > maxDays) {
      maxDays = overlapDays;
      bestMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return bestMonth;
}

function getAnnualConsumption(inputs: ElectricityInputs): number | null {
  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const fromTopLevel = (inputs as ElectricityInputs & { consumoAnual?: number })
    .consumoAnual;
  const topLevelValue = toFiniteNumber(fromTopLevel);
  if (topLevelValue !== null) return topLevelValue;

  const fromClientData = (
    inputs as ElectricityInputs & {
      clientData?: { consumoAnual?: number };
    }
  ).clientData?.consumoAnual;
  const clientDataValue = toFiniteNumber(fromClientData);
  if (clientDataValue !== null) return clientDataValue;
  return 0;
}

function isEligibleProduct(
  inputs: ElectricityInputs,
  definition: ProductDefinition,
): boolean {
  const annualConsumption = getAnnualConsumption(inputs);
  return isProductEligible(definition, { annualConsumption });
}

// ─── Electricity – Fixed ──────────────────────────────────────────────────────

function calcElecFijo(
  inputs: ElectricityInputs,
  definition: ProductDefinition,
  tier: string,
  map: PriceMap,
): ProductResult | null {
  if (!isEligibleProduct(inputs, definition)) {
    return null;
  }
  const product = definition.productKey;

  const {
    tarifaAcceso,
    consumo,
    potenciaContratada,
    excesoPotencia,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;

  // "1P PLUS" products are "Periodo Único" — when a selected tariff has only a
  // P1 price, it applies to all periods for that tariff. Do not fall back across
  // tariffs: the workbook looks up the selected tariff and leaves unavailable
  // tariff/product combinations blank.
  const isSinglePeriod = Boolean(definition.singlePeriod);

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const precioEn =
      priceOf(
        map,
        `ELEC:FIJO:${product}:${tier}:${tarifaAcceso}:${p}:ENERGIA`,
      ) ??
      (isSinglePeriod
        ? singlePeriodPriceOf(map, product, tier, tarifaAcceso, "ENERGIA")
        : undefined);
    if (precioEn === undefined) return null; // missing price → product unavailable for this tier/tariff combo
    terminoEnergia += precioEn * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    const precioPot =
      priceOf(
        map,
        `ELEC:FIJO:${product}:${tier}:${tarifaAcceso}:${p}:POTENCIA`,
      ) ??
      (isSinglePeriod
        ? singlePeriodPriceOf(map, product, tier, tarifaAcceso, "POTENCIA")
        : undefined);
    if (precioPot === undefined) return null;
    terminoPotencia += precioPot * pv(potenciaMap, p) * (dias / 365);
  }

  // excesoPotencia is the € amount from the client's current invoice (grid charge,
  // same regardless of commercial supplier — matches Excel E35 pass-through)
  const terminoExceso = excesoPotencia ?? 0;

  const reactiva = extras?.reactiva ?? 0;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  // otrosCargos (IMP RDL) is included in the Impuesto Eléctrico base per Excel formula:
  // IMP = (TOTAL_POT + TOTAL_ENER + IMP_RDL) × 5.11%
  const otros = extras?.otrosCargos ?? 0;
  const ieRate =
    extras?.impuestoElectricoTasa != null
      ? extras.impuestoElectricoTasa / 100
      : IMPUESTO_ELECTRICO;
  const ivaRate = extras?.ivaTasa != null ? extras.ivaTasa / 100 : IVA_RATE;
  const baseImponible =
    terminoEnergia + terminoPotencia + terminoExceso + reactiva + otros;
  // Match Excel: use full precision for IE and IVA in the calculation chain,
  // only round for display values in desglose and for the final total.
  const impuestoElectricoRaw = baseImponible * ieRate;
  // alquilerEquipoMedida is outside the impuesto base but inside the IVA base
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${definition.displayName} ${tier}`,
    commodity: "ELECTRICITY",
    pricingType: "FIXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoPotencia: r2(terminoPotencia),
      excesoPotencia: r2(terminoExceso),
      otrosCargos: r2(reactiva + otros),
      alquiler: r2(alquiler),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Indexed ────────────────────────────────────────────────────

function calcElecIndex(
  inputs: ElectricityInputs,
  definition: ProductDefinition,
  tier: string,
  map: PriceMap,
): ProductResult | null {
  const product = definition.productKey;
  const {
    tarifaAcceso,
    consumo,
    potenciaContratada,
    excesoPotencia,
    periodo,
    facturaActual,
    extras,
    omieEstimado,
  } = inputs;
  // Indexed offers use the selected billing month for price lookup, while Excel
  // still uses the invoice period days for power and annualized savings.
  // Use fechaFin (not fechaInicio) to derive the default billing month — a billing
  // period like "2026-01-31 → 2026-02-28" is a February bill, not a January bill.
  // fechaInicio may fall on the last day of the previous month (common in Spain).
  const billingMonthKey = inputs.billingMonth ?? periodo.fechaFin.slice(0, 7); // "YYYY-MM"
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;
  // All indexed products (DINAMICA, DINAMICA_PLUS, DINAMICA_CONTROL, etc.) store
  // the full all-in 12-month average "Precio TE" under the MARGEN key — extracted
  // from the individual product sheets by the Excel parser.  OMIE is NOT added here;
  // it is only used for Personalizada Index and Personalizada OMIE+B products.

  // The billing month is used to look up month-specific Precio TE values that
  // were extracted from the individual DINAMICA / DINAMICA PLUS product sheets.
  // This matches the Excel behaviour: it uses the actual prices for the billing
  // month, not the 12-month average.  If no month-specific price is stored (e.g.
  // for DINAMICA_CONTROL variants or older imports), we fall back to the PROMEDIO
  // (12-month average) key, and then to the legacy ENERGIA key.

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const baseKey = `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}`;
    const storedPrice =
      // 1. Month-specific price (e.g. MARZO-26) — highest priority
      priceOf(map, `${baseKey}:MARGEN:${billingMonthKey}`) ??
      // 2. 12-month PROMEDIO — good fallback for DINAMICA/PLUS
      priceOf(map, `${baseKey}:MARGEN`) ??
      // 3. Legacy key name used in earlier imports
      priceOf(map, `${baseKey}:ENERGIA`);
    if (storedPrice === undefined) return null;
    terminoEnergia += storedPrice * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    const precioPot = priceOf(
      map,
      `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}:POTENCIA`,
    );
    if (precioPot === undefined) return null;
    terminoPotencia += precioPot * pv(potenciaMap, p) * (dias / 365);
  }

  // excesoPotencia is the € amount from the client's current invoice (grid charge,
  // same regardless of commercial supplier — matches Excel E35 pass-through)
  const terminoExceso = excesoPotencia ?? 0;

  const reactiva = extras?.reactiva ?? 0;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  // otrosCargos (IMP RDL) is included in the Impuesto Eléctrico base per Excel formula:
  // IMP = (TOTAL_POT + TOTAL_ENER + IMP_RDL) × 5.11%
  const otros = extras?.otrosCargos ?? 0;
  const ieRate =
    extras?.impuestoElectricoTasa != null
      ? extras.impuestoElectricoTasa / 100
      : IMPUESTO_ELECTRICO;
  const ivaRate = extras?.ivaTasa != null ? extras.ivaTasa / 100 : IVA_RATE;
  const baseImponible =
    terminoEnergia + terminoPotencia + terminoExceso + reactiva + otros;
  const impuestoElectricoRaw = baseImponible * ieRate;
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${definition.displayName} ${tier}`,
    commodity: "ELECTRICITY",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoPotencia: r2(terminoPotencia),
      excesoPotencia: r2(terminoExceso),
      otrosCargos: r2(reactiva + otros),
      alquiler: r2(alquiler),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Personalizada Fijo ────────────────────────────────────────

/**
 * Personalizada Fijo (custom fixed offer) product.
 * The user supplies all-in energy prices (€/kWh) and power prices (€/kWdia)
 * per period.  Defaults can be imported from the COMPARATIVA LIBRE LUZ sheet.
 * Only computed when at least one energy price period is > 0.
 */
function calcElecPersonalizadaFijo(
  inputs: ElectricityInputs,
  map: PriceMap,
): ProductResult | null {
  if (!inputs.personalizadaFijo) return null;
  const { preciosEnergia, preciosPotencia } = inputs.personalizadaFijo;
  const preciosEnergiaMap = (preciosEnergia ?? {}) as Record<
    string,
    number | undefined
  >;
  const hasEnergy = Object.values(preciosEnergiaMap).some(
    (v) => v != null && v > 0,
  );
  if (!hasEnergy) return null;

  const {
    tarifaAcceso,
    consumo,
    potenciaContratada,
    excesoPotencia,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;
  const preciosPotenciaMap = (preciosPotencia ?? {}) as Record<
    string,
    number | undefined
  >;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const precio = preciosEnergiaMap[p] ?? 0;
    terminoEnergia += precio * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    // price is €/kWdia → × kW × dias
    const precioDia = preciosPotenciaMap[p] ?? 0;
    terminoPotencia += precioDia * pv(potenciaMap, p) * dias;
  }

  const terminoExceso = excesoPotencia ?? 0;
  const reactiva = extras?.reactiva ?? 0;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const ieRate =
    extras?.impuestoElectricoTasa != null
      ? extras.impuestoElectricoTasa / 100
      : IMPUESTO_ELECTRICO;
  const ivaRate = extras?.ivaTasa != null ? extras.ivaTasa / 100 : IVA_RATE;
  const baseImponible =
    terminoEnergia + terminoPotencia + terminoExceso + reactiva + otros;
  const impuestoElectricoRaw = baseImponible * ieRate;
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: "PERSONALIZADA_FIJO",
    productLabel: "Personalizada Fijo",
    commodity: "ELECTRICITY",
    pricingType: "FIXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoPotencia: r2(terminoPotencia),
      excesoPotencia: r2(terminoExceso),
      otrosCargos: r2(reactiva + otros),
      alquiler: r2(alquiler),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Personalizada Index ────────────────────────────────────────

/**
 * Personalizada Index product.
 * Uses user-supplied energy margins (€/MWh) and power margins (€/kW/year).
 * Only computed when at least one energy margin period is > 0.
 * Formula: energyCost = (precioExcel[p] + margenEnergia[p] × 1.01528/1000) × consumo[p]
 *          powerCost  = (atrPower[p] + margenPotencia[p]) × potencia[p] × dias/365
 */
function calcPersonalizadaIndex(
  inputs: ElectricityInputs,
  map: PriceMap,
): ProductResult | null {
  // The product has no tier variant — keys use an empty-string tier (POTENCIA lookup).
  const product = "PERSONALIZADA_INDEX";
  const tier = "";

  const billingMonthKey = inputs.billingMonth ?? inputs.periodo.fechaFin.slice(0, 7);
  // Use user-supplied values when present. If the custom fields are blank, fall
  // back to the imported PERSONALIZADA INDEX sheet values, matching Excel.
  const hasAnyUserValue =
    Object.values(inputs.personalizadaIndex?.margenEnergia ?? {}).some(
      (v) => v != null && v !== 0,
    ) ||
    Object.values(inputs.personalizadaIndex?.margenPotencia ?? {}).some(
      (v) => v != null && v !== 0,
    ) ||
    Object.values(inputs.omieEstimado ?? {}).some((v) => v != null && v !== 0);
  const hasImportedDefaults = (ENERGY_PERIODS[inputs.tarifaAcceso] ?? []).some(
    (p) => {
      const baseKey = `ELEC:INDEX:${product}:${tier}:${inputs.tarifaAcceso}:${p}`;
      return (
        priceOf(map, `${baseKey}:MARGEN:${billingMonthKey}`) !== undefined ||
        priceOf(map, `${baseKey}:MARGEN`) !== undefined
      );
    },
  );
  if (!hasAnyUserValue && !hasImportedDefaults) return null;
  const hasExplicitOmie = Object.values(inputs.omieEstimado ?? {}).some(
    (v) => v != null && v !== 0,
  );

  const {
    tarifaAcceso,
    consumo,
    potenciaContratada,
    excesoPotencia,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;

  const omieMapIdx = (inputs.omieEstimado ?? {}) as Record<
    string,
    number | undefined
  >;
  const margenEnergiaMap = (inputs.personalizadaIndex?.margenEnergia ??
    {}) as Record<string, number | undefined>;
  const margenPotIdxMap = (inputs.personalizadaIndex?.margenPotencia ??
    {}) as Record<string, number | undefined>;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const baseKey = `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}`;
    const storedPrice =
      priceOf(map, `${baseKey}:MARGEN:${billingMonthKey}`) ??
      priceOf(map, `${baseKey}:MARGEN`);
    const margenEnergiaP =
      ((margenEnergiaMap[p] ?? 0) * PERSONALIZADA_INDEX_ENERGY_MARGIN_FACTOR) /
      1000;
    const precioEnergia =
      storedPrice !== undefined
        ? storedPrice + margenEnergiaP
        : hasExplicitOmie
          ? pv(omieMapIdx, p) + margenEnergiaP
          : margenEnergiaP;
    if (precioEnergia === undefined) return null;
    terminoEnergia += precioEnergia * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    // Base ATR power price comes from the DB (same regulated charge across all indexed products).
    // The user's margenPotencia is the commercial power margin added on top.
    const precioPotBase =
      priceOf(
        map,
        `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}:POTENCIA`,
      ) ?? 0;
    const margenPotP = margenPotIdxMap[p] ?? 0;
    terminoPotencia +=
      (precioPotBase + margenPotP) * pv(potenciaMap, p) * (dias / 365);
  }

  const terminoExceso = excesoPotencia ?? 0;
  const reactiva = extras?.reactiva ?? 0;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const ieRate =
    extras?.impuestoElectricoTasa != null
      ? extras.impuestoElectricoTasa / 100
      : IMPUESTO_ELECTRICO;
  const ivaRate = extras?.ivaTasa != null ? extras.ivaTasa / 100 : IVA_RATE;
  const baseImponible =
    terminoEnergia + terminoPotencia + terminoExceso + reactiva + otros;
  const impuestoElectricoRaw = baseImponible * ieRate;
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: "PERSONALIZADA_INDEX",
    productLabel: "Personalizada Index",
    commodity: "ELECTRICITY",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoPotencia: r2(terminoPotencia),
      excesoPotencia: r2(terminoExceso),
      otrosCargos: r2(reactiva + otros),
      alquiler: r2(alquiler),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Personalizada OMIE + B ─────────────────────────────────────

/**
 * Personalizada OMIE + B product.
 * Uses the Excel-derived "Precio TE" for the selected billing month plus the
 * user-supplied "B" term (€/MWh) per period, applying the same B multiplier
 * used by the workbook before the tariff/overhead adders.
 * Only computed when at least one B term period is > 0.
 */
function calcPersonalizadaOmieB(
  inputs: ElectricityInputs,
  map: PriceMap,
): ProductResult | null {
  // Only compute when the user has supplied at least one non-zero B term.
  const terminoBValues = inputs.personalizadaOmieB
    ? Object.values(inputs.personalizadaOmieB.terminoB)
    : [];
  const hasAnyBTerm = terminoBValues.some((v) => v != null && v !== 0);
  if (!hasAnyBTerm) return null;

  // Use DB-stored prices from the "PERSONALIZADA OMIE + B" Excel sheet.
  // These are full all-in monthly energy prices (same structure as DINAMICA).
  // The product has no tier variant — keys use an empty-string tier.
  const product = "PERSONALIZADA_OMIE_B";
  const tier = "";

  const {
    tarifaAcceso,
    consumo,
    potenciaContratada,
    excesoPotencia,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const billingMonthKey = inputs.billingMonth ?? periodo.fechaFin.slice(0, 7);
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;

  const terminoBMap = (inputs.personalizadaOmieB?.terminoB ?? {}) as Record<
    string,
    number | undefined
  >;
  const margenPotOmieBMap = (inputs.personalizadaOmieB?.margenPotencia ??
    {}) as Record<string, number | undefined>;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const baseKey = `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}`;
    const storedPrice =
      priceOf(map, `${baseKey}:MARGEN:${billingMonthKey}`) ??
      priceOf(map, `${baseKey}:MARGEN`) ??
      priceOf(map, `${baseKey}:ENERGIA`) ??
      ((inputs.omieEstimado ?? {}) as Record<string, number | undefined>)[p];
    if (storedPrice === undefined) return null;
    const bFactor =
      priceOf(map, `${baseKey}:B_FACTOR:${billingMonthKey}`) ??
      priceOf(map, `${baseKey}:B_FACTOR`) ??
      1;
    const bTermP = ((terminoBMap[p] ?? 0) * bFactor) / 1000;
    terminoEnergia += (storedPrice + bTermP) * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    // Base ATR power price comes from the DB (same regulated charge across all indexed products).
    // The user's margenPotencia is the commercial power margin added on top.
    const precioPotBase =
      priceOf(
        map,
        `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}:POTENCIA`,
      ) ?? 0;
    const margenPotP = margenPotOmieBMap[p] ?? 0;
    terminoPotencia +=
      (precioPotBase + margenPotP) * pv(potenciaMap, p) * (dias / 365);
  }

  const terminoExceso = excesoPotencia ?? 0;
  const reactiva = extras?.reactiva ?? 0;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const ieRate =
    extras?.impuestoElectricoTasa != null
      ? extras.impuestoElectricoTasa / 100
      : IMPUESTO_ELECTRICO;
  const ivaRate = extras?.ivaTasa != null ? extras.ivaTasa / 100 : IVA_RATE;
  const baseImponible =
    terminoEnergia + terminoPotencia + terminoExceso + reactiva + otros;
  const impuestoElectricoRaw = baseImponible * ieRate;
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: "PERSONALIZADA_OMIE_B",
    productLabel: "Personalizada OMIE + B",
    commodity: "ELECTRICITY",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoPotencia: r2(terminoPotencia),
      excesoPotencia: r2(terminoExceso),
      otrosCargos: r2(reactiva + otros),
      alquiler: r2(alquiler),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

function calcGasFijo(
  inputs: GasInputs,
  definition: ProductDefinition,
  tier: string,
  map: PriceMap,
): ProductResult | null {
  const product = definition.productKey;
  const {
    tarifaAcceso,
    zonaGeografica,
    consumo,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const zonaKey = zonaGeografica === "Baleares" ? "BAL" : "PEN";

  const precioEnergia = priceOf(
    map,
    `GAS:FIJO:${product}:${tier}:${tarifaAcceso}:${zonaKey}:ENERGIA`,
  );
  // TerminoDia is only stored for N1 in the price table (other tiers share the
  // same tariff-level fixed rate). Fall back to N1 when the tier-specific key
  // is absent.
  const terminoDiaPrice =
    priceOf(map, `GAS:FIJO:${product}:${tier}:${tarifaAcceso}:TERMINO_DIA`) ??
    priceOf(map, `GAS:FIJO:${product}:N1:${tarifaAcceso}:TERMINO_DIA`);
  if (precioEnergia === undefined || terminoDiaPrice === undefined) return null;

  const terminoEnergia = precioEnergia * consumo;
  // Use only terminoDia × días (TERMINO_ANIO is the same rate expressed as
  // €/year and must NOT be added on top — it would double-count the fixed term).
  const terminoFijoDia = terminoDiaPrice * dias;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const hidrocarburoRate = inputs.impuestoHidrocarburo ?? IMPUESTO_HIDROCARBURO;
  const impuestoHidrocarburo = r2(hidrocarburoRate * consumo);
  const subtotal = terminoEnergia + terminoFijoDia;
  const ivaRate = inputs.ivaTasa != null ? inputs.ivaTasa / 100 : IVA_RATE;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${definition.displayName} ${tier}`,
    commodity: "GAS",
    pricingType: "FIXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      otrosCargos: r2(otros),
      alquiler: r2(alquiler),
      impuestoHidrocarburo,
      iva,
    },
  };
}

// ─── Gas – Indexed ────────────────────────────────────────────────────────────

function calcGasIndex(
  inputs: GasInputs,
  definition: ProductDefinition,
  tier: string,
  map: PriceMap,
): ProductResult | null {
  const product = definition.productKey;
  const {
    tarifaAcceso,
    zonaGeografica,
    consumo,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const zonaKey = zonaGeografica === "Baleares" ? "BAL" : "PEN";
  const mibgasKey = `MIBGAS:${dominantBillingMonth(periodo.fechaInicio, periodo.fechaFin)}`;
  const mibgas = priceOf(map, mibgasKey) ?? 0;

  const margen = priceOf(
    map,
    `GAS:INDEX:${product}:${tier}:${tarifaAcceso}:${zonaKey}:MARGEN`,
  );
  if (margen === undefined) return null;

  // Each indexed gas product shares the fixed-term (terminoDia) of its
  // corresponding fixed product:
  //   INDEXADO      → FIJO terminoDia
  //   DINAMICA_PLUS → ESTABLE_PLUS terminoDia
  const GAS_INDEX_TO_FIJO_PRODUCT: Record<string, string> = {
    INDEXADO: "FIJO",
    DINAMICA_PLUS: "ESTABLE_PLUS",
  };
  const fijoProduct = GAS_INDEX_TO_FIJO_PRODUCT[product] ?? "FIJO";
  // Use the tier-specific terminoDia when available (ESTABLE_PLUS has
  // distinct values for N1/N2/N3). Fall back to N1 for products that only
  // store fixed terms on the N1 block (e.g. FIJO/INDEXADO).
  const terminoDiaPrice =
    priceOf(
      map,
      `GAS:FIJO:${fijoProduct}:${tier}:${tarifaAcceso}:TERMINO_DIA`,
    ) ??
    priceOf(map, `GAS:FIJO:${fijoProduct}:N1:${tarifaAcceso}:TERMINO_DIA`) ??
    0;

  const precioEnergia = mibgas + margen;
  const terminoEnergia = precioEnergia * consumo;
  const terminoFijoDia = terminoDiaPrice * dias;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const hidrocarburoRate = inputs.impuestoHidrocarburo ?? IMPUESTO_HIDROCARBURO;
  const impuestoHidrocarburo = r2(hidrocarburoRate * consumo);
  const subtotal = terminoEnergia + terminoFijoDia;
  const ivaRate = inputs.ivaTasa != null ? inputs.ivaTasa / 100 : IVA_RATE;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${definition.displayName} ${tier}`,
    commodity: "GAS",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      otrosCargos: r2(otros),
      alquiler: r2(alquiler),
      impuestoHidrocarburo,
      iva,
    },
  };
}

// ─── Gas – Personalizada Fijo ─────────────────────────────────────────────────

/**
 * Gas Personalizada Fijo (custom fixed offer) product.
 * The user supplies the all-in variable term (€/kWh) and fixed term (€/día).
 * Defaults can be imported from the COMPARATIVA LIBRE GAS sheet.
 * Only computed when terminoVariable > 0.
 */
function calcGasPersonalizadaFijo(
  inputs: GasInputs,
  map: PriceMap,
): ProductResult | null {
  if (
    !inputs.personalizadaFijo ||
    inputs.personalizadaFijo.terminoVariable <= 0
  )
    return null;

  const { terminoVariable, terminoDia } = inputs.personalizadaFijo;
  const { consumo, periodo, facturaActual, extras } = inputs;
  const dias = periodo.dias;
  const terminoEnergia = terminoVariable * consumo;
  const terminoFijoDia = (terminoDia ?? 0) * dias;
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const hidrocarburoRate = inputs.impuestoHidrocarburo ?? IMPUESTO_HIDROCARBURO;
  const impuestoHidrocarburo = r2(hidrocarburoRate * consumo);
  const subtotal = terminoEnergia + terminoFijoDia;
  const ivaRate = inputs.ivaTasa != null ? inputs.ivaTasa / 100 : IVA_RATE;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: "GAS_PERSONALIZADA_FIJO",
    productLabel: "Personalizada Fijo",
    commodity: "GAS",
    pricingType: "FIXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      otrosCargos: r2(otros),
      alquiler: r2(alquiler),
      impuestoHidrocarburo,
      iva,
    },
  };
}

// ─── Gas – Personalizada Indexada ─────────────────────────────────────────────

/**
 * Gas Personalizada Indexada product.
 * The user supplies a flat energy margin (€/kWh) on top of MIBGAS.
 * The fixed term (terminoDia) is taken from the base FIJO product for the tariff.
 * Only computed when personalizadaIndex.margenEnergia > 0.
 */
function calcGasPersonalizadaIndex(
  inputs: GasInputs,
  map: PriceMap,
): ProductResult | null {
  if (
    !inputs.personalizadaIndex ||
    inputs.personalizadaIndex.margenEnergia <= 0
  )
    return null;

  const {
    tarifaAcceso,
    zonaGeografica,
    consumo,
    periodo,
    facturaActual,
    extras,
  } = inputs;
  const dias = periodo.dias;
  const mibgasKey = `MIBGAS:${dominantBillingMonth(periodo.fechaInicio, periodo.fechaFin)}`;
  const mibgas = priceOf(map, mibgasKey) ?? 0;

  const margen = inputs.personalizadaIndex.margenEnergia;
  const precioEnergia = mibgas + margen;
  const terminoEnergia = precioEnergia * consumo;

  // Use the FIJO terminoDia for this tariff (fall back to N1)
  const terminoDiaPrice =
    priceOf(map, `GAS:FIJO:FIJO:N1:${tarifaAcceso}:TERMINO_DIA`) ?? 0;
  const terminoFijoDia = terminoDiaPrice * dias;

  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const hidrocarburoRate = inputs.impuestoHidrocarburo ?? IMPUESTO_HIDROCARBURO;
  const impuestoHidrocarburo = r2(hidrocarburoRate * consumo);
  const subtotal = terminoEnergia + terminoFijoDia;
  const ivaRate = inputs.ivaTasa != null ? inputs.ivaTasa / 100 : IVA_RATE;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual =
    dias === 365 ? r2(facturaActual - total) : r2((ahorro / dias) * 365);

  return {
    productKey: "GAS_PERSONALIZADA_INDEX",
    productLabel: "Personalizada Index",
    commodity: "GAS",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      otrosCargos: r2(otros),
      alquiler: r2(alquiler),
      impuestoHidrocarburo,
      iva,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class CalculationService {
  /**
   * Build a PriceMap from a flat array of BaseValueItem-like objects.
   * Accepts any shape with `key` + `valueNumeric` fields.
   */
  static buildPriceMap(
    items: Array<{ key: string; valueNumeric: string | number | null }>,
  ): PriceMap {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.valueNumeric !== null && item.valueNumeric !== undefined) {
        const num =
          typeof item.valueNumeric === "number"
            ? item.valueNumeric
            : parseFloat(String(item.valueNumeric));
        if (!isNaN(num)) {
          map.set(item.key, num);
        }
      }
    }
    return map;
  }

  /**
   * Calculate all electricity products for the given inputs and price map.
   * Returns results for every (product × tier) combination that has valid prices.
   * Results are sorted by pricing type (FIXED first, then INDEXED), then by ahorro descending.
   */
  static calculateElectricity(
    inputs: ElectricityInputs,
    map: PriceMap,
    options: CalculationOptions = {},
  ): ProductResult[] {
    const results: ProductResult[] = [];
    const scopeType = options.baseValueScope ?? "GLOBAL";
    const configuredProducts = (
      commodity: "ELECTRICITY",
      pricingType: "FIXED" | "INDEXED",
    ) => {
      const products = options.productDefinitions?.filter(
        (product) =>
          product.commodity === commodity && product.pricingType === pricingType,
      );
      return products && products.length > 0
        ? products
        : getProductDefinitions({ scopeType, commodity, pricingType });
    };

    for (const product of configuredProducts("ELECTRICITY", "FIXED")) {
      for (const tier of product.tiers) {
        const r = calcElecFijo(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    for (const product of configuredProducts("ELECTRICITY", "INDEXED")) {
      for (const tier of product.tiers) {
        const r = calcElecIndex(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    // Personalizada products — prices come from their dedicated Excel sheets (stored in
    // the DB like DINAMICA products). They are included whenever prices exist in the DB.
    const rPIdx = calcPersonalizadaIndex(inputs, map);
    if (rPIdx) results.push(rPIdx);

    const rPOmieB = calcPersonalizadaOmieB(inputs, map);
    if (rPOmieB) results.push(rPOmieB);

    // Personalizada Fijo — user-supplied all-in prices per period
    const rPFijo = calcElecPersonalizadaFijo(inputs, map);
    if (rPFijo) results.push(rPFijo);

    // Products are already in Excel order due to iteration sequence:
    // FIXED products iterated first (ESTABLE→1P_PLUS→etc), each with tiers N1→N2→N3
    // INDEXED products iterated second (DINAMICA→DINAMICA_PLUS→etc), each with tiers N1→N2→N3
    // Personalizada products appear last
    return results;
  }

  /**
   * Calculate all gas products for the given inputs and price map.
   * Returns results for every (product × tier) combination that has valid prices.
   * Results are sorted by ahorro descending.
   */
  static calculateGas(
    inputs: GasInputs,
    map: PriceMap,
    options: CalculationOptions = {},
  ): ProductResult[] {
    const results: ProductResult[] = [];
    const scopeType = options.baseValueScope ?? "GLOBAL";
    const configuredProducts = (pricingType: "FIXED" | "INDEXED") => {
      const products = options.productDefinitions?.filter(
        (product) =>
          product.commodity === "GAS" && product.pricingType === pricingType,
      );
      return products && products.length > 0
        ? products
        : getProductDefinitions({
            scopeType,
            commodity: "GAS",
            pricingType,
          });
    };

    for (const product of configuredProducts("FIXED")) {
      for (const tier of product.tiers) {
        const r = calcGasFijo(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    for (const product of configuredProducts("INDEXED")) {
      for (const tier of product.tiers) {
        const r = calcGasIndex(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    // Personalizada Fijo — user-supplied all-in fixed prices
    const rGasPFijo = calcGasPersonalizadaFijo(inputs, map);
    if (rGasPFijo) results.push(rGasPFijo);

    // Personalizada Indexada — only included when the user has provided a margin
    const rGasPIdx = calcGasPersonalizadaIndex(inputs, map);
    if (rGasPIdx) results.push(rGasPIdx);

    // Products are already in declaration order due to iteration sequence:
    // GAS products iterated in order (ESTABLE_GAS→ESTABLE_PLUS_GAS→DINAMICA_GAS→etc), each with tiers N1→N2→N3
    return results;
  }

  /**
   * Top-level entry point.
   * Runs all applicable calculations and returns a SimulationResults object.
   */
  static calculate(
    payload: SimulationPayload,
    map: PriceMap,
    baseValueSetId: string,
    options: CalculationOptions = {},
  ): SimulationResults {
    const results: SimulationResults = {
      calculatedAt: new Date().toISOString(),
      baseValueSetId,
    };

    if (payload.electricity) {
      results.electricity = this.calculateElectricity(
        payload.electricity,
        map,
        options,
      );
    }

    if (payload.gas) {
      results.gas = this.calculateGas(payload.gas, map, options);
    }

    return results;
  }
}
