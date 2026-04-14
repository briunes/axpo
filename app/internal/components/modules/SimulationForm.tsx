"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { SimulationResultsCards } from "./SimulationResultsCards";
import type { SimulationItem } from "../../lib/internalApi";
import { calculateSimulation, updateSimulation } from "../../lib/internalApi";
import { useI18n } from "../../../../src/lib/i18n-context";
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
type SimType = "ELECTRICITY" | "GAS" | "BOTH";

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
    exceso: PeriodMap;
    omie: PeriodMap;
    facturaActual: number;
    reactiva: number;
    alquiler: number;
    otrosCargos: number;
}

interface GasFormState {
    tarifaAcceso: GasTarifa;
    zonaGeografica: GasZona;
    consumo: number;
    telemedida: "SI" | "NO";
    fechaInicio: string;
    fechaFin: string;
    facturaActual: number;
    alquiler: number;
    otrosCargos: number;
}

function daysBetween(from: string, to: string): number {
    const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    return Math.max(1, d);
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
        exceso: { P1: 0, P2: 0, P3: 0 },
        omie: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        facturaActual: 0,
        reactiva: 0,
        alquiler: 0,
        otrosCargos: 0,
    };
}

function defaultGasState(): GasFormState {
    const { fechaInicio, fechaFin } = prevMonthRange();
    return {
        tarifaAcceso: "RL01",
        zonaGeografica: "Peninsula",
        consumo: 0,
        telemedida: "NO",
        fechaInicio,
        fechaFin,
        facturaActual: 0,
        alquiler: 0,
        otrosCargos: 0,
    };
}

// ─── Payload builders ──────────────────────────────────────────────────────────

function buildElecInputs(s: ElecFormState): ElectricityInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin);
    return {
        clientData: {
            cups: s.cups || undefined,
            consumoAnual: s.consumoAnual || undefined,
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
        periodo: { fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, dias },
        facturaActual: s.facturaActual,
        extras: {
            reactiva: s.reactiva || undefined,
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
        },
    } as any;
}

function buildGasInputs(s: GasFormState): GasInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin);
    return {
        tarifaAcceso: s.tarifaAcceso,
        zonaGeografica: s.zonaGeografica,
        consumo: s.consumo,
        telemedida: s.telemedida,
        periodo: { fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, dias },
        facturaActual: s.facturaActual,
        extras: {
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
        },
    };
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateElec(s: ElecFormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!s.fechaInicio) errs.fechaInicio = "Start date is required";
    if (!s.fechaFin) errs.fechaFin = "End date is required";
    if (s.fechaInicio && s.fechaFin && s.fechaFin <= s.fechaInicio) errs.fechaFin = "Must be after start date";
    if (s.facturaActual <= 0) errs.facturaActual = "Enter the current invoice total";
    const ep = ELEC_ENERGY_PERIODS[s.tarifaAcceso];
    const pp = ELEC_POWER_PERIODS[s.tarifaAcceso];
    ep.forEach((p) => { if ((s.consumo[p] ?? 0) <= 0) errs[`consumo.${p}`] = "Required"; });
    pp.forEach((p) => { if ((s.potencia[p] ?? 0) <= 0) errs[`potencia.${p}`] = "Required"; });
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
    if (!e) return null;
    const ep = ELEC_ENERGY_PERIODS[e.tarifaAcceso] ?? [];
    const pp = ELEC_POWER_PERIODS[e.tarifaAcceso] ?? [];
    const xp = ELEC_EXCESS_PERIODS[e.tarifaAcceso] ?? [];
    const cMap = e.consumo as unknown as Record<string, number>;
    const potMap = e.potenciaContratada as unknown as Record<string, number>;
    const exMap = (e.excesoPotencia ?? {}) as Record<string, number>;
    const omieMap = (e.omieEstimado ?? {}) as Record<string, number>;
    const clientData = (e as any).clientData ?? {};
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
        consumo: Object.fromEntries(ep.map((p) => [p, cMap[p] ?? 0])),
        potencia: Object.fromEntries(pp.map((p) => [p, potMap[p] ?? 0])),
        exceso: Object.fromEntries(xp.map((p) => [p, exMap[p] ?? 0])),
        omie: Object.fromEntries(ep.map((p) => [p, omieMap[p] ?? 0])),
        facturaActual: e.facturaActual,
        reactiva: e.extras?.reactiva ?? 0,
        alquiler: e.extras?.alquilerEquipoMedida ?? 0,
        otrosCargos: e.extras?.otrosCargos ?? 0,
    };
}

