"use client";

import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { SimulationResultsCards } from "./SimulationResultsCards";
import type { SimulationItem, ClientItem, CupsLookupEntry } from "../../lib/internalApi";
import { calculateSimulation, updateSimulationSelectedOffer, fetchCupsLookup, listBaseValueSets, listBaseValueItems } from "../../lib/internalApi";
import { getSystemConfig } from "../../lib/configApi";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatNumber } from "../../lib/formatPreferences";
import { FormSelect } from "../ui/FormSelect";
import { DateInput } from "../ui/DateInput";
import { DateRangePicker } from "../ui/DateRangePicker";
import { FormInput } from "../ui/FormInput";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Autocomplete, TextField, Collapse, Divider, Box, Button, Tabs, Tab, Typography, FormControlLabel, Switch } from "@mui/material";
import { Country } from "country-state-city";
import type {
    SimulationPayload,
    ElectricityInputs,
    GasInputs,
    SimulationResults,
    ElecTarifa,
    GasTarifa,
    GasZona,
} from "@/domain/types";

// ─── Period helpers ────────────────────────────────────────────────────────────

const ELEC_ENERGY_PERIODS: Record<ElecTarifa, string[]> = {
    "2.0TD": ["P1", "P2", "P3"],
    "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};
const ELEC_POWER_PERIODS: Record<ElecTarifa, string[]> = {
    "2.0TD": ["P1", "P2"],
    "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};
const ELEC_EXCESS_PERIODS: Record<ElecTarifa, string[]> = {
    "2.0TD": [],
    "3.0TD": ["P1", "P2", "P3"],
    "6.1TD": ["P1", "P2", "P3"],
};

type PeriodMap = Record<string, number>;
type SimType = "ELECTRICITY" | "GAS";

function emptyPeriods(periods: string[]): PeriodMap {
    return Object.fromEntries(periods.map((p) => [p, 0]));
}

// ─── Form state types ──────────────────────────────────────────────────────────

interface ElecFormState {
    // Client data
    cups: string;
    consumoAnual: number;
    nombreTitular: string;
    personaContacto: string;
    comercial: string;
    direccion: string;
    comercializadorActual: string;
    // Access tariff
    tarifaAcceso: ElecTarifa;
    zonaGeografica: "Peninsula" | "Baleares" | "Canarias";
    perfilCarga: "NORMAL" | "DIURNO";
    fechaInicio: string;
    fechaFin: string;
    consumo: PeriodMap;
    potencia: PeriodMap;
    exceso: number;
    omie: PeriodMap;
    // Personalizada Index
    personalizadaIndexMargenEnergia: PeriodMap;
    personalizadaIndexMargenPotencia: PeriodMap;
    // Personalizada OMIE + B
    personalizadaOmieBTerminoB: PeriodMap;
    personalizadaOmieBMargenPotencia: PeriodMap;
    // Personalizada Fijo (custom fixed offer)
    personalizadaFijoPotencia: PeriodMap;
    personalizadaFijoEnergia: PeriodMap;
    facturaActual: number;
    reactiva: number;
    alquiler: number;
    otrosCargos: number;
    useCurrentInvoiceBreakdown: boolean;
    importePotencia: number;
    importeEnergia: number;
    importeImpuestoElectrico: number;
    importeIva: number;
    ivaTasa: number;
    impuestoElectricoTasa: number;
}

interface GasFormState {
    // Client data
    cups: string;
    consumoAnual: number;
    nombreTitular: string;
    personaContacto: string;
    comercial: string;
    direccion: string;
    comercializadorActual: string;
    // Access tariff
    tarifaAcceso: GasTarifa;
    zonaGeografica: GasZona;
    consumo: number;
    telemedida: "SI" | "NO";
    fechaInicio: string;
    fechaFin: string;
    facturaActual: number;
    alquiler: number;
    otrosCargos: number;
    useCurrentInvoiceBreakdown: boolean;
    importeTerminoFijo: number;
    importeTerminoVariable: number;
    importeImpuestoHidrocarburos: number;
    importeIva: number;
    ivaTasa: number;
    impuestoHidrocarburo: number;
    /** Personalizada Indexada margin over MIBGAS in €/kWh */
    personalizadaIndexMargen: number;
    /** Personalizada Fijo: all-in fixed daily term in €/día */
    personalizadaFijoTerminoDia: number;
    /** Personalizada Fijo: all-in variable term in €/kWh */
    personalizadaFijoTerminoVariable: number;
}

function daysBetween(from: string, to: string, inclusive = false): number {
    const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    return Math.max(1, inclusive ? d + 1 : d); // electricity: inclusive (end-start+1), gas: non-inclusive (end-start)
}

function parseLocalDate(isoDateString: string): Date {
    // Parse YYYY-MM-DD as local date instead of UTC
    const [y, m, d] = isoDateString.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatYYYYMM(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDominantBillingMonth(fechaInicio?: string, fechaFin?: string): string {
    if (!fechaInicio) return "";
    if (!fechaFin) return fechaInicio.slice(0, 7);

    const start = parseLocalDate(fechaInicio);
    const end = parseLocalDate(fechaFin);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return fechaInicio.slice(0, 7);
    }

    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    let bestMonth = formatYYYYMM(cursor);
    let maxDays = -1;

    while (cursor <= endMonth) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;

        const overlapDays = overlapEnd >= overlapStart
            ? Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1
            : 0;

        if (overlapDays > maxDays) {
            maxDays = overlapDays;
            bestMonth = formatYYYYMM(monthStart);
        }

        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return bestMonth;
}

function prevMonthRange() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
        fechaInicio: firstDay.toISOString().slice(0, 10),
        fechaFin: lastDay.toISOString().slice(0, 10),
    };
}

const ELEC_PERIOD_LABELS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function shouldScaleOcrConsumption(source: Record<string, any>, facturaActual?: number): boolean {
    if (!facturaActual || facturaActual > 10000) return false;
    const rawEnergyCost = ELEC_PERIOD_LABELS.reduce((sum, period) => {
        const consumo = finiteNumber(source[`consumo${period}`]) ?? 0;
        const precio = finiteNumber(source[`precioEnergia${period}`]) ?? 0;
        return sum + consumo * precio;
    }, 0);
    return rawEnergyCost > facturaActual * 5 && rawEnergyCost / 1000 < facturaActual * 2;
}

function normalizeConsumptionMap(
    consumo: PeriodMap,
    source: Record<string, any>,
    facturaActual?: number,
): PeriodMap {
    if (!shouldScaleOcrConsumption(source, facturaActual)) return consumo;
    return Object.fromEntries(
        Object.entries(consumo).map(([period, value]) => [period, roundMoney(value / 1000)]),
    );
}

function deriveCurrentBreakdown(source: Record<string, any>): {
    importePotencia?: number;
    importeEnergia?: number;
    importeImpuestoElectrico?: number;
    importeIva?: number;
} {
    const factura = finiteNumber(source.facturaActual);
    const ivaTasa = finiteNumber(source.ivaTasa);
    const impuestoElectricoTasa = finiteNumber(source.impuestoElectricoTasa);
    const powerPeriods =
        source.tarifaAcceso === "2.0TD"
            ? ELEC_POWER_PERIODS["2.0TD"]
            : ELEC_PERIOD_LABELS;
    const scaleConsumption = shouldScaleOcrConsumption(source, factura);
    const getConsumption = (period: string): number => {
        const value = finiteNumber(source[`consumo${period}`]) ?? 0;
        return scaleConsumption ? value / 1000 : value;
    };

    const result: {
        importePotencia?: number;
        importeEnergia?: number;
        importeImpuestoElectrico?: number;
        importeIva?: number;
    } = {};

    const billingDays =
        source.fechaInicio && source.fechaFin ? daysBetween(source.fechaInicio, source.fechaFin, false) : undefined;
    if (billingDays) {
        const powerCost = powerPeriods.reduce((sum, period) => {
            const potencia = finiteNumber(source[`potencia${period}`]) ?? 0;
            const precio = finiteNumber(source[`precioPotencia${period}`]) ?? 0;
            return sum + potencia * precio * billingDays;
        }, 0);
        if (powerCost > 0) result.importePotencia = roundMoney(powerCost);
    }

    if (factura != null && ivaTasa != null) {
        result.importeIva = roundMoney(factura * (ivaTasa / (100 + ivaTasa)));
    }

    if (factura != null && ivaTasa != null && impuestoElectricoTasa != null) {
        const ieR = impuestoElectricoTasa / 100;
        const ivaR = ivaTasa / 100;
        result.importeImpuestoElectrico = roundMoney(factura * (ieR / ((1 + ieR) * (1 + ivaR))));
    }

    if (factura != null) {
        const rentalOrOther = Math.max(
            finiteNumber(source.alquiler) ?? 0,
            finiteNumber(source.otrosCargos) ?? 0,
        );
        const known =
            (result.importePotencia ?? 0) +
            (result.importeImpuestoElectrico ?? 0) +
            (result.importeIva ?? 0) +
            (finiteNumber(source.excesoPotencia) ?? 0) +
            (finiteNumber(source.reactiva) ?? 0) +
            rentalOrOther;
        const residual = factura - known;
        if (known > 0 && residual > 0) {
            result.importeEnergia = roundMoney(residual);
        }
    }

    if (factura != null && result.importeEnergia == null) {
        const hasPricesForAllConsumedPeriods = ELEC_PERIOD_LABELS.every((period) => {
            const consumo = getConsumption(period);
            const precio = finiteNumber(source[`precioEnergia${period}`]);
            return consumo <= 0 || (precio != null && precio > 0);
        });
        const energyFromPrices = ELEC_PERIOD_LABELS.reduce((sum, period) => {
            const precio = finiteNumber(source[`precioEnergia${period}`]) ?? 0;
            return sum + getConsumption(period) * precio;
        }, 0);
        if (hasPricesForAllConsumedPeriods && energyFromPrices > 0 && energyFromPrices < factura) {
            result.importeEnergia = roundMoney(energyFromPrices);
        }
    }

    return result;
}

function deriveGasCurrentBreakdown(source: Record<string, any>): {
    importeTerminoFijo?: number;
    importeTerminoVariable?: number;
    importeImpuestoHidrocarburos?: number;
    importeIva?: number;
} {
    const factura = finiteNumber(source.facturaActual);
    if (factura == null) return {};

    const ivaTasa = finiteNumber(source.ivaTasa) ?? 21;
    const consumo = finiteNumber(source.consumoTotal) ?? finiteNumber(source.consumo) ?? 0;
    const impuestoHidrocarburo = finiteNumber(source.impuestoHidrocarburo) ?? 0.00234;
    const alquiler = finiteNumber(source.alquiler) ?? finiteNumber(source.alquilerEquipoMedida) ?? 0;
    const otrosCargos = finiteNumber(source.otrosCargos) ?? 0;

    const importeIva = roundMoney(factura * (ivaTasa / (100 + ivaTasa)));
    const importeImpuestoHidrocarburos = roundMoney(impuestoHidrocarburo * consumo);
    const known =
        importeIva +
        importeImpuestoHidrocarburos +
        alquiler +
        otrosCargos;
    const residual = Math.max(0, factura - known);

    return {
        importeTerminoFijo: 0,
        importeTerminoVariable: roundMoney(residual),
        importeImpuestoHidrocarburos,
        importeIva,
    };
}

function currentElecInvoiceBreakdownTotal(s: ElecFormState): number {
    return roundMoney(
        (s.importePotencia || 0) +
        (s.importeEnergia || 0) +
        (s.exceso || 0) +
        (s.importeImpuestoElectrico || 0) +
        (s.otrosCargos || 0) +
        (s.alquiler || 0) +
        (s.importeIva || 0),
    );
}

function currentGasInvoiceBreakdownTotal(s: GasFormState): number {
    return roundMoney(
        (s.importeTerminoFijo || 0) +
        (s.importeTerminoVariable || 0) +
        (s.importeImpuestoHidrocarburos || 0) +
        (s.otrosCargos || 0) +
        (s.alquiler || 0) +
        (s.importeIva || 0),
    );
}

function invoiceBreakdownMismatch(total: number, invoiceTotal: number): boolean {
    return invoiceTotal > 0 && Math.abs(roundMoney(total - invoiceTotal)) > 0.02;
}

function defaultElecState(): ElecFormState {
    const { fechaInicio, fechaFin } = prevMonthRange();
    return {
        cups: "",
        consumoAnual: 0,
        nombreTitular: "",
        personaContacto: "",
        comercial: "",
        direccion: "",
        comercializadorActual: "",
        tarifaAcceso: "3.0TD",
        zonaGeografica: "Peninsula",
        perfilCarga: "NORMAL",
        fechaInicio,
        fechaFin,
        consumo: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        potencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        exceso: 0,
        omie: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaIndexMargenEnergia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaIndexMargenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaOmieBTerminoB: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaOmieBMargenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaFijoPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        personalizadaFijoEnergia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        facturaActual: 0,
        reactiva: 0,
        alquiler: 0,
        otrosCargos: 0,
        useCurrentInvoiceBreakdown: true,
        importePotencia: 0,
        importeEnergia: 0,
        importeImpuestoElectrico: 0,
        importeIva: 0,
        ivaTasa: 21,
        impuestoElectricoTasa: 5.11269,
    };
}

function defaultGasState(): GasFormState {
    const { fechaInicio, fechaFin } = prevMonthRange();
    return {
        cups: "",
        consumoAnual: 0,
        nombreTitular: "",
        personaContacto: "",
        comercial: "",
        direccion: "",
        comercializadorActual: "",
        tarifaAcceso: "RL01",
        zonaGeografica: "Peninsula",
        consumo: 0,
        telemedida: "NO",
        fechaInicio,
        fechaFin,
        facturaActual: 0,
        alquiler: 0,
        otrosCargos: 0,
        useCurrentInvoiceBreakdown: true,
        importeTerminoFijo: 0,
        importeTerminoVariable: 0,
        importeImpuestoHidrocarburos: 0,
        importeIva: 0,
        ivaTasa: 21,
        impuestoHidrocarburo: 0.00234,
        personalizadaIndexMargen: 0,
        personalizadaFijoTerminoDia: 0,
        personalizadaFijoTerminoVariable: 0,
    };
}

// ─── Payload builders ──────────────────────────────────────────────────────────

function buildElecInputs(s: ElecFormState): ElectricityInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin, true);
    return {
        clientData: {
            cups: s.cups || undefined,
            consumoAnual: s.consumoAnual,
            nombreTitular: s.nombreTitular || undefined,
            personaContacto: s.personaContacto || undefined,
            comercial: s.comercial || undefined,
            direccion: s.direccion || undefined,
            comercializadorActual: s.comercializadorActual || undefined,
        },
        tarifaAcceso: s.tarifaAcceso,
        zonaGeografica: s.zonaGeografica,
        perfilCarga: s.perfilCarga,
        potenciaContratada: s.potencia as ElectricityInputs["potenciaContratada"],
        excesoPotencia: s.exceso,
        consumo: s.consumo as ElectricityInputs["consumo"],
        omieEstimado: s.omie,
        personalizadaIndex: {
            margenEnergia: s.personalizadaIndexMargenEnergia,
            margenPotencia: s.personalizadaIndexMargenPotencia,
        },
        personalizadaOmieB: {
            terminoB: s.personalizadaOmieBTerminoB,
            margenPotencia: s.personalizadaOmieBMargenPotencia,
        },
        personalizadaFijo: {
            preciosEnergia: s.personalizadaFijoEnergia,
            preciosPotencia: s.personalizadaFijoPotencia,
        },
        periodo: { fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, dias },
        facturaActual: s.facturaActual,
        extras: {
            reactiva: s.reactiva || undefined,
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
            useCurrentInvoiceBreakdown: s.useCurrentInvoiceBreakdown,
            terminoPotenciaActual: s.importePotencia || undefined,
            terminoEnergiaActual: s.importeEnergia || undefined,
            impuestoElectricoActual: s.importeImpuestoElectrico || undefined,
            ivaActual: s.importeIva || undefined,
            currentInvoiceBreakdown: {
                terminoPotencia: s.importePotencia || 0,
                terminoEnergia: s.importeEnergia || 0,
                excesoPotencia: s.exceso || 0,
                impuestoElectrico: s.importeImpuestoElectrico || 0,
                otrosCargos: s.otrosCargos || 0,
                alquiler: s.alquiler || 0,
                iva: s.importeIva || 0,
                total: currentElecInvoiceBreakdownTotal(s),
            },
            ivaTasa: s.ivaTasa,
            impuestoElectricoTasa: s.impuestoElectricoTasa,
        },
    } as any;
}

