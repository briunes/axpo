/**
 * Template variable replacement utilities
 *
 * This module provides functions to extract and replace template variables
 * in HTML templates with actual simulation data.
 */

import type {
  SimulationPayload,
  ElecPeriodMap,
} from "@/domain/types/simulation";
import type { EditableSectionOverrides } from "@/infrastructure/templates/editableSections";
import {
  mergeEditableSections,
  type EditableSectionsConfig,
} from "@/infrastructure/templates/editableSections";

/**
 * Formats a number as currency (euros)
 */
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formats a number with comma decimal separator
 */
function formatNumber(value: number | undefined, decimals: number = 4): string {
  if (value === undefined || value === null) return "-";
  return value.toFixed(decimals).replace(".", ",");
}

function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("es-ES");
}

/**
 * Gets value from period map or returns default
 */
function getPeriodValue(
  periodMap: ElecPeriodMap | undefined,
  period: keyof ElecPeriodMap,
  decimals: number = 4,
): string {
  if (!periodMap) return "-";
  const value = periodMap[period];
  return value !== undefined ? formatNumber(value, decimals) : "-";
}

/**
 * Optional share/email context for variables that aren't part of the
 * simulation payload itself (e.g. public link, PIN, magic link).
 */
export interface ShareContext {
  simulationLink?: string;
  pin?: string;
  expiresInDays?: number;
  magicLink?: string;
}

/**
 * Extracts all template variable values from simulation data
 * Returns a map of variable keys to their actual values
 *
 * @param simulation - The simulation object
 * @param payload - Optional simulation payload with results
 * @param shareContext - Optional context for shared/email links
 * @param editableSections - Optional editable sections config
 * @param editableOverrides - Optional overrides for editable sections
 * @param language - Language code for chart labels (es, en, fr, de, it, pt) - defaults to es
 */