function hydrateGas(p: SimulationPayload): GasFormState | null {
    const g = p.gas;
    if (!g) return null;
    return {
        tarifaAcceso: g.tarifaAcceso,
        zonaGeografica: g.zonaGeografica,
        consumo: g.consumo,
        telemedida: g.telemedida,
        fechaInicio: g.periodo.fechaInicio,
        fechaFin: g.periodo.fechaFin,
        facturaActual: g.facturaActual,
        alquiler: g.extras?.alquilerEquipoMedida ?? 0,
        otrosCargos: g.extras?.otrosCargos ?? 0,
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
    title: string;
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
        <div style={{
            marginBottom: 24,
            ...(block ? {
                background: "white",
                border: `1px solid var(--scheme-neutral-${complete ? '700' : '900'}, rgba(255,255,255,0.08))`,
                borderRadius: 12,
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.02)",
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
                    borderBottom: isOpen ? `1px solid var(--scheme-neutral-${block ? '850' : '900'})` : "none",
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
                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-500)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                )}
            </div>
            {isOpen && children}
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>{children}</div>;
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
        <div className="sp-form-group" style={{ flex: flex ?? "1 1 150px", minWidth: 110, ...(error ? { borderLeft: "2px solid var(--scheme-error-400, #f87171)", paddingLeft: 8 } : {}) }}>
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
        <select className="sp-form-input" value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

function Num({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
    return (
        <input
            className="sp-form-input"
            type="number"
            step={step ?? 1}
            min={0}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {periods.map((p) => {
                    const isInvalid = errorPeriods?.includes(p);
                    return (
                        <div key={p} style={{ flex: "1 1 90px", minWidth: 75 }}>
                            <div style={{ fontSize: 10, textAlign: "center", marginBottom: 3, ...(isInvalid ? { color: "var(--scheme-error-400, #f87171)", fontWeight: 600 } : { opacity: 0.5 }) }}>{p}</div>
                            <input
                                className="sp-form-input"
                                type="number"
                                step={step ?? 1}
                                min={0}
                                value={values[p] ?? 0}
                                onChange={(e) => onChange(p, parseFloat(e.target.value) || 0)}
                                style={{ textAlign: "right", padding: "5px 8px", fontSize: 13, ...(isInvalid ? { borderColor: "var(--scheme-error-400, #f87171)", outline: "1px solid var(--scheme-error-400, #f87171)" } : {}) }}
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

function ElecForm({ state, onChange, errors = {} }: { state: ElecFormState; onChange: (s: ElecFormState) => void; errors?: Record<string, string> }) {
    const { t } = useI18n();
    const up = <K extends keyof ElecFormState>(k: K, v: ElecFormState[K]) => onChange({ ...state, [k]: v });
    const upP = (field: "consumo" | "potencia" | "exceso" | "omie") => (p: string, v: number) => up(field, { ...state[field], [p]: v });
    const ep = ELEC_ENERGY_PERIODS[state.tarifaAcceso];
    const pp = ELEC_POWER_PERIODS[state.tarifaAcceso];
    const xp = ELEC_EXCESS_PERIODS[state.tarifaAcceso];
    const consumoErrPeriods = ep.filter((p) => !!errors[`consumo.${p}`]);
    const potenciaErrPeriods = pp.filter((p) => !!errors[`potencia.${p}`]);

    // Completion checks
    const clientComplete = !!state.cups && !!state.nombreTitular;
    const invoiceComplete = !!state.fechaInicio && !!state.fechaFin && state.facturaActual > 0;
    const powerComplete = pp.every((p) => (state.potencia[p] ?? 0) > 0);
    const consumptionComplete = ep.every((p) => (state.consumo[p] ?? 0) > 0);

    const requiredSteps = [clientComplete, invoiceComplete, powerComplete, consumptionComplete];
    const completedCount = requiredSteps.filter(Boolean).length;
    const totalSteps = requiredSteps.length;
    const progressPercent = (completedCount / totalSteps) * 100;

    return (
        <>
            {/* Progress indicator */}
            <div style={{
                marginBottom: 28,
                padding: "16px 20px",
                background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
                border: "1px solid var(--scheme-neutral-900)",
                borderRadius: 8,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--scheme-neutral-300)" }}>
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
                    <Field label={t("simulationForm", "fieldCups")} flex="1 1 280px" required help={t("simulationForm", "helpCups")}>
                        <input className="sp-form-input" type="text" value={state.cups} onChange={(e) => up("cups", e.target.value)} placeholder={t("simulationForm", "placeholderCups")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldAnnualConsumption")} flex="1 1 180px" hint={t("simulationForm", "fieldAnnualConsumptionHint")} help={t("simulationForm", "helpAnnualConsumption")}>
                        <Num value={state.consumoAnual} onChange={(v) => up("consumoAnual", v)} step={1000} />
                    </Field>
                    <Field label={t("simulationForm", "fieldZone")} flex="1 1 160px" required>
                        <Sel value={state.zonaGeografica} onChange={(v) => up("zonaGeografica", v as ElecFormState["zonaGeografica"])} options={[{ value: "Peninsula", label: t("simulationForm", "peninsula") }, { value: "Baleares", label: t("simulationForm", "balearics") }, { value: "Canarias", label: t("simulationForm", "canarias") }]} />
                    </Field>
                </Row>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginTop: 20, marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid var(--scheme-neutral-900)" }}>{t("simulationForm", "clientDetailsSubtitle")}</div>
                <Row>
                    <Field label={t("simulationForm", "fieldClientName")} required>
                        <input className="sp-form-input" type="text" value={state.nombreTitular} onChange={(e) => up("nombreTitular", e.target.value)} placeholder={t("simulationForm", "placeholderClientName")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldContactPerson")}>
                        <input className="sp-form-input" type="text" value={state.personaContacto} onChange={(e) => up("personaContacto", e.target.value)} placeholder={t("simulationForm", "placeholderContactPerson")} />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldSalesAgent")}>
                        <input className="sp-form-input" type="text" value={state.comercial} onChange={(e) => up("comercial", e.target.value)} placeholder={t("simulationForm", "placeholderSalesAgent")} />
                    </Field>
                    <Field label={t("simulationForm", "fieldAddress")}>
                        <input className="sp-form-input" type="text" value={state.direccion} onChange={(e) => up("direccion", e.target.value)} placeholder={t("simulationForm", "placeholderAddress")} />
                    </Field>
                </Row>
                <Row>
                    <Field label={t("simulationForm", "fieldCurrentSupplier")} flex="1 1 280px" help={t("simulationForm", "helpCurrentSupplier")}>
                        <input className="sp-form-input" type="text" value={state.comercializadorActual} onChange={(e) => up("comercializadorActual", e.target.value)} placeholder={t("simulationForm", "placeholderCurrentSupplier")} />
                    </Field>
                </Row>
            </Sec>

            {/* Contract + Billing period with completion indicator */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
                background: "white",
                border: `1px solid var(--scheme-neutral-${invoiceComplete ? '700' : '900'}, rgba(255,255,255,0.08))`,
                borderRadius: 12,
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.02)",
            }}>
                <Sec title={t("simulationForm", "sectionInvoiceData")}>
                    <Field label={t("simulationForm", "fieldTariff")} required help={t("simulationForm", "helpAccessTariff")}>
                        <Sel value={state.tarifaAcceso} onChange={(v) => {
                            const tariff = v as ElecTarifa;
                            onChange({
                                ...state,
                                tarifaAcceso: tariff,
                                consumo: emptyPeriods(ELEC_ENERGY_PERIODS[tariff]),
                                potencia: emptyPeriods(ELEC_POWER_PERIODS[tariff]),
                                exceso: emptyPeriods(ELEC_EXCESS_PERIODS[tariff]),
                                omie: emptyPeriods(ELEC_ENERGY_PERIODS[tariff]),
                            });
                        }} options={[{ value: "2.0TD", label: t("simulationForm", "optionLowVoltage15") }, { value: "3.0TD", label: t("simulationForm", "optionLowVoltage15Plus") }, { value: "6.1TD", label: t("simulationForm", "optionHighVoltage") }]} />
                    </Field>
                    <div style={{ height: 10 }} />
                    <Field label={t("simulationForm", "fieldLoadProfile")}>
                        <Sel value={state.perfilCarga} onChange={(v) => up("perfilCarga", v as "NORMAL" | "DIURNO")} options={[{ value: "NORMAL", label: t("simulationForm", "normal") }, { value: "DIURNO", label: t("simulationForm", "daytime") }]} />
                    </Field>
                </Sec>

                <Sec title={t("simulationForm", "sectionBillingPeriod")}>
                    <Row>
                        <Field label={t("simulationForm", "fieldStartDate")} error={errors.fechaInicio} required help={t("simulationForm", "helpStartDate")}>
                            <input className="sp-form-input" type="date" value={state.fechaInicio} onChange={(e) => up("fechaInicio", e.target.value)} />
                        </Field>
                        <Field label={t("simulationForm", "fieldEndDate")} error={errors.fechaFin} required help={t("simulationForm", "helpEndDate")}>
                            <input className="sp-form-input" type="date" value={state.fechaFin} onChange={(e) => up("fechaFin", e.target.value)} />
                        </Field>
                        <Field label={t("simulationForm", "fieldDays")} flex="0 0 70px">
                            <input className="sp-form-input" type="number" readOnly value={daysBetween(state.fechaInicio, state.fechaFin)} style={{ opacity: 0.6 }} />
                        </Field>
                    </Row>
                </Sec>
            </div>

            <Sec title={t("simulationForm", "sectionContractedPower")} block collapsible complete={powerComplete}>
                <PeriodGrid label={`${t("simulationForm", "powerPeriodsLabel", { periods: pp.join(" · ") })}`} periods={pp} values={state.potencia} onChange={upP("potencia")} step={0.1} hint={t("simulationForm", "powerPeriodsHintInvoice")} errorPeriods={potenciaErrPeriods} />
                {xp.length > 0 && (
                    <>
                        <div style={{ height: 12 }} />
                        <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>{t("simulationForm", "excessPowerNote")}</div>
                        <PeriodGrid label={`${t("simulationForm", "powerPeriodsLabel", { periods: xp.join(" · ") })}`} periods={xp} values={state.exceso} onChange={upP("exceso")} step={0.1} hint={t("simulationForm", "excessPowerHint")} />
                    </>
                )}
            </Sec>

            <Sec title={t("simulationForm", "sectionEnergyConsumption")} block collapsible complete={consumptionComplete}>
                <PeriodGrid label={`${t("simulationForm", "energyPeriodsLabel", { periods: ep.join(" · ") })}`} periods={ep} values={state.consumo} onChange={upP("consumo")} step={100} hint={t("simulationForm", "energyPeriodsHintInvoice")} errorPeriods={consumoErrPeriods} />
            </Sec>

            <Sec title={t("simulationForm", "sectionInvoiceBreakdown")} block collapsible defaultOpen={false} complete={invoiceComplete}>
                <Row>
                    <Field label={t("simulationForm", "fieldReactiveEnergy")} hint={t("simulationForm", "fieldReactiveHint")}>
                        <Num value={state.reactiva} onChange={(v) => up("reactiva", v)} step={1} />
                    </Field>
                    <Field label={t("simulationForm", "fieldMeterRental")} hint={t("simulationForm", "fieldMeterRentalHint")}>
                        <Num value={state.alquiler} onChange={(v) => up("alquiler", v)} step={0.5} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")} hint={t("simulationForm", "fieldOtherChargesHint")}>
                        <Num value={state.otrosCargos} onChange={(v) => up("otrosCargos", v)} step={1} />
                    </Field>
                </Row>
                <div style={{ height: 6 }} />
                <Row>
                    <Field label={t("simulationForm", "fieldVat")} hint={t("simulationForm", "fieldVatHint")} flex="1 1 120px">
                        <input className="sp-form-input" type="number" value="21" readOnly style={{ opacity: 0.6 }} />
                    </Field>
                    <Field label={t("simulationForm", "fieldElecTax")} hint={t("simulationForm", "fieldElecTaxHint")} flex="1 1 160px">
                        <input className="sp-form-input" type="number" value="5.11" readOnly style={{ opacity: 0.6 }} />
                    </Field>
                    <Field label={t("simulationForm", "fieldInvoiceTotal")} hint={t("simulationForm", "fieldCurrentInvoiceHint")} error={errors.facturaActual} flex="1 1 160px" required help={t("simulationForm", "helpInvoiceTotal")}>
                        <Num value={state.facturaActual} onChange={(v) => up("facturaActual", v)} step={10} />
                    </Field>
                </Row>
            </Sec>

            <Sec title={t("simulationForm", "fieldLoadProfile")} block collapsible defaultOpen={false} optional>
                <div style={{ fontSize: 12, color: "var(--scheme-neutral-400)", marginBottom: 8 }}>{t("simulationForm", "loadProfileDescription")}</div>
                <Field label={t("simulationForm", "fieldProfile")}>
                    <Sel value={state.perfilCarga} onChange={(v) => up("perfilCarga", v as "NORMAL" | "DIURNO")} options={[{ value: "NORMAL", label: t("simulationForm", "normal") }, { value: "DIURNO", label: t("simulationForm", "daytime") }]} />
                </Field>
            </Sec>

            <Sec title={t("simulationForm", "sectionIndexedPricing")} block collapsible defaultOpen={false} optional>
                <div style={{ fontSize: 12, color: "var(--scheme-neutral-400)", marginBottom: 12 }}>
                    {t("simulationForm", "omieDescription")}
                </div>
                <PeriodGrid label={t("simulationForm", "omieSpotLabel")} periods={ep} values={state.omie} onChange={upP("omie")} step={0.001} hint={t("simulationForm", "omieSpotHint")} />
            </Sec>
        </>
    );
}

// ─── Gas sub-form ─────────────────────────────────────────────────────────────

function GasForm({ state, onChange, errors = {} }: { state: GasFormState; onChange: (s: GasFormState) => void; errors?: Record<string, string> }) {
    const { t } = useI18n();
    const up = <K extends keyof GasFormState>(k: K, v: GasFormState[K]) => onChange({ ...state, [k]: v });
    return (
        <>
            {/* Contract + Billing period side by side */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
                background: "white",
                border: "1px solid var(--scheme-neutral-900, rgba(255,255,255,0.08))",
                borderRadius: 12,
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.02)",
            }}>
                <Sec title={t("simulationForm", "sectionGasContractDetails")}>
                    <Field label={t("simulationForm", "fieldTariff")}>
                        <Sel value={state.tarifaAcceso} onChange={(v) => up("tarifaAcceso", v as GasTarifa)} options={["RL01", "RL02", "RL03", "RL04", "RL05", "RL06", "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6"].map((v) => ({ value: v, label: v }))} />
                    </Field>
                    <div style={{ height: 10 }} />
                    <Row>
                        <Field label={t("simulationForm", "fieldZone")}>
                            <Sel value={state.zonaGeografica} onChange={(v) => up("zonaGeografica", v as GasZona)} options={[{ value: "Peninsula", label: t("simulationForm", "peninsula") }, { value: "Baleares", label: t("simulationForm", "balearics") }]} />
                        </Field>
                        <Field label={t("simulationForm", "fieldTelemetering")}>
                            <Sel value={state.telemedida} onChange={(v) => up("telemedida", v as "SI" | "NO")} options={[{ value: "NO", label: t("simulationForm", "no") }, { value: "SI", label: t("simulationForm", "yes") }]} />
                        </Field>
                    </Row>
                </Sec>

                <Sec title={t("simulationForm", "sectionBillingPeriod")}>
                    <Row>
                        <Field label={t("simulationForm", "fieldGasFrom")} error={errors.fechaInicio}>
                            <input className="sp-form-input" type="date" value={state.fechaInicio} onChange={(e) => up("fechaInicio", e.target.value)} />
                        </Field>
                        <Field label={t("simulationForm", "fieldGasTo")} error={errors.fechaFin}>
                            <input className="sp-form-input" type="date" value={state.fechaFin} onChange={(e) => up("fechaFin", e.target.value)} />
                        </Field>
                        <Field label={t("simulationForm", "fieldDays")} flex="0 0 70px">
                            <input className="sp-form-input" type="number" readOnly value={daysBetween(state.fechaInicio, state.fechaFin)} style={{ opacity: 0.6 }} />
                        </Field>
                    </Row>
                    <div style={{ height: 10 }} />
                    <Field label={t("simulationForm", "fieldCurrentInvoice")} hint={t("simulationForm", "fieldGasCurrentInvoiceHint")} error={errors.facturaActual}>
                        <Num value={state.facturaActual} onChange={(v) => up("facturaActual", v)} step={10} />
                    </Field>
                </Sec>
            </div>

            <Sec title={t("simulationForm", "sectionGasConsumption")} block>
                <Row>
                    <Field label={t("simulationForm", "fieldConsumption")} hint={t("simulationForm", "fieldTotalConsumptionHint")} flex="1 1 260px" error={errors.consumo}>
                        <Num value={state.consumo} onChange={(v) => up("consumo", v)} step={500} />
                    </Field>
                </Row>
            </Sec>

            <Sec title={t("simulationForm", "sectionExtraCharges")} block>
                <Row>
                    <Field label={t("simulationForm", "fieldMeterRental")} hint={t("simulationForm", "fieldMeterRentalMonthlyHint")}>
                        <Num value={state.alquiler} onChange={(v) => up("alquiler", v)} step={0.5} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")} hint={t("simulationForm", "fieldOtherChargesLineHint")}>
                        <Num value={state.otrosCargos} onChange={(v) => up("otrosCargos", v)} step={1} />
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

export interface SimulationFormProps {
    simulation: SimulationItem;
    token: string;
    onSuccess?: (results: SimulationResults) => void;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onOfferSelected?: (productKey: string) => void;
}

export function SimulationForm({ simulation, token, onSuccess, onNotify, onOfferSelected }: SimulationFormProps) {
    const { t } = useI18n();
    const existingPayload = (simulation.payloadJson ?? {}) as SimulationPayload;

    const [simType, setSimType] = useState<SimType>(existingPayload.type ?? "ELECTRICITY");
    const [elecState, setElecState] = useState<ElecFormState>(() => hydrateElec(existingPayload) ?? defaultElecState());
    const [gasState, setGasState] = useState<GasFormState>(() => hydrateGas(existingPayload) ?? defaultGasState());
    const [results, setResults] = useState<SimulationResults | null>(existingPayload.results ?? null);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"inputs" | "results">(existingPayload.results ? "results" : "inputs");
    const [hasValidated, setHasValidated] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<SimulationPayload["selectedOffer"]>(
        existingPayload.selectedOffer ?? undefined
    );
    const [savingSelection, setSavingSelection] = useState(false);
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
                exceso: { P1: 0, P2: 0, P3: 0 },
                omie: { P1: 0.17623088364033698, P2: 0.10728797576897793, P3: 0.079728736723209598, P4: 0, P5: 0, P6: 0 },
                facturaActual: 493.79,
                reactiva: 0,
                alquiler: 1.3,
                otrosCargos: 0,
            };
            setElecState(testElec);
        }
        if (simType !== "ELECTRICITY") {
            const testGas: GasFormState = {
                tarifaAcceso: "RL01",
                zonaGeografica: "Peninsula",
                consumo: 5000,
                telemedida: "NO",
                fechaInicio: "2026-02-01",
                fechaFin: "2026-02-28",
                facturaActual: 285.50,
                alquiler: 1.5,
                otrosCargos: 0,
            };
            setGasState(testGas);
        }
        onNotify?.(t("simulationForm", "testDataFilled"), "success");
    }, [simType, onNotify]);

    const handleCalculate = useCallback(async () => {
        setHasValidated(true);
        const eErrs = simType !== "GAS" ? validateElec(elecState) : {};
        const gErrs = simType !== "ELECTRICITY" ? validateGas(gasState) : {};
        if (Object.keys(eErrs).length + Object.keys(gErrs).length > 0) return;
        setError(null);
        setCalculating(true);
        try {
            const payload: SimulationPayload = {
                schemaVersion: "1",
                type: simType,
                electricity: simType !== "GAS" ? buildElecInputs(elecState) : undefined,
                gas: simType !== "ELECTRICITY" ? buildGasInputs(gasState) : undefined,
                ...(selectedOffer ? { selectedOffer } : {}),
            };
            await updateSimulation(token, simulation.id, { payloadJson: payload as Record<string, unknown> });
            const calcResult = await calculateSimulation(token, simulation.id);
            setResults(calcResult.results);
            setActiveTab("results");
            onSuccess?.(calcResult.results);
            onNotify?.(t("simulationForm", "calculationComplete", { count: (calcResult.results.electricity?.length ?? 0) + (calcResult.results.gas?.length ?? 0) }), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "calculationFailed");
            setError(msg);
            onNotify?.(msg, "error");
        } finally {
            setCalculating(false);
        }
    }, [simulation.id, token, simType, elecState, gasState, selectedOffer, onSuccess, onNotify]);

    const handleSelectOffer = useCallback(async (productKey: string, commodity: "ELECTRICITY" | "GAS", pricingType: "FIXED" | "INDEXED") => {
        const offerData: SimulationPayload["selectedOffer"] = { productKey, commodity, pricingType, selectedAt: new Date().toISOString() };
        setSelectedOffer(offerData);
        setSavingSelection(true);
        try {
            // Build the full payload from current state so we never lose inputs or
            // results when only the selectedOffer changes.  Using simulation.payloadJson
            // (the mount-time prop) would spread stale data that is missing the inputs
            // and/or results saved by the most recent calculation.
            const updatedPayload: SimulationPayload = {
                schemaVersion: "1",
                type: simType,
                electricity: simType !== "GAS" ? buildElecInputs(elecState) : undefined,
                gas: simType !== "ELECTRICITY" ? buildGasInputs(gasState) : undefined,
                ...(results ? { results } : {}),
                selectedOffer: offerData,
            };
            await updateSimulation(token, simulation.id, { payloadJson: updatedPayload as Record<string, unknown> });
            onOfferSelected?.(productKey);
            onNotify?.(t("simulationForm", "offerSaved"), "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("simulationForm", "failedToSaveSelection");
            onNotify?.(msg, "error");
            setSelectedOffer(undefined);
        } finally {
            setSavingSelection(false);
        }
    }, [simulation.id, token, simType, elecState, gasState, results, onOfferSelected, onNotify]);

    const facturaActual = simType === "ELECTRICITY" ? elecState.facturaActual
        : simType === "GAS" ? gasState.facturaActual : undefined;

    const resultCount = (results?.electricity?.length ?? 0) + (results?.gas?.length ?? 0);

    return (
        <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--scheme-neutral-900)", marginBottom: 28 }}>
                {[
                    { key: "inputs" as const, label: t("simulationForm", "tabInputs") },
                    { key: "results" as const, label: results ? t("simulationForm", "tabResultsWithCount", { count: resultCount }) : t("simulationForm", "tabResults") },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: "10px 20px",
                            fontSize: 14,
                            fontWeight: activeTab === tab.key ? 600 : 400,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: activeTab === tab.key ? "var(--scheme-neutral-100)" : "var(--scheme-neutral-400)",
                            borderBottom: activeTab === tab.key ? "2px solid var(--scheme-brand-600, #4ade80)" : "2px solid transparent",
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Inputs tab */}
            {activeTab === "inputs" && (
                <div>
                    {/* Commodity type indicator (read-only) */}
                    <div style={{
                        marginBottom: 28,
                        padding: "12px 16px",
                        background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
                        border: "1px solid var(--scheme-neutral-900)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                    }}>
                        <span style={{ fontSize: 13, color: "var(--scheme-neutral-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("simulationForm", "commodityType")}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--scheme-neutral-200)", display: "flex", alignItems: "center", gap: 6 }}>
                            {simType === "ELECTRICITY" && <><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /> {t("simulationForm", "electricity")}</>}
                            {simType === "GAS" && <><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} /> {t("simulationForm", "gas")}</>}
                            {simType === "BOTH" && <><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} /> {t("simulationForm", "electricityAndGasLabel")}</>}
                        </span>
                    </div>

                    {(simType === "ELECTRICITY" || simType === "BOTH") && (
                        <div>
                            {simType === "BOTH" && (
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--scheme-neutral-300)", display: "flex", alignItems: "center", gap: 6 }}><BoltIcon sx={{ fontSize: 16, color: "#f59e0b" }} /> {t("simulationForm", "electricity")}</div>
                            )}
                            <ElecForm state={elecState} onChange={setElecState} errors={elecErrors} />
                        </div>
                    )}

                    {simType === "BOTH" && <div style={{ height: 8 }} />}

                    {(simType === "GAS" || simType === "BOTH") && (
                        <div>
                            {simType === "BOTH" && (
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--scheme-neutral-300)", display: "flex", alignItems: "center", gap: 6 }}><LocalFireDepartmentIcon sx={{ fontSize: 16, color: "#ef4444" }} /> {t("simulationForm", "gas")}</div>
                            )}
                            <GasForm state={gasState} onChange={setGasState} errors={gasErrors} />
                        </div>
                    )}

                    {/* Validation + API error + Calculate button */}
                    {hasErrors && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid var(--scheme-error-400, #f87171)", borderRadius: 8, fontSize: 13, color: "var(--scheme-error-400, #f87171)" }}>
                            <span>⚠</span>
                            <span>{t("simulationForm", "fieldsRequireAttention", { count: Object.keys(elecErrors).length + Object.keys(gasErrors).length })}</span>
                        </div>
                    )}
                    {error && (
                        <div className="crud-alert crud-alert--error" style={{ marginBottom: 16 }}>{error}</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 8, borderTop: "1px solid var(--scheme-neutral-900)" }}>
                        <button
                            type="button"
                            className="sp-btn-secondary"
                            onClick={fillTestData}
                            style={{ padding: "10px 20px", fontSize: 14 }}
                        >
                            {t("simulationForm", "fillTestData")}
                        </button>
                        <div style={{ display: "flex", gap: 10 }}>
                            {results && (
                                <button
                                    type="button"
                                    className="sp-btn-secondary"
                                    onClick={() => setActiveTab("results")}
                                >
                                    {t("simulationForm", "viewPreviousResults")}
                                </button>
                            )}
                            <button
                                type="button"
                                className="sp-btn-primary"
                                onClick={handleCalculate}
                                disabled={calculating}
                                style={{ minWidth: 180, padding: "10px 24px", fontSize: 14 }}
                            >
                                {calculating ? t("simulationForm", "btnCalculating") : t("simulationForm", "btnCalculate")}
                            </button>
                        </div>
                    </div>
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
                            onUpdatePeriod={(type: "energy" | "power" | "omie", period: string, value: number) => {
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
                            onRecalculate={handleCalculate}
                            calculating={calculating}
                            selectedOffer={selectedOffer}
                            onSelectOffer={handleSelectOffer}
                        />
                    ) : (
                        <div style={{ padding: "60px 20px", textAlign: "center", opacity: 0.5 }}>
                            <div style={{ marginBottom: 12 }}><BoltIcon sx={{ fontSize: 48, color: "#f59e0b" }} /></div>
                            <div style={{ fontSize: 15, marginBottom: 8 }}>{t("simulationForm", "noResultsYet")}</div>
                            <div style={{ fontSize: 13 }}>{t("simulationForm", "noResultsInstructions")}</div>
                            <button type="button" className="sp-btn-primary" onClick={() => setActiveTab("inputs")} style={{ marginTop: 20 }}>
                                {t("simulationForm", "goToInputs")}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