function buildGasInputs(s: GasFormState): GasInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin); // gas: non-inclusive
    return {
        cups: s.cups || undefined,
        consumoAnual: s.consumoAnual || undefined,
        nombreTitular: s.nombreTitular || undefined,
        personaContacto: s.personaContacto || undefined,
        comercial: s.comercial || undefined,
        direccion: s.direccion || undefined,
        comercializadorActual: s.comercializadorActual || undefined,
        tarifaAcceso: s.tarifaAcceso,
        zonaGeografica: s.zonaGeografica,
        consumo: s.consumo,
        telemedida: s.telemedida,
        periodo: { fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, dias },
        facturaActual: s.facturaActual,
        extras: {
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
            useCurrentInvoiceBreakdown: s.useCurrentInvoiceBreakdown,
            terminoFijoActual: s.importeTerminoFijo || undefined,
            terminoVariableActual: s.importeTerminoVariable || undefined,
            impuestoHidrocarburoActual: s.importeImpuestoHidrocarburos || undefined,
            ivaActual: s.importeIva || undefined,
            currentInvoiceBreakdown: {
                terminoFijo: s.importeTerminoFijo || 0,
                terminoVariable: s.importeTerminoVariable || 0,
                impuestoHidrocarburo: s.importeImpuestoHidrocarburos || 0,
                otrosCargos: s.otrosCargos || 0,
                alquiler: s.alquiler || 0,
                iva: s.importeIva || 0,
                total: currentGasInvoiceBreakdownTotal(s),
            },
        },
        ivaTasa: s.ivaTasa || undefined,
        impuestoHidrocarburo: s.impuestoHidrocarburo || undefined,
        personalizadaIndex: s.personalizadaIndexMargen > 0
            ? { margenEnergia: s.personalizadaIndexMargen }
            : undefined,
        personalizadaFijo: (s.personalizadaFijoTerminoVariable > 0 || s.personalizadaFijoTerminoDia > 0)
            ? { terminoVariable: s.personalizadaFijoTerminoVariable, terminoDia: s.personalizadaFijoTerminoDia }
            : undefined,
    };
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateElec(s: ElecFormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!s.fechaInicio) errs.fechaInicio = "Start date is required";
    if (!s.fechaFin) errs.fechaFin = "End date is required";
    if (s.fechaInicio && s.fechaFin && s.fechaFin <= s.fechaInicio) errs.fechaFin = "Must be after start date";
    if (s.facturaActual <= 0) errs.facturaActual = "Enter the current invoice total";
    // Periods can be 0 — the Excel simulator accepts any value per period
    return errs;
}

function validateGas(s: GasFormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!s.fechaInicio) errs.fechaInicio = "Start date is required";
    if (!s.fechaFin) errs.fechaFin = "End date is required";
    if (s.fechaInicio && s.fechaFin && s.fechaFin <= s.fechaInicio) errs.fechaFin = "Must be after start date";
    if (s.facturaActual <= 0) errs.facturaActual = "Enter the current invoice total";
    if (s.consumo <= 0) errs.consumo = "Enter the total gas consumption";
    return errs;
}

// ─── Payload hydration ─────────────────────────────────────────────────────────

function hydrateElec(p: SimulationPayload): ElecFormState | null {
    const e = p.electricity;
    const invoiceData = (p as any).invoiceData;

    // If no existing electricity data but invoiceData exists for electricity, pre-fill from invoice
    if (!e && invoiceData && invoiceData.invoiceType === "ELECTRICITY") {
        const tariff = (invoiceData.tarifaAcceso || "3.0TD") as ElecTarifa;
        const ep = ELEC_ENERGY_PERIODS[tariff] ?? [];
        const pp = ELEC_POWER_PERIODS[tariff] ?? [];

        // Build consumption map from invoice periods
        const consumo: PeriodMap = {};
        ep.forEach((p) => {
            const key = `consumo${p}` as keyof typeof invoiceData;
            consumo[p] = invoiceData[key] ?? 0;
        });
        const normalizedConsumo = normalizeConsumptionMap(consumo, invoiceData, invoiceData.facturaActual);

        // Build power map from invoice periods
        const potencia: PeriodMap = {};
        pp.forEach((p) => {
            const key = `potencia${p}` as keyof typeof invoiceData;
            potencia[p] = invoiceData[key] ?? 0;
        });

        const { fechaInicio, fechaFin } = invoiceData.fechaInicio && invoiceData.fechaFin
            ? { fechaInicio: invoiceData.fechaInicio, fechaFin: invoiceData.fechaFin }
            : prevMonthRange();

        return {
            cups: invoiceData.cups || "",
            consumoAnual: invoiceData.consumoAnual || invoiceData.consumoTotal || 0,
            nombreTitular: invoiceData.nombreTitular || "",
            personaContacto: "",
            comercial: "",
            direccion: invoiceData.direccion || "",
            comercializadorActual: invoiceData.comercializadorActual || "",
            tarifaAcceso: tariff,
            zonaGeografica: "Peninsula",
            perfilCarga: "NORMAL",
            fechaInicio,
            fechaFin,
            consumo: normalizedConsumo,
            potencia,
            exceso: invoiceData.excesoPotencia ?? 0,
            omie: emptyPeriods(ep),
            personalizadaIndexMargenEnergia: emptyPeriods(ep),
            personalizadaIndexMargenPotencia: emptyPeriods(ep),
            personalizadaOmieBTerminoB: emptyPeriods(ep),
            personalizadaOmieBMargenPotencia: emptyPeriods(ep),
            personalizadaFijoPotencia: emptyPeriods(ep),
            personalizadaFijoEnergia: emptyPeriods(ep),
            facturaActual: invoiceData.facturaActual ?? 0,
            reactiva: invoiceData.reactiva ?? 0,
            alquiler: invoiceData.alquiler ?? 0,
            otrosCargos: invoiceData.otrosCargos ?? 0,
            useCurrentInvoiceBreakdown: invoiceData.useCurrentInvoiceBreakdown !== false,
            importePotencia: invoiceData.importePotencia ?? deriveCurrentBreakdown(invoiceData).importePotencia ?? 0,
            importeEnergia: invoiceData.importeEnergia ?? deriveCurrentBreakdown(invoiceData).importeEnergia ?? 0,
            importeImpuestoElectrico: invoiceData.importeImpuestoElectrico ?? deriveCurrentBreakdown(invoiceData).importeImpuestoElectrico ?? 0,
            importeIva: invoiceData.importeIva ?? deriveCurrentBreakdown(invoiceData).importeIva ?? 0,
            ivaTasa: invoiceData.ivaTasa ?? 21,
            impuestoElectricoTasa: invoiceData.impuestoElectricoTasa ?? 5.11269,
        };
    }

    if (!e) return null;
    const ep = ELEC_ENERGY_PERIODS[e.tarifaAcceso] ?? [];
    const pp = ELEC_POWER_PERIODS[e.tarifaAcceso] ?? [];
    const cMap = e.consumo as unknown as Record<string, number>;
    const potMap = e.potenciaContratada as unknown as Record<string, number>;
    const omieMap = (e.omieEstimado ?? {}) as Record<string, number>;
    const clientData = (e as any).clientData ?? {};
    const deriveSource: Record<string, any> = {
        ...(invoiceData ?? {}),
        tarifaAcceso: e.tarifaAcceso,
        facturaActual: e.facturaActual,
        fechaInicio: e.periodo.fechaInicio,
        fechaFin: e.periodo.fechaFin,
        excesoPotencia: e.excesoPotencia,
        reactiva: e.extras?.reactiva,
        alquiler: e.extras?.alquilerEquipoMedida,
        otrosCargos: e.extras?.otrosCargos,
        ivaTasa: e.extras?.ivaTasa,
        impuestoElectricoTasa: e.extras?.impuestoElectricoTasa,
    };
    ELEC_PERIOD_LABELS.forEach((period) => {
        deriveSource[`consumo${period}`] = (invoiceData as any)?.[`consumo${period}`] ?? cMap[period];
        deriveSource[`potencia${period}`] = (invoiceData as any)?.[`potencia${period}`] ?? potMap[period];
    });
    const derivedBreakdown = deriveCurrentBreakdown(deriveSource);
    const rawConsumo = Object.fromEntries(ep.map((p) => [p, cMap[p] ?? 0]));
    return {
        cups: clientData.cups ?? "",
        consumoAnual: clientData.consumoAnual ?? 0,
        nombreTitular: clientData.nombreTitular ?? "",
        personaContacto: clientData.personaContacto ?? "",
        comercial: clientData.comercial ?? "",
        direccion: clientData.direccion ?? "",
        comercializadorActual: clientData.comercializadorActual ?? "",
        tarifaAcceso: e.tarifaAcceso,
        zonaGeografica: e.zonaGeografica,
        perfilCarga: e.perfilCarga,
        fechaInicio: e.periodo.fechaInicio,
        fechaFin: e.periodo.fechaFin,
        consumo: normalizeConsumptionMap(rawConsumo, deriveSource, e.facturaActual),
        potencia: Object.fromEntries(pp.map((p) => [p, potMap[p] ?? 0])),
        exceso: typeof e.excesoPotencia === "number" ? e.excesoPotencia : 0,
        omie: Object.fromEntries(ep.map((p) => [p, omieMap[p] ?? 0])),
        personalizadaIndexMargenEnergia: Object.fromEntries(ep.map((p) => [p, ((e.personalizadaIndex?.margenEnergia ?? {}) as Record<string, number>)[p] ?? 0])),
        personalizadaIndexMargenPotencia: Object.fromEntries(pp.map((p) => [p, ((e.personalizadaIndex?.margenPotencia ?? {}) as Record<string, number>)[p] ?? 0])),
        personalizadaOmieBTerminoB: Object.fromEntries(ep.map((p) => [p, ((e.personalizadaOmieB?.terminoB ?? {}) as Record<string, number>)[p] ?? 0])),
        personalizadaOmieBMargenPotencia: Object.fromEntries(pp.map((p) => [p, ((e.personalizadaOmieB?.margenPotencia ?? {}) as Record<string, number>)[p] ?? 0])),
        personalizadaFijoEnergia: Object.fromEntries(ep.map((p) => [p, ((e.personalizadaFijo?.preciosEnergia ?? {}) as Record<string, number>)[p] ?? 0])),
        personalizadaFijoPotencia: Object.fromEntries(pp.map((p) => [p, ((e.personalizadaFijo?.preciosPotencia ?? {}) as Record<string, number>)[p] ?? 0])),
        facturaActual: e.facturaActual,
        reactiva: e.extras?.reactiva ?? 0,
        alquiler: e.extras?.alquilerEquipoMedida ?? 0,
        otrosCargos: e.extras?.otrosCargos ?? 0,
        useCurrentInvoiceBreakdown: (e.extras as any)?.useCurrentInvoiceBreakdown !== false,
        importePotencia: (e.extras as any)?.terminoPotenciaActual ?? (invoiceData as any)?.importePotencia ?? derivedBreakdown.importePotencia ?? 0,
        importeEnergia: (e.extras as any)?.terminoEnergiaActual ?? (invoiceData as any)?.importeEnergia ?? derivedBreakdown.importeEnergia ?? 0,
        importeImpuestoElectrico: (e.extras as any)?.impuestoElectricoActual ?? (invoiceData as any)?.importeImpuestoElectrico ?? derivedBreakdown.importeImpuestoElectrico ?? 0,
        importeIva: (e.extras as any)?.ivaActual ?? (invoiceData as any)?.importeIva ?? derivedBreakdown.importeIva ?? 0,
        ivaTasa: e.extras?.ivaTasa ?? 21,
        impuestoElectricoTasa: e.extras?.impuestoElectricoTasa ?? 5.11269,
    };
}

