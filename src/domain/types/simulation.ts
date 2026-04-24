/**
 * Simulation payload types
 *
 * These describe the shape of SimulationVersion.payloadJson.
 * All monetary values are in euros (€).
 * All energy values are in kWh.
 * All power values are in kW.
 *
 * Key naming convention used in BaseValueItem (for reference):
 *   ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA    → €/kWh
 *   ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA   → €/kW/año
 *   ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN    → €/kWh margin over OMIE
 *   ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA  → €/kW/año
 *   GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:ENERGIA        → €/kWh
 *   GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:TERMINO_DIA           → €/día
 *   GAS:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:MARGEN        → €/kWh margin over MIBGAS
 *   MIBGAS:{YYYY}-{MM}                                        → €/kWh MIBGAS monthly avg
 */

// ─── Enumerations ─────────────────────────────────────────────────────────── //

export type ElecTarifa = "2.0TD" | "3.0TD" | "6.1TD";

export type ElecZona = "Peninsula" | "Baleares" | "Canarias";

export type ElecPerfil = "NORMAL" | "DIURNO";

export type GasTarifa =
  | "RL01"
  | "RL02"
  | "RL03"
  | "RL04"
  | "RL05"
  | "RL06"
  | "RLPS1"
  | "RLPS2"
  | "RLPS3"
  | "RLPS4"
  | "RLPS5"
  | "RLPS6";

export type GasZona = "Peninsula" | "Baleares";

export type ProductTier = "N1" | "N2" | "N3";

/** Electricity fixed products (from BASE DE DATOS FIJO) */
export type ElecFijoProduct =
  | "ESTABLE"
  | "ESTABLE_PLUS"
  | "1P_PLUS"
  | "1P_PLUS_XL"
  | "ESTABLE_TALLERES"
  | "ESTABLE_PLUS_TALLERES";

/** Electricity indexed products (from BASE DE DATOS INDEX) */
export type ElecIndexProduct =
  | "DINAMICA_CONTROL"
  | "DINAMICA_CONTROL_PLUS"
  | "DINAMICA_CONTROL_TECHO"
  | "DINAMICA"
  | "DINAMICA_PLUS";

/** Gas fixed products (from PRECIOS FIJOS GAS) */
export type GasFijoProduct = "FIJO" | "ESTABLE_PLUS";

/** Gas indexed products (from PRECIOS INDEX GAS) */
export type GasIndexProduct = "INDEXADO" | "DINAMICA_PLUS";

// ─── Period maps ──────────────────────────────────────────────────────────── //

/** Six electricity periods. Not all tariffs use all periods. */
export type ElecPeriodMap = {
  P1: number;
  P2: number;
  P3?: number;
  P4?: number;
  P5?: number;
  P6?: number;
};

// ─── Electricity inputs ───────────────────────────────────────────────────── //

export interface ElectricityInputs {
  /** Access tariff (determines number of active periods) */
  tarifaAcceso: ElecTarifa;

  /** Geographic zone */
  zonaGeografica: ElecZona;

  /** Load profile used by the network distributor */
  perfilCarga: ElecPerfil;

  /** Contracted power in kW per period */
  potenciaContratada: ElecPeriodMap;

  /**
   * Excess power charge in € — copied directly from the client's invoice.
   * This is a regulatory grid charge, identical regardless of commercial supplier
   * (matches Excel E35 pass-through).
   */
  excesoPotencia?: number;

  /** Energy consumed in kWh per period for the billing period */
  consumo: ElecPeriodMap;

  /** Billing period */
  periodo: {
    fechaInicio: string; // ISO date "YYYY-MM-DD"
    fechaFin: string; // ISO date "YYYY-MM-DD"
    dias: number; // calendar days in the period
  };

  /** Client's current total invoice amount in €, used to compute savings */
  facturaActual: number;

  /**
   * Estimated OMIE spot price per period in €/kWh.
   * Required for indexed electricity products; ignored for fixed products.
   * If omitted the indexed calculation uses 0 (shows margin-only cost).
   */
  omieEstimado?: Partial<
    Record<"P1" | "P2" | "P3" | "P4" | "P5" | "P6", number>
  >;

