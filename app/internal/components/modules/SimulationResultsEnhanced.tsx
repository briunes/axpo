"use client";

import { useMemo } from "react";
import type { SimulationResults, ProductResult } from "@/domain/types";

interface SimulationResultsEnhancedProps {
    results: SimulationResults;
    facturaActual?: number;
    tarifaAcceso?: string;
    consumoAnual?: number;
    mes?: string;
}

function fmt(n: number, digits = 2): string {
    return n.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function ProductRow({ r, isHighlight }: { r: ProductResult; isHighlight?: boolean }) {
    const savingsColor = r.ahorro > 0 ? "#22c55e" : r.ahorro < 0 ? "#ef4444" : "#94a3b8";
    const pctColor = r.pctAhorro > 0 ? "#22c55e" : r.pctAhorro < 0 ? "#ef4444" : "#94a3b8";

    return (
        <tr style={{
            background: isHighlight ? "rgba(34, 197, 94, 0.08)" : "transparent",
            borderLeft: isHighlight ? "3px solid #22c55e" : "none",
        }}>
            <td style={{
                padding: "10px 14px",
                fontWeight: 600,
                fontSize: 13,
                color: "#e2e8f0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                {r.productLabel}
            </td>
            <td style={{
                padding: "10px 14px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontSize: 14,
                fontWeight: 600,
                color: "#f1f5f9",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                {fmt(r.totalFactura)} €
            </td>
            <td style={{
                padding: "10px 14px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontSize: 14,
                fontWeight: 600,
                color: savingsColor,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                {r.ahorro > 0 ? "+" : ""}{fmt(r.ahorro)} €
            </td>
            <td style={{
                padding: "10px 14px",
                textAlign: "right",
                fontSize: 13,
                fontWeight: 600,
                color: pctColor,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                {r.pctAhorro > 0 ? "+" : ""}{fmt(r.pctAhorro, 0)}%
            </td>
            <td style={{
                padding: "10px 14px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontSize: 13,
                color: "#cbd5e1",
                fontWeight: 500,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                {fmt(r.ahorroAnual, 2)} €
            </td>
            {isHighlight && (
                <td style={{
                    padding: "10px 14px",
                    textAlign: "right",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#22c55e",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                    MEJOR AHORRO
                </td>
            )}
        </tr>
    );
}

function GroupSection({
    title,
    items,
    bgColor,
    bestProduct,
}: {
    title: string;
    items: ProductResult[];
    bgColor: string;
    bestProduct?: ProductResult;
}) {
    if (items.length === 0) return null;

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{
                background: bgColor,
                padding: "8px 16px",
                borderRadius: "6px 6px 0 0",
                fontWeight: 700,
                fontSize: 13,
                color: "#0f172a",
                letterSpacing: "0.02em",
            }}>
                {title}
            </div>
            <div style={{
                background: "rgba(15, 23, 42, 0.4)",
                borderRadius: "0 0 6px 6px",
                overflow: "hidden",
            }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                        {items.map((r) => (
                            <ProductRow
                                key={r.productKey + r.pricingType}
                                r={r}
                                isHighlight={bestProduct && r.productKey === bestProduct.productKey && r.pricingType === bestProduct.pricingType}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SavingsChart({ items, facturaActual }: { items: ProductResult[]; facturaActual?: number }) {
    if (!facturaActual || items.length === 0) return null;

    const maxAbsSaving = Math.max(...items.map(r => Math.abs(r.ahorro)));
    const chartItems = items.slice(0, 10); // Top 10 for chart

    return (
        <div style={{
            background: "rgba(15, 23, 42, 0.8)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            border: "1px solid rgba(148, 163, 184, 0.2)",
        }}>
            <h4 style={{
                margin: "0 0 16px 0",
                fontSize: 14,
                fontWeight: 700,
                color: "#f1f5f9",
            }}>
                Comparación de ahorro (Top 10)
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chartItems.map((item) => {
                    const barWidth = Math.abs(item.ahorro / maxAbsSaving) * 100;
                    const isPositive = item.ahorro > 0;

                    return (
                        <div key={item.productKey + item.pricingType} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                minWidth: 120,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#f1f5f9",
                                textAlign: "right",
                                background: "rgba(15, 23, 42, 0.8)",
                                padding: "4px 8px",
                                borderRadius: 4,
                            }}>
                                {item.productLabel}
                            </div>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                    width: `${barWidth}%`,
                                    height: 24,
                                    background: isPositive
                                        ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                        : "linear-gradient(90deg, #ef4444, #dc2626)",
                                    borderRadius: 4,
                                    transition: "width 0.3s ease",
                                }} />
                                <span style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: isPositive ? "#22c55e" : "#ef4444",
                                    minWidth: 70,
                                }}>
                                    {isPositive ? "+" : ""}{fmt(item.ahorro)} €
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ComparisonStats({ items, facturaActual }: { items: ProductResult[]; facturaActual?: number }) {
    const stats = useMemo(() => {
        if (!items.length || !facturaActual) return null;

        const withSavings = items.filter(r => r.ahorro > 0);
        const withLosses = items.filter(r => r.ahorro < 0);
        const best = items[0];
        const worst = items[items.length - 1];
        const avgSaving = items.reduce((sum, r) => sum + r.ahorro, 0) / items.length;

        return { withSavings, withLosses, best, worst, avgSaving };
    }, [items, facturaActual]);

    if (!stats) return null;

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
        }}>
            <div style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                borderRadius: 8,
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#d1fae5", fontWeight: 600, marginBottom: 4 }}>MEJOR AHORRO</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>
                    +{fmt(stats.best.ahorro)} €
                </div>
                <div style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 500, marginTop: 4 }}>
                    {stats.best.productLabel}
                </div>
            </div>

            <div style={{
                background: "rgba(148, 163, 184, 0.15)",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                borderRadius: 8,
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>AHORRO MEDIO</div>
                <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: stats.avgSaving > 0 ? "#4ade80" : "#f87171",
                }}>
                    {stats.avgSaving > 0 ? "+" : ""}{fmt(stats.avgSaving)} €
                </div>
                <div style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 500, marginTop: 4 }}>
                    Promedio de {items.length} productos
                </div>
            </div>

            <div style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                borderRadius: 8,
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#d1fae5", fontWeight: 600, marginBottom: 4 }}>OFERTAS CON AHORRO</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>
                    {stats.withSavings.length}
                </div>
                <div style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 500, marginTop: 4 }}>
                    de {items.length} productos
                </div>
            </div>

            <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: 8,
                padding: 16,
            }}>
                <div style={{ fontSize: 11, color: "#fecaca", fontWeight: 600, marginBottom: 4 }}>SIN AHORRO</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#f87171" }}>
                    {stats.withLosses.length}
                </div>
                <div style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 500, marginTop: 4 }}>
                    Cuestan más que actual
                </div>
            </div>
        </div>
    );
}

export function SimulationResultsEnhanced({
    results,
    facturaActual,
    tarifaAcceso,
    consumoAnual,
    mes,
}: SimulationResultsEnhancedProps) {
    const hasElec = (results.electricity?.length ?? 0) > 0;
    const hasGas = (results.gas?.length ?? 0) > 0;

    if (!hasElec && !hasGas) {
        return (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.6, fontSize: 14 }}>
                No se obtuvieron resultados. Comprueba que los datos de entrada son correctos.
            </div>
        );
    }

    const elecFijas = results.electricity?.filter(r => r.pricingType === "FIXED") ?? [];
    const elecIndexadas = results.electricity?.filter(r => r.pricingType === "INDEXED") ?? [];
    const gasFijas = results.gas?.filter(r => r.pricingType === "FIXED") ?? [];
    const gasIndexadas = results.gas?.filter(r => r.pricingType === "INDEXED") ?? [];

    const bestElec = results.electricity?.[0];
    const bestGas = results.gas?.[0];

    return (
        <div>
            {/* Header Info */}
            <div style={{
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                borderRadius: 8,
                padding: 20,
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
            }}>
                <div>
                    <div style={{ fontSize: 12, color: "#d1d5db", fontWeight: 600, marginBottom: 8 }}>
                        RESULTADO DE LA SIMULACIÓN
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        {tarifaAcceso && (
                            <div>
                                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>TARIFA ACCESO: </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{tarifaAcceso}</span>
                            </div>
                        )}
                        {consumoAnual && (
                            <div>
                                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>CONSUMO ANUAL: </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{consumoAnual.toLocaleString()}</span>
                            </div>
                        )}
                        {mes && (
                            <div>
                                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>MES: </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{mes}</span>
                            </div>
                        )}
                    </div>
                </div>
                {facturaActual && (
                    <div style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        padding: "12px 20px",
                        borderRadius: 8,
                        textAlign: "center",
                    }}>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                            FACTURA ACTUAL
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>
                            {fmt(facturaActual)} €
                        </div>
                    </div>
                )}
            </div>

            {/* Electricity Results */}
            {hasElec && (
                <>
                    <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 16,
                        color: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}>
                        <span>⚡</span>
                        <span>ELECTRICIDAD</span>
                    </div>

                    <ComparisonStats items={results.electricity!} facturaActual={facturaActual} />
                    <SavingsChart items={results.electricity!} facturaActual={facturaActual} />

                    {/* Table Header */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 140px 120px 100px 140px",
                        padding: "10px 14px",
                        background: "rgba(99, 102, 241, 0.15)",
                        borderRadius: "6px 6px 0 0",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#cbd5e1",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}>
                        <div>Producto</div>
                        <div style={{ textAlign: "right" }}>Total Factura</div>
                        <div style={{ textAlign: "right" }}>€ Ahorro</div>
                        <div style={{ textAlign: "right" }}>% Ahorro</div>
                        <div style={{ textAlign: "right" }}>Ahorro Anual</div>
                    </div>

                    <GroupSection
                        title="FIJAS"
                        items={elecFijas}
                        bgColor="#93c5fd"
                        bestProduct={bestElec}
                    />

                    <GroupSection
                        title="INDEXADAS"
                        items={elecIndexadas}
                        bgColor="#86efac"
                        bestProduct={bestElec}
                    />
                </>
            )}

            {/* Gas Results */}
            {hasGas && (
                <>
                    <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginTop: 40,
                        marginBottom: 16,
                        color: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}>
                        <span>🔥</span>
                        <span>GAS</span>
                    </div>

                    <ComparisonStats items={results.gas!} facturaActual={facturaActual} />
                    <SavingsChart items={results.gas!} facturaActual={facturaActual} />

                    {/* Table Header */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 140px 120px 100px 140px",
                        padding: "10px 14px",
                        background: "rgba(251, 146, 60, 0.15)",
                        borderRadius: "6px 6px 0 0",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#cbd5e1",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}>
                        <div>Producto</div>
                        <div style={{ textAlign: "right" }}>Total Factura</div>
                        <div style={{ textAlign: "right" }}>€ Ahorro</div>
                        <div style={{ textAlign: "right" }}>% Ahorro</div>
                        <div style={{ textAlign: "right" }}>Ahorro Anual</div>
                    </div>

                    <GroupSection
                        title="FIJAS"
                        items={gasFijas}
                        bgColor="#fbbf24"
                        bestProduct={bestGas}
                    />

                    <GroupSection
                        title="INDEXADAS"
                        items={gasIndexadas}
                        bgColor="#86efac"
                        bestProduct={bestGas}
                    />
                </>
            )}

            {/* Footer */}
            <div style={{
                marginTop: 24,
                padding: 16,
                background: "rgba(15, 23, 42, 0.6)",
                borderRadius: 8,
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 500,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <div>
                    Calculado: {new Date(results.calculatedAt).toLocaleString("es-ES")}
                </div>
                <div>
                    Base de precios: <span className="dt-cell-mono" style={{ color: "#cbd5e1", fontWeight: 600 }}>
                        {results.baseValueSetId.slice(0, 12)}…
                    </span>
                </div>
            </div>
        </div>
    );
}
