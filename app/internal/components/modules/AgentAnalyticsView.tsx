"use client";

import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import type { AnalyticsOverview, AnalyticsUserStat } from "../../lib/internalApi";
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

interface AgentAnalyticsViewProps {
    analytics: AnalyticsOverview;
    selectedDays: number;
}

export function AgentAnalyticsView({ analytics, selectedDays }: AgentAnalyticsViewProps) {
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
    const pendingOpens = analytics.sharedSimulations - (analytics.successfulAccess || 0);

    // Prepare trend data
    const simDates = (analytics.simulationTrend ?? []).map((d) => {
        const dt = new Date(d.date + "T00:00:00");
        return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    });
    const simCounts = (analytics.simulationTrend ?? []).map((d) => d.count);
    const sentCounts = simCounts.map(c => Math.round(c * (sentRate / 100))); // Estimate
    const accessDates = (analytics.accessTrend ?? []).map((d) => new Date(d.date + "T00:00:00"));
    const opensPerDay = (analytics.accessTrend ?? []).map((d) => d.successful);

    const hasSimTrend = simCounts.some((v) => v > 0);
    const hasAccessTrend = opensPerDay.some((v) => v > 0);

    // Status breakdown for pie chart
    const draftCount = analytics.draftSimulations ?? (analytics.totalSimulations - analytics.sharedSimulations - analytics.expiredSimulations);
    const pieData = [
        { id: 0, value: draftCount, label: t("analyticsModule", "labelDraft"), color: "#6366f1" },
        { id: 1, value: pendingOpens, label: t("analyticsModule", "labelSentNotOpened"), color: "#f59e0b" },
        { id: 2, value: analytics.successfulAccess || 0, label: t("analyticsModule", "funnelOpened"), color: "#10b981" },
    ].filter((d) => d.value > 0);

    // Commercial performance columns
    const commercialColumns: ColumnDef<AnalyticsUserStat & { id: string }>[] = [
        {
            key: "userName",
            label: t("analyticsModule", "colCommercialName"),
            sortable: true,
            renderCell: (r) => <span className="dt-cell-primary">{r.userName}</span>,
        },
        {
            key: "total",
            label: t("analyticsModule", "colCreated"),
            sortable: true,
            renderCell: (r) => (
                <span style={{
                    fontWeight: 600,
                    color: r.total > 10 ? "#10b981" : r.total > 5 ? "#06b6d4" : "inherit",
                }}>
                    {r.total}
                </span>
            ),
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
                        minWidth: 50,
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
                // For now we don't have per-user open data, so we show a placeholder
                // You might need to update the API to return this
                const rate = 0; // TODO: Get actual open rate per user from API
                const color = rate > 70 ? "#10b981" : rate > 40 ? "#06b6d4" : "#f59e0b";
                return (
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        background: `${color}20`,
                        border: `1px solid ${color}40`,
                        borderRadius: 6,
                    }}>
                        <span style={{
                            fontWeight: 600,
                            color: color,
                        }}>
                            {rate}%
                        </span>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            {/* ── Agent KPIs ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <KpiCard
                    title={t("analyticsModule", "kpiCommercials")}
                    value={analytics.byUser?.length || 0}
                    accent="#8b5cf6"
                    sub={t("analyticsModule", "kpiCommercialsSub")}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsCreatedAgency")}
                    value={analytics.totalSimulations}
                    accent="#3b82f6"
                    sub={t("analyticsModule", "kpiSimsCreatedAgencySub")}
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
                    title={t("analyticsModule", "kpiPendingOpens")}
                    value={pendingOpens}
                    accent="#f59e0b"
                    sub={t("analyticsModule", "kpiPendingOpensSub")}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiTotalOpens")}
                    value={analytics.successfulAccess || 0}
                    accent="#14b8a6"
                    sub={t("analyticsModule", "kpiTotalOpensSub").replace("{count}", String(analytics.accessAttempts))}
                />
            </div>

            {/* ── Team Funnel ───────────────────────────────────────────────── */}
            <ChartPanel title={t("analyticsModule", "chartTeamEngagementFunnel")} subtitle={t("analyticsModule", "chartTeamEngagementFunnelSub")}>
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

            {/* ── Activity Trends + Status ──────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <ChartPanel
                    title={t("analyticsModule", "chartActivityOverTime")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
                >
                    {hasSimTrend ? (
                        <BarChart
                            xAxis={[{ data: simDates, scaleType: "band" }]}
                            series={[
                                { data: simCounts, label: t("analyticsModule", "funnelCreated"), color: "#3b82f6", stack: "sims" },
                                { data: sentCounts, label: t("analyticsModule", "funnelSent"), color: "#10b981", stack: "sims" },
                            ]}
                            height={220}
                            sx={chartSx}
                            slotProps={{ legend: { direction: "horizontal" as const, position: { vertical: "top" as const, horizontal: "end" as const } } }}
                            margin={{ left: 36, right: 12, top: 40, bottom: 32 }}
                        />
                    ) : (
                        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13 }}>
                            {t("analyticsModule", "noActivityInPeriod")}
                        </div>
                    )}
                </ChartPanel>

                <ChartPanel title={t("analyticsModule", "chartStatusDistribution")}>
                    {pieData.length > 0 ? (
                        <PieChart
                            series={[{
                                data: pieData,
                                innerRadius: 48,
                                outerRadius: 76,
                                paddingAngle: 3,
                                cornerRadius: 4,
                                cx: 90,
                            }]}
                            height={220}
                            sx={chartSx}
                            slotProps={{
                                legend: {
                                    direction: "vertical" as const,
                                    position: { vertical: "middle" as const, horizontal: "end" as const },
                                },
                            }}
                            margin={{ left: 0, right: 140, top: 10, bottom: 10 }}
                        />
                    ) : (
                        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13 }}>
                            {t("analyticsModule", "noDataAvailable")}
                        </div>
                    )}
                </ChartPanel>
            </div>

            {/* ── CRITICAL: Follow-ups Section ──────────────────────────────── */}
            <div className="panel-card" style={{
                padding: "20px",
                background: "linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)",
                border: "2px solid #f59e0b60",
                borderRadius: 12,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 24 }}>🔔</div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>
                            {t("analyticsModule", "followUpsRequired")}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "followUpsRequiredSub")}
                        </p>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div style={{
                        padding: "16px",
                        background: "var(--scheme-neutral-950)",
                        borderRadius: 8,
                        border: "1px solid var(--scheme-neutral-800)",
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginBottom: 6 }}>
                            {t("analyticsModule", "followUpsTotalPending")}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
                            {pendingOpens}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginTop: 4 }}>
                            {t("analyticsModule", "followUpsTotalPendingSub")}
                        </div>
                    </div>

                    <div style={{
                        padding: "16px",
                        background: "var(--scheme-neutral-950)",
                        borderRadius: 8,
                        border: "1px solid var(--scheme-neutral-800)",
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginBottom: 6 }}>
                            {t("analyticsModule", "followUpsRecentlySent")}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#06b6d4" }}>
                            ~{Math.round(pendingOpens * 0.3)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginTop: 4 }}>
                            {t("analyticsModule", "followUpsRecentlySentSub")}
                        </div>
                    </div>

                    <div style={{
                        padding: "16px",
                        background: "var(--scheme-neutral-950)",
                        borderRadius: 8,
                        border: "1px solid var(--scheme-neutral-800)",
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--scheme-neutral-400)", marginBottom: 6 }}>
                            {t("analyticsModule", "followUpsDeadLeads")}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>
                            ~{Math.round(pendingOpens * 0.4)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginTop: 4 }}>
                            {t("analyticsModule", "followUpsDeadLeadsSub")}
                        </div>
                    </div>
                </div>

                <div style={{
                    marginTop: 16,
                    padding: "12px",
                    background: "var(--scheme-neutral-950)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--scheme-neutral-400)",
                }}>
                    {t("analyticsModule", "followUpsActionItems")}
                </div>
            </div>

            {/* ── Commercial Performance Table ─────────────────────────────────── */}
            {analytics.byUser && analytics.byUser.length > 0 && (
                <div>
                    <div style={{ marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--scheme-neutral-100)", marginBottom: 4 }}>
                            {t("analyticsModule", "tableCommercialPerformance")}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "tableCommercialPerformanceSub")}
                        </p>
                    </div>
                    <DataTable<AnalyticsUserStat & { id: string }>
                        columns={commercialColumns}
                        rows={(analytics.byUser ?? []).map((r) => ({ ...r, id: r.userId }))}
                        loading={false}
                        emptyMessage={t("analyticsModule", "emptyCommercialData")}
                        headerRight={<span className="dt-meta-pill">{t("analyticsModule", "pillCommercials").replace("{count}", String(analytics.byUser.length))}</span>}
                    />
                </div>
            )}

            {/* ── Open Rate Trends ──────────────────────────────────────────── */}
            {hasAccessTrend && (
                <ChartPanel
                    title={t("analyticsModule", "chartClientOpens")}
                    subtitle={`${t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))} - ${t("analyticsModule", "chartClientOpensSub")}`}
                >
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
                </ChartPanel>
            )}
        </>
    );
}
