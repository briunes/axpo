"use client";

import { useState } from "react";
import type { SimulationItem } from "../../lib/internalApi";
import type { SimulationPayload, SimulationResults } from "@/domain/types";
import { SimulationResultsCards } from "./SimulationResultsCards";
import { useI18n } from "../../../../src/lib/i18n-context";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Collapse, IconButton } from "@mui/material";

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
                {value || <span style={{ color: "var(--scheme-neutral-600)" }}>—</span>}
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
                            borderRadius: 6,
                            fontSize: 13,
                        }}
                    >
                        <span style={{ color: "var(--scheme-neutral-500)", marginRight: 6 }}>{period}:</span>
                        <span style={{ fontWeight: 600, color: "var(--scheme-neutral-200)" }}>{Number(value).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SimulationViewDisplay({ simulation }: { simulation: SimulationItem }) {
    const payload = simulation.payloadJson as any;
    const simType = payload?.type;
    const elec = payload?.electricity;
    const gas = payload?.gas;
    const results = payload?.results as SimulationResults | undefined;
    const selectedOffer = payload?.selectedOffer as { productKey: string; commodity: "ELECTRICITY" | "GAS"; pricingType: "FIXED" | "INDEXED"; selectedAt: string } | undefined;

    const [showAllOffers, setShowAllOffers] = useState(false);

    // Find the selected product from results
    const selectedProduct = selectedOffer && results
        ? (selectedOffer.commodity === "ELECTRICITY" ? results.electricity : results.gas)?.find(
            p => p.productKey === selectedOffer.productKey
        )
        : undefined;

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
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--scheme-neutral-200)", marginBottom: 8 }}>
                    {t("simulationView", "noDataTitle") || "No Simulation Data"}
                </div>
                <div style={{ fontSize: 14, color: "var(--scheme-neutral-500)", marginBottom: 20 }}>
                    {t("simulationView", "noDataMessage") || "This simulation hasn't been configured yet. Use the 'Open & Edit' button above to add inputs and calculate offers."}
                </div>
            </div>
        );
    }

    return (
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
                        {simType === "ELECTRICITY" && <><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /> Electricity Simulation</>}
                        {simType === "GAS" && <><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} /> Gas Simulation</>}
                        {simType === "BOTH" && <><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444", marginLeft: "-4px" }} /> Electricity & Gas Simulation</>}
                    </div>
                </div>
            )}

            {/* Client Data */}
            {elec?.clientData && (
                <Section title={t("simulationView", "sectionClientInfo")}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                        <Field label={t("simulationView", "fieldCups")} value={elec.clientData.cups} mono />
                        <Field label={t("simulationView", "fieldAnnualConsumption")} value={elec.clientData.consumoAnual ? `${elec.clientData.consumoAnual.toLocaleString()} kWh` : undefined} />
                        <Field label={t("simulationView", "fieldAccountHolder")} value={elec.clientData.nombreTitular} />
                        <Field label={t("simulationView", "fieldContactPerson")} value={elec.clientData.personaContacto} />
                        <Field label={t("simulationView", "fieldSalesRep")} value={elec.clientData.comercial} />
                        <Field label={t("simulationView", "fieldAddress")} value={elec.clientData.direccion} />
                        <Field label={t("simulationView", "fieldCurrentSupplier")} value={elec.clientData.comercializadorActual} />
                    </div>
                </Section>
            )}

            {/* Electricity Configuration */}
            {(simType === "ELECTRICITY" || simType === "BOTH") && elec && (
                <Section title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} /> {t("simulationView", "sectionElecConfig").replace("⚡ ", "")}</div>}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 20 }}>
                        <Field label={t("simulationView", "fieldAccessTariff")} value={elec.tarifaAcceso} />
                        <Field label={t("simulationView", "fieldGeographicZone")} value={elec.zonaGeografica} />
                        <Field label={t("simulationView", "fieldLoadProfile")} value={elec.perfilCarga} />
                        <Field
                            label={t("simulationView", "fieldPeriod")}
                            value={elec.periodo ? `${elec.periodo.fechaInicio} → ${elec.periodo.fechaFin} (${t("simulationView", "periodDays", { days: elec.periodo.dias })})` : undefined}
                        />
                        <Field label={t("simulationView", "fieldCurrentInvoice")} value={elec.facturaActual ? `€${elec.facturaActual.toFixed(2)}` : undefined} />
                        <Field label={t("simulationView", "fieldReactiveEnergy")} value={elec.extras?.reactiva ? `€${elec.extras.reactiva.toFixed(2)}` : undefined} />
                        <Field label={t("simulationView", "fieldEquipmentRental")} value={elec.extras?.alquilerEquipoMedida ? `€${elec.extras.alquilerEquipoMedida.toFixed(2)}` : undefined} />
                        <Field label={t("simulationView", "fieldOtherCharges")} value={elec.extras?.otrosCargos ? `€${elec.extras.otrosCargos.toFixed(2)}` : undefined} />
                    </div>

                    {elec.consumo && <PeriodValues label={t("simulationView", "periodValues_consumption")} values={elec.consumo as any} />}
                    {elec.potenciaContratada && <PeriodValues label={t("simulationView", "periodValues_power")} values={elec.potenciaContratada as any} />}
                    {elec.excesoPotencia && Object.keys(elec.excesoPotencia).length > 0 && (
                        <PeriodValues label={t("simulationView", "periodValues_excessPower")} values={elec.excesoPotencia as any} />
                    )}
                    {elec.omieEstimado && Object.keys(elec.omieEstimado).length > 0 && (
                        <PeriodValues label={t("simulationView", "periodValues_omie")} values={elec.omieEstimado as any} />
                    )}
                </Section>
            )}

            {/* Gas Configuration */}
            {(simType === "GAS" || simType === "BOTH") && gas && (
                <Section title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} /> {t("simulationView", "sectionGasConfig").replace("🔥 ", "")}</div>}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                        <Field label={t("simulationView", "fieldAccessTariff")} value={gas.tarifaAcceso} />
                        <Field label={t("simulationView", "fieldGeographicZone")} value={gas.zonaGeografica} />
                        <Field label={t("simulationView", "fieldConsumption")} value={gas.consumo ? `${gas.consumo.toLocaleString()} kWh` : undefined} />
                        <Field label={t("simulationView", "fieldTelemetry")} value={gas.telemedida} />
                        <Field
                            label={t("simulationView", "fieldPeriod")}
                            value={gas.periodo ? `${gas.periodo.fechaInicio} → ${gas.periodo.fechaFin} (${t("simulationView", "periodDays", { days: gas.periodo.dias })})` : undefined}
                        />
                        <Field label={t("simulationView", "fieldCurrentInvoice")} value={gas.facturaActual ? `€${gas.facturaActual.toFixed(2)}` : undefined} />
                        <Field label={t("simulationView", "fieldEquipmentRental")} value={gas.extras?.alquilerEquipoMedida ? `€${gas.extras.alquilerEquipoMedida.toFixed(2)}` : undefined} />
                        <Field label={t("simulationView", "fieldOtherCharges")} value={gas.extras?.otrosCargos ? `€${gas.extras.otrosCargos.toFixed(2)}` : undefined} />
                    </div>
                </Section>
            )}

            {/* Selected Offer Highlight */}
            {selectedProduct && selectedOffer && (
                <div style={{
                    marginBottom: 32,
                    padding: 24,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
                    border: "3px solid #6366f1",
                    borderRadius: 16,
                    boxShadow: "0 4px 6px -1px rgba(99, 102, 241, 0.2)",
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 16,
                    }}>
                        <span style={{ fontSize: 28 }}>✓</span>
                        <h2 style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 700,
                            color: "var(--scheme-neutral-100)",
                        }}>
                            {t("simulationView", "selectedOfferTitle")}
                        </h2>
                    </div>

                    <div style={{
                        padding: 20,
                        background: "var(--scheme-neutral-1050)",
                        borderRadius: 12,
                        marginBottom: 16,
                    }}>
                        <div style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "var(--scheme-neutral-100)",
                            marginBottom: 12,
                        }}>
                            {selectedProduct.productLabel}
                        </div>

                        <div style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 16,
                        }}>
                            <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--scheme-neutral-400)",
                                background: "var(--scheme-neutral-900)",
                                padding: "4px 10px",
                                borderRadius: 12,
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}>
                                {selectedOffer.commodity === "ELECTRICITY" ? <><BoltIcon sx={{ fontSize: 12, color: "#f59e0b" }} /> Electricity</> : <><LocalFireDepartmentIcon sx={{ fontSize: 12, color: "#ef4444" }} /> Gas</>}
                            </span>
                            <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--scheme-neutral-400)",
                                background: "var(--scheme-neutral-900)",
                                padding: "4px 10px",
                                borderRadius: 12,
                                textTransform: "uppercase",
                            }}>
                                {selectedOffer.pricingType === "FIXED" ? t("simulationView", "badgeFixed") : t("simulationView", "badgeIndexed")}
                            </span>
                        </div>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 16,
                            padding: 16,
                            background: "var(--scheme-neutral-1000)",
                            borderRadius: 8,
                        }}>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginBottom: 4, textTransform: "uppercase" }}>
                                    {t("simulationView", "labelTotalInvoice")}
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--scheme-neutral-100)" }}>
                                    {selectedProduct.totalFactura.toFixed(2)} €
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginBottom: 4, textTransform: "uppercase" }}>
                                    {t("simulationView", "labelMonthlySavings")}
                                </div>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: selectedProduct.ahorro > 0 ? "#10b981" : "#ef4444",
                                }}>
                                    {selectedProduct.ahorro > 0 ? "+" : ""}{selectedProduct.ahorro.toFixed(2)} €
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginBottom: 4, textTransform: "uppercase" }}>
                                    {t("simulationView", "labelPctDifference")}
                                </div>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: selectedProduct.ahorro > 0 ? "#10b981" : "#ef4444",
                                }}>
                                    {selectedProduct.pctAhorro > 0 ? "+" : ""}{selectedProduct.pctAhorro.toFixed(1)}%
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginBottom: 4, textTransform: "uppercase" }}>
                                    {t("simulationView", "labelAnnualSavings")}
                                </div>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: selectedProduct.ahorro > 0 ? "#10b981" : "#ef4444",
                                }}>
                                    {selectedProduct.ahorro > 0 ? "+" : ""}{selectedProduct.ahorroAnual.toFixed(2)} €
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        fontSize: 12,
                        color: "var(--scheme-neutral-500)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}>
                        <span>📅</span>
                        <span>{t("simulationView", "selectedAt", {
                            date: new Date(selectedOffer.selectedAt).toLocaleDateString(undefined, {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                            })
                        })}</span>
                    </div>
                </div>
            )}

            {/* Results - All Offers (Read-only, Collapsible) */}
            {results && (
                <div style={{ marginTop: 32 }}>
                    <div
                        onClick={() => setShowAllOffers(!showAllOffers)}
                        style={{
                            padding: "14px 20px",
                            background: "var(--scheme-neutral-1000)",
                            border: "2px solid var(--scheme-neutral-800)",
                            borderRadius: showAllOffers ? "12px 12px 0 0" : 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            userSelect: "none",
                            transition: "border-radius 0.15s ease",
                        }}
                    >
                        <h2 style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: "var(--scheme-neutral-100)",
                        }}>
                            {t("simulationView", "allOffersTitle")}
                        </h2>
                        <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setShowAllOffers(!showAllOffers); }}
                            sx={{
                                color: "var(--scheme-neutral-400)",
                                transform: showAllOffers ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                            }}
                        >
                            <ExpandMoreIcon />
                        </IconButton>
                    </div>

                    <Collapse in={showAllOffers} unmountOnExit>
                        <div style={{
                            padding: 20,
                            background: "var(--scheme-neutral-1050)",
                            border: "2px solid var(--scheme-neutral-800)",
                            borderTop: "none",
                            borderRadius: "0 0 12px 12px",
                        }}>
                            <div style={{
                                fontSize: 13,
                                color: "var(--scheme-neutral-400)",
                                marginBottom: 16,
                                padding: 12,
                                background: "var(--scheme-neutral-1000)",
                                borderRadius: 8,
                            }}>
                                {t("simulationView", "readOnlyHint")}
                            </div>
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
                        </div>
                    </Collapse>
                </div>
            )}
        </div>
    );
}
