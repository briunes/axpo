"use client";

import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import type { AnalyticsOverview, AnalyticsAgencyStat, AnalyticsUserStat } from "../../lib/internalApi";
import { DataTable } from "../ui";
import type { ColumnDef } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";

interface KpiCardProps {
    title: string;
    value: string | number;
    sub?: string;
    accent?: string;
    percentage?: number;
    trend?: "up" | "down" | "neutral";
}

function KpiCard({ title, value, sub, accent, percentage, trend }: KpiCardProps) {
    return (
        <div className="panel-card" style={{
            flex: "1 1 160px",
            background: accent ? `linear-gradient(135deg, ${accent}15 0%, ${accent}05 100%)` : undefined,
            border: accent ? `1px solid ${accent}40` : undefined,
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative",
            overflow: "hidden",
        }}>
            {accent && (
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${accent} 0%, ${accent}80 100%)`,
                }} />
            )}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginBottom: 8 }}>{title}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
                {percentage !== undefined && (
                    <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: accent || "var(--scheme-neutral-400)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                    }}>
                        {trend === "up" && "↗"}
                        {trend === "down" && "↘"}
                        {percentage}%
                    </div>
                )}
            </div>
            {sub && <div style={{ fontSize: 12, color: "var(--scheme-neutral-500)", marginTop: 6 }}>{sub}</div>}
            {percentage !== undefined && (
                <div style={{
                    marginTop: 10,
                    height: 4,
                    background: "var(--scheme-neutral-900)",
                    borderRadius: 2,
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${Math.min(percentage, 100)}%`,
                        background: `linear-gradient(90deg, ${accent} 0%, ${accent}CC 100%)`,
                        transition: "width 0.6s ease",
                    }} />
                </div>
            )}
        </div>
    );
}

function ChartPanel({ title, subtitle, children, style }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <div className="panel-card" style={{
            borderRadius: 10,
            padding: "18px 20px",
            ...style,
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--scheme-neutral-500)", marginBottom: subtitle ? 2 : 14 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--scheme-neutral-500)", marginBottom: 14 }}>{subtitle}</div>}
            {children}
        </div>
    );
}

interface AdminAnalyticsViewProps {
    analytics: AnalyticsOverview;
    selectedDays: number;
}

