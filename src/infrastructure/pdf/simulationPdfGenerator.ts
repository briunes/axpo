import * as fs from "fs";
import * as path from "path";
import type {
  SimulationPayload,
  ElecPeriodMap,
} from "@/domain/types/simulation";

/**
 * Template variables that can be replaced in the PDF template
 */
export interface PdfTemplateVariables {
  // Client information
  CLIENT_NAME: string;
  CLIENT_ADDRESS: string;
  CUPS_NUMBER: string;

  // Simulation metadata
  SIMULATION_PERIOD: string;
  ANNUAL_CONSUMPTION: string;
  PRODUCT_NAME: string;

  // Current plan - Power contracted (kW)
  CURRENT_POWER_P1: string;
  CURRENT_POWER_P2: string;
  CURRENT_POWER_P3: string;
  CURRENT_POWER_P4: string;
  CURRENT_POWER_P5: string;
  CURRENT_POWER_P6: string;

  // Current plan - Energy consumption (kWh)
  CURRENT_ENERGY_P1: string;
  CURRENT_ENERGY_P2: string;
  CURRENT_ENERGY_P3: string;
  CURRENT_ENERGY_P4: string;
  CURRENT_ENERGY_P5: string;
  CURRENT_ENERGY_P6: string;

  // Current plan - Cost breakdown
  CURRENT_POWER_COST: string;
  CURRENT_ENERGY_COST: string;
  CURRENT_EXCESS_COST: string;
  CURRENT_TAX_COST: string;
  CURRENT_OTHER_COST: string;
  CURRENT_RENTAL_COST: string;
  CURRENT_VAT: string;
  CURRENT_TOTAL: string;

  // AXPO plan - Power contracted (kW)
  AXPO_POWER_P1: string;
  AXPO_POWER_P2: string;
  AXPO_POWER_P3: string;
  AXPO_POWER_P4: string;
  AXPO_POWER_P5: string;
  AXPO_POWER_P6: string;

  // AXPO plan - Energy consumption (kWh)
  AXPO_ENERGY_P1: string;
  AXPO_ENERGY_P2: string;
  AXPO_ENERGY_P3: string;
  AXPO_ENERGY_P4: string;
  AXPO_ENERGY_P5: string;
  AXPO_ENERGY_P6: string;

  // AXPO plan - Cost breakdown
  AXPO_POWER_COST: string;
  AXPO_ENERGY_COST: string;
  AXPO_EXCESS_COST: string;
  AXPO_TAX_COST: string;
  AXPO_OTHER_COST: string;
  AXPO_RENTAL_COST: string;
  AXPO_VAT: string;
  AXPO_TOTAL: string;

  // Savings
  SAVINGS_AMOUNT: string;
}

/**
 * Formats a number as currency (euros)
 */
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formats a number with comma decimal separator
 */