const GAS_TARIFA_VALUES: GasTarifa[] = ["RL01", "RL02", "RL03", "RL04", "RL05", "RL06", "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6"];

function normalizeGasTarifa(raw: string | undefined | null): GasTarifa {
    if (!raw) return "RL01";
    const upper = raw.toUpperCase().trim();
    // Exact match
    if (GAS_TARIFA_VALUES.includes(upper as GasTarifa)) return upper as GasTarifa;
    // Handle formats like "RL.2", "RL.02", "RLPS.1", "RL2", "RL 2"
    const m = upper.match(/^(RLPS|RL)[.\s-]?0?(\d)$/);
    if (m) {
        const candidate = `${m[1]}0${m[2]}` as GasTarifa;
        if (GAS_TARIFA_VALUES.includes(candidate)) return candidate;
    }
    return "RL01";
}

function hydrateGas(p: SimulationPayload): GasFormState | null {
    const g = p.gas;
    const invoiceData = (p as any).invoiceData;

    // If no existing gas data but invoiceData exists for gas, pre-fill from invoice
    if (!g && invoiceData && invoiceData.invoiceType === "GAS") {
        const { fechaInicio, fechaFin } = invoiceData.fechaInicio && invoiceData.fechaFin
            ? { fechaInicio: invoiceData.fechaInicio, fechaFin: invoiceData.fechaFin }
            : prevMonthRange();
        const derivedBreakdown = deriveGasCurrentBreakdown(invoiceData);

        return {
            cups: invoiceData.cups || "",
            consumoAnual: invoiceData.consumoAnual || 0,
            nombreTitular: invoiceData.nombreTitular || "",
            personaContacto: invoiceData.personaContacto || "",
            comercial: invoiceData.comercial || "",
            direccion: invoiceData.direccion || "",
            comercializadorActual: invoiceData.comercializadorActual || "",
            tarifaAcceso: normalizeGasTarifa(invoiceData.tarifaAcceso),
            zonaGeografica: "Peninsula",
            consumo: invoiceData.consumoTotal || 0,
            telemedida: invoiceData.telemedida === "SI" ? "SI" : "NO",
            fechaInicio,
            fechaFin,
            facturaActual: invoiceData.facturaActual ?? 0,
            alquiler: invoiceData.alquiler ?? 0,
            otrosCargos: invoiceData.otrosCargos ?? 0,
            useCurrentInvoiceBreakdown: invoiceData.useCurrentInvoiceBreakdown !== false,
            importeTerminoFijo: invoiceData.importeTerminoFijo ?? derivedBreakdown.importeTerminoFijo ?? 0,
            importeTerminoVariable: invoiceData.importeTerminoVariable ?? derivedBreakdown.importeTerminoVariable ?? 0,
            importeImpuestoHidrocarburos: invoiceData.importeImpuestoHidrocarburos ?? derivedBreakdown.importeImpuestoHidrocarburos ?? 0,
            importeIva: invoiceData.importeIva ?? derivedBreakdown.importeIva ?? 0,
            ivaTasa: invoiceData.ivaTasa ?? 21,
            impuestoHidrocarburo: invoiceData.impuestoHidrocarburo ?? 0.00234,
            personalizadaIndexMargen: 0,
            personalizadaFijoTerminoDia: 0,
            personalizadaFijoTerminoVariable: 0,
        };
    }

    if (!g) return null;
    const derivedBreakdown = deriveGasCurrentBreakdown({
        ...(invoiceData ?? {}),
        facturaActual: g.facturaActual,
        consumo: g.consumo,
        alquilerEquipoMedida: g.extras?.alquilerEquipoMedida,
        alquiler: g.extras?.alquilerEquipoMedida,
        otrosCargos: g.extras?.otrosCargos,
        ivaTasa: g.ivaTasa,
        impuestoHidrocarburo: g.impuestoHidrocarburo,
    });
    return {
        cups: g.cups || "",
        consumoAnual: g.consumoAnual || 0,
        nombreTitular: g.nombreTitular || "",
        personaContacto: g.personaContacto || "",
        comercial: g.comercial || "",
        direccion: g.direccion || "",
        comercializadorActual: g.comercializadorActual || "",
        tarifaAcceso: g.tarifaAcceso,
        zonaGeografica: g.zonaGeografica,
        consumo: g.consumo,
        telemedida: g.telemedida,
        fechaInicio: g.periodo.fechaInicio,
        fechaFin: g.periodo.fechaFin,
        facturaActual: g.facturaActual,
        alquiler: g.extras?.alquilerEquipoMedida ?? 0,
        otrosCargos: g.extras?.otrosCargos ?? 0,
        useCurrentInvoiceBreakdown: (g.extras as any)?.useCurrentInvoiceBreakdown !== false,
        importeTerminoFijo: (g.extras as any)?.terminoFijoActual ?? (invoiceData as any)?.importeTerminoFijo ?? derivedBreakdown.importeTerminoFijo ?? 0,
        importeTerminoVariable: (g.extras as any)?.terminoVariableActual ?? (invoiceData as any)?.importeTerminoVariable ?? derivedBreakdown.importeTerminoVariable ?? 0,
        importeImpuestoHidrocarburos: (g.extras as any)?.impuestoHidrocarburoActual ?? (invoiceData as any)?.importeImpuestoHidrocarburos ?? derivedBreakdown.importeImpuestoHidrocarburos ?? 0,
        importeIva: (g.extras as any)?.ivaActual ?? (invoiceData as any)?.importeIva ?? derivedBreakdown.importeIva ?? 0,
        ivaTasa: g.ivaTasa ?? 21,
        impuestoHidrocarburo: g.impuestoHidrocarburo ?? 0.00234,
        personalizadaIndexMargen: g.personalizadaIndex?.margenEnergia ?? 0,
        personalizadaFijoTerminoDia: g.personalizadaFijo?.terminoDia ?? 0,
        personalizadaFijoTerminoVariable: g.personalizadaFijo?.terminoVariable ?? 0,
    };
}

// ─── Tiny UI helpers ───────────────────────────────────────────────────────────

function HelpIcon({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    return (
        <span
            style={{ position: "relative", display: "inline-flex", marginLeft: 4, cursor: "help" }}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", fontWeight: 600 }}>ⓘ</span>
            {show && (
                <span style={{
                    position: "absolute",
                    left: 20,
                    top: -8,
                    background: "var(--scheme-neutral-1100)",
                    border: "1px solid var(--scheme-neutral-800)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--scheme-neutral-300)",
                    whiteSpace: "nowrap",
                    zIndex: 1000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}>
                    {text}
                </span>
            )}
        </span>
    );
}

function Sec({ title, children, block, collapsible, defaultOpen = true, optional, complete }: {
    title?: string;
    children: React.ReactNode;
    block?: boolean;
    collapsible?: boolean;
    defaultOpen?: boolean;
    optional?: boolean;
    complete?: boolean;
}) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={block ? "simulation-form-section simulation-form-section--block" : "simulation-form-section"} style={{
            marginBottom: 24,
            ...(block ? {
                background: "linear-gradient(180deg, color-mix(in srgb, var(--scheme-neutral-1200) 94%, var(--scheme-neutral-1000)), var(--scheme-neutral-1200))",
                border: `1px solid ${complete ? "var(--scheme-neutral-800)" : "color-mix(in srgb, var(--scheme-neutral-900) 82%, var(--scheme-neutral-800))"}`,
                borderRadius: 12,
                padding: "clamp(14px, 4vw, 24px)",
                boxShadow: "var(--scheme-shadow-soft)",
            } : {})
        }}>
            <div
                style={{
                    fontSize: block ? 14 : 11,
                    fontWeight: block ? 700 : 700,
                    letterSpacing: block ? "0.05em" : "0.08em",
                    textTransform: "uppercase",
                    color: block ? "var(--scheme-neutral-200)" : "var(--scheme-neutral-400)",
                    marginBottom: isOpen ? (block ? 16 : 12) : 0,
                    paddingBottom: isOpen ? (block ? 12 : 6) : 0,
                    borderBottom: isOpen && title ? `1px solid var(--scheme-neutral-${block ? '850' : '900'})` : "none",
                    cursor: collapsible ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    userSelect: "none",
                }}
                onClick={() => collapsible && setIsOpen(!isOpen)}
            >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {title}
                    {optional && <span style={{ fontSize: 10, fontWeight: 400, color: "var(--scheme-neutral-500)", textTransform: "none" }}>({t("simulationForm", "optional")})</span>}
                    {complete && <span style={{ fontSize: 16, color: "var(--scheme-brand-500, #4ade80)" }}>✓</span>}
                </span>
                {collapsible && (
                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-500)", transition: "transform 0.3s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                )}
            </div>
            <Collapse in={isOpen} timeout={300}>
                <div>{children}</div>
            </Collapse>
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div className="simulation-form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>{children}</div>;
}

function Field({ label, hint, flex, error, required, help, children }: {
    label: string;
    hint?: string;
    flex?: string;
    error?: string;
    required?: boolean;
    help?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="sp-form-group simulation-form-field" style={{ flex: flex ?? "1 1 150px", minWidth: 0, maxWidth: "100%", ...(error ? { borderLeft: "2px solid var(--scheme-error-400, #f87171)", paddingLeft: 8 } : {}) }}>
            <label className="sp-form-label" style={error ? { color: "var(--scheme-error-400, #f87171)" } : undefined}>
                {label}
                {required && <span style={{ color: "var(--scheme-error-400, #f87171)", marginLeft: 2 }}>*</span>}
                {help && <HelpIcon text={help} />}
            </label>
            {children}
            {error
                ? <span style={{ fontSize: 11, color: "var(--scheme-error-400, #f87171)", marginTop: 3, display: "block" }}>{error}</span>
                : hint ? <span className="sp-form-hint">{hint}</span> : null}
        </div>
    );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <FormSelect
            label=""
            options={options}
            value={value}
            onChange={(v) => onChange(v as string)}
        />
    );
}

