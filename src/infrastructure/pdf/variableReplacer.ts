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
 */
export function extractVariableValues(
  simulation: any,
  payload?: SimulationPayload,
  shareContext?: ShareContext,
  editableSections?: EditableSectionsConfig,
  editableOverrides?: EditableSectionOverrides,
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
  const simulationPeriod = `${periodStart} — ${periodEnd}`;

  // Calculate annual consumption (approximate from monthly)
  const totalConsumption = electricity?.consumo
    ? Object.values(electricity.consumo).reduce(
        (a: number, b: unknown) => (a || 0) + ((b as number) || 0),
        0,
      )
    : 0;
  const annualConsumption = (totalConsumption as number) * 12;

  // Extract client info - check both simulation.client and electricity.clientData
  const clientData = electricity?.clientData || {};
  const clientName =
    simulation.client?.name || clientData.nombreTitular || "N/A";
  const contactPerson =
    simulation.client?.contactPerson ||
    simulation.client?.contactName ||
    clientData.personaContacto ||
    clientName;
  const clientAddress = simulation.client?.address
    ? `${simulation.client.address}, ${simulation.client.postalCode || ""} ${simulation.client.city || ""}`.trim()
    : clientData.direccion || "N/A";

  // CUPS - check both simulation and electricity.clientData
  const cupsNumber = simulation.cupsNumber || clientData.cups || "N/A";

  // Product name
  const productName = selectedResult?.productLabel || "N/A";

  // Current plan costs
  const currentTotal = electricity?.facturaActual || 0;

  // AXPO plan costs (from results)
  const axpoDesglose = selectedResult?.desglose || {};
  const axpoPowerCost = axpoDesglose.terminoPotencia || 0;
  const axpoEnergyCost = axpoDesglose.terminoEnergia || 0;
  const axpoExcessCost = axpoDesglose.excesoPotencia || 0;
  const axpoTaxCost =
    (axpoDesglose.impuestoElectrico || 0) +
    (axpoDesglose.impuestoHidrocarburo || 0);
  const axpoOtherCost = axpoDesglose.extras || 0;
  const axpoRentalCost = electricity?.extras?.alquilerEquipoMedida || 0;
  const axpoVat = axpoDesglose.iva || 0;
  const axpoTotal = selectedResult?.totalFactura || 0;

  // Estimate current plan breakdown (proportional distribution)
  const currentPowerCost = currentTotal * 0.35;
  const currentEnergyCost = currentTotal * 0.4;
  const currentExcessCost = electricity?.excesoPotencia
    ? currentTotal * 0.05
    : 0;
  const currentTaxCost = currentTotal * 0.05;
  const currentOtherCost = currentTotal * 0.03;
  const currentRentalCost = electricity?.extras?.alquilerEquipoMedida || 0;
  const currentVat = currentTotal * 0.12;

  // Savings
  const savingsAmount = selectedResult?.ahorro || 0;

  // Build complete variable map
  const variables: Record<string, string> = {
    // Client information
    CLIENT_NAME: clientName,
    CONTACT_PERSON: contactPerson,
    CLIENT_ADDRESS: clientAddress,
    CUPS_NUMBER: cupsNumber,

    // Simulation metadata
    SIMULATION_ID: simulation.id,
    SIMULATION_PERIOD: simulationPeriod,
    ANNUAL_CONSUMPTION: formatNumber(annualConsumption, 0),
    PRODUCT_NAME: productName,
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
        ? `${process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || process.env.FRONTEND_SIMULADOR_URL || "https://tuenergia.axpoiberia.es"}/simulador/?token=${simulation.publicToken}`
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
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value);
  });

  return result;
}