export function extractVariableValues(
  simulation: any,
  payload?: SimulationPayload,
  shareContext?: ShareContext,
  editableSections?: EditableSectionsConfig,
  editableOverrides?: EditableSectionOverrides,
  language: string = "es",
): Record<string, string> {
  // Debug logging
  console.log(
    "[extractVariableValues] payload keys:",
    payload ? Object.keys(payload) : "null",
  );
  console.log(
    "[extractVariableValues] payload.electricity exists:",
    !!payload?.electricity,
  );
  console.log(
    "[extractVariableValues] payload.results exists:",
    !!payload?.results,
  );
  console.log(
    "[extractVariableValues] payload.results.electricity length:",
    payload?.results?.electricity?.length,
  );

  const electricity = payload?.electricity as any; // Cast to any to access clientData
  const gas = payload?.gas as any;
  const results = payload?.results;

  // Get selected offer index or default to first result
  const selectedOfferKey = payload?.selectedOffer?.productKey;
  console.log("[extractVariableValues] selectedOfferKey:", selectedOfferKey);
  console.log(
    "[extractVariableValues] available results:",
    results?.electricity?.map((r) => r.productKey),
  );

  const selectedResult = selectedOfferKey
    ? results?.electricity?.find((r) => r.productKey === selectedOfferKey)
    : results?.electricity?.[0];

  console.log(
    "[extractVariableValues] selectedResult:",
    selectedResult
      ? {
          productKey: selectedResult.productKey,
          totalFactura: selectedResult.totalFactura,
          ahorro: selectedResult.ahorro,
          hasDesglose: !!selectedResult.desglose,
        }
      : "null",
  );

  // Calculate period dates
  const periodStart = electricity?.periodo?.fechaInicio || "N/A";
  const periodEnd = electricity?.periodo?.fechaFin || "N/A";
  const simulationPeriod = `${periodStart} - ${periodEnd}`;

  // Calculate annual consumption (approximate from monthly)
  const totalConsumption = electricity?.consumo
    ? Object.values(electricity.consumo).reduce(
        (a: number, b: unknown) => (a || 0) + ((b as number) || 0),
        0,
      )
    : 0;
  const annualConsumption = (totalConsumption as number) * 12;
  const electricityBillingDays = electricity?.periodo?.dias || 0;

  // Extract client info - check simulation, electricity and gas payload shapes.
  const clientData = electricity?.clientData || {};
  const gasClientData = gas?.clientData || {};
  const clientName =
    simulation.client?.name ||
    clientData.nombreTitular ||
    gas?.nombreTitular ||
    gasClientData.nombreTitular ||
    "N/A";
  const contactPerson =
    simulation.client?.contactPerson ||
    simulation.client?.contactName ||
    clientData.personaContacto ||
    gas?.personaContacto ||
    gasClientData.personaContacto ||
    clientName;
  const clientAddress = simulation.client?.address
    ? `${simulation.client.address}, ${simulation.client.postalCode || ""} ${simulation.client.city || ""}`.trim()
    : clientData.direccion ||
      gas?.direccion ||
      gasClientData.direccion ||
      "N/A";

  // CUPS - check simulation-level, electricity payload and gas payload fields.
  const cupsNumber =
    simulation.cupsNumber ||
    clientData.cups ||
    gas?.cups ||
    gasClientData.cups ||
    "N/A";

  // Product name
  const productName = selectedResult?.productLabel || "N/A";

  // AXPO plan costs (from results)
  const axpoDesglose = selectedResult?.desglose || {};
  const axpoPowerCost = axpoDesglose.terminoPotencia || 0;
  const axpoEnergyCost = axpoDesglose.terminoEnergia || 0;
  const axpoExcessCost = axpoDesglose.excesoPotencia || 0;
  const axpoTaxCost =
    (axpoDesglose.impuestoElectrico || 0) +
    (axpoDesglose.impuestoHidrocarburo || 0);
  const axpoOtherCost = axpoDesglose.otrosCargos || 0;
  const axpoRentalCost =
    axpoDesglose.alquiler || electricity?.extras?.alquilerEquipoMedida || 0;
  const axpoVat = axpoDesglose.iva || 0;
  const axpoTotal = selectedResult?.totalFactura || 0;

  // Current plan costs.
  // The simulation form only reliably stores `facturaActual` (the total).
  // Anything else is sourced from `electricity.extras` if present; the
  // remaining base is split between terminoPotencia and terminoEnergia
  // using the same per-period distribution that Axpo uses, so the two
  // plans stay self-consistent. Tax (IE) and VAT are back-derived from
  // the total using the rates captured in `extras` (matches the way
  // the gas side is already handled further down in this function).
  const currentTotal = electricity?.facturaActual || 0;
  const currentIvaTasa =
    electricity?.extras?.ivaTasa != null ? electricity.extras.ivaTasa : 21;
  const currentIeTasa =
    electricity?.extras?.impuestoElectricoTasa != null
      ? electricity.extras.impuestoElectricoTasa
      : 5.11269;
  const currentRentalCost = electricity?.extras?.alquilerEquipoMedida || 0;
  const currentReactiveCost = electricity?.extras?.reactiva || 0;
  const currentOtherChargeCost = electricity?.extras?.otrosCargos || 0;
  const currentExcessCost = electricity?.excesoPotencia || 0;
  // Lines that are KNOWN exactly from the form (always real € values).
  const currentKnownBase =
    currentRentalCost +
    currentReactiveCost +
    currentOtherChargeCost +
    currentExcessCost;
  // Back-derive IE + VAT from currentTotal using the input rates.
  // The Spanish tax chain is:  total = (base + base*ie) * (1+iva) + alquiler
  // Solving for IE directly (rental is OUTSIDE the IE base but inside IVA):
  //   ie  = total * ieR / ((1+ieR) * (1+ivaR))
  //   vat = (total - ie - alquiler) * ivaR
  const ieR = currentIeTasa / 100;
  const ivaR = currentIvaTasa / 100;
  const currentTaxCost = currentTotal * (ieR / ((1 + ieR) * (1 + ivaR)));
  const currentVat = (currentTotal - currentTaxCost - currentRentalCost) * ivaR;
  const explicitCurrentTax = (electricity?.extras as any)
    ?.impuestoElectricoActual;
  const explicitCurrentVat = (electricity?.extras as any)?.ivaActual;
  const displayedCurrentTax =
    explicitCurrentTax != null ? Number(explicitCurrentTax) : currentTaxCost;
  const displayedCurrentVat =
    explicitCurrentVat != null ? Number(explicitCurrentVat) : currentVat;
  // Base for terminoPotencia + terminoEnergia (the only lines we can't
  // observe directly) = total − tax − vat − known lines.
  const currentPowerEnergyBase = Math.max(
    0,
    currentTotal - displayedCurrentTax - displayedCurrentVat - currentKnownBase,
  );
  // If the OCR or the form captured the real split, prefer it.
  const explicitCurrentPower = (electricity?.extras as any)
    ?.terminoPotenciaActual;
  const explicitCurrentEnergy = (electricity?.extras as any)
    ?.terminoEnergiaActual;
  // Otherwise, mirror the Axpo plan's power/energy ratio - a much
  // better estimate than fixed 35%/40% because it adapts to the
  // access tariff, period mix and consumption profile of THIS simulation.
  const axpoPeSum = axpoPowerCost + axpoEnergyCost || 1;
  const currentPowerCost =
    explicitCurrentPower != null
      ? Number(explicitCurrentPower)
      : currentPowerEnergyBase * (axpoPowerCost / axpoPeSum);
  const currentEnergyCost =
    explicitCurrentEnergy != null
      ? Number(explicitCurrentEnergy)
      : currentPowerEnergyBase * (axpoEnergyCost / axpoPeSum);
  // CURRENT_OTHER_COST keeps its semantic of "reactiva + otros cargos"
  // to mirror the Axpo desglose shape so a side-by-side comparison
  // shows comparable line items.
  const currentOtherCost = currentReactiveCost + currentOtherChargeCost;

  // Savings
  const savingsAmount = selectedResult?.ahorro || 0;

  // ─── Gas variables ────────────────────────────────────────────────────────
  const gasResults = payload?.results?.gas;
  const selectedGasOfferKey =
    payload?.selectedOffer?.commodity === "GAS"
      ? payload?.selectedOffer?.productKey
      : undefined;
  const selectedGasResult = selectedGasOfferKey
    ? gasResults?.find((r: any) => r.productKey === selectedGasOfferKey)
    : gasResults?.[0];

  // Gas consumption - prefer consumoAnual, fall back to consumo (monthly * 12)
  const gasAnnualConsumptionKwh =
    gas?.consumoAnual || (gas?.consumo ? (gas.consumo as number) * 12 : 0);

  // Current gas costs
  const gasCurrentTotal: number = gas?.facturaActual || 0;
  const gasIvaTasa: number = gas?.ivaTasa ?? 21;
  const gasCurrentRentalCost: number = gas?.extras?.alquilerEquipoMedida || 0;
  const gasCurrentOtherCost: number = gas?.extras?.otrosCargos || 0;
  // Back-calculate VAT and tax from current total using input rates
  const gasCurrentVat = gasCurrentTotal * (gasIvaTasa / (100 + gasIvaTasa));
  const gasCurrentPreVat = gasCurrentTotal - gasCurrentVat;
  const gasImpHidro: number = gas?.impuestoHidrocarburo ?? 0;
  // IEH = impuestoHidrocarburo (€/kWh) * consumption in billing period
  const gasBillingConsumption: number = gas?.consumo || 0;
  const gasCurrentTax = gasImpHidro * gasBillingConsumption;
  const gasCurrentBase = Math.max(
    0,
    gasCurrentPreVat -
      gasCurrentTax -
      gasCurrentRentalCost -
      gasCurrentOtherCost,
  );
  // Rough 70/30 split of base into variable/fixed
  const gasCurrentVariableCost = gasCurrentBase * 0.7;
  const gasCurrentFixedCost = gasCurrentBase * 0.3;

  // AXPO gas costs from selected result desglose
  const gasAxpoDesglose = selectedGasResult?.desglose || {};
  const gasAxpoFixedCost: number = gasAxpoDesglose.terminoFijo || 0;
  const gasAxpoVariableCost: number = gasAxpoDesglose.terminoEnergia || 0;
  const gasAxpoTax: number = gasAxpoDesglose.impuestoHidrocarburo || 0;
  const gasAxpoRentalCost: number = gasAxpoDesglose.alquiler || 0;
  const gasAxpoOtherCost: number = gasAxpoDesglose.otrosCargos || 0;
  const gasAxpoVat: number = gasAxpoDesglose.iva || 0;
  const gasAxpoTotal: number = selectedGasResult?.totalFactura || 0;

  // Gas savings and product
  const gasSavingsAmount: number = selectedGasResult?.ahorro || 0;
  const gasProductName: string = selectedGasResult?.productLabel || "N/A";

  // Gas period dates
  const gasPeriodStart = gas?.periodo?.fechaInicio || "N/A";
  const gasPeriodEnd = gas?.periodo?.fechaFin || "N/A";
  const gasSimulationPeriod = `${gasPeriodStart} - ${gasPeriodEnd}`;

  // Determine if this is a gas simulation
  const isGas = payload?.type === "GAS" || !!gas;

  // Build complete variable map
  const variables: Record<string, string> = {
    // Client information
    CLIENT_NAME: clientName,
    CONTACT_PERSON: contactPerson,
    CLIENT_ADDRESS: clientAddress,
    CUPS_NUMBER: cupsNumber,

    // Simulation metadata
    SIMULATION_ID: simulation.id,
    SIMULATION_REFERENCE: simulation.referenceNumber || simulation.id || "N/A",
    SIMULATION_GENERATED_AT: formatDateTime(payload?.results?.calculatedAt),
    SIMULATION_PERIOD: isGas ? gasSimulationPeriod : simulationPeriod,
    ANNUAL_CONSUMPTION: formatNumber(annualConsumption, 0),
    PRODUCT_NAME: isGas ? gasProductName : productName,
    CREATED_AT: simulation.createdAt
      ? new Date(simulation.createdAt).toLocaleDateString()
      : "N/A",
    EXPIRES_AT: simulation.expiresAt
      ? new Date(simulation.expiresAt).toLocaleDateString()
      : "N/A",
    STATUS: simulation.status || "N/A",

    // Share / email context
    SIMULATION_LINK:
      shareContext?.simulationLink ||
      (simulation.publicToken
        ? `${process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || process.env.FRONTEND_SIMULADOR_URL || "https://simuladorpublicoaxpo.b-cdn.net"}/?token=${simulation.publicToken}`
        : "N/A"),
    PIN: shareContext?.pin || "N/A",
    EXPIRES_IN_DAYS:
      shareContext?.expiresInDays !== undefined
        ? String(shareContext.expiresInDays)
        : simulation.expiresAt
          ? String(
              Math.max(
                0,
                Math.ceil(
                  (new Date(simulation.expiresAt).getTime() - Date.now()) /
                    86_400_000,
                ),
              ),
            )
          : "N/A",
    MAGIC_LINK: shareContext?.magicLink || "N/A",

    // User info
    OWNER_NAME: simulation.ownerUser?.fullName || "N/A",
    OWNER_EMAIL:
      simulation.ownerUser?.commercialEmail ||
      simulation.ownerUser?.email ||
      "N/A",
    OWNER_PHONE:
      simulation.ownerUser?.commercialPhone ||
      simulation.ownerUser?.mobilePhone ||
      "N/A",
    USER_AGENCY:
      simulation.ownerUser?.agency?.name || simulation.agency?.name || "N/A",

    // Current plan - Power contracted (kW)
    CURRENT_POWER_P1: getPeriodValue(electricity?.potenciaContratada, "P1"),
    CURRENT_POWER_P2: getPeriodValue(electricity?.potenciaContratada, "P2"),
    CURRENT_POWER_P3: getPeriodValue(electricity?.potenciaContratada, "P3"),
    CURRENT_POWER_P4: getPeriodValue(electricity?.potenciaContratada, "P4"),
    CURRENT_POWER_P5: getPeriodValue(electricity?.potenciaContratada, "P5"),
    CURRENT_POWER_P6: getPeriodValue(electricity?.potenciaContratada, "P6"),

    // Current plan - Energy consumption (kWh)
    CURRENT_ENERGY_P1: getPeriodValue(electricity?.consumo, "P1", 0),
    CURRENT_ENERGY_P2: getPeriodValue(electricity?.consumo, "P2", 0),
    CURRENT_ENERGY_P3: getPeriodValue(electricity?.consumo, "P3", 0),
    CURRENT_ENERGY_P4: getPeriodValue(electricity?.consumo, "P4", 0),
    CURRENT_ENERGY_P5: getPeriodValue(electricity?.consumo, "P5", 0),
    CURRENT_ENERGY_P6: getPeriodValue(electricity?.consumo, "P6", 0),

    // Current plan - Cost breakdown
    CURRENT_POWER_COST: formatCurrency(currentPowerCost),
    CURRENT_ENERGY_COST: formatCurrency(currentEnergyCost),
    CURRENT_EXCESS_COST: formatCurrency(currentExcessCost),
    CURRENT_TAX_COST: formatCurrency(displayedCurrentTax),
    CURRENT_OTHER_COST: formatCurrency(currentOtherCost),
    CURRENT_RENTAL_COST: formatCurrency(currentRentalCost),
    CURRENT_VAT: formatCurrency(displayedCurrentVat),
    CURRENT_TOTAL: formatCurrency(currentTotal),

    // AXPO plan - Power contracted (same as current)
    AXPO_POWER_P1: getPeriodValue(electricity?.potenciaContratada, "P1"),
    AXPO_POWER_P2: getPeriodValue(electricity?.potenciaContratada, "P2"),
    AXPO_POWER_P3: getPeriodValue(electricity?.potenciaContratada, "P3"),
    AXPO_POWER_P4: getPeriodValue(electricity?.potenciaContratada, "P4"),
    AXPO_POWER_P5: getPeriodValue(electricity?.potenciaContratada, "P5"),
    AXPO_POWER_P6: getPeriodValue(electricity?.potenciaContratada, "P6"),

    // AXPO plan - Energy consumption (same as current)
    AXPO_ENERGY_P1: getPeriodValue(electricity?.consumo, "P1", 0),
    AXPO_ENERGY_P2: getPeriodValue(electricity?.consumo, "P2", 0),
    AXPO_ENERGY_P3: getPeriodValue(electricity?.consumo, "P3", 0),
    AXPO_ENERGY_P4: getPeriodValue(electricity?.consumo, "P4", 0),
    AXPO_ENERGY_P5: getPeriodValue(electricity?.consumo, "P5", 0),
    AXPO_ENERGY_P6: getPeriodValue(electricity?.consumo, "P6", 0),

    // AXPO plan - Cost breakdown
    AXPO_POWER_COST: formatCurrency(axpoPowerCost),
    AXPO_ENERGY_COST: formatCurrency(axpoEnergyCost),
    AXPO_EXCESS_COST: formatCurrency(axpoExcessCost),
    AXPO_TAX_COST: formatCurrency(axpoTaxCost),
    AXPO_OTHER_COST: formatCurrency(axpoOtherCost),
    AXPO_RENTAL_COST: formatCurrency(axpoRentalCost),
    AXPO_VAT: formatCurrency(axpoVat),
    AXPO_TOTAL: formatCurrency(axpoTotal),

    // Savings
    SAVINGS_AMOUNT: formatCurrency(isGas ? gasSavingsAmount : savingsAmount),

    // ─── Charts ──────────────────────────────────────────────────────────────
    CHART_COMPARATIVA: buildComparativaChart(
      isGas ? gasCurrentTotal : currentTotal,
      isGas ? gasAxpoTotal : axpoTotal,
      isGas ? gasSavingsAmount : savingsAmount,
      isGas ? gas?.periodo?.dias || 30 : electricity?.periodo?.dias || 30,
      isGas
        ? (selectedGasResult?.ahorroAnual ?? null)
        : (selectedResult?.ahorroAnual ?? null),
      language,
    ),

    // ─── Gas-specific variables ──────────────────────────────────────────────
    // ─── Electricity-specific variables ──────────────────────────────────────
    ELECTRICITY_TARIFF: electricity?.tarifaAcceso || "N/A",
    ELECTRICITY_ZONE: electricity?.zonaGeografica || "N/A",
    ELECTRICITY_PROFILE: electricity?.perfilCarga || "N/A",
    ELECTRICITY_BILLING_DAYS: electricityBillingDays
      ? String(electricityBillingDays)
      : "N/A",
    ELECTRICITY_CONSUMPTION_KWH: formatNumber(totalConsumption as number, 0),
    ELECTRICITY_IVA_RATE: formatNumber(currentIvaTasa, 2),
    ELECTRICITY_TAX_RATE: formatNumber(currentIeTasa, 5),
    CURRENT_REACTIVE_COST: formatCurrency(currentReactiveCost),
    CURRENT_OTHER_CHARGES: formatCurrency(currentOtherChargeCost),

    // ─── Gas-specific variables ──────────────────────────────────────────────
    GAS_TARIFF: gas?.tarifaAcceso || "N/A",
    GAS_ZONE: gas?.zonaGeografica || "N/A",
    GAS_TELEMEASURED: gas?.telemedida || "N/A",
    GAS_BILLING_DAYS: gas?.periodo?.dias ? String(gas.periodo.dias) : "N/A",
    GAS_CONSUMPTION_KWH: formatNumber(gasBillingConsumption, 0),
    GAS_ANNUAL_CONSUMPTION_KWH: formatNumber(gasAnnualConsumptionKwh, 0),
    GAS_ANNUAL_CONSUMPTION_M3: formatNumber(gasAnnualConsumptionKwh / 11.63, 0), // approx kWh → m³
    GAS_IVA_RATE: formatNumber(gasIvaTasa, 2),
    GAS_HYDROCARBON_TAX_RATE: formatNumber(gasImpHidro, 5),

    CURRENT_GAS_FIXED_COST: formatCurrency(gasCurrentFixedCost),
    CURRENT_GAS_VARIABLE_COST: formatCurrency(gasCurrentVariableCost),
    CURRENT_GAS_TAX: formatCurrency(gasCurrentTax),
    CURRENT_GAS_RENTAL_COST: formatCurrency(gasCurrentRentalCost),
    CURRENT_GAS_OTHER_COST: formatCurrency(gasCurrentOtherCost),
    CURRENT_GAS_VAT: formatCurrency(gasCurrentVat),
    CURRENT_GAS_TOTAL: formatCurrency(gasCurrentTotal),

    AXPO_GAS_FIXED_COST: formatCurrency(gasAxpoFixedCost),
    AXPO_GAS_VARIABLE_COST: formatCurrency(gasAxpoVariableCost),
    AXPO_GAS_TAX: formatCurrency(gasAxpoTax),
    AXPO_GAS_RENTAL_COST: formatCurrency(gasAxpoRentalCost),
    AXPO_GAS_OTHER_COST: formatCurrency(gasAxpoOtherCost),
    AXPO_GAS_VAT: formatCurrency(gasAxpoVat),
    AXPO_GAS_TOTAL: formatCurrency(gasAxpoTotal),
  };

  // Merge editable sections if template defines them
  if (editableSections) {
    const editableValues = mergeEditableSections(
      editableSections,
      editableOverrides,
    );
    Object.assign(variables, editableValues);
  }

  return variables;
}