  /** Extra line items on the current bill */
  extras: {
    reactiva?: number; // €  reactive energy charge
    alquilerEquipoMedida?: number; // €  meter rental
    otrosCargos?: number; // €  other charges
    /** IVA rate as a percentage (e.g. 21 means 21%). Falls back to 21% if not set. */
    ivaTasa?: number;
    /** Impuesto Eléctrico rate as a percentage (e.g. 5.11269 means 5.11%). Falls back to 5.11269% if not set. */
    impuestoElectricoTasa?: number;
  };
}

// ─── Gas inputs ───────────────────────────────────────────────────────────── //

export interface GasInputs {
  /** CUPS identifier */
  cups?: string;

  /** Annual consumption in kWh */
  consumoAnual?: number;

  /** Account holder name */
  nombreTitular?: string;

  /** Contact person */
  personaContacto?: string;

  /** Sales representative */
  comercial?: string;

  /** Supply address */
  direccion?: string;

  /** Current supplier/marketer */
  comercializadorActual?: string;

  /** Access tariff */
  tarifaAcceso: GasTarifa;

  /** Geographic zone */
  zonaGeografica: GasZona;

  /** Total energy consumed in kWh for the billing period */
  consumo: number;

  /** Remote meter reading service (affects fixed term in some tariffs) */
  telemedida: "SI" | "NO";

  /** Billing period */
  periodo: {
    fechaInicio: string;
    fechaFin: string;
    dias: number;
  };

  /** Client's current total invoice amount in €, used to compute savings */
  facturaActual: number;

  /** Extra line items */
  extras: {
    alquilerEquipoMedida?: number; // €
    otrosCargos?: number; // €
  };

  /** VAT rate as percentage (e.g., 21 for 21%) */
  ivaTasa?: number;

  /** Hydrocarbon tax in €/kWh */
  impuestoHidrocarburo?: number;
}

// ─── Calculation results ─────────────────────────────────────────────────── //

/** Result for one product variant */
export interface ProductResult {
  /** Composite key matching the key scheme used in BaseValueItem */
  productKey: string; // e.g. "ESTABLE:N1"

  /** Human-readable label */
  productLabel: string; // e.g. "ESTABLE N1 (Supertarifa)"

  /** Commodity: "ELECTRICITY" | "GAS" */
  commodity: "ELECTRICITY" | "GAS";

  /** Pricing type: "FIXED" | "INDEXED" */
  pricingType: "FIXED" | "INDEXED";

  /** Computed total invoice for the billing period in € */
  totalFactura: number;

  /** Savings vs current invoice: facturaActual - totalFactura (positive = savings) */
  ahorro: number;

  /** Savings percentage: ahorro / facturaActual × 100 */
  pctAhorro: number;

  /** Annualised savings: ahorro × 365 / dias */
  ahorroAnual: number;

  /** Breakdown for transparency / PDF */
  desglose?: {
    terminoEnergia?: number;
    terminoPotencia?: number;
    excesoPotencia?: number;
    terminoFijo?: number;
    extras?: number;
    impuestoElectrico?: number;
    impuestoHidrocarburo?: number;
    iva?: number;
  };
}

export interface SimulationResults {
  /** ISO timestamp of when the calculation was run */
  calculatedAt: string;

  /** ID of the BaseValueSet used for prices */
  baseValueSetId: string;

  /** Results for all electricity products */
  electricity?: ProductResult[];

  /** Results for all gas products */
  gas?: ProductResult[];
}

// ─── Top-level payload ────────────────────────────────────────────────────── //

export interface OcrMeta {
  source: string;
  confidence: number | null;
  updatedAt: string;
}

/**
 * The typed shape of SimulationVersion.payloadJson.
 * All fields are optional to allow partial/progressive completion.
 */
export interface SimulationPayload {
  /** Schema version — increment when the shape changes */
  schemaVersion?: "1";

  /** Which commodities this simulation covers */
  type?: "ELECTRICITY" | "GAS";

  electricity?: ElectricityInputs;

  gas?: GasInputs;

  /** OCR prefill metadata (set by the /ocr-prefill endpoint) */
  ocrMeta?: OcrMeta;

  /** Calculation results (set by the /calculate endpoint) */
  results?: SimulationResults;

  /** Selected offer to present to client */
  selectedOffer?: {
    productKey: string;
    commodity: "ELECTRICITY" | "GAS";
    pricingType: "FIXED" | "INDEXED";
    selectedAt: string;
  };
}
