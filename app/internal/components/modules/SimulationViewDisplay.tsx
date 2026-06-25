"use client";

import { useState } from "react";
import type { SimulationItem } from "../../lib/internalApi";
import type { SimulationResults } from "@/domain/types";
import { SimulationResultsCards } from "./SimulationResultsCards";
import { useI18n } from "../../../../src/lib/i18n-context";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckIcon from "@mui/icons-material/Check";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { Box, Button, Tab, Tabs } from "@mui/material";

const ELEC_ENERGY_PERIODS: Record<string, string[]> = {
    "2.0TD": ["P1", "P2", "P3"],
    "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

const ELEC_POWER_PERIODS: Record<string, string[]> = {
    "2.0TD": ["P1", "P2"],
    "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

type TranslateFn = ReturnType<typeof useI18n>["t"];

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{
            background: "var(--scheme-neutral-1100)",
            borderRadius: 8,
            padding: 24,
            marginBottom: 20,
        }}>
            <h3 style={{
                margin: 0,
                marginBottom: 20,
                fontSize: 16,
                fontWeight: 600,
                color: "var(--scheme-neutral-200)",
                paddingBottom: 12,
                borderBottom: "1px solid var(--scheme-neutral-900)",
            }}>
                {title}
            </h3>
            {children}
        </div>
    );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    const isEmpty = value === undefined || value === null || value === "";

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{
                fontSize: 11,
                color: "var(--scheme-neutral-500)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
            }}>
                {label}
            </div>
            <div style={{
                fontSize: 14,
                color: "var(--scheme-neutral-200)",
                fontFamily: mono ? "monospace" : undefined,
            }}>
                {isEmpty ? <span style={{ color: "var(--scheme-neutral-600)" }}>—</span> : value}
            </div>
        </div>
    );
}

function FormLikeSection({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="simulation-view-section simulation-form-section simulation-form-section--block" style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--scheme-neutral-1200) 94%, var(--scheme-neutral-1000)), var(--scheme-neutral-1200))",
            border: "1px solid color-mix(in srgb, var(--scheme-neutral-900) 82%, var(--scheme-neutral-800))",
            borderRadius: 12,
            padding: "clamp(14px, 4vw, 24px)",
            marginBottom: 24,
            boxShadow: "var(--scheme-shadow-soft)",
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 22,
            }}>
                <h3 style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--scheme-neutral-200)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                }}>
                    {title}
                    <CheckIcon sx={{ fontSize: 16, color: "var(--scheme-primary-500)" }} />
                </h3>
                <KeyboardArrowUpIcon sx={{ fontSize: 18, color: "var(--scheme-neutral-500)" }} />
            </div>
            {children}
        </div>
    );
}

function FormRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="simulation-form-row simulation-view-row" style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
        }}>
            {children}
        </div>
    );
}

function DividerLine({ compact }: { compact?: boolean }) {
    return (
        <div style={{
            height: 1,
            background: "var(--scheme-neutral-900)",
            margin: compact ? "12px 0" : "20px 0",
        }} />
    );
}

function ReadOnlyInputField({
    label,
    value,
    flex = "1 1 220px",
    mono,
}: {
    label: string;
    value: React.ReactNode;
    flex?: string;
    mono?: boolean;
}) {
    const isEmpty = value === undefined || value === null || value === "";

    return (
        <div className="simulation-form-field simulation-view-field" style={{ flex, minWidth: 0, maxWidth: "100%" }}>
            <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--scheme-neutral-400)",
                marginBottom: 6,
            }}>
                {label}
            </div>
            <div className="simulation-view-readonly-value" style={{
                minHeight: 36,
                display: "flex",
                alignItems: "center",
                padding: "7px 12px",
                border: "1px solid color-mix(in srgb, var(--scheme-neutral-900) 72%, var(--scheme-neutral-800))",
                borderRadius: 9,
                background: "var(--scheme-neutral-1200)",
                color: isEmpty ? "var(--scheme-neutral-600)" : "var(--scheme-neutral-200)",
                fontSize: 14,
                fontFamily: mono ? "monospace" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}>
                {isEmpty ? "—" : value}
            </div>
        </div>
    );
}