/**
 * Chart label translations for different languages
 */
const chartLabels = {
  es: {
    title: "Comparativa",
    currentLabel: "Competencia",
    axpoLabel: "Axpo",
    annualSavings: "Ahorro Anual",
    monthlySavings: "Ahorro Mensual",
    savingsPercent: "% Ahorrado",
  },
  en: {
    title: "Comparison",
    currentLabel: "Current",
    axpoLabel: "Axpo",
    annualSavings: "Annual Savings",
    monthlySavings: "Monthly Savings",
    savingsPercent: "% Saved",
  },
  fr: {
    title: "Comparaison",
    currentLabel: "Courant",
    axpoLabel: "Axpo",
    annualSavings: "Économies Annuelles",
    monthlySavings: "Économies Mensuelles",
    savingsPercent: "% Économisé",
  },
  de: {
    title: "Vergleich",
    currentLabel: "Aktuell",
    axpoLabel: "Axpo",
    annualSavings: "Jährliche Ersparnisse",
    monthlySavings: "Monatliche Ersparnisse",
    savingsPercent: "% Gespart",
  },
  it: {
    title: "Confronto",
    currentLabel: "Attuale",
    axpoLabel: "Axpo",
    annualSavings: "Risparmio Annuale",
    monthlySavings: "Risparmio Mensile",
    savingsPercent: "% Risparmiato",
  },
  pt: {
    title: "Comparação",
    currentLabel: "Atual",
    axpoLabel: "Axpo",
    annualSavings: "Economia Anual",
    monthlySavings: "Economia Mensal",
    savingsPercent: "% Economizado",
  },
};

