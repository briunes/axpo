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

export type PriceMap = Map<string, number>;

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPUESTO_ELECTRICO = 0.0511; // matches Excel E51 default (5.11%)
const IVA_RATE = 0.21;
const IMPUESTO_HIDROCARBURO = 0.00234; // €/kWh — Ley de Hidrocarburos

const TIERS = ["N1", "N2", "N3"] as const;

// Product order matches Excel simulator layout
const ELEC_FIJO_PRODUCTS = [
  "ESTABLE",
  "ESTABLE_PLUS",
  "1P_PLUS",
  "1P_PLUS_XL",
  "ESTABLE_TALLERES",
  "ESTABLE_PLUS_TALLERES",
] as const;

// Product order matches Excel simulator layout
const ELEC_INDEX_PRODUCTS = [
  "DINAMICA",
  "DINAMICA_PLUS",
  "DINAMICA_CONTROL",
  "DINAMICA_CONTROL_PLUS",
  "DINAMICA_CONTROL_TECHO",
] as const;

const GAS_FIJO_PRODUCTS = ["FIJO", "ESTABLE_PLUS"] as const;
const GAS_INDEX_PRODUCTS = ["INDEXADO", "DINAMICA_PLUS"] as const;

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

const ELEC_PRODUCT_LABELS: Record<string, string> = {
  ESTABLE: "Estable",
  ESTABLE_PLUS: "Estable Plus",
  "1P_PLUS": "1P Plus",
  "1P_PLUS_XL": "1P Plus XL",
  ESTABLE_TALLERES: "Estable Talleres",
  ESTABLE_PLUS_TALLERES: "Estable Plus Talleres",
  DINAMICA_CONTROL: "Dinámica Control",
  DINAMICA_CONTROL_PLUS: "Dinámica Control Plus",
  DINAMICA_CONTROL_TECHO: "Dinámica Control Techo",
  DINAMICA: "Dinámica",
  DINAMICA_PLUS: "Dinámica Plus",
};

const GAS_PRODUCT_LABELS: Record<string, string> = {
  FIJO: "Gas Fijo",
  ESTABLE_PLUS: "Gas Estable Plus",
  INDEXADO: "Gas Indexado",
  DINAMICA_PLUS: "Gas Dinámica Plus",
};

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

// ─── Electricity – Fixed ──────────────────────────────────────────────────────