function Num({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
    return (
        <FormInput
            label=""
            type="number"
            slotProps={{
                htmlInput: {
                    step: step ?? 1,
                    min: 0
                },

            }}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
    );
}

function PeriodGrid({ label, periods, values, onChange, step, hint, errorPeriods }: {
    label: string; periods: string[]; values: PeriodMap;
    onChange: (p: string, v: number) => void; step?: number; hint?: string;
    errorPeriods?: string[];
}) {
    const { t } = useI18n();
    const hasErrors = errorPeriods && errorPeriods.length > 0;
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>{label}</div>
            <div className="simulation-period-grid" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {periods.map((p) => {
                    const isInvalid = errorPeriods?.includes(p);
                    return (
                        <div className="simulation-period-field" key={p} style={{ flex: "1 1 90px", minWidth: 0 }}>
                            <div style={{ fontSize: 10, textAlign: "center", marginBottom: 3, ...(isInvalid ? { color: "var(--scheme-error-400, #f87171)", fontWeight: 600 } : { opacity: 0.5 }) }}>{p}</div>
                            <FormInput
                                label=""
                                type="number"
                                slotProps={{
                                    htmlInput: {
                                        step: step ?? 1,
                                        min: 0
                                    }
                                }}
                                value={values[p] ?? 0}
                                onChange={(e) => onChange(p, parseFloat(e.target.value) || 0)}
                                error={isInvalid}

                            />
                        </div>
                    );
                })}
            </div>
            {hasErrors
                ? <div style={{ fontSize: 11, color: "var(--scheme-error-400, #f87171)", marginTop: 4 }}>{t("simulationForm", "allPeriodsFilled")}</div>
                : hint ? <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>{hint}</div> : null}
        </div>
    );
}

// ─── Electricity sub-form ─────────────────────────────────────────────────────

