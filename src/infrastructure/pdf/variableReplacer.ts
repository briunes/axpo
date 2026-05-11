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

  // ─── Gas variables ────────────────────────────────────────────────────────
  const gas = payload?.gas as any;
  const gasResults = payload?.results?.gas;
  const selectedGasOfferKey =
    payload?.selectedOffer?.commodity === "GAS"
      ? payload?.selectedOffer?.productKey
      : undefined;
  const selectedGasResult = selectedGasOfferKey
    ? gasResults?.find((r: any) => r.productKey === selectedGasOfferKey)
    : gasResults?.[0];

  // Gas consumption — prefer consumoAnual, fall back to consumo (monthly * 12)
  const gasAnnualConsumptionKwh =
    gas?.consumoAnual || (gas?.consumo ? (gas.consumo as number) * 12 : 0);

  // Current gas costs
  const gasCurrentTotal: number = gas?.facturaActual || 0;
  const gasIvaTasa: number = gas?.ivaTasa ?? 21;
  // Back-calculate VAT and tax from current total using input rates
  const gasCurrentVat = gasCurrentTotal * (gasIvaTasa / (100 + gasIvaTasa));
  const gasCurrentPreVat = gasCurrentTotal - gasCurrentVat;
  const gasImpHidro: number = gas?.impuestoHidrocarburo ?? 0;
  // IEH = impuestoHidrocarburo (€/kWh) * consumption in billing period
  const gasBillingConsumption: number = gas?.consumo || 0;
  const gasCurrentTax = gasImpHidro * gasBillingConsumption;
  const gasCurrentBase = gasCurrentPreVat - gasCurrentTax;
  // Rough 70/30 split of base into variable/fixed
  const gasCurrentVariableCost = gasCurrentBase * 0.7;
  const gasCurrentFixedCost = gasCurrentBase * 0.3;

  // AXPO gas costs from selected result desglose
  const gasAxpoDesglose = selectedGasResult?.desglose || {};
  const gasAxpoFixedCost: number = gasAxpoDesglose.terminoFijo || 0;
  const gasAxpoVariableCost: number = gasAxpoDesglose.terminoEnergia || 0;
  const gasAxpoTax: number = gasAxpoDesglose.impuestoHidrocarburo || 0;
  const gasAxpoVat: number = gasAxpoDesglose.iva || 0;
  const gasAxpoTotal: number = selectedGasResult?.totalFactura || 0;

  // Gas savings and product
  const gasSavingsAmount: number = selectedGasResult?.ahorro || 0;
  const gasProductName: string = selectedGasResult?.productLabel || "N/A";

  // Gas period dates
  const gasPeriodStart = gas?.periodo?.fechaInicio || "N/A";
  const gasPeriodEnd = gas?.periodo?.fechaFin || "N/A";
  const gasSimulationPeriod = `${gasPeriodStart} — ${gasPeriodEnd}`;

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
    SAVINGS_AMOUNT: formatCurrency(isGas ? gasSavingsAmount : savingsAmount),

    // ─── Charts ──────────────────────────────────────────────────────────────
    CHART_COMPARATIVA: buildComparativaChart(
      isGas ? gasCurrentTotal : currentTotal,
      isGas ? gasAxpoTotal : axpoTotal,
      isGas ? gasSavingsAmount : savingsAmount,
    ),

    // ─── Gas-specific variables ──────────────────────────────────────────────
    GAS_ANNUAL_CONSUMPTION_KWH: formatNumber(gasAnnualConsumptionKwh, 0),
    GAS_ANNUAL_CONSUMPTION_M3: formatNumber(gasAnnualConsumptionKwh / 11.63, 0), // approx kWh → m³

    CURRENT_GAS_FIXED_COST: formatCurrency(gasCurrentFixedCost),
    CURRENT_GAS_VARIABLE_COST: formatCurrency(gasCurrentVariableCost),
    CURRENT_GAS_TAX: formatCurrency(gasCurrentTax),
    CURRENT_GAS_VAT: formatCurrency(gasCurrentVat),
    CURRENT_GAS_TOTAL: formatCurrency(gasCurrentTotal),

    AXPO_GAS_FIXED_COST: formatCurrency(gasAxpoFixedCost),
    AXPO_GAS_VARIABLE_COST: formatCurrency(gasAxpoVariableCost),
    AXPO_GAS_TAX: formatCurrency(gasAxpoTax),
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
 * Builds a self-contained HTML snippet for the Comparativa bar chart.
 * Uses pure SVG + inline CSS — no JavaScript — so it renders in Puppeteer PDFs.
 *
 * Both currentTotal and axpoTotal are *monthly* figures (€).
 * The chart displays annual totals (× 12).
 */
