"use client";

import { useState } from "react";
import type { SimulationResults, ProductResult } from "@/domain/types";
import { useI18n } from "../../../../src/lib/i18n-context";

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
}

interface PendingOffer {
    product: ProductResult;
    commodity: "ELECTRICITY" | "GAS";
}

function fmt(n: number, digits = 2): string {
    return n.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function ProductTable({ products, facturaActual, selectedOffer, onOfferClick, commodity, bestProductKey }: {
    products: ProductResult[];
    facturaActual?: number;
    selectedOffer?: { productKey: string; commodity: "ELECTRICITY" | "GAS" };
    onOfferClick?: (product: ProductResult, commodity: "ELECTRICITY" | "GAS") => void;
    commodity: "ELECTRICITY" | "GAS";
    bestProductKey?: string;
}) {
    const { t } = useI18n();
    return (
        <div style={{
            background: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
        }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ background: "linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)" }}>
                        {onOfferClick && (
                            <th style={{
                                padding: "14px 16px",
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#6b7280",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                borderBottom: "2px solid #e5e7eb",
                                width: "80px",
                            }}>
                                {t("simulationOffersCards", "colSelect")}
                            </th>
                        )}
                        <th style={{
                            padding: "14px 16px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "2px solid #e5e7eb",
                        }}>
                            {t("simulationOffersCards", "colProduct")}
                        </th>
                        <th style={{
                            padding: "14px 16px",
                            textAlign: "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "2px solid #e5e7eb",
                        }}>
                            {t("simulationOffersCards", "colTotalInvoice")}
                        </th>
                        <th style={{
                            padding: "14px 16px",
                            textAlign: "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "2px solid #e5e7eb",
                        }}>
                            {t("simulationOffersCards", "colMonthlySavings")}
                        </th>
                        <th style={{
                            padding: "14px 16px",
                            textAlign: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "2px solid #e5e7eb",
                        }}>
                            {t("simulationOffersCards", "colPctDifference")}
                        </th>
                        <th style={{
                            padding: "14px 16px",
                            textAlign: "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "2px solid #e5e7eb",
                        }}>
                            {t("simulationOffersCards", "colAnnualSavings")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((product, idx) => {
                        const isTop = product.productKey === bestProductKey && product.ahorro > 0;
                        const isSelected = selectedOffer?.productKey === product.productKey && selectedOffer?.commodity === commodity;
                        const savingsColor = product.ahorro > 0 ? "#10b981" : product.ahorro < 0 ? "#ef4444" : "#6b7280";
                        const bgColor = isSelected
                            ? "linear-gradient(90deg, #e0e7ff 0%, #f5f3ff 100%)"
                            : isTop
                                ? "linear-gradient(90deg, #d1fae5 0%, #ecfdf5 100%)"
                                : idx % 2 === 0 ? "#ffffff" : "#f9fafb";

                        return (
                            <tr key={product.productKey + product.pricingType} style={{
                                background: bgColor,
                                borderLeft: isSelected ? "4px solid #6366f1" : isTop ? "4px solid #10b981" : "none",
                            }}>
                                {onOfferClick && (
                                    <td style={{
                                        padding: "14px 16px",
                                        textAlign: "center",
                                        borderBottom: "1px solid #f3f4f6",
                                    }}>
                                        <input
                                            type="radio"
                                            name={`select-offer-${commodity}`}
                                            checked={isSelected}
                                            onChange={() => onOfferClick(product, commodity)}
                                            style={{
                                                width: 18,
                                                height: 18,
                                                cursor: "pointer",
                                                accentColor: "#6366f1",
                                            }}
                                        />
                                    </td>
                                )}
                                <td style={{
                                    padding: "14px 16px",
                                    borderBottom: "1px solid #f3f4f6",
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
                                                color: "#111827",
                                                marginBottom: 3,
                                            }}>
                                                {product.productLabel}
                                            </div>
                                            <div style={{
                                                display: "inline-block",
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                background: "#f3f4f6",
                                                padding: "2px 8px",
                                                borderRadius: 10,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.03em",
                                            }}>
                                                {product.pricingType === "FIXED" ? t("simulationOffersCards", "pricingFixed") : t("simulationOffersCards", "pricingIndexed")}
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
                                    color: "#111827",
                                    borderBottom: "1px solid #f3f4f6",
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
                                    borderBottom: "1px solid #f3f4f6",
                                }}>
                                    {product.ahorro > 0 ? "+" : ""}{fmt(product.ahorro)} €
                                </td>
                                <td style={{
                                    padding: "14px 16px",
                                    textAlign: "center",
                                    borderBottom: "1px solid #f3f4f6",
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
                                    color: "#4b5563",
                                    borderBottom: "1px solid #f3f4f6",
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
}) {
    const { t } = useI18n();
    const [expandedSection, setExpandedSection] = useState<"energy" | "power" | "omie" | null>(null);

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
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)",
            border: "1px solid #e5e7eb",
        }}>
            <h3 style={{
                margin: "0 0 12px 0",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
            }}>
                {t("simulationOffersCards", "sectionTitle")}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tarifaAcceso && (
                    <div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
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
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
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
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
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
            </div>

            {/* Editable periods */}
            {energyPeriods && Object.keys(energyPeriods).length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <button
                        onClick={() => setExpandedSection(expandedSection === "energy" ? null : "energy")}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: expandedSection === "energy" ? "#f3f4f6" : "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            color: "#374151",
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
                        <div style={{ marginTop: 8, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                            {Object.entries(energyPeriods).map(([period, value]) => (
                                <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", minWidth: 30 }}>
                                        {period}:
                                    </label>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => handleInputChange("energy", period, e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: "6px 10px",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 6,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "#111827",
                                            background: "#fff",
                                        }}
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
                            background: expandedSection === "power" ? "#f3f4f6" : "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            color: "#374151",
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
                        <div style={{ marginTop: 8, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                            {Object.entries(powerPeriods).map(([period, value]) => (
                                <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", minWidth: 30 }}>
                                        {period}:
                                    </label>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => handleInputChange("power", period, e.target.value)}
                                        step="0.01"
                                        style={{
                                            flex: 1,
                                            padding: "6px 10px",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 6,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "#111827",
                                            background: "#fff",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {omiePeriods && Object.keys(omiePeriods).length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <button
                        onClick={() => setExpandedSection(expandedSection === "omie" ? null : "omie")}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: expandedSection === "omie" ? "#f3f4f6" : "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            color: "#374151",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "all 0.2s",
                        }}
                    >
                        <span>{t("simulationOffersCards", "btnOmie")}</span>
                        <span>{expandedSection === "omie" ? "▲" : "▼"}</span>
                    </button>
                    {expandedSection === "omie" && (
                        <div style={{ marginTop: 8, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                            {Object.entries(omiePeriods).map(([period, value]) => (
                                <div key={period} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", minWidth: 30 }}>
                                        {period}:
                                    </label>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => handleInputChange("omie", period, e.target.value)}
                                        step="0.001"
                                        style={{
                                            flex: 1,
                                            padding: "6px 10px",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 6,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "#111827",
                                            background: "#fff",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "2px solid #e5e7eb",
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
                color: "#9ca3af",
                textAlign: "center",
                fontWeight: 500,
            }}>
                {t("simulationOffersCards", "recalculateHint")}
            </div>
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
}: SimulationResultsCardsProps) {
    const { t } = useI18n();
    const [elecTab, setElecTab] = useState<"all" | "fixed" | "indexed">("all");
    const [gasTab, setGasTab] = useState<"all" | "fixed" | "indexed">("all");
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
            <div style={{ padding: 60, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📊</div>
                <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 8, fontWeight: 600 }}>
                    {t("simulationOffersCards", "noResults")}
                </div>
                <div style={{ fontSize: 14, color: "#9ca3af" }}>
                    {t("simulationOffersCards", "noResultsHint")}
                </div>
            </div>
        );
    }

    return (
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
            />

            {/* Right side - Product tables */}
            <div>
                {/* Electricity section */}
                {hasElec && (() => {
                    const elecProducts = results.electricity!;
                    const fixedProducts = elecProducts.filter(p => p.pricingType === "FIXED");
                    const indexedProducts = elecProducts.filter(p => p.pricingType === "INDEXED");

                    // Find the best offer (highest savings) across all electricity products
                    const bestElecProduct = elecProducts.reduce((best, current) =>
                        current.ahorro > best.ahorro ? current : best
                        , elecProducts[0]);

                    const displayProducts = elecTab === "all"
                        ? elecProducts
                        : elecTab === "fixed"
                            ? fixedProducts
                            : indexedProducts;

                    return (
                        <div style={{ marginBottom: 40 }}>
                            <h2 style={{
                                margin: "0 0 16px 0",
                                fontSize: 20,
                                fontWeight: 700,
                                color: "#111827",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}>
                                <span>⚡</span>
                                <span>{t("simulationOffersCards", "electricityOffers")}</span>
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#6b7280",
                                    background: "#f3f4f6",
                                    padding: "4px 12px",
                                    borderRadius: 12,
                                }}>
                                    {t("simulationOffersCards", "productsCount", { count: elecProducts.length })}
                                </span>
                            </h2>

                            {/* Tabs */}
                            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
                                {[
                                    { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: elecProducts.length },
                                    { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                    { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                ].map((tab) => (
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
                                                    ? "#111827"
                                                    : "#6b7280",
                                            borderBottom: elecTab === tab.key ? "3px solid #4ade80" : "3px solid transparent",
                                            marginBottom: -2,
                                            opacity: tab.count === 0 ? 0.4 : 1,
                                        }}
                                    >
                                        {tab.label} <span style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: elecTab === tab.key ? "#e0e7ff" : "#f3f4f6",
                                            color: elecTab === tab.key ? "#4338ca" : "#6b7280",
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
                                    onOfferClick={handleOfferClick}
                                    commodity="ELECTRICITY"
                                    bestProductKey={bestElecProduct.productKey}
                                />
                            ) : (
                                <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
                                    <div style={{ fontSize: 14, color: "#6b7280" }}>
                                        {t("simulationOffersCards", "noProductsAvailable")}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Gas section */}
                {hasGas && (() => {
                    const gasProducts = results.gas!;
                    const fixedProducts = gasProducts.filter(p => p.pricingType === "FIXED");
                    const indexedProducts = gasProducts.filter(p => p.pricingType === "INDEXED");

                    // Find the best offer (highest savings) across all gas products
                    const bestGasProduct = gasProducts.reduce((best, current) =>
                        current.ahorro > best.ahorro ? current : best
                        , gasProducts[0]);

                    const displayProducts = gasTab === "all"
                        ? gasProducts
                        : gasTab === "fixed"
                            ? fixedProducts
                            : indexedProducts;

                    return (
                        <div>
                            <h2 style={{
                                margin: "0 0 16px 0",
                                fontSize: 20,
                                fontWeight: 700,
                                color: "#111827",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}>
                                <span>🔥</span>
                                <span>{t("simulationOffersCards", "gasOffers")}</span>
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#6b7280",
                                    background: "#f3f4f6",
                                    padding: "4px 12px",
                                    borderRadius: 12,
                                }}>
                                    {t("simulationOffersCards", "productsCount", { count: gasProducts.length })}
                                </span>
                            </h2>

                            {/* Tabs */}
                            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
                                {[
                                    { key: "all" as const, label: t("simulationOffersCards", "tabAll"), count: gasProducts.length },
                                    { key: "fixed" as const, label: t("simulationOffersCards", "tabFixed"), count: fixedProducts.length },
                                    { key: "indexed" as const, label: t("simulationOffersCards", "tabIndexed"), count: indexedProducts.length },
                                ].map((tab) => (
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
                                                    ? "#111827"
                                                    : "#6b7280",
                                            borderBottom: gasTab === tab.key ? "3px solid #4ade80" : "3px solid transparent",
                                            marginBottom: -2,
                                            opacity: tab.count === 0 ? 0.4 : 1,
                                        }}
                                    >
                                        {tab.label} <span style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: gasTab === tab.key ? "#e0e7ff" : "#f3f4f6",
                                            color: gasTab === tab.key ? "#4338ca" : "#6b7280",
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
                                    onOfferClick={handleOfferClick}
                                    commodity="GAS"
                                    bestProductKey={bestGasProduct.productKey}
                                />
                            ) : (
                                <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
                                    <div style={{ fontSize: 14, color: "#6b7280" }}>
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
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                    color: "#6b7280",
                    fontWeight: 500,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <div>
                        {t("simulationOffersCards", "calculatedAt")} {new Date(results.calculatedAt).toLocaleString()}
                    </div>
                    <div>
                        {t("simulationOffersCards", "priceBase")} <span style={{ color: "#374151", fontWeight: 700, fontFamily: "monospace" }}>
                            {results.baseValueSetId.slice(0, 12)}…
                        </span>
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
                        background: "#fff",
                        borderRadius: 16,
                        padding: 32,
                        maxWidth: 500,
                        width: "90%",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{
                            margin: "0 0 16px 0",
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#111827",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}>
                            <span style={{ fontSize: 24 }}>✓</span>
                            <span>{t("simulationOffersCards", "confirmTitle")}</span>
                        </h3>

                        <div style={{
                            padding: 20,
                            background: "linear-gradient(135deg, #e0e7ff 0%, #f5f3ff 100%)",
                            borderRadius: 12,
                            border: "2px solid #6366f1",
                            marginBottom: 24,
                        }}>
                            <div style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#111827",
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
                                    color: "#6b7280",
                                    background: "#fff",
                                    padding: "4px 10px",
                                    borderRadius: 12,
                                    textTransform: "uppercase",
                                }}>
                                    {pendingOffer.commodity === "ELECTRICITY" ? t("simulationOffersCards", "confirmElectricity") : t("simulationOffersCards", "confirmGas")}
                                </span>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#6b7280",
                                    background: "#fff",
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
                                    <div style={{ color: "#6b7280", marginBottom: 4 }}>{t("simulationOffersCards", "colTotalInvoice")}</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                                        {fmt(pendingOffer.product.totalFactura)} €
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: "#6b7280", marginBottom: 4 }}>{t("simulationOffersCards", "colMonthlySavings")}</div>
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
                            color: "#6b7280",
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
                                    background: "#fff",
                                    border: "2px solid #d1d5db",
                                    borderRadius: 8,
                                    color: "#6b7280",
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
