"use client";

import React, { useState } from "react";
import type { SimulationResults, ProductResult } from "@/domain/types";
import { useI18n } from "../../../../src/lib/i18n-context";
import { FormSelect } from "../ui/FormSelect";
import { CurrencyInput } from "../ui/CurrencyInput";

const MESES_ES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function fmtMonth(yyyyMM: string, locale: string = "en"): string {
    const [year, mon] = yyyyMM.split('-').map(Number);
    const intlLocale = locale === "es" ? "es-ES" : "en-US";
    const monthName = new Intl.DateTimeFormat(intlLocale, { month: "long" }).format(new Date(year, mon - 1, 1));
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} - ${year}`;
}

interface SimulationResultsCardsProps {
    results: SimulationResults;
    facturaActual?: number;
    tarifaAcceso?: string;
    consumoAnual?: number;
    energyPeriods?: Record<string, number>;
    powerPeriods?: Record<string, number>;
    omiePeriods?: Record<string, number>;
    onUpdatePeriod?: (type: "energy" | "power" | "omie", period: string, value: number) => void;
    onRecalculate?: () => void;
    calculating?: boolean;
    selectedOffer?: { productKey: string; commodity: "ELECTRICITY" | "GAS" };
    onSelectOffer?: (productKey: string, commodity: "ELECTRICITY" | "GAS", pricingType: "FIXED" | "INDEXED") => Promise<void>;
    readOnly?: boolean;
    /** Currently displayed billing month (YYYY-MM) */
    selectedMonth?: string;
    /** Selectable months (YYYY-MM[]) */
    availableMonths?: string[];
    /** Called when user picks a different month */
    onMonthChange?: (month: string) => void;
    personalizadaIndexPeriods?: { margenEnergia: Record<string, number>; margenPotencia: Record<string, number> };
    onUpdatePersonalizadaIndex?: (field: "margenEnergia" | "margenPotencia", period: string, value: number) => void;
    personalizadaOmieBPeriods?: { terminoB: Record<string, number>; margenPotencia: Record<string, number> };
    onUpdatePersonalizadaOmieB?: (field: "terminoB" | "margenPotencia", period: string, value: number) => void;
    gasPersonalizadaIndexMargen?: number;
    onUpdateGasPersonalizadaIndex?: (margen: number) => void;
}

interface PendingOffer {
    product: ProductResult;
    commodity: "ELECTRICITY" | "GAS";
}

function fmt(n: number, digits = 2): string {
    return n.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const uiColors = {
    surface: "var(--scheme-neutral-1200)",
    surfaceRaised: "var(--scheme-neutral-1100)",
    surfaceMuted: "var(--scheme-neutral-1000)",
    border: "var(--scheme-neutral-900)",
    borderStrong: "var(--scheme-neutral-800)",
    text: "var(--scheme-neutral-100)",
    textMuted: "var(--scheme-neutral-500)",
    textSoft: "var(--scheme-neutral-600)",
};

type SortCol = "productLabel" | "totalFactura" | "ahorro" | "pctAhorro" | "ahorroAnual";
type SortDir = "asc" | "desc";

function ProductTable({ products, facturaActual, selectedOffer, onOfferClick, commodity, bestProductKey }: {
    products: ProductResult[];
    facturaActual?: number;
    selectedOffer?: { productKey: string; commodity: "ELECTRICITY" | "GAS" };
    onOfferClick?: (product: ProductResult, commodity: "ELECTRICITY" | "GAS") => void;
    commodity: "ELECTRICITY" | "GAS";
    bestProductKey?: string;
}) {
    const { t } = useI18n();
    const [sortCol, setSortCol] = useState<SortCol>("ahorro");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const handleSort = (col: SortCol) => {
        if (sortCol === col) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortCol(col);
            setSortDir(col === "productLabel" ? "asc" : "desc");
        }
    };

    const sortedProducts = [...products].sort((a, b) => {
        let cmp = 0;
        if (sortCol === "productLabel") {
            cmp = a.productLabel.localeCompare(b.productLabel);
        } else {
            cmp = (a[sortCol] as number) - (b[sortCol] as number);
        }
        return sortDir === "asc" ? cmp : -cmp;
    });

    const SortIndicator = ({ col, align = "right" }: { col: SortCol; align?: "left" | "right" | "center" }) => (
        <span style={{
            display: "inline-flex",
            flexDirection: "column",
            marginLeft: align === "left" ? 4 : 0,
            marginRight: align === "right" ? 0 : 0,
            verticalAlign: "middle",
            gap: 1,
            opacity: sortCol === col ? 1 : 0.3,
        }}>
            <span style={{ fontSize: 8, lineHeight: 1, color: sortCol === col && sortDir === "asc" ? uiColors.text : uiColors.textMuted }}>▲</span>
            <span style={{ fontSize: 8, lineHeight: 1, color: sortCol === col && sortDir === "desc" ? uiColors.text : uiColors.textMuted }}>▼</span>
        </span>
    );

    const thSortStyle = (col: SortCol, align: "left" | "right" | "center" = "right"): React.CSSProperties => ({
        padding: "14px 16px",
        textAlign: align,
        fontSize: 11,
        fontWeight: 700,
        color: sortCol === col ? uiColors.text : uiColors.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderBottom: `2px solid ${uiColors.border}`,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
    });

    return (
        <div style={{
            background: uiColors.surface,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
            border: `1px solid ${uiColors.border}`,
        }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ background: `linear-gradient(180deg, ${uiColors.surfaceRaised} 0%, ${uiColors.surfaceMuted} 100%)` }}>
                        {onOfferClick && (
                            <th style={{
                                padding: "14px 16px",
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: uiColors.textMuted,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                borderBottom: `2px solid ${uiColors.border}`,
                                width: "80px",
                            }}>
                                {t("simulationOffersCards", "colSelect")}
                            </th>
                        )}
                        <th style={thSortStyle("productLabel", "left")} onClick={() => handleSort("productLabel")}>
                            {t("simulationOffersCards", "colProduct")}
                            <SortIndicator col="productLabel" align="left" />
                        </th>
                        <th style={thSortStyle("totalFactura", "right")} onClick={() => handleSort("totalFactura")}>
                            {t("simulationOffersCards", "colTotalInvoice")}
                            {" "}<SortIndicator col="totalFactura" />
                        </th>
                        <th style={thSortStyle("ahorro", "right")} onClick={() => handleSort("ahorro")}>
                            {t("simulationOffersCards", "colMonthlySavings")}
                            {" "}<SortIndicator col="ahorro" />
                        </th>
                        <th style={thSortStyle("pctAhorro", "center")} onClick={() => handleSort("pctAhorro")}>
                            {t("simulationOffersCards", "colPctDifference")}
                            {" "}<SortIndicator col="pctAhorro" align="center" />
                        </th>
                        <th style={thSortStyle("ahorroAnual", "right")} onClick={() => handleSort("ahorroAnual")}>
                            {t("simulationOffersCards", "colAnnualSavings")}
                            {" "}<SortIndicator col="ahorroAnual" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedProducts.map((product, idx) => {
                        const isTop = product.productKey === bestProductKey && product.ahorro > 0;
                        const isSelected = selectedOffer?.productKey === product.productKey && selectedOffer?.commodity === commodity;
                        const savingsColor = product.ahorro > 0 ? "#10b981" : product.ahorro < 0 ? "#ef4444" : "#6b7280";
                        const bgColor = isSelected
                            ? "linear-gradient(90deg, var(--scheme-brand-600-15) 0%, var(--scheme-accent-600-15) 100%)"
                            : isTop
                                ? "linear-gradient(90deg, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.08) 100%)"
                                : idx % 2 === 0 ? uiColors.surface : uiColors.surfaceRaised;

                        return (
                            <tr key={product.productKey + product.pricingType} style={{
                                background: bgColor,
                                borderLeft: isSelected ? "4px solid #6366f1" : isTop ? "4px solid #10b981" : "none",
                            }}>
                                {onOfferClick && (
                                    <td style={{
                                        padding: "14px 16px",
                                        textAlign: "center",
                                        borderBottom: `1px solid ${uiColors.border}`,
                                    }}>
                                        <div
                                            onClick={() => onOfferClick(product, commodity)}
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                border: `2px solid ${isSelected ? "#6366f1" : "var(--scheme-neutral-600, #9ca3af)"}`,
                                                background: isSelected ? "#6366f1" : "transparent",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {isSelected && (
                                                <div style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                }} />
                                            )}
                                        </div>
                                    </td>
                                )}
                                <td style={{
                                    padding: "14px 16px",
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}>
                                        <div>
                                            <div style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: uiColors.text,
                                                marginBottom: 3,
                                            }}>
                                                {product.productKey === "PERSONALIZADA_INDEX"
                                                    ? t("simulationOffersCards", "productLabelPersonalizadaIndex")
                                                    : product.productKey === "PERSONALIZADA_OMIE_B"
                                                        ? t("simulationOffersCards", "productLabelPersonalizadaOmieB")
                                                        : product.productKey === "GAS_PERSONALIZADA_INDEX"
                                                            ? t("simulationOffersCards", "productLabelGasPersonalizadaIndex")
                                                            : product.productLabel}
                                            </div>
                                            <div style={{
                                                display: "inline-block",
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: uiColors.textMuted,
                                                background: uiColors.surfaceMuted,
                                                padding: "2px 8px",
                                                borderRadius: 10,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.03em",
                                            }}>
                                                {product.pricingType === "FIXED"
                                                    ? t("simulationOffersCards", "pricingFixed")
                                                    : (product.productKey === "PERSONALIZADA_INDEX" || product.productKey === "PERSONALIZADA_OMIE_B" || product.productKey === "GAS_PERSONALIZADA_INDEX")
                                                        ? t("simulationOffersCards", "pricingPersonalizada")
                                                        : t("simulationOffersCards", "pricingIndexed")}
                                            </div>
                                        </div>
                                        {isTop && (
                                            <div style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "#fff",
                                                background: "#10b981",
                                                padding: "4px 10px",
                                                borderRadius: 12,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                            }}>
                                                {t("simulationOffersCards", "badgeBestOffer")}
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "#fff",
                                                background: "#6366f1",
                                                padding: "4px 10px",
                                                borderRadius: 12,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                            }}>
                                                {t("simulationOffersCards", "badgeSelected")}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td style={{
                                    padding: "14px 16px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: uiColors.text,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {fmt(product.totalFactura)} €
                                </td>
                                <td style={{
                                    padding: "14px 16px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: savingsColor,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {product.ahorro > 0 ? "+" : ""}{fmt(product.ahorro)} €
                                </td>
                                <td style={{
                                    padding: "14px 16px",
                                    textAlign: "center",
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    <div style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 12px",
                                        background: product.ahorro > 0
                                            ? "rgba(16, 185, 129, 0.1)"
                                            : product.ahorro < 0
                                                ? "rgba(239, 68, 68, 0.1)"
                                                : "rgba(107, 114, 128, 0.1)",
                                        borderRadius: 16,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: savingsColor,
                                    }}>
                                        {product.ahorro > 0 ? "↓" : product.ahorro < 0 ? "↑" : "—"}
                                        {product.pctAhorro > 0 ? "+" : ""}{fmt(product.pctAhorro, 1)}%
                                    </div>
                                </td>
                                <td style={{
                                    padding: "14px 16px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: uiColors.textSoft,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {product.ahorro > 0 ? "+" : ""}{fmt(product.ahorroAnual)} €
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function EditableInputPanel({
    facturaActual,
    tarifaAcceso,
    consumoAnual,
    energyPeriods,
    powerPeriods,
    omiePeriods,
    onUpdatePeriod,
    onRecalculate,
    calculating,
    readOnly,
    selectedMonth,
    availableMonths,
    onMonthChange,
    locale,
    personalizadaIndexPeriods,
    onUpdatePersonalizadaIndex,
    personalizadaOmieBPeriods,
    onUpdatePersonalizadaOmieB,
    gasPersonalizadaIndexMargen,
    onUpdateGasPersonalizadaIndex,
}: {
    facturaActual?: number;
    tarifaAcceso?: string;
    consumoAnual?: number;
    energyPeriods?: Record<string, number>;
    powerPeriods?: Record<string, number>;
    omiePeriods?: Record<string, number>;
    onUpdatePeriod?: (type: "energy" | "power" | "omie", period: string, value: number) => void;
    onRecalculate?: () => void;
    calculating?: boolean;
    readOnly?: boolean;
    selectedMonth?: string;
    availableMonths?: string[];
    onMonthChange?: (month: string) => void;
    locale?: string;
    personalizadaIndexPeriods?: { margenEnergia: Record<string, number>; margenPotencia: Record<string, number> };
    onUpdatePersonalizadaIndex?: (field: "margenEnergia" | "margenPotencia", period: string, value: number) => void;
    personalizadaOmieBPeriods?: { terminoB: Record<string, number>; margenPotencia: Record<string, number> };
    onUpdatePersonalizadaOmieB?: (field: "terminoB" | "margenPotencia", period: string, value: number) => void;
    gasPersonalizadaIndexMargen?: number;
    onUpdateGasPersonalizadaIndex?: (margen: number) => void;
}) {
    const { t } = useI18n();
    const [expandedSection, setExpandedSection] = useState<"energy" | "power" | "omie" | "personalizadaIndex" | "personalizadaOmieB" | null>(null);

    const handleInputChange = (type: "energy" | "power" | "omie", period: string, value: string) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && onUpdatePeriod) {
            onUpdatePeriod(type, period, numValue);
        }
    };

    return (
        <div style={{
            position: "sticky",
            top: 20,
            background: uiColors.surface,
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)",
            border: `1px solid ${uiColors.border}`,
        }}>
            <h3 style={{
                margin: "0 0 12px 0",
                fontSize: 14,
                fontWeight: 700,
                color: uiColors.text,
            }}>
                {t("simulationOffersCards", "sectionTitle")}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tarifaAcceso && (
                    <div>
                        <div style={{ fontSize: 10, color: uiColors.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
                            {t("simulationOffersCards", "labelAccessTariff")}
                        </div>
                        <div style={{
                            padding: "6px 10px",
                            background: "linear-gradient(135deg, #dbeafe, #e0e7ff)",
                            border: "1px solid #93c5fd",
                            borderRadius: 6,
                            color: "#1e40af",
                            fontSize: 13,
                            fontWeight: 700,
                        }}>
                            {tarifaAcceso}
                        </div>
                    </div>
                )}

                {consumoAnual ? (
                    <div>
                        <div style={{ fontSize: 10, color: uiColors.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
                            {t("simulationOffersCards", "labelAnnualConsumption")}
                        </div>
                        <div style={{
                            padding: "6px 10px",
                            background: "linear-gradient(135deg, #d1fae5, #dbeafe)",
                            border: "1px solid #6ee7b7",
                            borderRadius: 6,
                            color: "#065f46",
                            fontSize: 13,
                            fontWeight: 700,
                        }}>
                            {consumoAnual.toLocaleString()} kWh
                        </div>
                    </div>
                ) : ''}

                {facturaActual && (
                    <div>
                        <div style={{ fontSize: 10, color: uiColors.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
                            {t("simulationOffersCards", "labelCurrentInvoice")}
                        </div>
                        <div style={{
                            padding: "8px 10px",
                            background: "linear-gradient(135deg, #fed7aa, #fde68a)",
                            border: "1px solid #fb923c",
                            borderRadius: 6,
                            color: "#9a3412",
                            fontSize: 16,
                            fontWeight: 700,
                        }}>
                            {fmt(facturaActual)} €
                        </div>
                    </div>
                )}

                {availableMonths && availableMonths.length > 0 && onMonthChange && (
                    <div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
                            {t("simulationOffersCards", "monthSelectorLabel")}
                        </div>
                        <FormSelect
                            label=""
                            value={selectedMonth ?? ""}
                            options={availableMonths.map((m) => ({ value: m, label: fmtMonth(m, locale) }))}
                            onChange={(v) => v && onMonthChange(String(v))}
                            disabled={calculating}
                            fullWidth={true}
                        />
                    </div>
                )}
            </div>

            {!readOnly && (<>
                {/* Editable periods */}
                {energyPeriods && Object.keys(energyPeriods).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === "energy" ? null : "energy")}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: expandedSection === "energy" ? uiColors.surfaceMuted : uiColors.surface,
                                border: `1px solid ${uiColors.borderStrong}`,
                                borderRadius: 6,
                                color: uiColors.text,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.2s",
                            }}
                        >
                            <span>{t("simulationOffersCards", "btnConsumption")}</span>
                            <span>{expandedSection === "energy" ? "▲" : "▼"}</span>
                        </button>
                        {expandedSection === "energy" && (
                            <div style={{ marginTop: 8, padding: 12, background: uiColors.surfaceRaised, borderRadius: 8, border: `1px solid ${uiColors.border}` }}>
                                {Object.entries(energyPeriods).map(([period, value]) => (
                                    <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>
                                            {period}:
                                        </label>
                                        <CurrencyInput
                                            value={value}
                                            onChange={(v) => { if (!isNaN(v)) onUpdatePeriod?.("energy", period, v); }}
                                            currencySymbol=""
                                            decimals={0}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {powerPeriods && Object.keys(powerPeriods).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === "power" ? null : "power")}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: expandedSection === "power" ? uiColors.surfaceMuted : uiColors.surface,
                                border: `1px solid ${uiColors.borderStrong}`,
                                borderRadius: 6,
                                color: uiColors.text,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.2s",
                            }}
                        >
                            <span>{t("simulationOffersCards", "btnPower")}</span>
                            <span>{expandedSection === "power" ? "▲" : "▼"}</span>
                        </button>
                        {expandedSection === "power" && (
                            <div style={{ marginTop: 8, padding: 12, background: uiColors.surfaceRaised, borderRadius: 8, border: `1px solid ${uiColors.border}` }}>
                                {Object.entries(powerPeriods).map(([period, value]) => (
                                    <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>
                                            {period}:
                                        </label>
                                        <CurrencyInput
                                            value={value}
                                            onChange={(v) => { if (!isNaN(v)) onUpdatePeriod?.("power", period, v); }}
                                            currencySymbol=""
                                            decimals={2}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {personalizadaIndexPeriods && (Object.keys(personalizadaIndexPeriods.margenEnergia).length > 0 || Object.keys(personalizadaIndexPeriods.margenPotencia).length > 0) && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === "personalizadaIndex" ? null : "personalizadaIndex")}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: expandedSection === "personalizadaIndex" ? uiColors.surfaceMuted : uiColors.surface,
                                border: `1px solid ${uiColors.borderStrong}`,
                                borderRadius: 6,
                                color: uiColors.text,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.2s",
                            }}
                        >
                            <span>{t("simulationForm", "sectionPersonalizadaIndex")}</span>
                            <span>{expandedSection === "personalizadaIndex" ? "▲" : "▼"}</span>
                        </button>
                        {expandedSection === "personalizadaIndex" && (
                            <div style={{ marginTop: 8, padding: 12, background: uiColors.surfaceRaised, borderRadius: 8, border: `1px solid ${uiColors.border}` }}>
                                {Object.keys(personalizadaIndexPeriods.margenEnergia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaIndexMargenEnergiaLabel")}</div>
                                        {Object.entries(personalizadaIndexPeriods.margenEnergia).map(([period, value]) => (
                                            <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                                <CurrencyInput
                                                    value={value}
                                                    onChange={(v) => { if (!isNaN(v)) onUpdatePersonalizadaIndex?.("margenEnergia", period, v); }}
                                                    currencySymbol=""
                                                    decimals={2}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                                {Object.keys(personalizadaIndexPeriods.margenPotencia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaIndexMargenPotenciaLabel")}</div>
                                        {Object.entries(personalizadaIndexPeriods.margenPotencia).map(([period, value]) => (
                                            <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                                <CurrencyInput
                                                    value={value}
                                                    onChange={(v) => { if (!isNaN(v)) onUpdatePersonalizadaIndex?.("margenPotencia", period, v); }}
                                                    currencySymbol=""
                                                    decimals={2}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {personalizadaOmieBPeriods && (Object.keys(personalizadaOmieBPeriods.terminoB).length > 0 || Object.keys(personalizadaOmieBPeriods.margenPotencia).length > 0) && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === "personalizadaOmieB" ? null : "personalizadaOmieB")}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: expandedSection === "personalizadaOmieB" ? uiColors.surfaceMuted : uiColors.surface,
                                border: `1px solid ${uiColors.borderStrong}`,
                                borderRadius: 6,
                                color: uiColors.text,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.2s",
                            }}
                        >
                            <span>{t("simulationForm", "sectionPersonalizadaOmieB")}</span>
                            <span>{expandedSection === "personalizadaOmieB" ? "▲" : "▼"}</span>
                        </button>
                        {expandedSection === "personalizadaOmieB" && (
                            <div style={{ marginTop: 8, padding: 12, background: uiColors.surfaceRaised, borderRadius: 8, border: `1px solid ${uiColors.border}` }}>
                                {Object.keys(personalizadaOmieBPeriods.terminoB).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaOmieBTerminoBLabel")}</div>
                                        {Object.entries(personalizadaOmieBPeriods.terminoB).map(([period, value]) => (
                                            <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                                <CurrencyInput
                                                    value={value}
                                                    onChange={(v) => { if (!isNaN(v)) onUpdatePersonalizadaOmieB?.("terminoB", period, v); }}
                                                    currencySymbol=""
                                                    decimals={2}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                                {Object.keys(personalizadaOmieBPeriods.margenPotencia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaOmieBMargenPotenciaLabel")}</div>
                                        {Object.entries(personalizadaOmieBPeriods.margenPotencia).map(([period, value]) => (
                                            <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                                <CurrencyInput
                                                    value={value}
                                                    onChange={(v) => { if (!isNaN(v)) onUpdatePersonalizadaOmieB?.("margenPotencia", period, v); }}
                                                    currencySymbol=""
                                                    decimals={2}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {gasPersonalizadaIndexMargen !== undefined && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === "personalizadaIndex" ? null : "personalizadaIndex")}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: expandedSection === "personalizadaIndex" ? uiColors.surfaceMuted : uiColors.surface,
                                border: `1px solid ${uiColors.borderStrong}`,
                                borderRadius: 6,
                                color: uiColors.text,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.2s",
                            }}
                        >
                            <span>{t("simulationForm", "sectionGasPersonalizadaIndex")}</span>
                            <span>{expandedSection === "personalizadaIndex" ? "▲" : "▼"}</span>
                        </button>
                        {expandedSection === "personalizadaIndex" && (
                            <div style={{ marginTop: 8, padding: 12, background: uiColors.surfaceRaised, borderRadius: 8, border: `1px solid ${uiColors.border}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "gasPersonalizadaIndexMargenLabel")}</div>
                                <CurrencyInput
                                    value={gasPersonalizadaIndexMargen}
                                    onChange={(v) => { if (!isNaN(v)) onUpdateGasPersonalizadaIndex?.(v); }}
                                    currencySymbol=""
                                    decimals={5}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: `2px solid ${uiColors.border}`,
                }}>
                    <button
                        onClick={onRecalculate}
                        disabled={calculating}
                        style={{
                            width: "100%",
                            padding: "10px 16px",
                            background: calculating
                                ? "linear-gradient(135deg, #d1d5db, #9ca3af)"
                                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: calculating ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            opacity: calculating ? 0.7 : 1,
                            boxShadow: calculating ? "none" : "0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                        }}
                        onMouseEnter={(e) => {
                            if (!calculating) {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 8px 12px -1px rgba(99, 102, 241, 0.4)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = calculating ? "none" : "0 4px 6px -1px rgba(99, 102, 241, 0.3)";
                        }}
                    >
                        {calculating ? t("simulationOffersCards", "btnCalculating") : t("simulationOffersCards", "btnRecalculate")}
                    </button>
                </div>

                <div style={{
                    marginTop: 8,
                    fontSize: 10,
                    color: uiColors.textSoft,
                    textAlign: "center",
                    fontWeight: 500,
                }}>
                    {t("simulationOffersCards", "recalculateHint")}
                </div>
            </>)}
        </div>
    );
}

