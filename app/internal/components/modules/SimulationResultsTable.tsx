"use client";

import type { SimulationResults, ProductResult } from "@/domain/types";
import { useI18n } from "../../../../src/lib/i18n-context";

interface SimulationResultsTableProps {
    results: SimulationResults;
    facturaActual?: number;
}

function fmt(n: number, digits = 2): string {
    return n.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function PctBadge({ pct }: { pct: number }) {
    const isPositive = pct > 0;
    const color = isPositive
        ? "var(--scheme-brand-600, #16a34a)"
        : pct < 0
            ? "#dc2626"
            : "var(--scheme-neutral-400)";
    return (
        <span style={{
            display: "inline-block",
            padding: "2px 7px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: isPositive ? "rgba(22,163,74,0.12)" : pct < 0 ? "rgba(220,38,38,0.1)" : "rgba(150,150,150,0.1)",
            color,
        }}>
            {isPositive ? "+" : ""}{fmt(pct, 1)}%
        </span>
    );
}

function ProductRow({ r }: { r: ProductResult }) {
    const { t } = useI18n();
    const savingsColor = r.ahorro > 0 ? "var(--scheme-brand-600, #16a34a)" : r.ahorro < 0 ? "#dc2626" : "inherit";
    return (
        <tr>
            <td style={{ padding: "8px 10px", fontWeight: 500, fontSize: 13 }}>{r.productLabel}</td>
            <td style={{ padding: "8px 10px" }}>
                <span className="dt-cell-mono" style={{ fontSize: 11, opacity: 0.75 }}>
                    {r.pricingType === "FIXED" ? t("simulationResults", "pricingFixed") : t("simulationResults", "pricingIndexed")}
                </span>
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <strong>{fmt(r.totalFactura)} €</strong>
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: savingsColor }}>
                {r.ahorro > 0 ? "+" : ""}{fmt(r.ahorro)} €
            </td>
            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                <PctBadge pct={r.pctAhorro} />
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.8, fontSize: 12 }}>
                {r.ahorro > 0 ? "+" : ""}{fmt(r.ahorroAnual)} €/año
            </td>
        </tr>
    );
}

function ResultsSection({ label, items, facturaActual }: { label: string; items: ProductResult[]; facturaActual?: number }) {
    const { t } = useI18n();
    const best = items[0];
    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                {facturaActual && (
                    <span style={{ fontSize: 12, opacity: 0.6 }}>
                        {t("simulationResults", "currentInvoice")} <strong>{fmt(facturaActual)} €</strong>
                    </span>
                )}
                {best && best.ahorro > 0 && (
                    <span style={{
                        marginLeft: "auto",
                        fontSize: 12, fontWeight: 600,
                        color: "var(--scheme-brand-600, #16a34a)",
                        background: "rgba(22,163,74,0.1)",
                        padding: "3px 10px",
                        borderRadius: 12,
                    }}>
                        {t("simulationResults", "bestOffer", { product: best.productLabel, amount: fmt(best.ahorro) })}
                    </span>
                )}
            </div>
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--scheme-neutral-900, #2a2a2a)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: "var(--scheme-neutral-1000, #1a1a1a)" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{t("simulationResults", "colProduct")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11 }}>{t("simulationResults", "colType")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11 }}>{t("simulationResults", "colTotalInvoice")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11 }}>{t("simulationResults", "colSavings")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "center", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11 }}>{t("simulationResults", "colSavingsPct")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--scheme-neutral-400)", fontWeight: 500, fontSize: 11 }}>{t("simulationResults", "colAnnualSavings")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((r) => (
                            <ProductRow key={r.productKey + r.pricingType} r={r} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function SimulationResultsTable({ results, facturaActual }: SimulationResultsTableProps) {
    const { t } = useI18n();
    const hasElec = (results.electricity?.length ?? 0) > 0;
    const hasGas = (results.gas?.length ?? 0) > 0;

    if (!hasElec && !hasGas) {
        return (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
                {t("simulationResults", "noResults")}
            </div>
        );
    }

    return (
        <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16 }}>
                {t("simulationResults", "calculatedAt")} {new Date(results.calculatedAt).toLocaleString()}
                {" · "}Set: <span className="dt-cell-mono">{results.baseValueSetId.slice(0, 12)}…</span>
            </div>
            {hasElec && (
                <ResultsSection
                    label={t("simulationResults", "electricity")}
                    items={results.electricity!}
                    facturaActual={facturaActual}
                />
            )}
            {hasGas && (
                <ResultsSection
                    label={t("simulationResults", "gas")}
                    items={results.gas!}
                    facturaActual={facturaActual}
                />
            )}
        </div>
    );
}
