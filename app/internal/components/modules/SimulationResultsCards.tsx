"use client";

import React, { useState } from "react";
import type { SimulationResults, ProductResult } from "@/domain/types";
import { useI18n } from "../../../../src/lib/i18n-context";
import { FormSelect } from "../ui/FormSelect";
import { CurrencyInput } from "../ui/CurrencyInput";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { alpha, useTheme } from "@mui/material/styles";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Radio, Stack, Tab, Tabs, Typography } from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import SavingsIcon from "@mui/icons-material/Savings";
import TuneIcon from "@mui/icons-material/Tune";

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
    onClearOffer?: () => Promise<void>;
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
    elecPersonalizadaFijoPeriods?: { preciosPotencia: Record<string, number>; preciosEnergia: Record<string, number> };
    onUpdateElecPersonalizadaFijo?: (field: "preciosPotencia" | "preciosEnergia", period: string, value: number) => void;
    gasPersonalizadaFijo?: { terminoDia: number; terminoVariable: number };
    onUpdateGasPersonalizadaFijo?: (field: "terminoDia" | "terminoVariable", value: number) => void;
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

const offerTabIcon = (key: "all" | "fixed" | "indexed" | "personalizadas") => {
    if (key === "fixed") return <TuneIcon fontSize="small" />;
    if (key === "indexed") return <BarChartIcon fontSize="small" />;
    if (key === "personalizadas") return <SavingsIcon fontSize="small" />;
    return undefined;
};

const isPersonalizedProduct = (product: ProductResult): boolean =>
    product.productKey === "PERSONALIZADA_INDEX" ||
    product.productKey === "PERSONALIZADA_OMIE_B" ||
    product.productKey === "GAS_PERSONALIZADA_INDEX" ||
    product.productKey === "PERSONALIZADA_FIJO" ||
    product.productKey === "GAS_PERSONALIZADA_FIJO";

const offerKind = (product: ProductResult): "personalized" | "fixed" | "indexed" => {
    if (isPersonalizedProduct(product)) return "personalized";
    return product.pricingType === "FIXED" ? "fixed" : "indexed";
};

const offerKindIcon = (kind: "personalized" | "fixed" | "indexed") => {
    if (kind === "personalized") return <SavingsIcon />;
    if (kind === "fixed") return <TuneIcon />;
    return <BarChartIcon />;
};