function ElecForm({ state, onChange, errors = {}, cupsHistory = [], onClientFieldsChanged, ivaRateOptions = [], electricityTaxRateOptions = [] }: {
    state: ElecFormState;
    onChange: (s: ElecFormState) => void;
    errors?: Record<string, string>;
    cupsHistory?: CupsLookupEntry[];
    onClientFieldsChanged?: (data: { name?: string; contactName?: string }) => void;
    ivaRateOptions?: number[];
    electricityTaxRateOptions?: number[];
}) {
    const { t } = useI18n();
    const { preferences: { numberFormat } } = useUserPreferences();
    const up = <K extends keyof ElecFormState>(k: K, v: ElecFormState[K]) => onChange({ ...state, [k]: v });
    const upP = (field: "consumo" | "potencia" | "omie" | "personalizadaIndexMargenEnergia" | "personalizadaIndexMargenPotencia" | "personalizadaOmieBTerminoB" | "personalizadaOmieBMargenPotencia" | "personalizadaFijoPotencia" | "personalizadaFijoEnergia") => (p: string, v: number) => up(field, { ...state[field], [p]: v });
    const ep = ELEC_ENERGY_PERIODS[state.tarifaAcceso];
    const pp = ELEC_POWER_PERIODS[state.tarifaAcceso];
    const xp = ELEC_EXCESS_PERIODS[state.tarifaAcceso];
    const consumoErrPeriods = ep.filter((p) => !!errors[`consumo.${p}`]);
    const potenciaErrPeriods = pp.filter((p) => !!errors[`potencia.${p}`]);

    // When a known CUPS is selected, auto-fill client fields from history
    const handleCupsChange = (value: string) => {
        const normalized = value.toUpperCase().trim();
        up("cups", value);
        const match = cupsHistory.find((e) => e.cups === normalized);
        if (match) {
            onChange({
                ...state,
                cups: value,
                nombreTitular: match.nombreTitular || state.nombreTitular,
                personaContacto: match.personaContacto || state.personaContacto,
                comercial: match.comercial || state.comercial,
                direccion: match.direccion || state.direccion,
                comercializadorActual: match.comercializadorActual || state.comercializadorActual,
            });
        }
    };

    // Completion checks
    const clientComplete = !!state.cups && !!state.nombreTitular;
    const invoiceComplete = !!state.fechaInicio && !!state.fechaFin && state.facturaActual > 0;
    const powerComplete = pp.every((p) => (state.potencia[p] ?? 0) > 0);
    const consumptionComplete = ep.some((p) => (state.consumo[p] ?? 0) > 0);
    const currentBreakdownTotal = currentElecInvoiceBreakdownTotal(state);
    const currentBreakdownDifference = roundMoney(currentBreakdownTotal - state.facturaActual);
    const currentBreakdownDoesNotMatch = state.useCurrentInvoiceBreakdown && invoiceBreakdownMismatch(currentBreakdownTotal, state.facturaActual);

    const requiredSteps = [clientComplete, invoiceComplete, powerComplete, consumptionComplete];
    const completedCount = requiredSteps.filter(Boolean).length;
    const totalSteps = requiredSteps.length;
    const progressPercent = (completedCount / totalSteps) * 100;

    return (
        <>
            {/* Progress indicator */}
            <div className="simulation-input-progress-card" style={{
                marginBottom: 28,
                padding: "16px 20px",
                background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
                border: "1px solid var(--scheme-neutral-900)",
                borderRadius: 8,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "var(--scheme-neutral-300)" }}>
                        {t("simulationForm", "formCompletion", { completed: completedCount, total: totalSteps })}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-400)" }}>{Math.round(progressPercent)}%</span>
                </div>
                <div style={{
                    height: 6,
                    background: "var(--scheme-neutral-950)",
                    borderRadius: 3,
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${progressPercent}%`,
                        background: progressPercent === 100 ? "var(--scheme-brand-500, #4ade80)" : "var(--scheme-brand-600, #22c55e)",
                        transition: "width 0.3s ease",
                    }} />
                </div>
            </div>

            {/* Client data section */}
            <Sec title={t("simulationForm", "sectionClientInfo")} block collapsible complete={clientComplete}>
                <Row>
                    <Field label={t("simulationForm", "fieldCups")} flex="1 1 280px" required help={t("simulationForm", "helpCups")}
                        hint={cupsHistory.length > 0 ? t("simulationForm", "cupsLookupHint", { count: cupsHistory.length }) : undefined}>
                        <Autocomplete
                            freeSolo
                            options={cupsHistory}
                            getOptionLabel={(option) => typeof option === 'string' ? option : option.cups}
                            value={state.cups}
                            onChange={(_, newValue) => {
                                handleCupsChange(typeof newValue === 'string' ? newValue : (newValue as CupsLookupEntry)?.cups || "");
                            }}
                            onInputChange={(_, newInputValue) => {
                                handleCupsChange(newInputValue);
                            }}
                            renderOption={(props, option) => {
                                const { key, ...restProps } = props as typeof props & { key?: React.Key };
                                const entry = option as CupsLookupEntry;
                                const statusColor: Record<string, string> = {
                                    DRAFT: '#f59e0b',
                                    SHARED: '#22c55e',
                                    EXPIRED: '#ef4444',
                                };
                                const color = statusColor[entry.lastStatus ?? ''] ?? '#94a3b8';
                                const dateStr = entry.lastUsed
                                    ? new Date(entry.lastUsed).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                                    : null;
                                return (
                                    <li key={key ?? entry.cups} {...restProps} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 14px', gap: 2, cursor: 'pointer' }}>
                                        <span style={{ fontWeight: 600, letterSpacing: '0.03em' }}>{entry.cups}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>

                                            {entry.lastStatus && (
                                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, background: color + '1a', borderRadius: 4, padding: '1px 6px' }}>{entry.lastStatus}</span>
                                            )}
                                            {dateStr && (
                                                <span style={{ fontSize: 10, color: 'var(--scheme-neutral-500)' }}>{dateStr}</span>
                                            )}
                                        </div>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder={t("simulationForm", "placeholderCups")}
                                    size="small"
                                    sx={(theme) => ({
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fafafa',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            color: theme.palette.text.primary,
                                            '& fieldset': {
                                                borderWidth: '1px',
                                                borderColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(255, 255, 255, 0.23)'
                                                    : 'rgba(0, 0, 0, 0.23)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(255, 255, 255, 0.4)'
                                                    : 'rgba(0, 0, 0, 0.4)',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderWidth: '1px',
                                            },
                                        },
                                        '& .MuiInputBase-input::placeholder': {
                                            color: theme.palette.text.secondary,
                                            opacity: 1,
                                        },
                                    })}
                                />
                            )}
                            ListboxProps={{
                                style: {
                                    maxHeight: '300px',
                                }
                            }}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldAnnualConsumption")} flex="1 1 180px" hint={t("simulationForm", "fieldAnnualConsumptionHint")} help={t("simulationForm", "helpAnnualConsumption")}>
                        <Num value={state.consumoAnual} onChange={(v) => up("consumoAnual", v)} step={1000} />
                    </Field>
                    <Field label={t("simulationForm", "fieldZone")} flex="1 1 160px" required>
                        <Sel value={state.zonaGeografica} onChange={(v) => up("zonaGeografica", v as ElecFormState["zonaGeografica"])} options={[{ value: "Peninsula", label: t("simulationForm", "peninsula") }, { value: "Baleares", label: t("simulationForm", "balearics") }, { value: "Canarias", label: t("simulationForm", "canarias") }]} />
                    </Field>
                </Row>
                <Divider sx={{ mb: 2 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldClientName")} required>
                        <FormInput
                            label=""
                            type="text"
                            value={state.nombreTitular}
                            onChange={(e) => up("nombreTitular", e.target.value)}
                            onBlur={() => onClientFieldsChanged?.({ name: state.nombreTitular })}
                            placeholder={t("simulationForm", "placeholderClientName")}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldContactPerson")}>
                        <FormInput
                            label=""
                            type="text"
                            value={state.personaContacto}
                            onChange={(e) => up("personaContacto", e.target.value)}
                            onBlur={() => onClientFieldsChanged?.({ contactName: state.personaContacto })}
                            placeholder={t("simulationForm", "placeholderContactPerson")}
                        />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldSalesAgent")}>
                        <FormInput disabled label="" type="text" value={state.comercial} onChange={(e) => up("comercial", e.target.value)} placeholder={t("simulationForm", "placeholderSalesAgent")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldAddress")}>
                        <FormInput label="" type="text" value={state.direccion} onChange={(e) => up("direccion", e.target.value)} placeholder={t("simulationForm", "placeholderAddress")} />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldCurrentSupplier")} flex="1 1 280px" help={t("simulationForm", "helpCurrentSupplier")}>
                        <FormInput label="" type="text" value={state.comercializadorActual} onChange={(e) => up("comercializadorActual", e.target.value)} placeholder={t("simulationForm", "placeholderCurrentSupplier")} />
                    </Field>
                </Row>
            </Sec>

            <Sec title={t("simulationForm", "sectionInvoiceBreakdown")} block collapsible complete={powerComplete && consumptionComplete && invoiceComplete}>
                <Box className="simulation-form-responsive-grid" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                    gap: 16,
                }}>
                    <Sec>
                        <Field label={t("simulationForm", "fieldTariff")} required help={t("simulationForm", "helpAccessTariff")}>
                            <Sel value={state.tarifaAcceso} onChange={(v) => {
                                const tariff = v as ElecTarifa;
                                onChange({
                                    ...state,
                                    tarifaAcceso: tariff,
                                    consumo: emptyPeriods(ELEC_ENERGY_PERIODS[tariff]),
                                    potencia: emptyPeriods(ELEC_POWER_PERIODS[tariff]),
                                    exceso: 0,
                                    omie: emptyPeriods(ELEC_ENERGY_PERIODS[tariff]),
                                });
                            }} options={[{ value: "2.0TD", label: t("simulationForm", "optionLowVoltage15") }, { value: "3.0TD", label: t("simulationForm", "optionLowVoltage15Plus") }, { value: "6.1TD", label: t("simulationForm", "optionHighVoltage") }]} />
                        </Field>
                        <div style={{ height: 10 }} />
                        <Field label={t("simulationForm", "fieldLoadProfile")}>
                            <Sel value={state.perfilCarga} onChange={(v) => up("perfilCarga", v as "NORMAL" | "DIURNO")} options={[{ value: "NORMAL", label: t("simulationForm", "normal") }, { value: "DIURNO", label: t("simulationForm", "daytime") }]} />
                        </Field>
                    </Sec>
                    <Sec>
                        <Row>
                            <Field label={t("simulationForm", "fieldBillingPeriod")} error={errors.fechaInicio || errors.fechaFin} required>
                                <DateRangePicker
                                    variant="inline"
                                    startDate={state.fechaInicio ? parseLocalDate(state.fechaInicio) : null}
                                    endDate={state.fechaFin ? parseLocalDate(state.fechaFin) : null}
                                    onChange={(start, end) => {
                                        const formatDate = (date: Date) => {
                                            const y = date.getFullYear();
                                            const m = String(date.getMonth() + 1).padStart(2, '0');
                                            const d = String(date.getDate()).padStart(2, '0');
                                            return `${y}-${m}-${d}`;
                                        };

                                        const newState: Partial<ElecFormState> = {};

                                        if (start) {
                                            newState.fechaInicio = formatDate(start);
                                        }

                                        if (end) {
                                            newState.fechaFin = formatDate(end);
                                        } else if (start && !end) {
                                            newState.fechaFin = "";
                                        }

                                        onChange({ ...state, ...newState });
                                    }}
                                    error={!!errors.fechaInicio || !!errors.fechaFin}
                                    nopadding
                                    months={2}
                                />
                            </Field>
                            <Field label={t("simulationForm", "fieldDays")} flex="0 0 88px">
                                <FormInput label="" type="number" slotProps={{ htmlInput: { readOnly: true } }} value={daysBetween(state.fechaInicio, state.fechaFin, true)} sx={{ opacity: 0.6 }} />
                            </Field>
                        </Row>
                    </Sec>
                </Box>
                <Divider sx={{ my: 2 }} />

                <PeriodGrid label={`${t("simulationForm", "powerPeriodsLabel", { periods: pp.join(" · ") })}`} periods={pp} values={state.potencia} onChange={upP("potencia")} step={0.1} hint={t("simulationForm", "powerPeriodsHintInvoice")} errorPeriods={potenciaErrPeriods} />
                {xp.length > 0 && (
                    <>
                        <div style={{ height: 12 }} />
                        <Row>
                            <Field label={t("simulationForm", "excessPowerLabel")} hint={t("simulationForm", "excessPowerHint")} flex="0 0 200px">
                                <CurrencyInput value={state.exceso} onChange={(v) => up("exceso", isNaN(v) ? 0 : v)} />
                            </Field>
                        </Row>
                    </>
                )}
                <Divider sx={{ my: 2 }} />
                <PeriodGrid label={`${t("simulationForm", "energyPeriodsLabel", { periods: ep.join(" · ") })}`} periods={ep} values={state.consumo} onChange={upP("consumo")} step={100} hint={t("simulationForm", "energyPeriodsHintInvoice")} errorPeriods={consumoErrPeriods} />
                <Divider sx={{ my: 2 }} />

                <Row>
                    <Field label={t("simulationForm", "fieldInvoiceTotal")} hint={t("simulationForm", "fieldCurrentInvoiceHint")} error={errors.facturaActual} flex="1 1 0" required help={t("simulationForm", "helpInvoiceTotal")}>
                        <CurrencyInput value={state.facturaActual} onChange={(v) => up("facturaActual", isNaN(v) ? 0 : v)} error={!!errors.facturaActual} />
                    </Field>
                    <Field label={t("simulationForm", "fieldReactiveEnergy")} hint={t("simulationForm", "fieldReactiveHint")} flex="1 1 0">
                        <CurrencyInput value={state.reactiva} onChange={(v) => up("reactiva", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldMeterRental")} hint={t("simulationForm", "fieldMeterRentalHint")} flex="1 1 0">
                        <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")} hint={t("simulationForm", "fieldOtherChargesHint")} flex="1 1 0">
                        <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                    </Field>
                </Row>
                <Row>
                    <Field label="" flex="1 1 100%">
                        <Box
                            sx={{
                                border: "1px solid",
                                borderColor: currentBreakdownDoesNotMatch ? "warning.main" : state.useCurrentInvoiceBreakdown ? "success.main" : "divider",
                                borderRadius: 1,
                                p: 1.25,
                                bgcolor: currentBreakdownDoesNotMatch ? "rgba(245,158,11,.16)" : state.useCurrentInvoiceBreakdown ? "rgba(16,185,129,.08)" : "transparent",
                            }}
                        >
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={state.useCurrentInvoiceBreakdown}
                                        onChange={(_, checked) => up("useCurrentInvoiceBreakdown", checked)}
                                    />
                                }
                                label={t("simulationForm", "currentPlanBreakdownLabel")}
                                sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 12, fontWeight: 800 } }}
                            />
                            {state.useCurrentInvoiceBreakdown ? (
                                <Typography variant="caption" sx={{ display: "block", ml: 5.25, color: "text.secondary", lineHeight: 1.35 }}>
                                    {t("simulationForm", "currentPlanBreakdownEnabledHint")}
                                </Typography>
                            ) : null}
                            {currentBreakdownDoesNotMatch ? (
                                <Typography variant="caption" sx={{ display: "block", ml: 5.25, color: "warning.main", lineHeight: 1.35, fontWeight: 700 }}>
                                    {t("simulationForm", "currentPlanBreakdownMismatchWarning", { amount: `${formatNumber(Math.abs(currentBreakdownDifference), numberFormat, 2)} €` })}
                                </Typography>
                            ) : null}
                        </Box>
                    </Field>
                </Row>
                <Collapse in={state.useCurrentInvoiceBreakdown} timeout={200} unmountOnExit>
                    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: currentBreakdownDoesNotMatch ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.08)" }}>
                        <Row>
                            <Field label={t("simulationForm", "currentPowerCostLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.importePotencia} onChange={(v) => up("importePotencia", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "currentEnergyCostLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.importeEnergia} onChange={(v) => up("importeEnergia", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "excessPowerLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.exceso} onChange={(v) => up("exceso", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "currentElectricityTaxLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.importeImpuestoElectrico} onChange={(v) => up("importeImpuestoElectrico", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "fieldOtherCharges")} flex="1 1 180px">
                                <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "fieldMeterRental")} flex="1 1 180px">
                                <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "currentIvaAmountLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.importeIva} onChange={(v) => up("importeIva", isNaN(v) ? 0 : v)} />
                            </Field>
                        </Row>
                    </Box>
                </Collapse>
                <Divider sx={{ my: 2 }} />
                <Row>
                    <Field label={state.zonaGeografica === "Canarias" ? t("simulationForm", "fieldIgic") : t("simulationForm", "fieldVat")} hint={state.zonaGeografica === "Canarias" ? t("simulationForm", "fieldIgicHint") : t("simulationForm", "fieldVatHint")} flex="1 1 0">
                        {ivaRateOptions.length > 0 ? (
                            <Sel
                                value={String(state.ivaTasa)}
                                onChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) up("ivaTasa", n); }}
                                options={[...new Set([...ivaRateOptions, state.ivaTasa])].filter((o) => !isNaN(o)).sort((a, b) => a - b).map((o) => ({ value: String(o), label: formatNumber(o, numberFormat) + "%" }))}
                            />
                        ) : (
                            <Num value={state.ivaTasa} onChange={(v) => up("ivaTasa", v)} step={0.01} />
                        )}
                    </Field>
                    <Field label={t("simulationForm", "fieldElecTax")} hint={t("simulationForm", "fieldElecTaxHint", { tax: formatNumber(state.impuestoElectricoTasa, numberFormat) + "%" })} flex="1 1 0">
                        {electricityTaxRateOptions.length > 0 ? (
                            <Sel
                                value={String(state.impuestoElectricoTasa)}
                                onChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) up("impuestoElectricoTasa", n); }}
                                options={[...new Set([...electricityTaxRateOptions, state.impuestoElectricoTasa])].filter((o) => !isNaN(o)).sort((a, b) => a - b).map((o) => ({ value: String(o), label: formatNumber(o, numberFormat) + "%" }))}
                            />
                        ) : (
                            <Num value={state.impuestoElectricoTasa} onChange={(v) => up("impuestoElectricoTasa", v)} step={0.001} />
                        )}
                    </Field>
                </Row>
            </Sec>

        </>
    );
}

// ─── Gas sub-form ─────────────────────────────────────────────────────────────

function GasForm({ state, onChange, errors = {}, ivaRateOptions = [], hydrocarbonTaxRateOptions = [] }: { state: GasFormState; onChange: (s: GasFormState) => void; errors?: Record<string, string>; ivaRateOptions?: number[]; hydrocarbonTaxRateOptions?: number[] }) {
    const { t } = useI18n();
    const { preferences: { numberFormat } } = useUserPreferences();
    const up = <K extends keyof GasFormState>(k: K, v: GasFormState[K]) => onChange({ ...state, [k]: v });

    // Completion checks for gas
    const invoiceComplete = !!state.fechaInicio && !!state.fechaFin && state.facturaActual > 0;
    const consumptionComplete = state.consumo > 0;
    const currentBreakdownTotal = currentGasInvoiceBreakdownTotal(state);
    const currentBreakdownDifference = roundMoney(currentBreakdownTotal - state.facturaActual);
    const currentBreakdownDoesNotMatch = state.useCurrentInvoiceBreakdown && invoiceBreakdownMismatch(currentBreakdownTotal, state.facturaActual);

    const requiredSteps = [invoiceComplete, consumptionComplete];
    const completedCount = requiredSteps.filter(Boolean).length;
    const totalSteps = requiredSteps.length;
    const progressPercent = (completedCount / totalSteps) * 100;

    return (
        <>
            {/* Progress indicator */}
            <div className="simulation-input-progress-card" style={{
                marginBottom: 28,
                padding: "16px 20px",
                background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
                border: "1px solid var(--scheme-neutral-900)",
                borderRadius: 8,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "var(--scheme-neutral-300)" }}>
                        {t("simulationForm", "formCompletion", { completed: completedCount, total: totalSteps })}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-400)" }}>{Math.round(progressPercent)}%</span>
                </div>
                <div style={{
                    height: 6,
                    background: "var(--scheme-neutral-950)",
                    borderRadius: 3,
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${progressPercent}%`,
                        background: progressPercent === 100 ? "var(--scheme-brand-500, #4ade80)" : "var(--scheme-brand-600, #22c55e)",
                        transition: "width 0.3s ease",
                    }} />
                </div>
            </div>

            {/* CLIENT INFORMATION section */}
            <Sec title={t("simulationForm", "sectionClientInfo")} block collapsible complete={!!(state.nombreTitular)}>
                <Row>
                    <Field label={t("simulationForm", "fieldCups")} flex="1 1 260px" error={errors.cups}>
                        <FormInput label="" value={state.cups} onChange={(e) => up("cups", e.target.value)} placeholder={t("simulationForm", "placeholderCups")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldAnnualConsumption")} flex="1 1 180px" hint={t("simulationForm", "fieldAnnualConsumptionHint")} error={errors.consumoAnual}>
                        <Num value={state.consumoAnual} onChange={(v) => up("consumoAnual", v)} step={1000} />
                    </Field>
                    <Field label={t("simulationForm", "fieldZone")} flex="1 1 160px" required>
                        <Sel value={state.zonaGeografica} onChange={(v) => up("zonaGeografica", v as GasZona)} options={[{ value: "Peninsula", label: t("simulationForm", "peninsulaYBaleares") }]} />
                    </Field>
                </Row>
                <Divider sx={{ mb: 2 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldClientName")} error={errors.nombreTitular}>
                        <FormInput
                            label=""
                            type="text"
                            value={state.nombreTitular}
                            onChange={(e) => up("nombreTitular", e.target.value)}
                            placeholder={t("simulationForm", "placeholderClientName")}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldContactPerson")} error={errors.personaContacto}>
                        <FormInput
                            label=""
                            type="text"
                            value={state.personaContacto}
                            onChange={(e) => up("personaContacto", e.target.value)}
                            placeholder={t("simulationForm", "placeholderContactPerson")}
                        />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldSalesAgent")} error={errors.comercial}>
                        <FormInput disabled label="" type="text" value={state.comercial} onChange={(e) => up("comercial", e.target.value)} placeholder={t("simulationForm", "placeholderSalesAgent")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldAddress")} error={errors.direccion}>
                        <FormInput label="" type="text" value={state.direccion} onChange={(e) => up("direccion", e.target.value)} placeholder={t("simulationForm", "placeholderAddress")} />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldCurrentSupplier")} flex="1 1 280px" error={errors.comercializadorActual}>
                        <FormInput label="" type="text" value={state.comercializadorActual} onChange={(e) => up("comercializadorActual", e.target.value)} placeholder={t("simulationForm", "placeholderCurrentSupplier")} />
                    </Field>
                </Row>
            </Sec>

            {/* Invoice breakdown section */}
            <Sec title={t("simulationForm", "sectionInvoiceBreakdown")} block collapsible complete={invoiceComplete && consumptionComplete}>
                <Box className="simulation-form-responsive-grid" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                    gap: 16,
                }}>
                    <Sec>
                        <Field label={t("simulationForm", "fieldTariff")}>
                            <Sel value={state.tarifaAcceso} onChange={(v) => up("tarifaAcceso", v as GasTarifa)} options={["RL01", "RL02", "RL03", "RL04", "RL05", "RL06", "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6"].map((v) => ({ value: v, label: v }))} />
                        </Field>
                        <div style={{ height: 10 }} />
                        <Field label={t("simulationForm", "fieldTelemetering")}>
                            <Sel value={state.telemedida} onChange={(v) => up("telemedida", v as "SI" | "NO")} options={[{ value: "NO", label: t("simulationForm", "no") }, { value: "SI", label: t("simulationForm", "yes") }]} />
                        </Field>
                    </Sec>
                    <Sec>
                        <Row>
                            <Field label={t("simulationForm", "fieldBillingPeriod")} error={errors.fechaInicio || errors.fechaFin}>
                                <DateRangePicker
                                    variant="inline"
                                    startDate={state.fechaInicio ? parseLocalDate(state.fechaInicio) : null}
                                    endDate={state.fechaFin ? parseLocalDate(state.fechaFin) : null}
                                    onChange={(start, end) => {
                                        const formatDate = (date: Date) => {
                                            const y = date.getFullYear();
                                            const m = String(date.getMonth() + 1).padStart(2, '0');
                                            const d = String(date.getDate()).padStart(2, '0');
                                            return `${y}-${m}-${d}`;
                                        };

                                        const newState: Partial<GasFormState> = {};

                                        if (start) {
                                            newState.fechaInicio = formatDate(start);
                                        }

                                        if (end) {
                                            newState.fechaFin = formatDate(end);
                                        } else if (start && !end) {
                                            newState.fechaFin = "";
                                        }

                                        onChange({ ...state, ...newState });
                                    }}
                                    error={!!errors.fechaInicio || !!errors.fechaFin}
                                    nopadding
                                    months={2}
                                />
                            </Field>
                            <Field label={t("simulationForm", "fieldDays")} flex="0 0 70px">
                                <FormInput label="" type="number" slotProps={{ htmlInput: { readOnly: true } }} value={daysBetween(state.fechaInicio, state.fechaFin)} sx={{ opacity: 0.6 }} />
                            </Field>
                        </Row>
                    </Sec>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldConsumption")} hint={t("simulationForm", "fieldTotalConsumptionHint")} flex="1 1 260px" error={errors.consumo}>
                        <Num value={state.consumo} onChange={(v) => up("consumo", v)} step={500} />
                    </Field>
                </Row>
                <Divider sx={{ my: 2 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldCurrentInvoice")} hint={t("simulationForm", "fieldGasCurrentInvoiceHint")} error={errors.facturaActual} flex="1 1 0">
                        <CurrencyInput value={state.facturaActual} onChange={(v) => up("facturaActual", isNaN(v) ? 0 : v)} error={!!errors.facturaActual} />
                    </Field>
                    <Field label={t("simulationForm", "fieldMeterRental")} hint={t("simulationForm", "fieldMeterRentalMonthlyHint")} flex="1 1 0">
                        <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")} hint={t("simulationForm", "fieldOtherChargesLineHint")} flex="1 1 0">
                        <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                    </Field>
                </Row>
                <Row>
                    <Field label="" flex="1 1 100%">
                        <Box
                            sx={{
                                border: "1px solid",
                                borderColor: currentBreakdownDoesNotMatch ? "warning.main" : state.useCurrentInvoiceBreakdown ? "success.main" : "divider",
                                borderRadius: 1,
                                p: 1.25,
                                bgcolor: currentBreakdownDoesNotMatch ? "rgba(245,158,11,.16)" : state.useCurrentInvoiceBreakdown ? "rgba(16,185,129,.08)" : "transparent",
                            }}
                        >
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={state.useCurrentInvoiceBreakdown}
                                        onChange={(_, checked) => up("useCurrentInvoiceBreakdown", checked)}
                                    />
                                }
                                label={t("simulationForm", "currentPlanBreakdownLabel")}
                                sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 12, fontWeight: 800 } }}
                            />
                            {state.useCurrentInvoiceBreakdown ? (
                                <Typography variant="caption" sx={{ display: "block", ml: 5.25, color: "text.secondary", lineHeight: 1.35 }}>
                                    {t("simulationForm", "currentPlanBreakdownEnabledHint")}
                                </Typography>
                            ) : null}
                            {currentBreakdownDoesNotMatch ? (
                                <Typography variant="caption" sx={{ display: "block", ml: 5.25, color: "warning.main", lineHeight: 1.35, fontWeight: 700 }}>
                                    {t("simulationForm", "currentPlanBreakdownMismatchWarning", { amount: `${formatNumber(Math.abs(currentBreakdownDifference), numberFormat, 2)} €` })}
                                </Typography>
                            ) : null}
                        </Box>
                    </Field>
                </Row>
                <Collapse in={state.useCurrentInvoiceBreakdown} timeout={200} unmountOnExit>
                    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: currentBreakdownDoesNotMatch ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.08)" }}>
                        <Row>
                            <Field label="Fixed term" flex="1 1 180px">
                                <CurrencyInput value={state.importeTerminoFijo} onChange={(v) => up("importeTerminoFijo", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label="Variable energy term" flex="1 1 180px">
                                <CurrencyInput value={state.importeTerminoVariable} onChange={(v) => up("importeTerminoVariable", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label="Hydrocarbon tax amount" flex="1 1 180px">
                                <CurrencyInput value={state.importeImpuestoHidrocarburos} onChange={(v) => up("importeImpuestoHidrocarburos", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "fieldOtherCharges")} flex="1 1 180px">
                                <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "fieldMeterRental")} flex="1 1 180px">
                                <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                            </Field>
                            <Field label={t("simulationForm", "currentIvaAmountLabel")} flex="1 1 180px">
                                <CurrencyInput value={state.importeIva} onChange={(v) => up("importeIva", isNaN(v) ? 0 : v)} />
                            </Field>
                        </Row>
                    </Box>
                </Collapse>
                <Divider sx={{ my: 2 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldIVA")} hint={t("simulationForm", "fieldIVAHint")} flex="1 1 0">
                        {ivaRateOptions.length > 0 ? (
                            <Sel
                                value={String(state.ivaTasa)}
                                onChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) up("ivaTasa", n); }}
                                options={[...new Set([...ivaRateOptions, state.ivaTasa])].filter((o) => !isNaN(o)).sort((a, b) => a - b).map((o) => ({ value: String(o), label: formatNumber(o, numberFormat) + "%" }))}
                            />
                        ) : (
                            <Num value={state.ivaTasa} onChange={(v) => up("ivaTasa", v)} step={0.1} />
                        )}
                    </Field>
                    <Field label={t("simulationForm", "fieldHydrocarbonTax")} hint={t("simulationForm", "fieldHydrocarbonTaxHint")} flex="1 1 0">
                        {hydrocarbonTaxRateOptions.length > 0 ? (
                            <Sel
                                value={String(state.impuestoHidrocarburo)}
                                onChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) up("impuestoHidrocarburo", n); }}
                                options={[...new Set([...hydrocarbonTaxRateOptions, state.impuestoHidrocarburo])].filter((o) => !isNaN(o)).sort((a, b) => a - b).map((o) => ({ value: String(o), label: formatNumber(o, numberFormat, 5) }))}
                            />
                        ) : (
                            <Num value={state.impuestoHidrocarburo} onChange={(v) => up("impuestoHidrocarburo", v)} step={0.00001} />
                        )}
                    </Field>
                </Row>
            </Sec>

        </>
    );
}