export function SimulationResultsCards({
    results,
    facturaActual,
    tarifaAcceso,
    consumoAnual,
    energyPeriods,
    powerPeriods,
    omiePeriods,
    onUpdatePeriod,
    onRecalculate,
    calculating,
    selectedOffer,
    onSelectOffer,
    readOnly,
    selectedMonth,
    availableMonths,
    onMonthChange,
    personalizadaIndexPeriods,
    onUpdatePersonalizadaIndex,
    personalizadaOmieBPeriods,
    onUpdatePersonalizadaOmieB,
    gasPersonalizadaIndexMargen,
    onUpdateGasPersonalizadaIndex,
}: SimulationResultsCardsProps) {
    const { t, locale } = useI18n();
    const [elecTab, setElecTab] = useState<"all" | "fixed" | "indexed" | "personalizadas">("all");
    const [gasTab, setGasTab] = useState<"all" | "fixed" | "indexed" | "personalizadas">("all");
    const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null);
    const [saving, setSaving] = useState(false);

    const hasElec = (results.electricity?.length ?? 0) > 0;
    const hasGas = (results.gas?.length ?? 0) > 0;

    const handleOfferClick = (product: ProductResult, commodity: "ELECTRICITY" | "GAS") => {
        setPendingOffer({ product, commodity });
    };

    const handleConfirmSelection = async () => {
        if (!pendingOffer || !onSelectOffer) return;
        setSaving(true);
        try {
            await onSelectOffer(pendingOffer.product.productKey, pendingOffer.commodity, pendingOffer.product.pricingType);
            setPendingOffer(null);
        } catch (err) {
            // Error handling is done in the parent component
        } finally {
            setSaving(false);
        }
    };

    const handleCancelSelection = () => {
        setPendingOffer(null);
    };

    if (!hasElec && !hasGas) {
        return (
            <div style={{ padding: 60, textAlign: "center", background: uiColors.surfaceRaised, borderRadius: 12, border: `1px solid ${uiColors.border}` }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📊</div>
                <div style={{ fontSize: 16, color: uiColors.textMuted, marginBottom: 8, fontWeight: 600 }}>
                    {t("simulationOffersCards", "noResults")}
                </div>
                <div style={{ fontSize: 14, color: uiColors.textSoft }}>
                    {t("simulationOffersCards", "noResultsHint")}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
                display: "grid",
                gridTemplateColumns: "300px 1fr",
                gap: 16,
                alignItems: "start",
            }}>
                {/* Left sidebar - Editable input panel */}
                <EditableInputPanel
                    facturaActual={facturaActual}
                    tarifaAcceso={tarifaAcceso}
                    consumoAnual={consumoAnual}
                    energyPeriods={energyPeriods}
                    powerPeriods={powerPeriods}
                    omiePeriods={omiePeriods}
                    onUpdatePeriod={onUpdatePeriod}
                    onRecalculate={onRecalculate}
                    calculating={calculating}
                    readOnly={readOnly}
                    selectedMonth={selectedMonth}
                    availableMonths={availableMonths}
                    onMonthChange={onMonthChange}
                    locale={locale}
                    personalizadaIndexPeriods={personalizadaIndexPeriods}
                    onUpdatePersonalizadaIndex={onUpdatePersonalizadaIndex}
                    personalizadaOmieBPeriods={personalizadaOmieBPeriods}
                    onUpdatePersonalizadaOmieB={onUpdatePersonalizadaOmieB}
                    gasPersonalizadaIndexMargen={gasPersonalizadaIndexMargen}
                    onUpdateGasPersonalizadaIndex={onUpdateGasPersonalizadaIndex}
                />

                {/* Right side - Product tables */}
                <div>
                    {/* Electricity section */}
                    {hasElec && (() => {
                        const elecProducts = [...results.electricity!].sort((a, b) => b.ahorro - a.ahorro);
                        const fixedProducts = elecProducts.filter(p => p.pricingType === "FIXED");
                        const indexedProducts = elecProducts.filter(p => p.pricingType === "INDEXED");
                        const personalizadaProducts = elecProducts.filter(p => p.productKey === "PERSONALIZADA_INDEX" || p.productKey === "PERSONALIZADA_OMIE_B");
                        const hasPersonalizadas = personalizadaProducts.length > 0;

                        const bestElecProduct = elecProducts.reduce((best, current) =>
                            current.ahorro > best.ahorro ? current : best
                            , elecProducts[0]);

                        const displayProducts = elecTab === "all"
                            ? elecProducts
                            : elecTab === "fixed"
                                ? fixedProducts
                                : elecTab === "personalizadas"
                                    ? personalizadaProducts
                                    : indexedProducts;

                        return (
                            <div style={{ marginBottom: 40 }}>
                                <h2 style={{
                                    margin: "0 0 16px 0",
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: uiColors.text,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}>
                                    <span>⚡</span>
                                    <span>{t("simulationOffersCards", "electricityOffers")}</span>
                                    <span style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: uiColors.textMuted,
                                        background: uiColors.surfaceMuted,
                                        padding: "4px 12px",
                                        borderRadius: 12,
                                    }}>
                                        {t("simulationOffersCards", "productsCount", { count: elecProducts.length })}
                                    </span>
                                </h2>

                                {/* Tabs */}
                                <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${uiColors.border}`, marginBottom: 16 }}>
                                    {([
                                        { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: elecProducts.length },
                                        { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                        { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                        ...(hasPersonalizadas ? [{ key: "personalizadas" as const, label: t("simulationOffersCards", "tabPersonalizadas"), count: personalizadaProducts.length }] : []),
                                    ] as { key: "all" | "fixed" | "indexed" | "personalizadas"; label: string; count: number }[]).map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setElecTab(tab.key)}
                                            disabled={tab.count === 0}
                                            style={{
                                                padding: "10px 20px",
                                                fontSize: 13,
                                                fontWeight: elecTab === tab.key ? 600 : 400,
                                                background: "none",
                                                border: "none",
                                                cursor: tab.count === 0 ? "not-allowed" : "pointer",
                                                color: tab.count === 0
                                                    ? "#d1d5db"
                                                    : elecTab === tab.key
                                                        ? uiColors.text
                                                        : uiColors.textMuted,
                                                borderBottom: elecTab === tab.key ? "3px solid var(--scheme-brand-600)" : "3px solid transparent",
                                                marginBottom: -2,
                                                opacity: tab.count === 0 ? 0.4 : 1,
                                            }}
                                        >
                                            {tab.label} <span style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: elecTab === tab.key ? "var(--scheme-brand-600-15)" : uiColors.surfaceMuted,
                                                color: elecTab === tab.key ? "var(--scheme-brand-300)" : uiColors.textMuted,
                                                padding: "2px 6px",
                                                borderRadius: 8,
                                                marginLeft: 6,
                                            }}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {displayProducts.length > 0 ? (
                                    <ProductTable
                                        products={displayProducts}
                                        facturaActual={facturaActual}
                                        selectedOffer={selectedOffer}
                                        onOfferClick={readOnly ? undefined : handleOfferClick}
                                        commodity="ELECTRICITY"
                                        bestProductKey={bestElecProduct.productKey}
                                    />
                                ) : (
                                    <div style={{ padding: 40, textAlign: "center", background: uiColors.surfaceRaised, borderRadius: 12, border: `1px solid ${uiColors.border}` }}>
                                        <div style={{ fontSize: 14, color: uiColors.textMuted }}>
                                            {t("simulationOffersCards", "noProductsAvailable")}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Gas section */}
                    {hasGas && (() => {
                        const gasProducts = [...results.gas!].sort((a, b) => b.ahorro - a.ahorro);
                        const fixedProducts = gasProducts.filter(p => p.pricingType === "FIXED");
                        const indexedProducts = gasProducts.filter(p => p.pricingType === "INDEXED" && p.productKey !== "GAS_PERSONALIZADA_INDEX");
                        const personalizadaProducts = gasProducts.filter(p => p.productKey === "GAS_PERSONALIZADA_INDEX");
                        const hasPersonalizadas = personalizadaProducts.length > 0;

                        // Find the best offer (highest savings) across all gas products
                        const bestGasProduct = gasProducts.reduce((best, current) =>
                            current.ahorro > best.ahorro ? current : best
                            , gasProducts[0]);

                        const displayProducts = gasTab === "all"
                            ? gasProducts
                            : gasTab === "fixed"
                                ? fixedProducts
                                : gasTab === "personalizadas"
                                    ? personalizadaProducts
                                    : indexedProducts;

                        return (
                            <div>
                                <h2 style={{
                                    margin: "0 0 16px 0",
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: uiColors.text,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}>
                                    <span>🔥</span>
                                    <span>{t("simulationOffersCards", "gasOffers")}</span>
                                    <span style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: uiColors.textMuted,
                                        background: uiColors.surfaceMuted,
                                        padding: "4px 12px",
                                        borderRadius: 12,
                                    }}>
                                        {t("simulationOffersCards", "productsCount", { count: gasProducts.length })}
                                    </span>
                                </h2>

                                {/* Tabs */}
                                <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${uiColors.border}`, marginBottom: 16 }}>
                                    {([
                                        { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: gasProducts.length },
                                        { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                        { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                        ...(hasPersonalizadas ? [{ key: "personalizadas" as const, label: t("simulationOffersCards", "tabPersonalizadas"), count: personalizadaProducts.length }] : []),
                                    ] as { key: "all" | "fixed" | "indexed" | "personalizadas"; label: string; count: number }[]).map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setGasTab(tab.key)}
                                            disabled={tab.count === 0}
                                            style={{
                                                padding: "10px 20px",
                                                fontSize: 13,
                                                fontWeight: gasTab === tab.key ? 600 : 400,
                                                background: "none",
                                                border: "none",
                                                cursor: tab.count === 0 ? "not-allowed" : "pointer",
                                                color: tab.count === 0
                                                    ? "#d1d5db"
                                                    : gasTab === tab.key
                                                        ? uiColors.text
                                                        : uiColors.textMuted,
                                                borderBottom: gasTab === tab.key ? "3px solid var(--scheme-brand-600)" : "3px solid transparent",
                                                marginBottom: -2,
                                                opacity: tab.count === 0 ? 0.4 : 1,
                                            }}
                                        >
                                            {tab.label} <span style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: gasTab === tab.key ? "var(--scheme-brand-600-15)" : uiColors.surfaceMuted,
                                                color: gasTab === tab.key ? "var(--scheme-brand-300)" : uiColors.textMuted,
                                                padding: "2px 6px",
                                                borderRadius: 8,
                                                marginLeft: 6,
                                            }}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {displayProducts.length > 0 ? (
                                    <ProductTable
                                        products={displayProducts}
                                        facturaActual={facturaActual}
                                        selectedOffer={selectedOffer}
                                        onOfferClick={readOnly ? undefined : handleOfferClick}
                                        commodity="GAS"
                                        bestProductKey={bestGasProduct.productKey}
                                    />
                                ) : (
                                    <div style={{ padding: 40, textAlign: "center", background: uiColors.surfaceRaised, borderRadius: 12, border: `1px solid ${uiColors.border}` }}>
                                        <div style={{ fontSize: 14, color: uiColors.textMuted }}>
                                            {t("simulationOffersCards", "noProductsAvailable")}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Footer info */}
                    <div style={{
                        marginTop: 32,
                        padding: 16,
                        background: uiColors.surfaceRaised,
                        borderRadius: 8,
                        border: `1px solid ${uiColors.border}`,
                        fontSize: 11,
                        color: uiColors.textMuted,
                        fontWeight: 500,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <div>
                            {t("simulationOffersCards", "calculatedAt")} {new Date(results.calculatedAt).toLocaleString()}
                        </div>
                        <div>
                            {t("simulationOffersCards", "priceBase")} <span style={{ color: uiColors.text, fontWeight: 700, fontFamily: "monospace" }}>
                                {results.baseValueSetId.slice(0, 12)}…
                            </span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Confirmation Modal */}
            {pendingOffer && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                }} onClick={handleCancelSelection}>
                    <div style={{
                        background: uiColors.surface,
                        borderRadius: 16,
                        padding: 32,
                        maxWidth: 500,
                        width: "90%",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.28), 0 10px 10px -5px rgba(0, 0, 0, 0.16)",
                        border: `1px solid ${uiColors.border}`,
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{
                            margin: "0 0 16px 0",
                            fontSize: 20,
                            fontWeight: 700,
                            color: uiColors.text,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}>
                            <span style={{ fontSize: 24 }}>✓</span>
                            <span>{t("simulationOffersCards", "confirmTitle")}</span>
                        </h3>

                        <div style={{
                            padding: 20,
                            background: "linear-gradient(135deg, var(--scheme-brand-600-15) 0%, var(--scheme-accent-600-15) 100%)",
                            borderRadius: 12,
                            border: "2px solid var(--scheme-brand-600)",
                            marginBottom: 24,
                        }}>
                            <div style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: uiColors.text,
                                marginBottom: 8,
                            }}>
                                {pendingOffer.product.productLabel}
                            </div>
                            <div style={{
                                display: "flex",
                                gap: 8,
                                marginBottom: 12,
                            }}>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: uiColors.textMuted,
                                    background: uiColors.surface,
                                    padding: "4px 10px",
                                    borderRadius: 12,
                                    textTransform: "uppercase",
                                }}>
                                    {pendingOffer.commodity === "ELECTRICITY" ? t("simulationOffersCards", "confirmElectricity") : t("simulationOffersCards", "confirmGas")}
                                </span>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: uiColors.textMuted,
                                    background: uiColors.surface,
                                    padding: "4px 10px",
                                    borderRadius: 12,
                                    textTransform: "uppercase",
                                }}>
                                    {pendingOffer.product.pricingType === "FIXED" ? t("simulationOffersCards", "confirmFixed") : t("simulationOffersCards", "confirmIndexed")}
                                </span>
                            </div>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                                fontSize: 13,
                            }}>
                                <div>
                                    <div style={{ color: uiColors.textMuted, marginBottom: 4 }}>{t("simulationOffersCards", "colTotalInvoice")}</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: uiColors.text }}>
                                        {fmt(pendingOffer.product.totalFactura)} €
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: uiColors.textMuted, marginBottom: 4 }}>{t("simulationOffersCards", "colMonthlySavings")}</div>
                                    <div style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: pendingOffer.product.ahorro > 0 ? "#10b981" : "#ef4444",
                                    }}>
                                        {pendingOffer.product.ahorro > 0 ? "+" : ""}{fmt(pendingOffer.product.ahorro)} €
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p style={{
                            margin: "0 0 24px 0",
                            fontSize: 14,
                            color: uiColors.textMuted,
                            lineHeight: 1.6,
                        }}>
                            {t("simulationOffersCards", "confirmDescription")}
                        </p>

                        <div style={{
                            display: "flex",
                            gap: 12,
                            justifyContent: "flex-end",
                        }}>
                            <button
                                type="button"
                                onClick={handleCancelSelection}
                                disabled={saving}
                                style={{
                                    padding: "12px 24px",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    background: uiColors.surface,
                                    border: `2px solid ${uiColors.borderStrong}`,
                                    borderRadius: 8,
                                    color: uiColors.textMuted,
                                    cursor: saving ? "not-allowed" : "pointer",
                                    opacity: saving ? 0.5 : 1,
                                }}
                            >
                                {t("simulationOffersCards", "confirmCancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSelection}
                                disabled={saving}
                                style={{
                                    padding: "12px 24px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    background: saving
                                        ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                                        : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                    border: "none",
                                    borderRadius: 8,
                                    color: "#fff",
                                    cursor: saving ? "not-allowed" : "pointer",
                                    boxShadow: saving ? "none" : "0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                                }}
                            >
                                {saving ? t("simulationOffersCards", "confirmSaving") : t("simulationOffersCards", "confirmButton")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