function ProductTable({ products, facturaActual, selectedOffer, onOfferClick, commodity, bestProductKey }: {
    products: ProductResult[];
    facturaActual?: number;
    selectedOffer?: { productKey: string; commodity: "ELECTRICITY" | "GAS" };
    onOfferClick?: (product: ProductResult, commodity: "ELECTRICITY" | "GAS") => void;
    commodity: "ELECTRICITY" | "GAS";
    bestProductKey?: string;
}) {
    const theme = useTheme();
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
            <KeyboardArrowUpIcon sx={{ fontSize: 12, lineHeight: 1, color: sortCol === col && sortDir === "asc" ? uiColors.text : uiColors.textMuted }} />
            <KeyboardArrowDownIcon sx={{ fontSize: 12, mt: "-6px", color: sortCol === col && sortDir === "desc" ? uiColors.text : uiColors.textMuted }} />
        </span>
    );

    const thSortStyle = (col: SortCol, align: "left" | "right" | "center" = "right"): React.CSSProperties => ({
        padding: "9px 12px",
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
                        const kind = offerKind(product);
                        const bgColor = isSelected
                            ? alpha(theme.palette.primary.main, 0.12)
                            : isTop
                                ? alpha(theme.palette.success.main, 0.08)
                                : idx % 2 === 0 ? uiColors.surface : uiColors.surfaceRaised;

                        return (
                            <tr key={product.productKey + product.pricingType} style={{
                                background: bgColor,
                                borderLeft: isSelected ? `4px solid ${theme.palette.primary.main}` : isTop ? `4px solid ${theme.palette.success.main}` : "none",
                            }}>
                                {onOfferClick && (
                                    <td style={{
                                        padding: "7px 12px",
                                        textAlign: "center",
                                        borderBottom: `1px solid ${uiColors.border}`,
                                        width: 64,
                                    }}>
                                        <Radio
                                            checked={isSelected}
                                            onClick={() => onOfferClick(product, commodity)}
                                            size="small"
                                            sx={{ p: 0.5 }}
                                            inputProps={{ "aria-label": product.productLabel }}
                                        />
                                    </td>
                                )}
                                <td style={{
                                    padding: "7px 12px",
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}>
                                        <div>
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: uiColors.text,
                                                marginBottom: 2,
                                            }}>
                                                {product.productKey === "PERSONALIZADA_INDEX"
                                                    ? t("simulationOffersCards", "productLabelPersonalizadaIndex")
                                                    : product.productKey === "PERSONALIZADA_OMIE_B"
                                                        ? t("simulationOffersCards", "productLabelPersonalizadaOmieB")
                                                        : product.productKey === "GAS_PERSONALIZADA_INDEX"
                                                            ? t("simulationOffersCards", "productLabelGasPersonalizadaIndex")
                                                            : product.productLabel}
                                            </div>
                                            <Chip
                                                size="small"
                                                variant="filled"
                                                icon={offerKindIcon(kind)}
                                                label={kind === "personalized"
                                                    ? t("simulationOffersCards", "pricingPersonalizada")
                                                    : kind === "fixed"
                                                        ? t("simulationOffersCards", "pricingFixed")
                                                        : t("simulationOffersCards", "pricingIndexed")}
                                                sx={{ height: 18, fontSize: 10, fontWeight: 600, color: "text.secondary", bgcolor: "action.hover" }}
                                            />
                                        </div>
                                        {isTop && (
                                            <Chip size="small" color="success" label={t("simulationOffersCards", "badgeBestOffer")} sx={{ height: 22, fontSize: 10, fontWeight: 700 }} />
                                        )}
                                        {isSelected && (
                                            <Chip size="small" color="primary" label={t("simulationOffersCards", "badgeSelected")} sx={{ height: 22, fontSize: 10, fontWeight: 700 }} />
                                        )}
                                    </div>
                                </td>
                                <td style={{
                                    padding: "7px 12px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: uiColors.text,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {fmt(product.totalFactura)} €
                                </td>
                                <td style={{
                                    padding: "7px 12px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: savingsColor,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {product.ahorro > 0 ? "" : ""}{fmt(product.ahorro)} €
                                </td>
                                <td style={{
                                    padding: "7px 12px",
                                    textAlign: "center",
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    <div style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "4px 10px",
                                        background: product.ahorro > 0
                                            ? "rgba(16, 185, 129, 0.1)"
                                            : product.ahorro < 0
                                                ? "rgba(239, 68, 68, 0.1)"
                                                : "rgba(107, 114, 128, 0.1)",
                                        borderRadius: 16,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: savingsColor,
                                    }}>
                                        {product.ahorro > 0 ? "↓" : product.ahorro < 0 ? "↑" : "—"}
                                        {product.pctAhorro > 0 ? "" : ""}{fmt(product.pctAhorro, 1)}%
                                    </div>
                                </td>
                                <td style={{
                                    padding: "7px 12px",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: uiColors.textSoft,
                                    borderBottom: `1px solid ${uiColors.border}`,
                                }}>
                                    {product.ahorro > 0 ? "" : ""}{fmt(product.ahorroAnual)} €
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
    elecPersonalizadaFijoPeriods,
    onUpdateElecPersonalizadaFijo,
    gasPersonalizadaFijo,
    onUpdateGasPersonalizadaFijo,
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
    elecPersonalizadaFijoPeriods?: { preciosPotencia: Record<string, number>; preciosEnergia: Record<string, number> };
    onUpdateElecPersonalizadaFijo?: (field: "preciosPotencia" | "preciosEnergia", period: string, value: number) => void;
    gasPersonalizadaFijo?: { terminoDia: number; terminoVariable: number };
    onUpdateGasPersonalizadaFijo?: (field: "terminoDia" | "terminoVariable", value: number) => void;
}) {
    const { t } = useI18n();
    const { preferences: { numberFormat } } = useUserPreferences();

    const handleInputChange = (type: "energy" | "power" | "omie", period: string, value: string) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && onUpdatePeriod) {
            onUpdatePeriod(type, period, numValue);
        }
    };

    const AccordionSection = ({
        title,
        children,
    }: {
        title: React.ReactNode;
        children: React.ReactNode;
    }) => (
        <Accordion
            disableGutters
            elevation={0}
            sx={{
                mt: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "6px !important",
                bgcolor: "transparent",
                "&::before": { display: "none" },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{
                    minHeight: 36,
                    px: 1.25,
                    "&.Mui-expanded": { minHeight: 36 },
                    "& .MuiAccordionSummary-content": {
                        my: 0.75,
                        fontSize: 12,
                        fontWeight: 700,
                    },
                }}
            >
                {title}
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
                {children}
            </AccordionDetails>
        </Accordion>
    );

    return (
        <div style={{
            position: "relative",
            height: "100%",
            overflowY: "auto",
            boxSizing: "border-box",
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
                    <AccordionSection title={t("simulationOffersCards", "btnConsumption")}>
                            <div>
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
                    </AccordionSection>
                )}

                {powerPeriods && Object.keys(powerPeriods).length > 0 && (
                    <AccordionSection title={t("simulationOffersCards", "btnPower")}>
                            <div>
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
                    </AccordionSection>
                )}

                {personalizadaIndexPeriods && (Object.keys(personalizadaIndexPeriods.margenEnergia).length > 0 || Object.keys(personalizadaIndexPeriods.margenPotencia).length > 0) && (
                    <AccordionSection title={t("simulationForm", "sectionPersonalizadaIndex")}>
                            <div>
                                {Object.keys(personalizadaIndexPeriods.margenPotencia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaIndexMargenPotenciaLabel")}</div>
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
                                {Object.keys(personalizadaIndexPeriods.margenEnergia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaIndexMargenEnergiaLabel")}</div>
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
                            </div>
                    </AccordionSection>
                )}

                {personalizadaOmieBPeriods && (Object.keys(personalizadaOmieBPeriods.terminoB).length > 0 || Object.keys(personalizadaOmieBPeriods.margenPotencia).length > 0) && (
                    <AccordionSection title={t("simulationForm", "sectionPersonalizadaOmieB")}>
                            <div>
                                {Object.keys(personalizadaOmieBPeriods.margenPotencia).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaOmieBMargenPotenciaLabel")}</div>
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
                                {Object.keys(personalizadaOmieBPeriods.terminoB).length > 0 && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>{t("simulationForm", "personalizadaOmieBTerminoBLabel")}</div>
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
                            </div>
                    </AccordionSection>
                )}

                {gasPersonalizadaIndexMargen !== undefined && (
                    <AccordionSection title={t("simulationForm", "sectionGasPersonalizadaIndex")}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>{t("simulationForm", "gasPersonalizadaIndexMargenLabel")}</div>
                                <CurrencyInput
                                    key={`gas-personalizada-index-${numberFormat}`}
                                    value={gasPersonalizadaIndexMargen}
                                    onChange={(v) => { if (!isNaN(v)) onUpdateGasPersonalizadaIndex?.(v); }}
                                    currencySymbol=""
                                    decimals={5}
                                    numberFormat={numberFormat}
                                />
                            </div>
                    </AccordionSection>
                )}

                {elecPersonalizadaFijoPeriods && (
                    <AccordionSection title="Personalized Fixed (custom)">
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Término Potencia (€/kWdia)</div>
                                {Object.entries(elecPersonalizadaFijoPeriods.preciosPotencia).map(([period, value]) => (
                                    <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                        <CurrencyInput
                                            value={value}
                                            onChange={(v) => { if (!isNaN(v)) onUpdateElecPersonalizadaFijo?.("preciosPotencia", period, v); }}
                                            currencySymbol=""
                                            decimals={4}
                                        />
                                    </div>
                                ))}
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>Término Energía (€/kWh)</div>
                                {Object.entries(elecPersonalizadaFijoPeriods.preciosEnergia).map(([period, value]) => (
                                    <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: uiColors.textMuted, minWidth: 30 }}>{period}:</label>
                                        <CurrencyInput
                                            value={value}
                                            onChange={(v) => { if (!isNaN(v)) onUpdateElecPersonalizadaFijo?.("preciosEnergia", period, v); }}
                                            currencySymbol=""
                                            decimals={4}
                                        />
                                    </div>
                                ))}
                            </div>
                    </AccordionSection>
                )}

                {gasPersonalizadaFijo !== undefined && (
                    <AccordionSection title="Personalized Fixed (custom)">
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Término Fijo (€/día)</div>
                                <CurrencyInput
                                    key={`gas-personalizada-fixed-day-${numberFormat}`}
                                    value={gasPersonalizadaFijo.terminoDia}
                                    onChange={(v) => { if (!isNaN(v)) onUpdateGasPersonalizadaFijo?.("terminoDia", v); }}
                                    currencySymbol=""
                                    decimals={4}
                                    numberFormat={numberFormat}
                                />
                                <div style={{ fontSize: 11, fontWeight: 700, color: uiColors.textMuted, marginBottom: 6, marginTop: 10, textTransform: "uppercase" }}>Término Variable (€/kWh)</div>
                                <CurrencyInput
                                    key={`gas-personalizada-fixed-variable-${numberFormat}`}
                                    value={gasPersonalizadaFijo.terminoVariable}
                                    onChange={(v) => { if (!isNaN(v)) onUpdateGasPersonalizadaFijo?.("terminoVariable", v); }}
                                    currencySymbol=""
                                    decimals={5}
                                    numberFormat={numberFormat}
                                />
                            </div>
                    </AccordionSection>
                )}

                <div style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: `2px solid ${uiColors.border}`,
                }}>
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        onClick={onRecalculate}
                        disabled={calculating}
                        startIcon={<RefreshIcon />}
                        sx={{ fontWeight: 700, textTransform: "none" }}
                    >
                        {calculating ? t("simulationOffersCards", "btnCalculating") : t("simulationOffersCards", "btnRecalculate")}
                    </Button>
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
    onClearOffer,
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
    elecPersonalizadaFijoPeriods,
    onUpdateElecPersonalizadaFijo,
    gasPersonalizadaFijo,
    onUpdateGasPersonalizadaFijo,
}: SimulationResultsCardsProps) {
    const { t, locale } = useI18n();
    const [elecTab, setElecTab] = useState<"all" | "fixed" | "indexed" | "personalizadas">("all");
    const [gasTab, setGasTab] = useState<"all" | "fixed" | "indexed" | "personalizadas">("all");
    const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null);
    const [saving, setSaving] = useState(false);

    const hasElec = (results.electricity?.length ?? 0) > 0;
    const hasGas = (results.gas?.length ?? 0) > 0;

    const handleOfferClick = async (product: ProductResult, commodity: "ELECTRICITY" | "GAS") => {
        const isSelected = selectedOffer?.productKey === product.productKey && selectedOffer?.commodity === commodity;
        if (isSelected && onClearOffer) {
            setSaving(true);
            try {
                await onClearOffer();
            } finally {
                setSaving(false);
            }
            return;
        }
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
                <BarChartIcon sx={{ fontSize: 48, mb: 2, color: "text.disabled" }} />
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
                gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr)",
                gap: 16,
                alignItems: "stretch",
                height: "calc(100vh - 180px)",
                minHeight: 520,
                overflow: "hidden",
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
                    elecPersonalizadaFijoPeriods={elecPersonalizadaFijoPeriods}
                    onUpdateElecPersonalizadaFijo={onUpdateElecPersonalizadaFijo}
                    gasPersonalizadaFijo={gasPersonalizadaFijo}
                    onUpdateGasPersonalizadaFijo={onUpdateGasPersonalizadaFijo}
                />

                {/* Right side - Product tables */}
                <div style={{ minHeight: 0, minWidth: 0, height: "100%", overflowY: "auto", paddingRight: 4 }}>
                    {/* Electricity section */}
                    {hasElec && (() => {
                        const elecProducts = [...results.electricity!].sort((a, b) => b.ahorro - a.ahorro);
                        const fixedProducts = elecProducts.filter(p => p.pricingType === "FIXED" && p.productKey !== "PERSONALIZADA_FIJO");
                        const indexedProducts = elecProducts.filter(p => p.pricingType === "INDEXED" && p.productKey !== "PERSONALIZADA_INDEX");
                        const personalizadaProducts = elecProducts.filter(p => p.productKey === "PERSONALIZADA_INDEX" || p.productKey === "PERSONALIZADA_OMIE_B" || p.productKey === "PERSONALIZADA_FIJO");
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
                                    <BoltIcon sx={{ color: "warning.main" }} />
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

                                <Tabs
                                    value={elecTab}
                                    onChange={(_, value: "all" | "fixed" | "indexed" | "personalizadas") => setElecTab(value)}
                                    textColor="primary"
                                    indicatorColor="primary"
                                    sx={{
                                        mb: 2,
                                        borderBottom: 1,
                                        borderColor: "divider",
                                        minHeight: 40,
                                        "& .MuiTab-root": {
                                            minHeight: 40,
                                            px: 2,
                                            py: 1,
                                            textTransform: "none",
                                            fontSize: 13,
                                            fontWeight: 600,
                                        },
                                    }}
                                >
                                    {([
                                        { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: elecProducts.length },
                                        { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                        { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                        ...(hasPersonalizadas ? [{ key: "personalizadas" as const, label: t("simulationOffersCards", "tabPersonalizadas"), count: personalizadaProducts.length }] : []),
                                    ] as { key: "all" | "fixed" | "indexed" | "personalizadas"; label: string; count: number }[]).map((tab) => (
                                        <Tab
                                            key={tab.key}
                                            value={tab.key}
                                            disabled={tab.count === 0}
                                            icon={offerTabIcon(tab.key)}
                                            iconPosition="start"
                                            label={
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    {tab.label}
                                                    <Chip size="small" label={tab.count} sx={{ height: 18, minWidth: 18, fontSize: 10, fontWeight: 700 }} />
                                                </span>
                                            }
                                        />
                                    ))}
                                </Tabs>

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
                        const fixedProducts = gasProducts.filter(p => p.pricingType === "FIXED" && p.productKey !== "GAS_PERSONALIZADA_FIJO");
                        const indexedProducts = gasProducts.filter(p => p.pricingType === "INDEXED" && p.productKey !== "GAS_PERSONALIZADA_INDEX");
                        const personalizadaProducts = gasProducts.filter(p => p.productKey === "GAS_PERSONALIZADA_INDEX" || p.productKey === "GAS_PERSONALIZADA_FIJO");
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
                                    <LocalFireDepartmentIcon sx={{ color: "error.main" }} />
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

                                <Tabs
                                    value={gasTab}
                                    onChange={(_, value: "all" | "fixed" | "indexed" | "personalizadas") => setGasTab(value)}
                                    textColor="primary"
                                    indicatorColor="primary"
                                    sx={{
                                        mb: 2,
                                        borderBottom: 1,
                                        borderColor: "divider",
                                        minHeight: 40,
                                        "& .MuiTab-root": {
                                            minHeight: 40,
                                            px: 2,
                                            py: 1,
                                            textTransform: "none",
                                            fontSize: 13,
                                            fontWeight: 600,
                                        },
                                    }}
                                >
                                    {([
                                        { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: gasProducts.length },
                                        { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                        { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                        ...(hasPersonalizadas ? [{ key: "personalizadas" as const, label: t("simulationOffersCards", "tabPersonalizadas"), count: personalizadaProducts.length }] : []),
                                    ] as { key: "all" | "fixed" | "indexed" | "personalizadas"; label: string; count: number }[]).map((tab) => (
                                        <Tab
                                            key={tab.key}
                                            value={tab.key}
                                            disabled={tab.count === 0}
                                            icon={offerTabIcon(tab.key)}
                                            iconPosition="start"
                                            label={
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    {tab.label}
                                                    <Chip size="small" label={tab.count} sx={{ height: 18, minWidth: 18, fontSize: 10, fontWeight: 700 }} />
                                                </span>
                                            }
                                        />
                                    ))}
                                </Tabs>

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
                <Dialog
                    open
                    onClose={saving ? undefined : handleCancelSelection}
                    maxWidth="xs"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 2,
                            border: 1,
                            borderColor: "divider",
                        },
                    }}
                >
                    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
                        <CheckCircleIcon color="primary" />
                        <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
                            {t("simulationOffersCards", "confirmTitle")}
                        </Typography>
                    </DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        <Box
                            sx={{
                                p: 2.5,
                                mb: 3,
                                borderRadius: 2,
                                border: 1,
                                borderColor: "primary.main",
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                                {pendingOffer.product.productLabel}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
                                <Chip
                                    size="small"
                                    icon={pendingOffer.commodity === "ELECTRICITY" ? <BoltIcon /> : <LocalFireDepartmentIcon />}
                                    label={pendingOffer.commodity === "ELECTRICITY" ? t("simulationOffersCards", "confirmElectricity") : t("simulationOffersCards", "confirmGas")}
                                />
                                <Chip
                                    size="small"
                                    icon={offerKindIcon(offerKind(pendingOffer.product))}
                                    label={offerKind(pendingOffer.product) === "personalized"
                                        ? t("simulationOffersCards", "pricingPersonalizada")
                                        : offerKind(pendingOffer.product) === "fixed"
                                            ? t("simulationOffersCards", "confirmFixed")
                                            : t("simulationOffersCards", "confirmIndexed")}
                                />
                            </Stack>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("simulationOffersCards", "colTotalInvoice")}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {fmt(pendingOffer.product.totalFactura)} €
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("simulationOffersCards", "colMonthlySavings")}
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 700,
                                            color: pendingOffer.product.ahorro > 0 ? "success.main" : "error.main",
                                        }}
                                    >
                                        {fmt(pendingOffer.product.ahorro)} €
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {t("simulationOffersCards", "confirmDescription")}
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                        <Button
                            variant="outlined"
                            onClick={handleCancelSelection}
                            disabled={saving}
                        >
                            {t("simulationOffersCards", "confirmCancel")}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleConfirmSelection}
                            disabled={saving}
                            startIcon={<CheckCircleIcon />}
                        >
                            {saving ? t("simulationOffersCards", "confirmSaving") : t("simulationOffersCards", "confirmButton")}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </div>
    );
}
