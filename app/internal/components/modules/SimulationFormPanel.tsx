"use client";

import { useState, useEffect, useCallback } from "react";
import { SlidePanel, CurrencyInput } from "../ui";
import { SimulationResultsTable } from "./SimulationResultsTable";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SimulationItem } from "../../lib/internalApi";
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

function emptyPeriods(periods: string[]): PeriodMap {
    return Object.fromEntries(periods.map((p) => [p, 0]));
}

// ─── Form state types ──────────────────────────────────────────────────────────

interface ElecFormState {
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
    cups?: string;
    consumoAnual?: number;
    nombreTitular?: string;
    personaContacto?: string;
    comercial?: string;
    direccion?: string;
    comercializadorActual?: string;
    tarifaAcceso: GasTarifa;
    zonaGeografica: GasZona;
    consumo: number;
    telemedida: "SI" | "NO";
    fechaInicio: string;
    fechaFin: string;
    facturaActual: number;
    alquiler: number;
    otrosCargos: number;
    ivaTasa?: number;
    impuestoHidrocarburo?: number;
}

type SimType = "ELECTRICITY" | "GAS";

function daysBetween(from: string, to: string): number {
    const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    return Math.max(1, d);
}

function defaultElecState(): ElecFormState {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
        tarifaAcceso: "3.0TD",
        zonaGeografica: "Peninsula",
        perfilCarga: "NORMAL",
        fechaInicio: firstDay.toISOString().slice(0, 10),
        fechaFin: lastDay.toISOString().slice(0, 10),
        consumo: { P1: 5000, P2: 4000, P3: 3000, P4: 2000, P5: 1500, P6: 1000 },
        potencia: { P1: 50, P2: 50, P3: 50, P4: 50, P5: 50, P6: 50 },
        exceso: { P1: 0, P2: 0, P3: 0 },
        omie: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
        facturaActual: 3200,
        reactiva: 0,
        alquiler: 5,
        otrosCargos: 0,
    };
}

function defaultGasState(): GasFormState {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
        tarifaAcceso: "RL01",
        zonaGeografica: "Peninsula",
        consumo: 50000,
        telemedida: "NO",
        fechaInicio: firstDay.toISOString().slice(0, 10),
        fechaFin: lastDay.toISOString().slice(0, 10),
        facturaActual: 2500,
        alquiler: 5,
        otrosCargos: 0,
    };
}

// ─── Tiny form helpers ─────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.45, marginBottom: 10 }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function FieldRow({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>{children}</div>;
}

function Field({
    label,
    hint,
    children,
    flex,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
    flex?: string;
}) {
    return (
        <div className="sp-form-group" style={{ flex: flex ?? "1 1 140px", minWidth: 100 }}>
            <label className="sp-form-label">{label}</label>
            {children}
            {hint && <span className="sp-form-hint">{hint}</span>}
        </div>
    );
}

function Sel({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <select className="sp-form-input" value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

function Num({
    value,
    onChange,
    step,
    min,
}: {
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
}) {
    return (
        <input
            className="sp-form-input"
            type="number"
            step={step ?? 1}
            min={min ?? 0}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
    );
}

// ─── Period grid ───────────────────────────────────────────────────────────────

function PeriodGrid({
    label,
    periods,
    values,
    onChange,
    step,
    hint,
}: {
    label: string;
    periods: string[];
    values: PeriodMap;
    onChange: (period: string, val: number) => void;
    step?: number;
    hint?: string;
}) {
    return (
        <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 5 }}>{label}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {periods.map((p) => (
                    <div key={p} style={{ flex: "1 1 80px", minWidth: 70 }}>
                        <div style={{ fontSize: 10, opacity: 0.5, textAlign: "center", marginBottom: 2 }}>{p}</div>
                        <input
                            className="sp-form-input"
                            type="number"
                            step={step ?? 1}
                            min={0}
                            value={values[p] ?? 0}
                            onChange={(e) => onChange(p, parseFloat(e.target.value) || 0)}
                            style={{ textAlign: "right", padding: "4px 6px", fontSize: 12 }}
                        />
                    </div>
                ))}
            </div>
            {hint && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 3 }}>{hint}</div>}
        </div>
    );
}