// ─── Commodity type buttons ────────────────────────────────────────────────────

function TypeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "8px 22px",
                borderRadius: 8,
                border: `1.5px solid ${active ? "var(--scheme-brand-600, #4ade80)" : "var(--scheme-neutral-800)"}`,
                background: active ? "rgba(74,222,128,0.08)" : "transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--scheme-neutral-100)" : "var(--scheme-neutral-400)",
                transition: "all 0.15s",
            }}
        >
            {children}
        </button>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export interface SimulationFormHandle {
    calculate: (baseValueSetIdOverride?: string) => void;
}

export interface SimulationFormProps {
    simulation: SimulationItem;
    token: string;
    clients?: ClientItem[];
    onClientFieldsChanged?: (clientId: string, data: { name?: string; contactName?: string }) => void;
    onSuccess?: (results: SimulationResults, baseValueSetId?: string, payload?: SimulationPayload) => void;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onOfferSelected?: (productKey?: string, selectedOffer?: SimulationPayload["selectedOffer"]) => void;
    readOnly?: boolean;
    /** ID of the base value set to use for calculation (Admin override) */
    baseValueSetId?: string;
}

export const SimulationForm = forwardRef<SimulationFormHandle, SimulationFormProps>(function SimulationForm({ simulation, token, clients, onClientFieldsChanged, onSuccess, onNotify, onOfferSelected, readOnly, baseValueSetId }: SimulationFormProps, ref) {
    const { t } = useI18n();
    const existingPayload = (simulation.payloadJson ?? {}) as SimulationPayload;
    const isOcrFilled = !!(existingPayload as any).invoiceData;

    const ownerName = simulation.ownerUser?.fullName ?? "";

    const [simType, setSimType] = useState<SimType>(existingPayload.type ?? "ELECTRICITY");
    const [elecState, setElecState] = useState<ElecFormState>(() => {
        const s = hydrateElec(existingPayload) ?? defaultElecState();
        return s.comercial ? s : { ...s, comercial: ownerName };
    });
    const [gasState, setGasState] = useState<GasFormState>(() => {
        const s = hydrateGas(existingPayload) ?? defaultGasState();
        return s.comercial ? s : { ...s, comercial: ownerName };
    });
    const [results, setResults] = useState<SimulationResults | null>(existingPayload.results ?? null);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"inputs" | "results">(existingPayload.results ? "results" : "inputs");
    const [hasValidated, setHasValidated] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<SimulationPayload["selectedOffer"]>(
        existingPayload.selectedOffer ?? undefined
    );
    // Tracks the billing month explicitly chosen by the user via the month selector.
    // null means "derive from the billing period dates" (the default).
    const [billingMonthOverride, setBillingMonthOverride] = useState<string | null>(null);
    const [cupsHistory, setCupsHistory] = useState<CupsLookupEntry[]>([]);
    const [ivaRateOptions, setIvaRateOptions] = useState<number[]>([]);
    const [electricityTaxRateOptions, setElectricityTaxRateOptions] = useState<number[]>([]);
    const [hydrocarbonTaxRateOptions, setHydrocarbonTaxRateOptions] = useState<number[]>([]);
    const [electricityTaxConfig, setElectricityTaxConfig] = useState<any>(null);
    const [gasTaxConfig, setGasTaxConfig] = useState<any>(null);

    // Load CUPS history (scoped to simulation's client if set)
    useEffect(() => {
        fetchCupsLookup(token, simulation.clientId ? { clientId: simulation.clientId } : {})
            .then(setCupsHistory)
            .catch(() => { /* non-critical */ });
    }, [token, simulation.clientId]);

    // Load tax rate options + active defaults from system config
    useEffect(() => {
        getSystemConfig().then((cfg) => {
            const opts = cfg as any;

            // Store full tax configs for zone-aware lookups
            if (opts.electricityTaxConfig) setElectricityTaxConfig(opts.electricityTaxConfig);
            if (opts.gasTaxConfig) setGasTaxConfig(opts.gasTaxConfig);

            // Legacy flat options (fallback)
            if (opts.ivaRateOptions?.length > 1) setIvaRateOptions(opts.ivaRateOptions.map((v: any) => Number(v) * 100));
            if (opts.electricityTaxRateOptions?.length > 1) setElectricityTaxRateOptions(opts.electricityTaxRateOptions.map((v: any) => Number(v) * 100));
            if (opts.hydrocarbonTaxRateOptions?.length >= 1) setHydrocarbonTaxRateOptions(opts.hydrocarbonTaxRateOptions.map(Number));

            // Pre-fill active values into form state for new simulations (no saved payload data)
            const hasExistingElec = !!(existingPayload as any).electricity?.extras;
            const hasExistingGas = !!(existingPayload as any).gas;

            if (!hasExistingElec && opts.electricityTaxConfig) {
                const zone = (existingPayload as any).electricity?.zonaGeografica ?? "Peninsula";
                const zoneKey = zone === "Baleares" ? "baleares" : zone === "Canarias" ? "canarias" : "peninsula";
                const zoneConf = opts.electricityTaxConfig[zoneKey];
                const ivaRates: number[] = (zoneConf?.ivaRates ?? zoneConf?.igicRates ?? []).map((v: any) => Number(v) * 100);
                const elecTaxRates: number[] = (zoneConf?.elecTaxRates ?? []).map((v: any) => Number(v) * 100);
                setElecState((prev) => ({
                    ...prev,
                    ...(ivaRates.length > 0 ? { ivaTasa: ivaRates[0] } : {}),
                    ...(elecTaxRates.length > 0 ? { impuestoElectricoTasa: elecTaxRates[0] } : {}),
                }));
            } else if (!hasExistingElec) {
                const ivaPercent = opts.ivaRate != null ? Number(opts.ivaRate) * 100 : undefined;
                const elecTaxPercent = opts.electricityTaxRate != null ? Number(opts.electricityTaxRate) * 100 : undefined;
                setElecState((prev) => ({
                    ...prev,
                    ...(ivaPercent != null ? { ivaTasa: ivaPercent } : {}),
                    ...(elecTaxPercent != null ? { impuestoElectricoTasa: elecTaxPercent } : {}),
                }));
            }

            if (!hasExistingGas && opts.gasTaxConfig) {
                const zone = (existingPayload as any).gas?.zonaGeografica ?? "Peninsula";
                const zoneKey = zone === "Baleares" ? "baleares" : "peninsula";
                const zoneConf = opts.gasTaxConfig[zoneKey];
                const ivaRates: number[] = (zoneConf?.ivaRates ?? []).map((v: any) => Number(v) * 100);
                const hydroRates: number[] = (opts.gasTaxConfig.hydrocarbonTaxRates ?? []).map(Number);
                setGasState((prev) => ({
                    ...prev,
                    ...(ivaRates.length > 0 ? { ivaTasa: ivaRates[0] } : {}),
                    ...(hydroRates.length > 0 ? { impuestoHidrocarburo: hydroRates[0] } : {}),
                }));
            } else if (!hasExistingGas) {
                const ivaPercent = opts.ivaRate != null ? Number(opts.ivaRate) * 100 : undefined;
                const hydroRate = opts.hydrocarbonTaxRate != null ? Number(opts.hydrocarbonTaxRate) : undefined;
                setGasState((prev) => ({
                    ...prev,
                    ...(ivaPercent != null ? { ivaTasa: ivaPercent } : {}),
                    ...(hydroRate != null ? { impuestoHidrocarburo: hydroRate } : {}),
                }));
            }
        }).catch(() => { /* non-critical */ });
    }, []);

    // Pre-fill client fields from ClientItem when a client is linked and form client data is empty
    useEffect(() => {
        if (!simulation.clientId || !clients?.length) return;
        const client = clients.find((c) => c.id === simulation.clientId);
        if (!client) return;

        // Build a formatted address string from the client's address parts
        const buildClientAddress = (c: typeof client): string => {
            const parts: string[] = [];
            if (c.street) parts.push(c.street);
            const cityLine = [c.postalCode, c.city].filter(Boolean).join(" ");
            if (cityLine) parts.push(cityLine);
            if (c.province) parts.push(c.province);
            if (c.country) {
                const countryObj = Country.getCountryByCode(c.country);
                parts.push(countryObj ? countryObj.name : c.country);
            }
            return parts.join(", ");
        };

        const clientAddress = buildClientAddress(client);

        setElecState((prev) => {
            // Only pre-fill if the simulation payload had no client data at all
            const hasExistingData = prev.nombreTitular || prev.personaContacto;
            if (hasExistingData) return prev;
            return {
                ...prev,
                nombreTitular: client.name ?? prev.nombreTitular,
                personaContacto: client.contactName ?? prev.personaContacto,
                direccion: clientAddress || prev.direccion,
            };
        });

        setGasState((prev) => {
            const hasExistingData = prev.nombreTitular || prev.personaContacto;
            if (hasExistingData) return prev;
            return {
                ...prev,
                nombreTitular: client.name ?? prev.nombreTitular,
                personaContacto: client.contactName ?? prev.personaContacto,
                direccion: clientAddress || prev.direccion,
            };
        });
    }, [simulation.clientId, clients]);
    const elecErrors = useMemo(
        () => (hasValidated && simType !== "GAS" ? validateElec(elecState) : {}),
        [hasValidated, elecState, simType]
    );
    const gasErrors = useMemo(
        () => (hasValidated && simType !== "ELECTRICITY" ? validateGas(gasState) : {}),
        [hasValidated, gasState, simType]
    );
    const hasErrors = Object.keys(elecErrors).length + Object.keys(gasErrors).length > 0;

    const fillTestData = useCallback(() => {
        if (simType !== "GAS") {
            const testElec: ElecFormState = {
                cups: "ES0031103005412001XB",
                consumoAnual: 0, // Not used in period calculations
                nombreTitular: "GASCON DISEÑO, S.L.",
                personaContacto: "",
                comercial: "",
                direccion: "DEL GATO N, 3, URBANIZACION LA VIRGINIA \n14880 - MARBELLA, Córdoba",
                comercializadorActual: "IBERDROLA",
                tarifaAcceso: "2.0TD",
                zonaGeografica: "Peninsula",
                perfilCarga: "NORMAL",
                fechaInicio: "2026-02-01",
                fechaFin: "2026-03-01",
                consumo: { P1: 468, P2: 449, P3: 1023, P4: 0, P5: 0, P6: 0 },
                potencia: { P1: 9.86, P2: 9.86, P3: 0, P4: 0, P5: 0, P6: 0 },
                exceso: 0,
                omie: { P1: 0.17623088364033698, P2: 0.10728797576897793, P3: 0.079728736723209598, P4: 0, P5: 0, P6: 0 },
                facturaActual: 493.79,
                reactiva: 0,
                alquiler: 1.3,
                otrosCargos: 0,
                useCurrentInvoiceBreakdown: true,
                importePotencia: 0,
                importeEnergia: 0,
                importeImpuestoElectrico: 0,
                importeIva: 0,
                ivaTasa: 21,
                impuestoElectricoTasa: 5.11269,
                personalizadaIndexMargenEnergia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
                personalizadaIndexMargenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
                personalizadaOmieBTerminoB: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
                personalizadaOmieBMargenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
                personalizadaFijoPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
                personalizadaFijoEnergia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
            };
            setElecState(testElec);
        }
        if (simType !== "ELECTRICITY") {
            const testGas: GasFormState = {
                cups: "ES0230901000023635SW",
                consumoAnual: 4343455,
                nombreTitular: "CCPP EXTERIORS ONDARRETA 2",
                personaContacto: "",
                comercial: "",
                direccion: "",
                comercializadorActual: "",
                tarifaAcceso: "RL01",
                zonaGeografica: "Peninsula",
                consumo: 5000,
                telemedida: "NO",
                fechaInicio: "2026-02-01",
                fechaFin: "2026-02-28",
                facturaActual: 285.50,
                alquiler: 1.5,
                otrosCargos: 0,
                useCurrentInvoiceBreakdown: true,
                importeTerminoFijo: 0,
                importeTerminoVariable: 223.80,
                importeImpuestoHidrocarburos: 11.70,
                importeIva: 50.00,
                ivaTasa: 21,
                impuestoHidrocarburo: 0.00234,
                personalizadaIndexMargen: 0,
                personalizadaFijoTerminoDia: 0,
                personalizadaFijoTerminoVariable: 0,
            };
            setGasState(testGas);
        }
        onNotify?.(t("simulationForm", "testDataFilled"), "success");
    }, [simType, onNotify]);

    const handleCalculate = useCallback(async (baseValueSetIdOverride?: string) => {
        setHasValidated(true);
        const eErrs = simType !== "GAS" ? validateElec(elecState) : {};
        const gErrs = simType !== "ELECTRICITY" ? validateGas(gasState) : {};
        if (Object.keys(eErrs).length + Object.keys(gErrs).length > 0) return;
        setError(null);
        setCalculating(true);
        try {
            const effectiveBillingMonth =
                billingMonthOverride ??
                (simType !== "GAS"
                    ? getDominantBillingMonth(elecState.fechaInicio, elecState.fechaFin)
                    : undefined);
            const payload: SimulationPayload = {
                schemaVersion: "1",
                type: simType,
                electricity: simType !== "GAS"
                    ? {
                        ...buildElecInputs(elecState),
                        ...(effectiveBillingMonth ? { billingMonth: effectiveBillingMonth } : {}),
                    }
                    : undefined,
                gas: simType !== "ELECTRICITY" ? buildGasInputs(gasState) : undefined,
                ...(selectedOffer ? { selectedOffer } : {}),
            };
            const effectiveBaseValueSetId = baseValueSetIdOverride ?? baseValueSetId;
            const calcResult = await calculateSimulation(token, simulation.id, {
                ...(effectiveBaseValueSetId ? { baseValueSetId: effectiveBaseValueSetId } : {}),
                payloadJson: payload,
                ...(effectiveBillingMonth ? { selectedMonth: effectiveBillingMonth } : {}),
            });
            const updatedPayload: SimulationPayload = {
                ...payload,
                results: calcResult.results,
            };
            setResults(calcResult.results);
            setActiveTab("results");
            onSuccess?.(calcResult.results, calcResult.baseValueSetId, updatedPayload);
            onNotify?.(t("simulationForm", "calculationComplete", { count: (calcResult.results.electricity?.length ?? 0) + (calcResult.results.gas?.length ?? 0) }), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "calculationFailed");
            setError(msg);
            onNotify?.(msg, "error");
        } finally {
            setCalculating(false);
        }
    }, [simulation.id, token, simType, elecState, gasState, selectedOffer, onSuccess, onNotify, baseValueSetId, billingMonthOverride]);

    const calculateWithMonth = useCallback(async (month: string) => {
        // Do NOT change fechaInicio/fechaFin — the billing period must stay as-is.
        // Instead, pass selectedMonth to the API so indexed calculations use the
        // correct month's prices and days, while fixed calculations keep using
        // the billing period's days.
        setBillingMonthOverride(month);
        setError(null);
        setCalculating(true);
        try {
            const payload: SimulationPayload = {
                schemaVersion: "1",
                type: simType,
                electricity: simType !== "GAS"
                    ? {
                        ...buildElecInputs(elecState),
                        billingMonth: month,
                    }
                    : undefined,
                gas: simType !== "ELECTRICITY" ? buildGasInputs(gasState) : undefined,
                ...(selectedOffer ? { selectedOffer } : {}),
            };
            const calcResult = await calculateSimulation(token, simulation.id, {
                ...(baseValueSetId ? { baseValueSetId } : {}),
                payloadJson: payload,
                selectedMonth: month,
            });
            const updatedPayload: SimulationPayload = {
                ...payload,
                results: calcResult.results,
            };
            setResults(calcResult.results);
            setActiveTab("results");
            onSuccess?.(calcResult.results, calcResult.baseValueSetId, updatedPayload);
            onNotify?.(t("simulationForm", "calculationComplete", { count: (calcResult.results.electricity?.length ?? 0) + (calcResult.results.gas?.length ?? 0) }), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "calculationFailed");
            setError(msg);
            onNotify?.(msg, "error");
        } finally {
            setCalculating(false);
        }
    }, [simulation.id, token, simType, elecState, gasState, selectedOffer, onSuccess, onNotify, baseValueSetId]);

    useImperativeHandle(ref, () => ({ calculate: handleCalculate }), [handleCalculate]);

    const handleSelectOffer = useCallback(async (productKey: string, commodity: "ELECTRICITY" | "GAS", pricingType: "FIXED" | "INDEXED") => {
        const offerData: SimulationPayload["selectedOffer"] = { productKey, commodity, pricingType, selectedAt: new Date().toISOString() };
        const previousOffer = selectedOffer;
        setSelectedOffer(offerData);
        try {
            await updateSimulationSelectedOffer(token, simulation.id, offerData);
            onOfferSelected?.(productKey, offerData);
            onNotify?.(t("simulationForm", "offerSaved"), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "failedToSaveSelection");
            onNotify?.(msg, "error");
            setSelectedOffer(previousOffer);
        } finally {
        }
    }, [simulation.id, token, selectedOffer, onOfferSelected, onNotify]);

    const handleClearOffer = useCallback(async () => {
        const previousOffer = selectedOffer;
        setSelectedOffer(undefined);
        try {
            await updateSimulationSelectedOffer(token, simulation.id, null);
            onOfferSelected?.(undefined, null);
            onNotify?.(t("simulationForm", "offerCleared"), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "failedToClearSelection");
            setSelectedOffer(previousOffer);
            onNotify?.(msg, "error");
            throw err;
        }
    }, [simulation.id, token, selectedOffer, onOfferSelected, onNotify]);

    const facturaActual = simType === "ELECTRICITY" ? elecState.facturaActual
        : simType === "GAS" ? gasState.facturaActual : undefined;

    const selectedMonth = billingMonthOverride ?? (
        simType !== "GAS"
            ? getDominantBillingMonth(elecState.fechaInicio, elecState.fechaFin)
            : getDominantBillingMonth(gasState.fechaInicio, gasState.fechaFin)
    );
    const availableMonths = (() => {
        const today = new Date();
        const months: string[] = [];
        for (let delta = 0; delta <= 17; delta++) {
            const d = new Date(today.getFullYear(), today.getMonth() - delta, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        if (selectedMonth && !months.includes(selectedMonth)) {
            months.unshift(selectedMonth);
        }
        return months; // most recent first
    })();

    const resultCount = (results?.electricity?.length ?? 0) + (results?.gas?.length ?? 0);

    const handleTabClick = useCallback(async (tab: "inputs" | "results") => {
        if (tab === "inputs" && selectedOffer && !readOnly) {
            try {
                await handleClearOffer();
            } catch {
                return;
            }
        }
        setActiveTab(tab);
    }, [selectedOffer, readOnly, handleClearOffer]);

    return (
        <div>
            <Box className="simulation-detail-tabs" sx={{ mb: '12px' }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value: "inputs" | "results") => void handleTabClick(value)}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{
                        minHeight: 36,
                        "& .MuiTab-root": {
                            minHeight: 36,
                            px: 2,
                            py: 0.75,
                            textTransform: "none",
                            fontWeight: 500,
                        },
                    }}
                >
                    <Tab
                        value="inputs"
                        label={<Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>{t("simulationForm", "tabInputs")}</Typography>}
                    />
                    <Tab
                        value="results"
                        label={
                            <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                                {results ? t("simulationForm", "tabResultsWithCount", { count: resultCount }) : t("simulationForm", "tabResults")}
                            </Typography>
                        }
                    />
                </Tabs>
            </Box>

            {/* Inputs tab */}
            {activeTab === "inputs" && (
                <div>
                    {/* OCR disclaimer */}
                    {isOcrFilled && (
                        <div className="simulation-input-notice-card simulation-input-notice-card--warning" style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "10px 14px",
                            borderRadius: 8,
                            marginBottom: 20,
                            background: "rgba(245, 158, 11, 0.08)",
                            color: "var(--scheme-warning-400, #f59e0b)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}>
                            <Typography component="span" variant="body2" sx={{ flexShrink: 0, lineHeight: 1.3 }}>⚠️</Typography>
                            <Typography component="span" variant="body2">{t("invoiceExtractor", "ocrDisclaimer") ?? "O OCR pode conter erros. Por favor, valide os dados preenchidos antes de continuar."}</Typography>
                        </div>
                    )}

                    {/* Commodity type indicator (read-only) */}
                    <div className="simulation-input-utility-card" style={{
                        marginBottom: 28,
                        padding: "12px 16px",
                        background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
                        border: "1px solid var(--scheme-neutral-900)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                    }}>
                        <Typography component="span" variant="caption" sx={{ color: "var(--scheme-neutral-400)", fontWeight: 600, textTransform: "uppercase" }}>{t("simulationForm", "commodityType")}</Typography>
                        <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: "var(--scheme-neutral-200)", display: "flex", alignItems: "center", gap: 0.75 }}>
                            {simType === "ELECTRICITY" && <><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /> {t("simulationForm", "electricity")}</>}
                            {simType === "GAS" && <><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} /> {t("simulationForm", "gas")}</>}
                        </Typography>
                    </div>

                    {(simType === "ELECTRICITY") && (
                        <div>
                            {(() => {
                                const zone = elecState.zonaGeografica;
                                const zoneKey = zone === "Baleares" ? "baleares" : zone === "Canarias" ? "canarias" : "peninsula";
                                const zoneConf = electricityTaxConfig?.[zoneKey];
                                const zoneIvaOptions: number[] = zoneConf
                                    ? (zoneConf.ivaRates ?? zoneConf.igicRates ?? []).map((v: any) => Number(v) * 100)
                                    : ivaRateOptions;
                                const zoneElecTaxOptions: number[] = zoneConf
                                    ? (zoneConf.elecTaxRates ?? []).map((v: any) => Number(v) * 100)
                                    : electricityTaxRateOptions;
                                return (
                                    <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0, opacity: readOnly ? 0.7 : 1 }}>
                                        <ElecForm
                                            state={elecState}
                                            onChange={(s) => {
                                                // When zone changes, auto-update tax values to first configured rate for new zone
                                                if (s.zonaGeografica !== elecState.zonaGeografica && electricityTaxConfig) {
                                                    const newZoneKey = s.zonaGeografica === "Baleares" ? "baleares" : s.zonaGeografica === "Canarias" ? "canarias" : "peninsula";
                                                    const newZoneConf = electricityTaxConfig[newZoneKey];
                                                    const newIvaRates: number[] = (newZoneConf?.ivaRates ?? newZoneConf?.igicRates ?? []).map((v: any) => Number(v) * 100);
                                                    const newElecTaxRates: number[] = (newZoneConf?.elecTaxRates ?? []).map((v: any) => Number(v) * 100);
                                                    setElecState({
                                                        ...s,
                                                        ...(newIvaRates.length > 0 ? { ivaTasa: newIvaRates[0] } : {}),
                                                        ...(newElecTaxRates.length > 0 ? { impuestoElectricoTasa: newElecTaxRates[0] } : {}),
                                                    });
                                                } else {
                                                    setElecState(s);
                                                }
                                            }}
                                            errors={elecErrors}
                                            cupsHistory={cupsHistory}
                                            ivaRateOptions={zoneIvaOptions}
                                            electricityTaxRateOptions={zoneElecTaxOptions}
                                            onClientFieldsChanged={
                                                simulation.clientId && onClientFieldsChanged
                                                    ? (data) => onClientFieldsChanged(simulation.clientId!, data)
                                                    : undefined
                                            }
                                        />
                                    </fieldset>
                                );
                            })()}
                        </div>
                    )}


                    {(simType === "GAS") && (
                        <div>
                            {(() => {
                                const zone = gasState.zonaGeografica;
                                const zoneKey = zone === "Baleares" ? "baleares" : "peninsula";
                                const zoneConf = gasTaxConfig?.[zoneKey];
                                const zoneIvaOptions: number[] = zoneConf
                                    ? (zoneConf.ivaRates ?? []).map((v: any) => Number(v) * 100)
                                    : ivaRateOptions;
                                const zoneHydroOptions: number[] = gasTaxConfig
                                    ? (gasTaxConfig.hydrocarbonTaxRates ?? []).map(Number)
                                    : hydrocarbonTaxRateOptions;
                                return (
                                    <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0, opacity: readOnly ? 0.7 : 1 }}>
                                        <GasForm
                                            state={gasState}
                                            onChange={(s) => {
                                                if (s.zonaGeografica !== gasState.zonaGeografica && gasTaxConfig) {
                                                    const newZoneKey = s.zonaGeografica === "Baleares" ? "baleares" : "peninsula";
                                                    const newZoneConf = gasTaxConfig[newZoneKey];
                                                    const newIvaRates: number[] = (newZoneConf?.ivaRates ?? []).map((v: any) => Number(v) * 100);
                                                    const newHydroRates: number[] = (gasTaxConfig.hydrocarbonTaxRates ?? []).map(Number);
                                                    setGasState({
                                                        ...s,
                                                        ...(newIvaRates.length > 0 ? { ivaTasa: newIvaRates[0] } : {}),
                                                        ...(newHydroRates.length > 0 ? { impuestoHidrocarburo: newHydroRates[0] } : {}),
                                                    });
                                                } else {
                                                    setGasState(s);
                                                }
                                            }}
                                            errors={gasErrors}
                                            ivaRateOptions={zoneIvaOptions}
                                            hydrocarbonTaxRateOptions={zoneHydroOptions}
                                        />
                                    </fieldset>
                                );
                            })()}
                        </div>
                    )}

                    {/* Validation + API error + Calculate button */}
                    {hasErrors && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid var(--scheme-error-400, #f87171)", borderRadius: 8, color: "var(--scheme-error-400, #f87171)" }}>
                            <Typography component="span" variant="body2">⚠</Typography>
                            <Typography component="span" variant="body2">{t("simulationForm", "fieldsRequireAttention", { count: Object.keys(elecErrors).length + Object.keys(gasErrors).length })}</Typography>
                        </div>
                    )}
                    {error && (
                        <div className="crud-alert crud-alert--error" style={{ marginBottom: 16 }}>{error}</div>
                    )}
                    {!readOnly && (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid var(--scheme-neutral-900)" }}>
                            {results && (
                                <Button
                                    variant="contained"
                                    onClick={() => setActiveTab("results")}
                                >
                                    {t("simulationForm", "viewPreviousResults")}
                                </Button>
                            )}
                            <Button
                                variant="contained"
                                onClick={() => void handleCalculate()}
                                disabled={calculating}
                            >
                                {calculating ? t("simulationForm", "btnCalculating") : t("simulationForm", "btnCalculate")}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Results tab */}
            {activeTab === "results" && (
                <div>
                    {results ? (
                        <SimulationResultsCards
                            results={results}
                            facturaActual={facturaActual}
                            tarifaAcceso={simType !== "GAS" ? elecState.tarifaAcceso : gasState.tarifaAcceso}
                            consumoAnual={simType !== "GAS" ? elecState.consumoAnual : undefined}
                            energyPeriods={simType !== "GAS" ? elecState.consumo : undefined}
                            powerPeriods={simType !== "GAS" ? elecState.potencia : undefined}
                            omiePeriods={simType !== "GAS" ? elecState.omie : undefined}
                            onUpdatePeriod={readOnly ? undefined : (type: "energy" | "power" | "omie", period: string, value: number) => {
                                if (simType !== "GAS") {
                                    setElecState(prev => ({
                                        ...prev,
                                        [type === "energy" ? "consumo" : type === "power" ? "potencia" : "omie"]: {
                                            ...prev[type === "energy" ? "consumo" : type === "power" ? "potencia" : "omie"],
                                            [period]: value,
                                        },
                                    }));
                                }
                            }}
                            personalizadaIndexPeriods={simType !== "GAS" ? { margenEnergia: elecState.personalizadaIndexMargenEnergia, margenPotencia: elecState.personalizadaIndexMargenPotencia } : undefined}
                            onUpdatePersonalizadaIndex={readOnly ? undefined : (field, period, value) => {
                                if (simType !== "GAS") {
                                    setElecState(prev => ({
                                        ...prev,
                                        [field === "margenEnergia" ? "personalizadaIndexMargenEnergia" : "personalizadaIndexMargenPotencia"]: {
                                            ...prev[field === "margenEnergia" ? "personalizadaIndexMargenEnergia" : "personalizadaIndexMargenPotencia"],
                                            [period]: value,
                                        },
                                    }));
                                }
                            }}
                            personalizadaOmieBPeriods={simType !== "GAS" ? { terminoB: elecState.personalizadaOmieBTerminoB, margenPotencia: elecState.personalizadaOmieBMargenPotencia } : undefined}
                            onUpdatePersonalizadaOmieB={readOnly ? undefined : (field, period, value) => {
                                if (simType !== "GAS") {
                                    setElecState(prev => ({
                                        ...prev,
                                        [field === "terminoB" ? "personalizadaOmieBTerminoB" : "personalizadaOmieBMargenPotencia"]: {
                                            ...prev[field === "terminoB" ? "personalizadaOmieBTerminoB" : "personalizadaOmieBMargenPotencia"],
                                            [period]: value,
                                        },
                                    }));
                                }
                            }}
                            elecPersonalizadaFijoPeriods={simType !== "GAS" ? { preciosPotencia: elecState.personalizadaFijoPotencia, preciosEnergia: elecState.personalizadaFijoEnergia } : undefined}
                            onUpdateElecPersonalizadaFijo={readOnly || simType === "GAS" ? undefined : (field, period, value) => {
                                setElecState(prev => ({
                                    ...prev,
                                    [field === "preciosPotencia" ? "personalizadaFijoPotencia" : "personalizadaFijoEnergia"]: {
                                        ...prev[field === "preciosPotencia" ? "personalizadaFijoPotencia" : "personalizadaFijoEnergia"],
                                        [period]: value,
                                    },
                                }));
                            }}
                            gasPersonalizadaIndexMargen={simType === "GAS" ? gasState.personalizadaIndexMargen : undefined}
                            onUpdateGasPersonalizadaIndex={readOnly || simType !== "GAS" ? undefined : (margen) => {
                                setGasState(prev => ({ ...prev, personalizadaIndexMargen: margen }));
                            }}
                            gasPersonalizadaFijo={simType === "GAS" ? { terminoDia: gasState.personalizadaFijoTerminoDia, terminoVariable: gasState.personalizadaFijoTerminoVariable } : undefined}
                            onUpdateGasPersonalizadaFijo={readOnly || simType !== "GAS" ? undefined : (field, value) => {
                                setGasState(prev => ({ ...prev, [field === "terminoDia" ? "personalizadaFijoTerminoDia" : "personalizadaFijoTerminoVariable"]: value }));
                            }}
                            onRecalculate={readOnly ? undefined : () => void handleCalculate()}
                            calculating={calculating}
                            selectedOffer={selectedOffer ?? undefined}
                            onSelectOffer={readOnly ? undefined : handleSelectOffer}
                            onClearOffer={readOnly ? undefined : handleClearOffer}
                            readOnly={readOnly}
                            selectedMonth={selectedMonth}
                            availableMonths={readOnly ? undefined : availableMonths}
                            onMonthChange={readOnly ? undefined : calculateWithMonth}
                        />
                    ) : (
                        <div style={{ padding: "60px 20px", textAlign: "center", opacity: 0.5 }}>
                            <div style={{ marginBottom: 12 }}><BoltIcon sx={{ fontSize: 48, color: "#f59e0b" }} /></div>
                            <Typography variant="body2" component="div" sx={{ mb: 1, fontWeight: 600 }}>{t("simulationForm", "noResultsYet")}</Typography>
                            <Typography variant="body2" component="div">{t("simulationForm", "noResultsInstructions")}</Typography>
                            <Button variant="contained" onClick={() => void handleTabClick("inputs")} sx={{ mt: 2.5 }}>
                                {t("simulationForm", "goToInputs")}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