function formatNumber(value: number | undefined, decimals: number = 4): string {
  if (value === undefined || value === null) return "—";
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Gets value from period map or returns default
 */
function getPeriodValue(
  periodMap: ElecPeriodMap | undefined,
  period: keyof ElecPeriodMap,
  decimals: number = 4,
): string {
  if (!periodMap) return "—";
  const value = periodMap[period];
  return value !== undefined ? formatNumber(value, decimals) : "—";
}

/**
 * Extracts template variables from simulation data
 */
export function extractTemplateVariables(
  simulation: any,
  payload: SimulationPayload,
): PdfTemplateVariables {
  const electricity = payload.electricity;
  const results = payload.results;
  const selectedResult = results?.electricity?.[0]; // Assuming first result is selected

  // Calculate period dates
  const periodStart = electricity?.periodo?.fechaInicio || "N/A";
  const periodEnd = electricity?.periodo?.fechaFin || "N/A";
  const simulationPeriod = `${periodStart} — ${periodEnd}`;

  // Calculate annual consumption (approximate from monthly)
  const totalConsumption = electricity?.consumo
    ? Object.values(electricity.consumo).reduce(
        (a, b) => (a || 0) + (b || 0),
        0,
      )
    : 0;
  const annualConsumption = totalConsumption * 12;

  // Extract client info
  const clientName = simulation.client?.name || "N/A";
  const clientAddress = simulation.client?.address
    ? `${simulation.client.address}, ${simulation.client.postalCode || ""} ${simulation.client.city || ""}`
    : "C de los Dominicos, 6, 47001 Valladolid";

  // Product name
  const productName = selectedResult?.productLabel || "Personalizada Index";

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

  // Current plan costs (from facturaActual breakdown).
  // See variableReplacer.ts for the rationale — same logic applies here.
  // The simulation form only reliably stores `facturaActual` (the total).
  // Rental / reactiva / otrosCargos / excesoPotencia are read from
  // `electricity.extras` when present. IE and VAT are back-derived from
  // the total using the rates captured in `extras`. The remaining base
  // is split between terminoPotencia and terminoEnergia using the same
  // per-period distribution that the Axpo plan uses, so the two plans
  // stay self-consistent.
  const currentTotal = electricity?.facturaActual || 0;
  const currentRentalCost = electricity?.extras?.alquilerEquipoMedida || 0;
  const currentExcessCost = electricity?.excesoPotencia || 0;
  const currentIvaTasa =
    electricity?.extras?.ivaTasa != null ? electricity.extras.ivaTasa : 21;
  const currentIeTasa =
    electricity?.extras?.impuestoElectricoTasa != null
      ? electricity.extras.impuestoElectricoTasa
      : 5.11269;
  const currentReactiveCost = electricity?.extras?.reactiva || 0;
  const currentOtherChargeCost = electricity?.extras?.otrosCargos || 0;
  const currentKnownBase =
    currentRentalCost +
    currentReactiveCost +
    currentOtherChargeCost +
    currentExcessCost;
  const ieR = currentIeTasa / 100;
  const ivaR = currentIvaTasa / 100;
  const currentTaxCost = currentTotal * (ieR / ((1 + ieR) * (1 + ivaR)));
  const currentVat = (currentTotal - currentTaxCost - currentRentalCost) * ivaR;
  const currentPowerEnergyBase = Math.max(
    0,
    currentTotal - currentTaxCost - currentVat - currentKnownBase,
  );
  const explicitCurrentPower = (electricity?.extras as any)
    ?.terminoPotenciaActual;
  const explicitCurrentEnergy = (electricity?.extras as any)
    ?.terminoEnergiaActual;
  const axpoPeSum = axpoPowerCost + axpoEnergyCost || 1;
  const currentPowerCost =
    explicitCurrentPower != null
      ? Number(explicitCurrentPower)
      : currentPowerEnergyBase * (axpoPowerCost / axpoPeSum);
  const currentEnergyCost =
    explicitCurrentEnergy != null
      ? Number(explicitCurrentEnergy)
      : currentPowerEnergyBase * (axpoEnergyCost / axpoPeSum);
  const currentOtherCost = currentReactiveCost + currentOtherChargeCost;

  // Savings
  const savingsAmount = selectedResult?.ahorro || 0;

  return {
    // Client information
    CLIENT_NAME: clientName,
    CLIENT_ADDRESS: clientAddress,
    CUPS_NUMBER: simulation.cupsNumber || "ES0031352682800001VB",

    // Simulation metadata
    SIMULATION_PERIOD: simulationPeriod,
    ANNUAL_CONSUMPTION: formatNumber(annualConsumption, 0),
    PRODUCT_NAME: productName,

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
    CURRENT_TAX_COST: formatCurrency(currentTaxCost),
    CURRENT_OTHER_COST: formatCurrency(currentOtherCost),
    CURRENT_RENTAL_COST: formatCurrency(currentRentalCost),
    CURRENT_VAT: formatCurrency(currentVat),
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
    SAVINGS_AMOUNT: formatCurrency(savingsAmount),
  };
}

/**
 * Replaces template variables in HTML content
 */
export function replaceTemplateVariables(
  htmlContent: string,
  variables: PdfTemplateVariables,
): string {
  let result = htmlContent;

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Loads the HTML template from file
 */
export function loadHtmlTemplate(): string {
  const templatePath = path.join(__dirname, "simulation-template.html");
  return fs.readFileSync(templatePath, "utf-8");
}

/**
 * Generates HTML content for a simulation PDF
 */
export function generateSimulationHtml(
  simulation: any,
  payload: SimulationPayload,
): string {
  const template = loadHtmlTemplate();
  const variables = extractTemplateVariables(simulation, payload);
  return replaceTemplateVariables(template, variables);
}