// ─── Electricity form ─────────────────────────────────────────────────────────

function ElectricityForm({
    state,
    onChange,
}: {
    state: ElecFormState;
    onChange: (s: ElecFormState) => void;
}) {
    const { t } = useI18n();
    const up = <K extends keyof ElecFormState>(k: K, v: ElecFormState[K]) =>
        onChange({ ...state, [k]: v });
    const upPeriod = (field: "consumo" | "potencia" | "exceso" | "omie") =>
        (p: string, v: number) => up(field, { ...state[field], [p]: v });

    const energyPeriods = ELEC_ENERGY_PERIODS[state.tarifaAcceso];
    const powerPeriods = ELEC_POWER_PERIODS[state.tarifaAcceso];
    const excessPeriods = ELEC_EXCESS_PERIODS[state.tarifaAcceso];

    return (
        <div>
            <FormSection title={t("simulationForm", "sectionTariffZone")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldTariff")}>
                        <Sel
                            value={state.tarifaAcceso}
                            onChange={(v) => {
                                const tarifa = v as ElecTarifa;
                                up("tarifaAcceso", tarifa);
                                up("consumo", emptyPeriods(ELEC_ENERGY_PERIODS[tarifa]));
                                up("potencia", emptyPeriods(ELEC_POWER_PERIODS[tarifa]));
                                up("exceso", emptyPeriods(ELEC_EXCESS_PERIODS[tarifa]));
                                up("omie", emptyPeriods(ELEC_ENERGY_PERIODS[tarifa]));
                            }}
                            options={[
                                { value: "2.0TD", label: "2.0TD (BT ≤15 kW)" },
                                { value: "3.0TD", label: "3.0TD (BT >15 kW)" },
                                { value: "6.1TD", label: "6.1TD (AT)" },
                            ]}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldZone")}>
                        <Sel
                            value={state.zonaGeografica}
                            onChange={(v) => up("zonaGeografica", v as ElecFormState["zonaGeografica"])}
                            options={[
                                { value: "Peninsula", label: t("simulationForm", "peninsula") },
                                { value: "Baleares", label: t("simulationForm", "balearics") },
                                { value: "Canarias", label: t("simulationForm", "canarias") },
                            ]}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldLoadProfile")}>
                        <Sel
                            value={state.perfilCarga}
                            onChange={(v) => up("perfilCarga", v as "NORMAL" | "DIURNO")}
                            options={[
                                { value: "NORMAL", label: t("simulationForm", "normal") },
                                { value: "DIURNO", label: t("simulationForm", "daytime") },
                            ]}
                        />
                    </Field>
                </FieldRow>
            </FormSection>

            <FormSection title={t("simulationForm", "sectionBillingPeriod")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldStartDate")}>
                        <input
                            className="sp-form-input"
                            type="date"
                            value={state.fechaInicio}
                            onChange={(e) => up("fechaInicio", e.target.value)}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldEndDate")}>
                        <input
                            className="sp-form-input"
                            type="date"
                            value={state.fechaFin}
                            onChange={(e) => up("fechaFin", e.target.value)}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldDays")} hint={t("simulationForm", "fieldDaysHint")} flex="0 0 80px">
                        <input
                            className="sp-form-input"
                            type="number"
                            readOnly
                            value={daysBetween(state.fechaInicio, state.fechaFin)}
                            style={{ background: "var(--scheme-neutral-1000)", opacity: 0.7 }}
                        />
                    </Field>
                </FieldRow>
            </FormSection>

            <FormSection title={t("simulationForm", "sectionEnergyConsumption")}>
                <PeriodGrid
                    label={t("simulationForm", "energyPeriodsLabel", { periods: energyPeriods.join(", ") })}
                    periods={energyPeriods}
                    values={state.consumo}
                    onChange={upPeriod("consumo")}
                    step={100}
                    hint={t("simulationForm", "energyPeriodsHint")}
                />
            </FormSection>

            <FormSection title={t("simulationForm", "sectionContractedPower")}>
                <PeriodGrid
                    label={t("simulationForm", "powerPeriodsLabel", { periods: powerPeriods.join(", ") })}
                    periods={powerPeriods}
                    values={state.potencia}
                    onChange={upPeriod("potencia")}
                    step={0.1}
                    hint={t("simulationForm", "powerPeriodsHint")}
                />
                {excessPeriods.length > 0 && (
                    <FieldRow>
                        <Field label={t("simulationForm", "excessPowerLabel")} hint={t("simulationForm", "excessPowerHint")} flex="0 0 200px">
                            <Num
                                value={state.exceso[excessPeriods[0]] ?? 0}
                                onChange={(v) => up("exceso", Object.fromEntries(excessPeriods.map((p) => [p, v])))}
                                step={0.1}
                            />
                        </Field>
                    </FieldRow>
                )}
            </FormSection>

            <FormSection title={t("simulationForm", "sectionOmie")}>
                <PeriodGrid
                    label={t("simulationForm", "omieLabel")}
                    periods={energyPeriods}
                    values={state.omie}
                    onChange={upPeriod("omie")}
                    step={0.001}
                    hint={t("simulationForm", "omieHint")}
                />
            </FormSection>

            <FormSection title={t("simulationForm", "sectionCurrentInvoice")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldCurrentInvoice")} hint={t("simulationForm", "fieldCurrentInvoiceHint")}>
                        <CurrencyInput value={state.facturaActual} onChange={(v) => up("facturaActual", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldReactiveEnergy")}>
                        <CurrencyInput value={state.reactiva} onChange={(v) => up("reactiva", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldMeterRental")}>
                        <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")}>
                        <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                    </Field>
                </FieldRow>
            </FormSection>
        </div>
    );
}

// ─── Gas form ─────────────────────────────────────────────────────────────────

function GasForm({
    state,
    onChange,
}: {
    state: GasFormState;
    onChange: (s: GasFormState) => void;
}) {
    const { t } = useI18n();
    const up = <K extends keyof GasFormState>(k: K, v: GasFormState[K]) =>
        onChange({ ...state, [k]: v });

    return (
        <div>
            <FormSection title={t("simulationForm", "sectionTariffZone")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldTariff")}>
                        <Sel
                            value={state.tarifaAcceso}
                            onChange={(v) => up("tarifaAcceso", v as GasTarifa)}
                            options={[
                                { value: "RL01", label: "RL01" },
                                { value: "RL02", label: "RL02" },
                                { value: "RL03", label: "RL03" },
                                { value: "RL04", label: "RL04" },
                                { value: "RL05", label: "RL05" },
                                { value: "RL06", label: "RL06" },
                                { value: "RLPS1", label: "RLPS1" },
                                { value: "RLPS2", label: "RLPS2" },
                                { value: "RLPS3", label: "RLPS3" },
                                { value: "RLPS4", label: "RLPS4" },
                                { value: "RLPS5", label: "RLPS5" },
                                { value: "RLPS6", label: "RLPS6" },
                            ]}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldZone")}>
                        <Sel
                            value={state.zonaGeografica}
                            onChange={(v) => up("zonaGeografica", v as GasZona)}
                            options={[
                                { value: "Peninsula", label: t("simulationForm", "peninsula") },
                                { value: "Baleares", label: t("simulationForm", "balearics") },
                            ]}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldTelemetering")}>
                        <Sel
                            value={state.telemedida}
                            onChange={(v) => up("telemedida", v as "SI" | "NO")}
                            options={[
                                { value: "NO", label: t("simulationForm", "no") },
                                { value: "SI", label: t("simulationForm", "yes") },
                            ]}
                        />
                    </Field>
                </FieldRow>
            </FormSection>

            <FormSection title={t("simulationForm", "sectionBillingPeriod")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldStartDate")}>
                        <input
                            className="sp-form-input"
                            type="date"
                            value={state.fechaInicio}
                            onChange={(e) => up("fechaInicio", e.target.value)}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldEndDate")}>
                        <input
                            className="sp-form-input"
                            type="date"
                            value={state.fechaFin}
                            onChange={(e) => up("fechaFin", e.target.value)}
                        />
                    </Field>
                    <Field label={t("simulationForm", "fieldDays")} hint={t("simulationForm", "fieldDaysAutoHint")} flex="0 0 80px">
                        <input
                            className="sp-form-input"
                            type="number"
                            readOnly
                            value={daysBetween(state.fechaInicio, state.fechaFin)}
                            style={{ background: "var(--scheme-neutral-1000)", opacity: 0.7 }}
                        />
                    </Field>
                </FieldRow>
            </FormSection>

            <FormSection title={t("simulationForm", "sectionConsumption")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldConsumption")} hint={t("simulationForm", "fieldConsumptionHint")}>
                        <Num value={state.consumo} onChange={(v) => up("consumo", v)} step={500} />
                    </Field>
                </FieldRow>
            </FormSection>

            <FormSection title={t("simulationForm", "sectionCurrentInvoice")}>
                <FieldRow>
                    <Field label={t("simulationForm", "fieldCurrentInvoice")} hint={t("simulationForm", "fieldCurrentInvoiceHint")}>
                        <CurrencyInput value={state.facturaActual} onChange={(v) => up("facturaActual", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldMeterRental")}>
                        <CurrencyInput value={state.alquiler} onChange={(v) => up("alquiler", isNaN(v) ? 0 : v)} />
                    </Field>
                    <Field label={t("simulationForm", "fieldOtherCharges")}>
                        <CurrencyInput value={state.otrosCargos} onChange={(v) => up("otrosCargos", isNaN(v) ? 0 : v)} />
                    </Field>
                </FieldRow>
            </FormSection>
        </div>
    );
}

// ─── Payload builders ──────────────────────────────────────────────────────────

function buildElecInputs(s: ElecFormState): ElectricityInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin);
    return {
        tarifaAcceso: s.tarifaAcceso,
        zonaGeografica: s.zonaGeografica,
        perfilCarga: s.perfilCarga,
        potenciaContratada: s.potencia as ElectricityInputs["potenciaContratada"],
        excesoPotencia: Object.values(s.exceso)[0] ?? 0,
        consumo: s.consumo as ElectricityInputs["consumo"],
        omieEstimado: s.omie,
        periodo: {
            fechaInicio: s.fechaInicio,
            fechaFin: s.fechaFin,
            dias,
        },
        facturaActual: s.facturaActual,
        extras: {
            reactiva: s.reactiva || undefined,
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
        },
    };
}

function buildGasInputs(s: GasFormState): GasInputs {
    const dias = daysBetween(s.fechaInicio, s.fechaFin);
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
        periodo: {
            fechaInicio: s.fechaInicio,
            fechaFin: s.fechaFin,
            dias,
        },
        facturaActual: s.facturaActual,
        extras: {
            alquilerEquipoMedida: s.alquiler || undefined,
            otrosCargos: s.otrosCargos || undefined,
        },
        ivaTasa: s.ivaTasa || undefined,
        impuestoHidrocarburo: s.impuestoHidrocarburo || undefined,
    };
}

// ─── State hydration from existing payload ──────────────────────────────────────

function hydrateElec(payload: SimulationPayload): ElecFormState | null {
    const e = payload.electricity;
    if (!e) return null;
    const ep = ELEC_ENERGY_PERIODS[e.tarifaAcceso] ?? [];
    const pp = ELEC_POWER_PERIODS[e.tarifaAcceso] ?? [];
    const xp = ELEC_EXCESS_PERIODS[e.tarifaAcceso] ?? [];
    const consumoMap = e.consumo as unknown as Record<string, number>;
    const potenciaMap = e.potenciaContratada as unknown as Record<string, number>;
    const excesoMap = (e.excesoPotencia ?? {}) as Record<string, number>;
    const omieMap = (e.omieEstimado ?? {}) as Record<string, number>;
    return {
        tarifaAcceso: e.tarifaAcceso,
        zonaGeografica: e.zonaGeografica,
        perfilCarga: e.perfilCarga,
        fechaInicio: e.periodo.fechaInicio,
        fechaFin: e.periodo.fechaFin,
        consumo: Object.fromEntries(ep.map((p) => [p, consumoMap[p] ?? 0])),
        potencia: Object.fromEntries(pp.map((p) => [p, potenciaMap[p] ?? 0])),
        exceso: Object.fromEntries(xp.map((p) => [p, excesoMap["P1"] ?? excesoMap[xp[0]] ?? 0])),
        omie: Object.fromEntries(ep.map((p) => [p, omieMap[p] ?? 0])),
        facturaActual: e.facturaActual,
        reactiva: e.extras?.reactiva ?? 0,
        alquiler: e.extras?.alquilerEquipoMedida ?? 0,
        otrosCargos: e.extras?.otrosCargos ?? 0,
    };
}

function hydrateGas(payload: SimulationPayload): GasFormState | null {
    const g = payload.gas;
    if (!g) return null;
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
        ivaTasa: g.ivaTasa ?? 21,
        impuestoHidrocarburo: g.impuestoHidrocarburo ?? 0.00234,
    };
}

// ─── Main panel component ──────────────────────────────────────────────────────

export interface SimulationFormPanelProps {
    open: boolean;
    simulation: SimulationItem | null;
    onClose: () => void;
    onSaveAndCalculate: (
        simId: string,
        payload: SimulationPayload
    ) => Promise<SimulationResults | null>;
}

export function SimulationFormPanel({
    open,
    simulation,
    onClose,
    onSaveAndCalculate,
}: SimulationFormPanelProps) {
    const { t } = useI18n();
    const [simType, setSimType] = useState<SimType>("ELECTRICITY");
    const [elecState, setElecState] = useState<ElecFormState>(defaultElecState());
    const [gasState, setGasState] = useState<GasFormState>(defaultGasState());
    const [results, setResults] = useState<SimulationResults | null>(null);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"form" | "results">("form");

    // Hydrate from existing payload when panel opens
    useEffect(() => {
        if (!open || !simulation?.payloadJson) {
            setResults(null);
            setActiveTab("form");
            return;
        }
        const p = simulation.payloadJson as SimulationPayload;
        if (p.type) setSimType(p.type);
        const elecHydrated = hydrateElec(p);
        if (elecHydrated) setElecState(elecHydrated);
        const gasHydrated = hydrateGas(p);
        if (gasHydrated) setGasState(gasHydrated);
        if (p.results) {
            setResults(p.results);
            setActiveTab("results");
        }
    }, [open, simulation?.id]);

    const handleCalculate = useCallback(async () => {
        if (!simulation) return;
        setError(null);
        setCalculating(true);
        try {
            const payload: SimulationPayload = {
                schemaVersion: "1",
                type: simType,
                electricity: simType !== "GAS" ? buildElecInputs(elecState) : undefined,
                gas: simType !== "ELECTRICITY" ? buildGasInputs(gasState) : undefined,
            };
            const res = await onSaveAndCalculate(simulation.id, payload);
            if (res) {
                setResults(res);
                setActiveTab("results");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("simulationForm", "errorCalculating"));
        } finally {
            setCalculating(false);
        }
    }, [simulation, simType, elecState, gasState, onSaveAndCalculate]);

    const facturaActual =
        simType === "ELECTRICITY" ? elecState.facturaActual
            : simType === "GAS" ? gasState.facturaActual
                : undefined;

    const tabs: { key: "form" | "results"; label: string }[] = [
        { key: "form", label: t("simulationForm", "tabData") },
        { key: "results", label: results ? t("simulationForm", "tabResultsCount", { count: (results.electricity?.length ?? 0) + (results.gas?.length ?? 0) }) : t("simulationForm", "tabResults") },
    ];

    return (
        <SlidePanel
            open={open}
            onClose={onClose}
            title={t("simulationForm", "panelTitle")}
            subtitle={simulation ? `ID: ${simulation.id.slice(0, 12)}…` : undefined}
            width={760}
            footer={
                <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}>
                    <button className="sp-btn-secondary" onClick={onClose}>
                        {t("simulationForm", "btnClose")}
                    </button>
                    <div style={{ flex: 1 }} />
                    {results && (
                        <button className="sp-btn-secondary" onClick={() => setActiveTab(activeTab === "form" ? "results" : "form")}>
                            {activeTab === "form" ? t("simulationForm", "btnViewResults") : t("simulationForm", "btnEditData")}
                        </button>
                    )}
                    <button
                        className="sp-btn-primary"
                        onClick={handleCalculate}
                        disabled={calculating}
                        style={{ minWidth: 140 }}
                    >
                        {calculating ? t("simulationForm", "btnCalculating") : t("simulationForm", "btnCalculate")}
                    </button>
                </div>
            }
        >
            {error && <div className="sp-panel-error" style={{ marginBottom: 12 }}>{error}</div>}

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--scheme-neutral-900)", marginBottom: 20 }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: activeTab === tab.key ? 600 : 400,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: activeTab === tab.key ? "var(--scheme-neutral-100)" : "var(--scheme-neutral-400)",
                            borderBottom: activeTab === tab.key ? "2px solid var(--scheme-brand-600, #fff)" : "2px solid transparent",
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Form tab */}
            {activeTab === "form" && (
                <div>
                    {/* Commodity type */}
                    <FormSection title={t("simulationForm", "simTypeSection")}>
                        <FieldRow>
                            {(["ELECTRICITY", "GAS"] as SimType[]).map((stype) => (
                                <button
                                    key={stype}
                                    onClick={() => setSimType(stype)}
                                    style={{
                                        padding: "7px 18px",
                                        borderRadius: 8,
                                        border: `1.5px solid ${simType === stype ? "var(--scheme-brand-600, #888)" : "var(--scheme-neutral-800)"}`,
                                        background: simType === stype ? "var(--scheme-brand-800, rgba(255,255,255,0.08))" : "transparent",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        fontWeight: simType === stype ? 600 : 400,
                                        color: simType === stype ? "var(--scheme-neutral-100)" : "var(--scheme-neutral-400)",
                                    }}
                                >
                                    {stype === "ELECTRICITY" ? t("simulationForm", "electricity") : t("simulationForm", "gas")}
                                </button>
                            ))}
                        </FieldRow>
                    </FormSection>

                    {simType === "ELECTRICITY" && (
                        <div>
                            <ElectricityForm state={elecState} onChange={setElecState} />
                        </div>
                    )}

                    {simType === "GAS" && (
                        <div>
                            <GasForm state={gasState} onChange={setGasState} />
                        </div>
                    )}
                </div>
            )}

            {/* Results tab */}
            {activeTab === "results" && (
                <div>
                    {results ? (
                        <SimulationResultsTable results={results} facturaActual={facturaActual} />
                    ) : (
                        <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 13 }}>
                            {t("simulationForm", "noResultsPrompt")}
                        </div>
                    )}
                </div>
            )}
        </SlidePanel>
    );
}
