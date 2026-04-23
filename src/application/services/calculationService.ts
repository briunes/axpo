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

const IMPUESTO_ELECTRICO = 0.0511269;
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
  const impuestoElectrico = r2(baseImponible * ieRate);
  // alquilerEquipoMedida is outside the impuesto base but inside the IVA base
  const baseIva = baseImponible + impuestoElectrico + alquiler;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
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
      impuestoElectrico,
      iva,
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
  const omieMap = (omieEstimado ?? {}) as Record<string, number | undefined>;

  let terminoEnergia = 0;
  for (const p of energyPeriods) {
    const energyPrice = priceOf(
      map,
      `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}:ENERGIA`,
    );
    if (energyPrice === undefined) {
      // Fallback for old MARGEN key if ENERGIA is not found
      const margen = priceOf(
        map,
        `ELEC:INDEX:${product}:${tier}:${tarifaAcceso}:${p}:MARGEN`,
      );
      if (margen === undefined) return null;
      const omieP = pv(omieMap, p);
      terminoEnergia += (omieP + margen) * pv(consumoMap, p);
    } else {
      terminoEnergia += energyPrice * pv(consumoMap, p);
    }
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
  const impuestoElectrico = r2(baseImponible * ieRate);
  // alquilerEquipoMedida is outside the impuesto base but inside the IVA base
  const baseIva = baseImponible + impuestoElectrico + alquiler;
  const iva = r2(baseIva * ivaRate);
  const total = r2(baseIva + iva);
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
      impuestoElectrico,
      iva,
    },
  };
}

// ─── Gas – Fixed ──────────────────────────────────────────────────────────────

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
  const terminoDiaPrice = priceOf(
    map,
    `GAS:FIJO:${product}:${tier}:${tarifaAcceso}:TERMINO_DIA`,
  );
  if (precioEnergia === undefined || terminoDiaPrice === undefined) return null;

  const terminoAnioPrice =
    priceOf(map, `GAS:FIJO:${product}:${tier}:${tarifaAcceso}:TERMINO_ANIO`) ??
    0;

  const terminoEnergia = precioEnergia * consumo;
  const terminoFijoDia = terminoDiaPrice * dias;
  const terminoFijoAnio = terminoAnioPrice * (dias / 365);
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const impuestoHidrocarburo = r2(IMPUESTO_HIDROCARBURO * consumo);
  const subtotal = terminoEnergia + terminoFijoDia + terminoFijoAnio;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * IVA_RATE);
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
      terminoFijo: r2(terminoFijoDia + terminoFijoAnio),
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

  const precioEnergia = mibgas + margen;
  const terminoEnergia = precioEnergia * consumo;
  // Gas index products in our price table have no separate fixed term
  const alquiler = extras?.alquilerEquipoMedida ?? 0;
  const otros = extras?.otrosCargos ?? 0;
  const impuestoHidrocarburo = r2(IMPUESTO_HIDROCARBURO * consumo);
  const subtotal = terminoEnergia;
  const baseIva = subtotal + impuestoHidrocarburo + alquiler + otros;
  const iva = r2(baseIva * IVA_RATE);
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

    // Products are already in Excel order due to iteration sequence:
    // FIXED products iterated first (ESTABLE→1P_PLUS→etc), each with tiers N1→N2→N3
    // INDEXED products iterated second (DINAMICA→DINAMICA_PLUS→etc), each with tiers N1→N2→N3
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