function FormPeriodValues({ label, values }: { label: string; values: Record<string, number> }) {
    const entries = Object.entries(values);
    if (entries.length === 0) return null;

    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{
                fontSize: 11,
                color: "var(--scheme-neutral-500)",
                marginBottom: 8,
            }}>
                {label}
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                gap: 8,
            }}>
                {entries.map(([period, value]) => (
                    <ReadOnlyInputField
                        key={period}
                        label={period}
                        value={Number(value).toFixed(2)}
                        flex="1 1 0"
                    />
                ))}
            </div>
        </div>
    );
}

function PeriodValues({ label, values }: { label: string; values: Record<string, number> }) {
    if (!values || Object.keys(values).length === 0) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{
                fontSize: 11,
                color: "var(--scheme-neutral-500)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
            }}>
                {label}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(values).map(([period, value]) => (
                    <div
                        key={period}
                        style={{
                            padding: "6px 12px",
                            background: "var(--scheme-neutral-1000)",
                            borderRadius: 6, }}
                    >
                        <span style={{ color: "var(--scheme-neutral-500)", marginRight: 6 }}>{period}:</span>
                        <span style={{ fontWeight: 600, color: "var(--scheme-neutral-200)" }}>{Number(value).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function periodValues(source: unknown, periods: string[]): Record<string, number> {
    const values = (source ?? {}) as Record<string, number>;
    return Object.fromEntries(periods.map((period) => [period, Number(values[period] ?? 0)]));
}

function currency(value: unknown): string {
    return `€${Number(value ?? 0).toFixed(2)}`;
}

function percent(value: unknown, digits = 3): string {
    return `${Number(value ?? 0).toFixed(digits)}%`;
}

function electricityTariffLabel(t: TranslateFn, tariff: string): string {
    if (tariff === "2.0TD") return t("simulationForm", "optionLowVoltage15");
    if (tariff === "3.0TD") return t("simulationForm", "optionLowVoltage15Plus");
    if (tariff === "6.1TD") return t("simulationForm", "optionHighVoltage");
    return tariff;
}

export function SimulationViewDisplay({ simulation }: { simulation: SimulationItem }) {
    const payload = simulation.payloadJson as any;
    const simType = payload?.type;
    const elec = payload?.electricity;
    const gas = payload?.gas;
    const results = payload?.results as SimulationResults | undefined;
    const selectedOffer = payload?.selectedOffer as { productKey: string; commodity: "ELECTRICITY" | "GAS"; pricingType: "FIXED" | "INDEXED"; selectedAt: string } | undefined;

    const [activeTab, setActiveTab] = useState<"inputs" | "results">(results ? "results" : "inputs");

    const { t } = useI18n();

    // Check if simulation has any actual data (not just type)
    const hasData = elec || gas || results;

    if (!hasData) {
        return (
            <div style={{
                padding: 60,
                textAlign: "center",
                background: "var(--scheme-neutral-1050)",
                borderRadius: 12,
                border: "2px dashed var(--scheme-neutral-800)",
            }}>
                <DescriptionOutlinedIcon sx={{ fontSize: 48, color: "var(--scheme-neutral-500)", mb: 2 }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--scheme-neutral-200)", marginBottom: 8 }}>
                    {t("simulationView", "noDataTitle") || "No Simulation Data"}
                </div>
                <div style={{ fontSize: 14, color: "var(--scheme-neutral-500)", marginBottom: 20 }}>
                    {t("simulationView", "noDataMessage") || "This simulation hasn't been configured yet. Use the 'Open & Edit' button above to add inputs and calculate offers."}
                </div>
            </div>
        );
    }

    const resultCount = (results?.electricity?.length ?? 0) + (results?.gas?.length ?? 0);
    const elecEnergyPeriods = elec
        ? ELEC_ENERGY_PERIODS[elec.tarifaAcceso] ?? Object.keys(elec.consumo ?? {})
        : [];
    const elecPowerPeriods = elec
        ? ELEC_POWER_PERIODS[elec.tarifaAcceso] ?? Object.keys(elec.potenciaContratada ?? {})
        : [];

    return (
        <div className="simulation-view-display">
            <Box className="simulation-detail-tabs" sx={{ mb: "12px" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value: "inputs" | "results") => setActiveTab(value)}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{
                        minHeight: 36,
                        "& .MuiTab-root": {
                            minHeight: 36,
                            px: 2,
                            py: 0.75,
                            textTransform: "none",
                            fontSize: 14,
                            fontWeight: 500,
                        },
                    }}
                >
                    <Tab value="inputs" label={t("simulationForm", "tabInputs")} />
                    <Tab
                        value="results"
                        label={results ? t("simulationForm", "tabResultsWithCount", { count: resultCount }) : t("simulationForm", "tabResults")}
                    />
                </Tabs>
            </Box>

            {activeTab === "inputs" && (
                <div>
                    {/* Type indicator */}
                    {simType && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 16px",
                                background: "var(--scheme-neutral-1000)",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: 600,
                            }}>
                                {simType === "ELECTRICITY" && <><BoltIcon sx={{ fontSize: 18, color: "var(--scheme-primary-500)" }} /> {t("simulationView", "typeElectricity")}</>}
                                {simType === "GAS" && <><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "var(--scheme-primary-500)" }} /> {t("simulationView", "typeGas")}</>}
                                {simType === "BOTH" && <><BoltIcon sx={{ fontSize: 18, color: "var(--scheme-primary-500)" }} /><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "var(--scheme-primary-500)", marginLeft: "-4px" }} /> {t("simulationView", "typeBoth")}</>}
                            </div>
                        </div>
                    )}

                    {/* Submitted values */}
                    {(elec?.clientData || gas) && (
                        <FormLikeSection title={t("simulationForm", "sectionClientInfo")}>
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldCups")}
                                    value={elec?.clientData?.cups ?? gas?.cups}
                                    flex="1 1 280px"
                                    mono
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldAnnualConsumption")}
                                    value={Number(elec?.clientData?.consumoAnual ?? gas?.consumoAnual ?? 0).toLocaleString()}
                                    flex="1 1 220px"
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldZone")}
                                    value={elec?.zonaGeografica ?? gas?.zonaGeografica}
                                    flex="1 1 220px"
                                />
                            </FormRow>
                            <DividerLine compact />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldClientName")}
                                    value={elec?.clientData?.nombreTitular ?? gas?.nombreTitular}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldContactPerson")}
                                    value={elec?.clientData?.personaContacto ?? gas?.personaContacto}
                                />
                            </FormRow>
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldSalesAgent")}
                                    value={elec?.clientData?.comercial ?? gas?.comercial}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldAddress")}
                                    value={elec?.clientData?.direccion ?? gas?.direccion}
                                />
                            </FormRow>
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldCurrentSupplier")}
                                    value={elec?.clientData?.comercializadorActual ?? gas?.comercializadorActual}
                                    flex="1 1 100%"
                                />
                            </FormRow>
                        </FormLikeSection>
                    )}

                    {/* Electricity values */}
                    {(simType === "ELECTRICITY" || simType === "BOTH") && elec && (
                        <FormLikeSection title={t("simulationForm", "sectionInvoiceBreakdown")}>
                            <div className="simulation-form-responsive-grid simulation-view-responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
                                <div>
                                    <ReadOnlyInputField
                                        label={t("simulationForm", "fieldTariff")}
                                        value={electricityTariffLabel(t, elec.tarifaAcceso)}
                                        flex="1 1 100%"
                                    />
                                    <div style={{ height: 10 }} />
                                    <ReadOnlyInputField
                                        label={t("simulationForm", "fieldLoadProfile")}
                                        value={elec.perfilCarga}
                                        flex="1 1 100%"
                                    />
                                </div>
                                <div>
                                    <FormRow>
                                        <ReadOnlyInputField
                                            label={t("simulationForm", "fieldBillingPeriod")}
                                            value={elec.periodo ? `${elec.periodo.fechaInicio} → ${elec.periodo.fechaFin}` : undefined}
                                            flex="1 1 320px"
                                        />
                                        <ReadOnlyInputField
                                            label={t("simulationForm", "fieldDays")}
                                            value={elec.periodo?.dias ?? 0}
                                            flex="0 0 96px"
                                        />
                                    </FormRow>
                                </div>
                            </div>

                            <DividerLine />
                            <FormPeriodValues
                                label={t("simulationForm", "powerPeriodsLabel", { periods: elecPowerPeriods.join(" · ") })}
                                values={periodValues(elec.potenciaContratada, elecPowerPeriods)}
                            />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "excessPowerLabel")}
                                    value={currency(elec.excesoPotencia)}
                                    flex="0 1 220px"
                                />
                            </FormRow>

                            <DividerLine />
                            <FormPeriodValues
                                label={t("simulationForm", "energyPeriodsLabel", { periods: elecEnergyPeriods.join(" · ") })}
                                values={periodValues(elec.consumo, elecEnergyPeriods)}
                            />

                            <DividerLine />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldInvoiceTotal")}
                                    value={currency(elec.facturaActual)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldReactiveEnergy")}
                                    value={currency(elec.extras?.reactiva)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldMeterRental")}
                                    value={currency(elec.extras?.alquilerEquipoMedida)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldOtherCharges")}
                                    value={currency(elec.extras?.otrosCargos)}
                                />
                            </FormRow>

                            <DividerLine compact />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={elec.zonaGeografica === "Canarias" ? t("simulationForm", "fieldIgic") : t("simulationForm", "fieldVat")}
                                    value={percent(elec.extras?.ivaTasa ?? 21, elec.zonaGeografica === "Canarias" ? 2 : 0)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldElecTax")}
                                    value={percent(elec.extras?.impuestoElectricoTasa ?? 5.11269, 3)}
                                />
                            </FormRow>
                        </FormLikeSection>
                    )}

                    {(simType === "ELECTRICITY" || simType === "BOTH") && elec && (
                        <>
                            <FormLikeSection title={t("simulationForm", "sectionPersonalizadaIndex")}>
                                <FormPeriodValues
                                    label={t("simulationForm", "personalizadaIndexMargenPotenciaLabel")}
                                    values={periodValues(elec.personalizadaIndex?.margenPotencia, elecPowerPeriods)}
                                />
                                <FormPeriodValues
                                    label={t("simulationForm", "personalizadaIndexMargenEnergiaLabel")}
                                    values={periodValues(elec.personalizadaIndex?.margenEnergia, elecEnergyPeriods)}
                                />
                            </FormLikeSection>

                            <FormLikeSection title={t("simulationForm", "sectionPersonalizadaOmieB")}>
                                <FormPeriodValues
                                    label={t("simulationForm", "personalizadaOmieBMargenPotenciaLabel")}
                                    values={periodValues(elec.personalizadaOmieB?.margenPotencia, elecPowerPeriods)}
                                />
                                <FormPeriodValues
                                    label={t("simulationForm", "personalizadaOmieBTerminoBLabel")}
                                    values={periodValues(elec.personalizadaOmieB?.terminoB, elecEnergyPeriods)}
                                />
                            </FormLikeSection>

                            <FormLikeSection title={t("simulationView", "sectionPersonalizadaFijo")}>
                                <FormPeriodValues
                                    label={t("simulationView", "personalizadaFijoPotenciaLabel")}
                                    values={periodValues(elec.personalizadaFijo?.preciosPotencia, elecPowerPeriods)}
                                />
                                <FormPeriodValues
                                    label={t("simulationView", "personalizadaFijoEnergiaLabel")}
                                    values={periodValues(elec.personalizadaFijo?.preciosEnergia, elecEnergyPeriods)}
                                />
                            </FormLikeSection>
                        </>
                    )}

                    {/* Gas values */}
                    {(simType === "GAS" || simType === "BOTH") && gas && (
                        <FormLikeSection title={t("simulationForm", "sectionInvoiceBreakdown")}>
                            <div className="simulation-form-responsive-grid simulation-view-responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
                                <div>
                                    <ReadOnlyInputField
                                        label={t("simulationForm", "fieldTariff")}
                                        value={gas.tarifaAcceso}
                                        flex="1 1 100%"
                                    />
                                    <div style={{ height: 10 }} />
                                    <ReadOnlyInputField
                                        label={t("simulationForm", "fieldTelemetering")}
                                        value={gas.telemedida}
                                        flex="1 1 100%"
                                    />
                                </div>
                                <div>
                                    <FormRow>
                                        <ReadOnlyInputField
                                            label={t("simulationForm", "fieldBillingPeriod")}
                                            value={gas.periodo ? `${gas.periodo.fechaInicio} → ${gas.periodo.fechaFin}` : undefined}
                                            flex="1 1 320px"
                                        />
                                        <ReadOnlyInputField
                                            label={t("simulationForm", "fieldDays")}
                                            value={gas.periodo?.dias ?? 0}
                                            flex="0 0 96px"
                                        />
                                    </FormRow>
                                </div>
                            </div>

                            <DividerLine />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldConsumption")}
                                    value={Number(gas.consumo ?? 0).toLocaleString()}
                                    flex="1 1 260px"
                                />
                            </FormRow>

                            <DividerLine />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldCurrentInvoice")}
                                    value={currency(gas.facturaActual)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldMeterRental")}
                                    value={currency(gas.extras?.alquilerEquipoMedida)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldOtherCharges")}
                                    value={currency(gas.extras?.otrosCargos)}
                                />
                            </FormRow>

                            <DividerLine compact />
                            <FormRow>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldIVA")}
                                    value={percent(gas.ivaTasa ?? 21, 0)}
                                />
                                <ReadOnlyInputField
                                    label={t("simulationForm", "fieldHydrocarbonTax")}
                                    value={Number(gas.impuestoHidrocarburo ?? 0.00234).toFixed(5)}
                                />
                            </FormRow>
                        </FormLikeSection>
                    )}

                    {(simType === "GAS" || simType === "BOTH") && gas && (
                        <>
                            <FormLikeSection title={t("simulationForm", "sectionGasPersonalizadaIndex")}>
                                <ReadOnlyInputField
                                    label={t("simulationForm", "gasPersonalizadaIndexMargenLabel")}
                                    value={Number(gas.personalizadaIndex?.margenEnergia ?? 0).toFixed(5)}
                                    flex="1 1 260px"
                                />
                            </FormLikeSection>

                            <FormLikeSection title={t("simulationView", "sectionGasPersonalizadaFijo")}>
                                <FormRow>
                                    <ReadOnlyInputField
                                        label={t("simulationView", "gasPersonalizadaFijoTerminoDiaLabel")}
                                        value={Number(gas.personalizadaFijo?.terminoDia ?? 0).toFixed(4)}
                                    />
                                    <ReadOnlyInputField
                                        label={t("simulationView", "gasPersonalizadaFijoTerminoVariableLabel")}
                                        value={Number(gas.personalizadaFijo?.terminoVariable ?? 0).toFixed(5)}
                                    />
                                </FormRow>
                            </FormLikeSection>
                        </>
                    )}
                </div>
            )}

            {activeTab === "results" && (
                <div>
                    {results ? (
                        <SimulationResultsCards
                            results={results}
                            facturaActual={
                                simType === "ELECTRICITY" ? elec?.facturaActual
                                    : simType === "GAS" ? gas?.facturaActual
                                        : undefined
                            }
                            tarifaAcceso={elec?.tarifaAcceso ?? gas?.tarifaAcceso}
                            consumoAnual={elec?.clientData?.consumoAnual}
                            selectedOffer={selectedOffer ? {
                                productKey: selectedOffer.productKey,
                                commodity: selectedOffer.commodity
                            } : undefined}
                            readOnly
                        />
                    ) : (
                        <div style={{ padding: "60px 20px", textAlign: "center", opacity: 0.5 }}>
                            <div style={{ marginBottom: 12 }}><BoltIcon sx={{ fontSize: 48, color: "var(--scheme-primary-500)" }} /></div>
                            <div style={{ fontSize: 15, marginBottom: 8 }}>{t("simulationForm", "noResultsYet")}</div>
                            <Button variant="contained" onClick={() => setActiveTab("inputs")} sx={{ mt: 2.5 }}>
                                {t("simulationForm", "goToInputs")}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