export function AdminAnalyticsView({ analytics, selectedDays }: AdminAnalyticsViewProps) {
    const { t } = useI18n();
    const chartSx = {
        "& .MuiChartsAxis-tickLabel": { fontSize: 10, fill: "var(--scheme-neutral-400)" },
        "& .MuiChartsGrid-line": { strokeDasharray: "4 4", opacity: 0.2, stroke: "var(--scheme-neutral-800)" },
        "& .MuiChartsLegend-series text": { fontSize: 11, fill: "var(--scheme-neutral-300)" },
    };

    // Calculate engagement metrics
    const openRate = analytics.sharedSimulations > 0
        ? Math.round((analytics.successfulAccess / analytics.sharedSimulations) * 100)
        : 0;
    const sentRate = analytics.totalSimulations > 0
        ? Math.round((analytics.sharedSimulations / analytics.totalSimulations) * 100)
        : 0;

    // Prepare trend data
    const simDates = (analytics.simulationTrend ?? []).map((d) => new Date(d.date + "T00:00:00"));
    const simCounts = (analytics.simulationTrend ?? []).map((d) => d.count);
    const accessDates = (analytics.accessTrend ?? []).map((d) => new Date(d.date + "T00:00:00"));
    const opensPerDay = (analytics.accessTrend ?? []).map((d) => d.successful);

    const hasSimTrend = simCounts.some((v) => v > 0);
    const hasAccessTrend = opensPerDay.some((v) => v > 0);

    // Agency performance columns
    const agencyColumns: ColumnDef<AnalyticsAgencyStat & { id: string }>[] = [
        {
            key: "agencyName",
            label: t("analyticsModule", "colAgencyName"),
            sortable: true,
            renderCell: (r) => <span className="dt-cell-primary">{r.agencyName}</span>,
        },
        {
            key: "total",
            label: t("analyticsModule", "colCreated"),
            sortable: true,
            renderCell: (r) => <span style={{ fontWeight: 600 }}>{r.total}</span>
        },
        {
            key: "shared",
            label: t("analyticsModule", "colSent"),
            sortable: true,
            renderCell: (r) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#10b981" }}>{r.shared}</span>
                    <div style={{
                        flex: 1,
                        height: 6,
                        background: "var(--scheme-neutral-900)",
                        borderRadius: 3,
                        overflow: "hidden",
                        minWidth: 60,
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${r.total > 0 ? (r.shared / r.total * 100) : 0}%`,
                            background: "linear-gradient(90deg, #10b981 0%, #10b981CC 100%)",
                        }} />
                    </div>
                </div>
            ),
        },
        {
            key: "openRate",
            label: t("analyticsModule", "colOpenRate"),
            renderCell: (r) => {
                // For now we don't have per-agency open data, so we show a placeholder
                // You might need to update the API to return this
                const rate = 0; // TODO: Get actual open rate per agency from API
                return (
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        background: "#8b5cf620",
                        border: "1px solid #8b5cf640",
                        borderRadius: 6,
                    }}>
                        <span style={{
                            fontWeight: 600,
                            color: "#8b5cf6",
                        }}>
                            {rate}%
                        </span>
                    </div>
                );
            },
        },
        {
            key: "expired",
            label: t("analyticsModule", "colExpired"),
            sortable: true,
            renderCell: (r) => <span style={{ color: r.expired > 0 ? "#f59e0b" : "inherit" }}>{r.expired}</span>,
        },
    ];

    return (
        <>
            {/* ── Admin KPIs ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14}}>
                <KpiCard
                    title={t("analyticsModule", "kpiTotalAgencies")}
                    value={analytics.byAgency?.length || 0}
                    accent="#8b5cf6"
                    sub={t("analyticsModule", "kpiTotalAgenciesSub")}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsCreated")}
                    value={analytics.totalSimulations}
                    accent="#3b82f6"
                    sub={t("analyticsModule", "kpiSimsCreatedSub")}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsSent")}
                    value={analytics.sharedSimulations}
                    sub={t("analyticsModule", "kpiSimsSentSub")}
                    accent="#10b981"
                    percentage={sentRate}
                    trend={sentRate > 70 ? "up" : sentRate < 40 ? "down" : "neutral"}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiOpenRate")}
                    value={`${openRate}%`}
                    sub={t("analyticsModule", "kpiOpenRateSub").replace("{count}", String(analytics.successfulAccess))}
                    accent="#06b6d4"
                    percentage={openRate}
                    trend={openRate > 60 ? "up" : openRate < 30 ? "down" : "neutral"}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiTotalOpens")}
                    value={analytics.successfulAccess || 0}
                    accent="#14b8a6"
                    sub={t("analyticsModule", "kpiTotalOpensSub").replace("{count}", String(analytics.accessAttempts))}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiActiveUsers")}
                    value={analytics.byUser?.length || 0}
                    accent="#a78bfa"
                    sub={t("analyticsModule", "kpiActiveUsersSub")}
                />
            </div>

            {/* ── Core Funnel (MOST IMPORTANT) ──────────────────────────────── */}
            <ChartPanel title={t("analyticsModule", "chartEngagementFunnel")} subtitle={t("analyticsModule", "chartEngagementFunnelSub")}>
                <div style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "12px 0", position: "relative" }}>
                    {[
                        { label: t("analyticsModule", "funnelCreated"), value: analytics.totalSimulations, color: "#3b82f6", percent: 100 },
                        { label: t("analyticsModule", "funnelSent"), value: analytics.sharedSimulations, color: "#10b981", percent: sentRate },
                        { label: t("analyticsModule", "funnelOpened"), value: analytics.successfulAccess || 0, color: "#06b6d4", percent: openRate },
                    ].map((stage, idx) => (
                        <div key={stage.label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
                            <div style={{
                                background: `${stage.color}20`,
                                border: `2px solid ${stage.color}60`,
                                borderRadius: 8,
                                padding: "20px",
                                textAlign: "center",
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginBottom: 8 }}>{stage.label}</div>
                                <div style={{ fontSize: 36, fontWeight: 700, color: stage.color }}>{stage.value}</div>
                                <div style={{ fontSize: 20, fontWeight: 600, color: `${stage.color}CC`, marginTop: 6 }}>{stage.percent}%</div>
                            </div>
                            {idx < 2 && (
                                <div style={{
                                    position: "absolute",
                                    right: "-24px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    fontSize: 32,
                                    color: "var(--scheme-neutral-600)",
                                    zIndex: 1,
                                }}>→</div>
                            )}
                        </div>
                    ))}
                </div>
            </ChartPanel>

            {/* ── Activity Trends ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ChartPanel
                    title={t("analyticsModule", "chartSimsCreated")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
                >
                    {hasSimTrend ? (
                        <LineChart
                            xAxis={[{ data: simDates, scaleType: "time" }]}
                            series={[{
                                data: simCounts,
                                label: t("analyticsModule", "funnelCreated"),
                                color: "#3b82f6",
                                area: true,
                                showMark: true,
                                curve: "natural",
                            }]}
                            height={200}
                            sx={chartSx}
                            margin={{ left: 36, right: 12, top: 12, bottom: 32 }}
                        />
                    ) : (
                        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13 }}>
                            {t("analyticsModule", "noSimulationsInPeriod")}
                        </div>
                    )}
                </ChartPanel>

                <ChartPanel
                    title={t("analyticsModule", "chartSimsOpened")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
                >
                    {hasAccessTrend ? (
                        <LineChart
                            xAxis={[{ data: accessDates, scaleType: "time" }]}
                            series={[{
                                data: opensPerDay,
                                label: t("analyticsModule", "funnelOpened"),
                                color: "#06b6d4",
                                area: true,
                                showMark: true,
                                curve: "natural",
                            }]}
                            height={200}
                            sx={chartSx}
                            margin={{ left: 36, right: 12, top: 12, bottom: 32 }}
                        />
                    ) : (
                        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13 }}>
                            {t("analyticsModule", "noOpensInPeriod")}
                        </div>
                    )}
                </ChartPanel>
            </div>

            {/* ── Agency Performance Ranking ─────────────────────────────────── */}
            {analytics.byAgency && analytics.byAgency.length > 0 && (
                <div>
                    <div style={{ marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--scheme-neutral-100)", marginBottom: 4 }}>
                            {t("analyticsModule", "tableAgencyPerformance")}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "tableAgencyPerformanceSub")}
                        </p>
                    </div>
                    <DataTable<AnalyticsAgencyStat & { id: string }>
                        columns={agencyColumns}
                        rows={(analytics.byAgency ?? []).map((r) => ({ ...r, id: r.agencyId }))}
                        loading={false}
                        emptyMessage={t("analyticsModule", "emptyAgencyData")}
                        headerRight={<span className="dt-meta-pill">{t("analyticsModule", "pillAgencies").replace("{count}", String(analytics.byAgency.length))}</span>}
                    />
                </div>
            )}

            {/* ── Alerts / Insights ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div className="panel-card" style={{
                    padding: "16px",
                    background: "linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)",
                    border: "1px solid #f59e0b40",
                    borderRadius: 8,
                }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#f59e0b", marginBottom: 6 }}>{t("analyticsModule", "alertLowOpenRate")}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
                        {openRate < 30 ? t("analyticsModule", "alertLowOpenRateAction") : t("analyticsModule", "alertLowOpenRateGood")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--scheme-neutral-400)", marginTop: 4 }}>
                        {openRate < 30 ? t("analyticsModule", "alertLowOpenRateMsgBad") : t("analyticsModule", "alertLowOpenRateMsgGood")}
                    </div>
                </div>

                <div className="panel-card" style={{
                    padding: "16px",
                    background: "linear-gradient(135deg, #10b98115 0%, #10b98105 100%)",
                    border: "1px solid #10b98140",
                    borderRadius: 8,
                }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#10b981", marginBottom: 6 }}>{t("analyticsModule", "alertSentRate")}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
                        {sentRate}%
                    </div>
                    <div style={{ fontSize: 11, color: "var(--scheme-neutral-400)", marginTop: 4 }}>
                        {sentRate < 50 ? t("analyticsModule", "alertSentRateMsgLow") : t("analyticsModule", "alertSentRateMsgGood")}
                    </div>
                </div>

                <div className="panel-card" style={{
                    padding: "16px",
                    background: "linear-gradient(135deg, #8b5cf615 0%, #8b5cf605 100%)",
                    border: "1px solid #8b5cf640",
                    borderRadius: 8,
                    paddingBottom: '10px' 
                }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#8b5cf6", marginBottom: 6 }}>{t("analyticsModule", "alertPendingOpens")}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6" }}>
                        {analytics.sharedSimulations - (analytics.successfulAccess || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--scheme-neutral-400)", marginTop: 4 }}>
                        {t("analyticsModule", "alertPendingOpensSub")}
                    </div>
                </div>
            </div>
        </>
    );
}