function buildComparativaChart(
  currentTotal: number,
  axpoTotal: number,
  savingsAmount: number,
): string {
  const annualCurrent = currentTotal * 12;
  const annualAxpo = axpoTotal * 12;
  const annualSavings = savingsAmount * 12;
  const monthlySavings = savingsAmount;
  const savingsPct =
    currentTotal > 0 ? (savingsAmount / currentTotal) * 100 : 0;

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Chart dimensions
  const svgW = 340;
  const svgH = 220;
  const barW = 80;
  const maxBarH = 150;
  const barY0 = 170; // baseline y

  const maxVal = Math.max(annualCurrent, annualAxpo, 1);
  const hCurrent = (annualCurrent / maxVal) * maxBarH;
  const hAxpo = (annualAxpo / maxVal) * maxBarH;

  const xCurrent = 60;
  const xAxpo = 180;

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
        `<line x1="45" y1="${t.y.toFixed(1)}" x2="${svgW - 10}" y2="${t.y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>` +
        `<text x="40" y="${(t.y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#6b7280">${Math.round(t.val)}</text>`,
    )
    .join("");

  // SVG width fills most of the left column; we scale it via viewBox so it
  // stretches to whatever width the left flex child occupies.
  return `
<div style="display:block;width:100%;box-sizing:border-box;padding:16px 0;font-family:Arial,sans-serif;page-break-inside:avoid">

  <div style="font-size:13px;font-weight:700;color:#3b3bd4;margin-bottom:12px">Comparativa</div>

  <!-- Two-column row: chart left, stats right -->
  <div style="display:flex;width:100%;gap:24px;align-items:flex-start">

    <!-- Bar chart — 50% width -->
    <div style="flex:0 0 50%;min-width:0">
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="display:block">
        <defs>
          <linearGradient id="axpoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="50%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>

        ${tickLines}

        <!-- X axis -->
        <line x1="45" y1="${barY0}" x2="${svgW - 10}" y2="${barY0}" stroke="#9ca3af" stroke-width="1.5"/>

        <!-- Current bar -->
        <rect x="${xCurrent}" y="${(barY0 - hCurrent).toFixed(1)}" width="${barW}" height="${hCurrent.toFixed(1)}" fill="#9ca3af" rx="4"/>

        <!-- AXPO bar -->
        <rect x="${xAxpo}" y="${(barY0 - hAxpo).toFixed(1)}" width="${barW}" height="${hAxpo.toFixed(1)}" fill="url(#axpoGrad)" rx="4"/>

        <!-- X labels -->
        <text x="${xCurrent + barW / 2}" y="${barY0 + 16}" text-anchor="middle" font-size="10" fill="#374151">Competencia</text>
        <text x="${xAxpo + barW / 2}" y="${barY0 + 16}" text-anchor="middle" font-size="10" fill="#374151">Axpo</text>

        <!-- Value labels on top of bars -->
        <text x="${xCurrent + barW / 2}" y="${(barY0 - hCurrent - 5).toFixed(1)}" text-anchor="middle" font-size="9" fill="#374151">${fmt(annualCurrent)} €</text>
        <text x="${xAxpo + barW / 2}" y="${(barY0 - hAxpo - 5).toFixed(1)}" text-anchor="middle" font-size="9" fill="#374151">${fmt(annualAxpo)} €</text>
      </svg>
    </div>

    <!-- Stats boxes — 50% width, stacked vertically -->
    <div style="flex:0 0 50%;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;padding-left:12px">
      <div style="background:#3b3bd4;border-radius:8px;padding:12px 16px;color:white">
        <div style="font-size:10px;font-weight:600;margin-bottom:6px">Ahorro Anual</div>
        <div style="font-size:22px;font-weight:700;text-align:right">${fmt(annualSavings)} €</div>
      </div>
      <div style="background:#3b3bd4;border-radius:8px;padding:12px 16px;color:white">
        <div style="font-size:10px;font-weight:600;margin-bottom:6px">Ahorro Mensual</div>
        <div style="font-size:22px;font-weight:700;text-align:right">${fmt(monthlySavings)} €</div>
      </div>
      <div style="background:#3b3bd4;border-radius:8px;padding:12px 16px;color:white">
        <div style="font-size:10px;font-weight:600;margin-bottom:6px">% Ahorrado</div>
        <div style="font-size:22px;font-weight:700;text-align:right">${savingsPct.toFixed(2).replace(".", ",")} %</div>
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