/**
 * Builds a self-contained HTML snippet for the Comparativa bar chart.
 * Uses pure SVG + inline CSS - no JavaScript - so it renders in Puppeteer PDFs.
 *
 * Both currentTotal and axpoTotal are period figures (€).
 * The chart displays annual totals using (value / dias) × 365 extrapolation.
 * If dias = 365, uses the direct annual difference.
 *
 * @param currentTotal - Current plan total for the billing period
 * @param axpoTotal - Axpo plan total for the billing period
 * @param savingsAmount - Savings for the billing period
 * @param dias - Days in billing period (default 30)
 * @param ahorroAnualOverride - Override for annual savings calculation
 * @param language - Language code (es, en, fr, de, it, pt) - defaults to es
 */
function buildComparativaChart(
  currentTotal: number,
  axpoTotal: number,
  savingsAmount: number,
  dias: number = 30,
  ahorroAnualOverride: number | null = null,
  language: string = "es",
): string {
  const annualCurrent =
    dias === 365 ? currentTotal : (currentTotal / dias) * 365;
  const annualAxpo = dias === 365 ? axpoTotal : (axpoTotal / dias) * 365;
  const annualSavings =
    ahorroAnualOverride !== null
      ? ahorroAnualOverride
      : dias === 365
        ? savingsAmount
        : (savingsAmount / dias) * 365;
  const monthlySavings = savingsAmount;
  const savingsPct =
    currentTotal > 0 ? (savingsAmount / currentTotal) * 100 : 0;

  // Get labels for the specified language (default to Spanish if not found)
  const labels =
    chartLabels[language as keyof typeof chartLabels] || chartLabels.es;

  // Determine locale for number formatting
  const localeMap: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  const locale = localeMap[language] || "es-ES";

  const fmt = (n: number) =>
    n.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Chart dimensions tuned for the proposal PDF layout.
  // The SVG height (~330) is sized to match the right column:
  //   3 cards × min-height 64px + 2 × 6px gap = 204px
  //   and rendered through `viewBox` so it scales with `width="100%"`.
  const svgW = 360;
  const svgH = 330;
  const plotX0 = 44;
  const plotX1 = 350;
  const barW = 82;
  const maxBarH = 240;
  const barY0 = 290; // baseline y

  const maxVal = Math.max(annualCurrent, annualAxpo, 1);
  const hCurrent = (annualCurrent / maxVal) * maxBarH;
  const hAxpo = (annualAxpo / maxVal) * maxBarH;

  const xCurrent = 66;
  const xAxpo = 216;

  // Y-axis ticks (4 ticks)
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = (maxVal / tickCount) * i;
    const y = barY0 - (val / maxVal) * maxBarH;
    return { val, y };
  });

  const tickLines = ticks
    .map(
      (t) =>
        `<line x1="${plotX0}" y1="${t.y.toFixed(1)}" x2="${plotX1}" y2="${t.y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>` +
        `<text x="${plotX0 - 6}" y="${(t.y + 4).toFixed(1)}" text-anchor="end" font-size="8" fill="#6b7280">${Math.round(t.val)}</text>`,
    )
    .join("");

  return `
<div style="display:block;width:100%;box-sizing:border-box;padding:0;font-family:Arial,sans-serif;page-break-inside:avoid">

  <div style="font-size:20px;line-height:1.15;font-weight:400;color:#1E2CF4;margin-bottom:12px">${labels.title}</div>

  <div style="display:flex;width:100%;gap:20px;align-items:flex-end">

    <div style="flex:0 0 50%;min-width:0">
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%">
        <defs>
          <linearGradient id="axpoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="50%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>

        ${tickLines}

        <!-- X axis -->
        <line x1="${plotX0}" y1="${barY0}" x2="${plotX1}" y2="${barY0}" stroke="#9ca3af" stroke-width="1.5"/>

        <!-- Current bar -->
        <rect x="${xCurrent}" y="${(barY0 - hCurrent).toFixed(1)}" width="${barW}" height="${hCurrent.toFixed(1)}" fill="#9ca3af" rx="4"/>

        <!-- AXPO bar -->
        <rect x="${xAxpo}" y="${(barY0 - hAxpo).toFixed(1)}" width="${barW}" height="${hAxpo.toFixed(1)}" fill="url(#axpoGrad)" rx="4"/>

        <!-- X labels -->
        <text x="${xCurrent + barW / 2}" y="${barY0 + 18}" text-anchor="middle" font-size="9" fill="#374151">${labels.currentLabel}</text>
        <text x="${xAxpo + barW / 2}" y="${barY0 + 18}" text-anchor="middle" font-size="9" fill="#374151">${labels.axpoLabel}</text>

        <!-- Value labels on top of bars -->
        <text x="${xCurrent + barW / 2}" y="${(barY0 - hCurrent - 5).toFixed(1)}" text-anchor="middle" font-size="8" fill="#374151">${fmt(annualCurrent)} €</text>
        <text x="${xAxpo + barW / 2}" y="${(barY0 - hAxpo - 5).toFixed(1)}" text-anchor="middle" font-size="8" fill="#374151">${fmt(annualAxpo)} €</text>
      </svg>
    </div>

    <div style="flex:1 1 0;display:flex;flex-direction:column;gap:10px;box-sizing:border-box">
      <div style="background:#3F43D4;border-radius:8px;padding:10px 16px;color:white;min-height:64px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25)">
        <div style="font-size:10px;font-weight:700;margin-bottom:7px">${labels.annualSavings}</div>
        <div style="border-top:1px solid rgba(255,255,255,0.34);padding-top:4px;font-size:22px;line-height:1.05;font-weight:700;text-align:right">${fmt(annualSavings)} €</div>
      </div>
      <div style="background:#3F43D4;border-radius:8px;padding:10px 16px;color:white;min-height:64px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25)">
        <div style="font-size:10px;font-weight:700;margin-bottom:7px">${labels.monthlySavings}</div>
        <div style="border-top:1px solid rgba(255,255,255,0.34);padding-top:4px;font-size:22px;line-height:1.05;font-weight:700;text-align:right">${fmt(monthlySavings)} €</div>
      </div>
      <div style="background:#3F43D4;border-radius:8px;padding:10px 16px;color:white;min-height:64px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25)">
        <div style="font-size:10px;font-weight:700;margin-bottom:7px">${labels.savingsPercent}</div>
        <div style="border-top:1px solid rgba(255,255,255,0.34);padding-top:4px;font-size:22px;line-height:1.05;font-weight:700;text-align:right">${savingsPct.toFixed(2).replace(".", ",")} %</div>
      </div>
    </div>

  </div>

</div>`;
}

/**
 * Replaces template variables in content
 * Supports both {{VARIABLE}} format
 */
export function replaceVariables(
  content: string,
  variableValues: Record<string, string>,
): string {
  let result = content;

  // Replace all variables
  Object.entries(variableValues).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(regex, value);
  });

  return result;
}