function calcElecFijo(
  inputs: ElectricityInputs,
  product: string,
  tier: string,
  map: PriceMap,
): ProductResult | null {
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

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const precioEn = priceOf(
      map,
      `ELEC:FIJO:${product}:${tier}:${tarifaAcceso}:${p}:ENERGIA`,
    );
    if (precioEn === undefined) return null; // missing price → product unavailable for this tier/tariff combo
    terminoEnergia += precioEn * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    const precioPot = priceOf(
      map,
      `ELEC:FIJO:${product}:${tier}:${tarifaAcceso}:${p}:POTENCIA`,
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
  // Match Excel: use full precision for IE and IVA in the calculation chain,
  // only round for display values in desglose and for the final total.
  const impuestoElectricoRaw = baseImponible * ieRate;
  // alquilerEquipoMedida is outside the impuesto base but inside the IVA base
  const baseIva = baseImponible + impuestoElectricoRaw + alquiler;
  const ivaRaw = baseIva * ivaRate;
  const total = r2(baseIva + ivaRaw);
  const ahorro = r2(facturaActual - total);
  const pctAhorro = facturaActual > 0 ? r2((ahorro / facturaActual) * 100) : 0;
  const ahorroAnual = r2(ahorro * 12);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${ELEC_PRODUCT_LABELS[product] ?? product} ${tier}`,
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
      extras: r2(reactiva + alquiler + otros),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Indexed ────────────────────────────────────────────────────

function calcElecIndex(
  inputs: ElectricityInputs,
  product: string,
  tier: string,
  map: PriceMap,
): ProductResult | null {
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
  const billingMonthKey = periodo.fechaInicio.slice(0, 7); // "YYYY-MM"

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
  const ahorroAnual = r2(ahorro * 12);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${ELEC_PRODUCT_LABELS[product] ?? product} ${tier}`,
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
      extras: r2(reactiva + alquiler + otros),
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
 * Formula: energyCost = (omie[p] + margenEnergia[p]/1000) × consumo[p]
 */
function calcPersonalizadaIndex(
  inputs: ElectricityInputs,
): ProductResult | null {
  const pi = inputs.personalizadaIndex;
  if (!pi) return null;

  // Skip entirely if no energy margin has been provided
  const hasEnergyMargin = Object.values(pi.margenEnergia).some(
    (v) => v && v > 0,
  );
  if (!hasEnergyMargin) return null;

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
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;
  const omieMap = (omieEstimado ?? {}) as Record<string, number | undefined>;
  const margenEnergiaMap = (pi.margenEnergia ?? {}) as Record<
    string,
    number | undefined
  >;
  const margenPotenciaMap = (pi.margenPotencia ?? {}) as Record<
    string,
    number | undefined
  >;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const margenMWh = margenEnergiaMap[p] ?? 0;
    const margenKwh = margenMWh / 1000; // convert €/MWh → €/kWh
    const omieP = pv(omieMap as Record<string, number | undefined>, p);
    terminoEnergia += (omieP + margenKwh) * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    const margenPot = margenPotenciaMap[p] ?? 0; // €/kW/year
    terminoPotencia += margenPot * pv(potenciaMap, p) * (dias / 365);
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
  const ahorroAnual = r2(ahorro * 12);

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
      extras: r2(reactiva + alquiler + otros),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

// ─── Electricity – Personalizada OMIE + B ─────────────────────────────────────

/**
 * Personalizada OMIE + B product.
 * Uses OMIE + user-supplied "B" term (€/MWh) per period as energy price,
 * plus user-supplied power margins (€/kW/year).
 * Only computed when at least one B term period is > 0.
 * Formula: energyCost = (omie[p] + terminoB[p]/1000) × consumo[p]
 */
function calcPersonalizadaOmieB(
  inputs: ElectricityInputs,
): ProductResult | null {
  const pb = inputs.personalizadaOmieB;
  if (!pb) return null;

  const hasBTerm = Object.values(pb.terminoB).some((v) => v && v > 0);
  if (!hasBTerm) return null;

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
  const dias = periodo.dias;
  const energyPeriods = ENERGY_PERIODS[tarifaAcceso] ?? [];
  const powerPeriods = POWER_PERIODS[tarifaAcceso] ?? [];
  const consumoMap = consumo as unknown as Record<string, number | undefined>;
  const potenciaMap = potenciaContratada as unknown as Record<
    string,
    number | undefined
  >;
  const omieMap = (omieEstimado ?? {}) as Record<string, number | undefined>;
  const terminoBMap = (pb.terminoB ?? {}) as Record<string, number | undefined>;
  const margenPotenciaMap = (pb.margenPotencia ?? {}) as Record<
    string,
    number | undefined
  >;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const bMWh = terminoBMap[p] ?? 0;
    const bKwh = bMWh / 1000; // convert €/MWh → €/kWh
    const omieP = pv(omieMap as Record<string, number | undefined>, p);
    terminoEnergia += (omieP + bKwh) * pv(consumoMap, p);
  }

  let terminoPotencia = 0;
  for (const p of powerPeriods) {
    const margenPot = margenPotenciaMap[p] ?? 0; // €/kW/year
    terminoPotencia += margenPot * pv(potenciaMap, p) * (dias / 365);
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
  const ahorroAnual = r2(ahorro * 12);

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
      extras: r2(reactiva + alquiler + otros),
      impuestoElectrico: r2(impuestoElectricoRaw),
      iva: r2(ivaRaw),
    },
  };
}

function calcGasFijo(
  inputs: GasInputs,
  product: string,
  tier: string,
  map: PriceMap,
): ProductResult | null {
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
  const ahorroAnual = r2(ahorro * 12);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${GAS_PRODUCT_LABELS[product] ?? product} ${tier}`,
    commodity: "GAS",
    pricingType: "FIXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      extras: r2(alquiler + otros),
      impuestoHidrocarburo,
      iva,
    },
  };
}

// ─── Gas – Indexed ────────────────────────────────────────────────────────────

function calcGasIndex(
  inputs: GasInputs,
  product: string,
  tier: string,
  map: PriceMap,
): ProductResult | null {
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
  const mibgasKey = `MIBGAS:${periodo.fechaInicio.slice(0, 7)}`;
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
  const ahorroAnual = r2(ahorro * 12);

  return {
    productKey: `${product}:${tier}`,
    productLabel: `${GAS_PRODUCT_LABELS[product] ?? product} ${tier}`,
    commodity: "GAS",
    pricingType: "INDEXED",
    totalFactura: total,
    ahorro,
    pctAhorro,
    ahorroAnual,
    desglose: {
      terminoEnergia: r2(terminoEnergia),
      terminoFijo: r2(terminoFijoDia),
      extras: r2(alquiler + otros),
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
  ): ProductResult[] {
    const results: ProductResult[] = [];

    for (const product of ELEC_FIJO_PRODUCTS) {
      for (const tier of TIERS) {
        const r = calcElecFijo(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    for (const product of ELEC_INDEX_PRODUCTS) {
      for (const tier of TIERS) {
        const r = calcElecIndex(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    // Personalizada products — only included when the user has filled the relevant fields
    const rPIdx = calcPersonalizadaIndex(inputs);
    if (rPIdx) results.push(rPIdx);

    const rPOmieB = calcPersonalizadaOmieB(inputs);
    if (rPOmieB) results.push(rPOmieB);

    // Products are already in Excel order due to iteration sequence:
    // FIXED products iterated first (ESTABLE→1P_PLUS→etc), each with tiers N1→N2→N3
    // INDEXED products iterated second (DINAMICA→DINAMICA_PLUS→etc), each with tiers N1→N2→N3
    // Personalizada products appear last (only when user data is provided)
    return results;
  }

  /**
   * Calculate all gas products for the given inputs and price map.
   * Returns results for every (product × tier) combination that has valid prices.
   * Results are sorted by ahorro descending.
   */
  static calculateGas(inputs: GasInputs, map: PriceMap): ProductResult[] {
    const results: ProductResult[] = [];

    for (const product of GAS_FIJO_PRODUCTS) {
      for (const tier of TIERS) {
        const r = calcGasFijo(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

    for (const product of GAS_INDEX_PRODUCTS) {
      for (const tier of TIERS) {
        const r = calcGasIndex(inputs, product, tier, map);
        if (r) results.push(r);
      }
    }

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
  ): SimulationResults {
    const results: SimulationResults = {
      calculatedAt: new Date().toISOString(),
      baseValueSetId,
    };

    if (payload.electricity) {
      results.electricity = this.calculateElectricity(payload.electricity, map);
    }

    if (payload.gas) {
      results.gas = this.calculateGas(payload.gas, map);
    }

    return results;
  }
}
