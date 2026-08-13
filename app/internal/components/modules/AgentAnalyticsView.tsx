"use client";

import { Box, Typography } from "@mui/material";
import type { AnalyticsOverview, AnalyticsUserStat } from "../../lib/internalApi";
import { DataTable, GradientLineChart, GradientBarChart, ResponsivePieChart } from "../ui";
import type { ColumnDef } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";

interface KpiCardProps {
    title: string;
    value: string | number;
    sub?: string;
    accent?: string;
    progressPercentage?: number;
    openedPercentage?: number;
    comparison?: number | null;
    previousValue?: string | number;
    comparisonLabel?: string;
    sparklineValues?: number[];
    icon?: React.ReactNode;
    split?: { leftLabel: string; leftPercent: number; rightLabel: string; rightPercent: number; denominatorLabel: string };
}

function KpiCard({ title, value, sub, accent = "#8b5cf6", comparison, previousValue, comparisonLabel, sparklineValues = [], icon, split }: KpiCardProps) {
    const values = sparklineValues.length > 1 ? sparklineValues : [0, 0];
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / range) * 20}`).join(" ");
    return (
        <div className="panel-card" style={{
            flex: "1 1 180px",
            background: accent ? `linear-gradient(135deg, ${accent}14 0%, ${accent}05 100%), var(--scheme-surface-raised)` : undefined,
            border: accent ? `1px solid ${accent}40` : undefined,
            borderRadius: 12,
            padding: "12px 16px 9px",
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
            minHeight: 148,
            display: "flex",
            flexDirection: "column",
        }}>
            {comparison !== undefined && (
                <div style={{ position: "absolute", top: 12, right: 15, fontSize: 13, fontWeight: 700, textAlign: "right", color: comparison === null || comparison === 0 ? "var(--scheme-neutral-400)" : comparison > 0 ? "#10b981" : "#ef4444" }} title={comparisonLabel}>
                    <div>{comparison === null ? "—%" : <>{comparison > 0 ? "↑" : comparison < 0 ? "↓" : "→"} {Math.abs(comparison)}%</>}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: "var(--scheme-neutral-500)", marginTop: 2 }}>vs. {previousValue}</div>
                </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9, paddingRight: 58 }}>
                <div style={{ width: 28, height: 28, flex: "0 0 28px", borderRadius: 8, display: "grid", placeItems: "center", color: accent, background: `${accent}16` }}>{icon}</div>
                <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--scheme-neutral-400)", lineHeight: 1.2 }}>{title}</div>
                {sub && <div style={{ fontSize: 10, color: "var(--scheme-neutral-500)", marginTop: 4, lineHeight: 1.25 }}>{sub}</div>}</div>
            </div>
            <div>
                <div style={{ fontSize: 34, fontWeight: 750, lineHeight: 1 }}>{value}</div>
            </div>
            {split && (
                <div style={{ marginTop: 7 }}>
                    <div style={{ display: "flex", height: 4, borderRadius: 999, overflow: "hidden", background: "var(--scheme-neutral-900)" }}>
                        <div style={{ width: `${split.leftPercent}%`, background: accent }} />
                        <div style={{ width: `${split.rightPercent}%`, background: "#06b6d4" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "var(--scheme-neutral-500)" }}>
                        <span>{split.leftLabel} {split.leftPercent}%</span>
                        <span>{split.rightLabel} {split.rightPercent}% {split.denominatorLabel}</span>
                    </div>
                </div>
            )}
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style={{ width: "100%", height: 27, display: "block", marginTop: "auto", paddingTop: 7 }}>
                <polyline points={points} fill="none" stroke={accent} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                {values.map((v, i) => <circle key={i} cx={(i / (values.length - 1)) * 100} cy={26 - ((v - min) / range) * 20} r="1.2" fill="white" stroke={accent} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            </svg>
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
            width: "100%",
            minWidth: 0,
            overflow: "hidden",
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
    // Open rate is computed against email-shared simulations only:
    // PDF/download shares can never be opened by the client, so including them
    // would artificially deflate the open rate percentage.
    const emailSent = analytics.sentEmails ?? analytics.emailSharedSimulations ?? analytics.sharedSimulations;
    const emailOpened = analytics.successfulAccess;
    const openRate = analytics.emailSharedSimulations > 0
        ? Math.round((emailOpened / analytics.emailSharedSimulations) * 100)
        : 0;
    const sentRate = analytics.totalSimulations > 0
        ? Math.round((emailSent / analytics.totalSimulations) * 100)
        : 0;
    const openedOfTotalRate = analytics.totalSimulations > 0
        ? Math.round((emailOpened / analytics.totalSimulations) * 100)
        : 0;
    const pendingOpens = Math.max(0, emailSent - emailOpened);
    const previous = analytics.previousPeriod;
    const percentChange = (current: number, prior: number | undefined) =>
        prior === undefined ? null : prior === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - prior) / prior) * 100);
    const previousOpenRate = previous && previous.emailSharedSimulations > 0
        ? Math.round((previous.openedWebSimulations / previous.emailSharedSimulations) * 100)
        : 0;
    const previousPendingOpens = previous ? Math.max(0, previous.sentEmails - previous.openedEmails) : undefined;
    const previousValue = (value: string | number | undefined) => value ?? "—";
    const emailShareRate = analytics.sharedSimulations > 0 ? Math.round((analytics.emailSharedSimulations / analytics.sharedSimulations) * 100) : 0;
    const pdfShareRate = analytics.sharedSimulations > 0 ? 100 - emailShareRate : 0;
    const comparisonLabel = t("analyticsModule", "previousPeriodValue");

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
        { id: 2, value: emailOpened, label: t("analyticsModule", "funnelOpened"), color: "#10b981" },
    ].filter((d) => d.value > 0);

    // Commercial performance columns
    const commercialColumns: ColumnDef<AnalyticsUserStat & { id: string }>[] = [
        {
            key: "userName",
            label: t("analyticsModule", "colCommercialName"),
            sortable: true,
            renderCell: (r) => <Typography component="span" variant="body2" className="dt-cell-primary">{r.userName}</Typography>,
        },
        {
            key: "total",
            label: t("analyticsModule", "colCreated"),
            sortable: true,
            renderCell: (r) => (
                <Typography component="span" variant="body2" sx={{
                    fontWeight: 600,
                    color: r.total > 10 ? "#10b981" : r.total > 5 ? "#06b6d4" : "inherit",
                }}>
                    {r.total}
                </Typography>
            ),
        },
        {
            key: "shared",
            label: t("analyticsModule", "colSent"),
            sortable: true,
            renderCell: (r) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: "#10b981" }}>{r.shared}</Typography>
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
                </Box>
            ),
        },
        {
            key: "openRate",
            label: t("analyticsModule", "colOpenRate"),
            renderCell: (r) => {
                const rate = r.shared > 0 ? Math.round(((r.opened ?? 0) / r.shared) * 100) : 0;
                const color = rate > 70 ? "#10b981" : rate > 40 ? "#06b6d4" : "#f59e0b";
                return (
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        background: `${color}20`,
                        border: `1px solid ${color}40`,
                        borderRadius: 6,
                    }}>
                        <Typography component="span" variant="body2" sx={{
                            fontWeight: 600,
                            color: color,
                        }}>
                            {rate}%
                        </Typography>
                    </Box>
                );
            },
        },
    ];

    return (
        <>
            {/* ── Agent KPIs ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <KpiCard
                    title={t("analyticsModule", "kpiUsersCreating")}
                    icon={<GroupOutlinedIcon fontSize="small" />}
                    value={analytics.activeUsers}
                    accent="#8b5cf6"
                    sub={t("analyticsModule", "kpiUsersCreatingSub")}
                    comparison={percentChange(analytics.activeUsers, previous?.activeUsers)}
                    previousValue={previousValue(previous?.activeUsers)}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={[previous?.activeUsers ?? 0, analytics.activeUsers]}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsCreatedAgency")}
                    icon={<AssessmentOutlinedIcon fontSize="small" />}
                    value={analytics.totalSimulations}
                    accent="#3b82f6"
                    sub={t("analyticsModule", "kpiSimsCreatedAgencySub")}
                    comparison={percentChange(analytics.totalSimulations, previous?.totalSimulations)}
                    previousValue={previousValue(previous?.totalSimulations)}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={simCounts}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsShared")}
                    icon={<SendOutlinedIcon fontSize="small" />}
                    value={analytics.sharedSimulations}
                    sub={t("analyticsModule", "kpiSharedBreakdown")
                        .replace("{email}", String(analytics.emailSharedSimulations))
                        .replace("{pdf}", String(Math.max(0, analytics.sharedSimulations - analytics.emailSharedSimulations)))}
                    accent="#10b981"
                    progressPercentage={sentRate}
                    openedPercentage={openedOfTotalRate}
                    comparison={percentChange(analytics.sharedSimulations, previous?.sharedSimulations)}
                    previousValue={previousValue(previous?.sharedSimulations)}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={[previous?.sharedSimulations ?? 0, analytics.sharedSimulations]}
                    split={{ leftLabel: "PDF", leftPercent: pdfShareRate, rightLabel: "Email", rightPercent: emailShareRate, denominatorLabel: t("analyticsModule", "sharePercentOfShared") }}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiOpenRate")}
                    icon={<TrackChangesOutlinedIcon fontSize="small" />}
                    value={`${openRate}%`}
                    sub={t("analyticsModule", "kpiEmailSentSub").replace("{opened}", String(emailOpened)).replace("{sent}", String(analytics.emailSharedSimulations))}
                    accent="#06b6d4"
                    progressPercentage={openRate}
                    comparison={previous ? percentChange(openRate, previousOpenRate) : null}
                    previousValue={previous ? `${previousOpenRate}%` : "—"}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={[previousOpenRate, openRate]}
                />
            </div>

            {/* ── Team Funnel ───────────────────────────────────────────────── */}
            <ChartPanel title={t("analyticsModule", "chartTeamEngagementFunnel")} subtitle={t("analyticsModule", "chartTeamEngagementFunnelSub")}>
                <div className="analytics-funnel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, padding: "8px 0" }}>
                    {[
                        { label: t("analyticsModule", "funnelCreated"), value: analytics.totalSimulations, color: "#3b82f6", percent: 100 },
                        { label: t("analyticsModule", "kpiSimsShared"), value: analytics.sharedSimulations, color: "#10b981", percent: analytics.totalSimulations > 0 ? Math.round((analytics.sharedSimulations / analytics.totalSimulations) * 100) : 0, context: `${analytics.emailSharedSimulations} email · ${Math.max(0, analytics.sharedSimulations - analytics.emailSharedSimulations)} PDF` },
                        { label: t("analyticsModule", "funnelOpenedWeb"), value: analytics.successfulAccess, color: "#06b6d4", percent: analytics.emailSharedSimulations > 0 ? Math.round((analytics.successfulAccess / analytics.emailSharedSimulations) * 100) : 0 },
                    ].map((stage, idx) => (
                        <div className="analytics-funnel-stage" key={stage.label} style={{ minWidth: 0 }}>
                            <div style={{
                                background: `linear-gradient(135deg, ${stage.color}14, ${stage.color}05)`,
                                border: `1px solid ${stage.color}38`,
                                borderRadius: 10,
                                padding: "15px 17px",
                                display: "flex",
                                alignItems: "center",
                                gap: 13,
                                height: "100%",
                                minHeight: 84,
                                boxSizing: "border-box",
                            }}>
                                <div style={{ width: 32, height: 32, flex: "0 0 32px", borderRadius: 999, display: "grid", placeItems: "center", background: `${stage.color}18`, color: stage.color, fontSize: 12, fontWeight: 750 }}>{idx + 1}</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--scheme-neutral-400)" }}>{stage.label}</div>
                                    <div style={{ minHeight: 11, fontSize: 9, color: "var(--scheme-neutral-500)", marginTop: 2 }}>{stage.context ?? "\u00A0"}</div>
                                    <div style={{ fontSize: 30, fontWeight: 750, lineHeight: 1.15, color: stage.color, marginTop: 3 }}>{stage.value}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: `${stage.color}DD` }}>{stage.percent}%</div>
                                    <div style={{ minHeight: 11, fontSize: 9, color: "var(--scheme-neutral-500)", marginTop: 2 }}>{idx === 0 ? "\u00A0" : idx === 1 ? t("analyticsModule", "funnelPercentOfCreated") : t("analyticsModule", "funnelPercentOfEmailed")}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ChartPanel>

            {/* ── Activity Trends + Status ──────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
                <ChartPanel
                    title={t("analyticsModule", "chartActivityOverTime")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
                >
                    <GradientBarChart
                        xData={simDates}
                        series={[
                            { data: simCounts, label: t("analyticsModule", "funnelCreated"), color: "#3b82f6" },
                            { data: sentCounts, label: t("analyticsModule", "funnelSent"), color: "#10b981" },
                        ]}
                        height={220}
                        margin={{ left: 36, right: 12, top: 40, bottom: 32 }}
                        emptyMessage={t("analyticsModule", "noActivityInPeriod")}
                    />
                </ChartPanel>

                <ChartPanel title={t("analyticsModule", "chartStatusDistribution")}>
                    {pieData.length > 0 ? (
                        <ResponsivePieChart
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
                        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, }}>
                            {t("analyticsModule", "noDataAvailable")}
                        </div>
                    )}
                </ChartPanel>
            </div>

            {/* ── CRITICAL: Follow-ups Section ──────────────────────────────── */}
            <div className="panel-card" style={{
                padding: "20px",
                background: "linear-gradient(135deg, #f59e0b14 0%, #f59e0b05 100%), var(--scheme-surface-raised)",
                border: "2px solid #f59e0b60",
                borderRadius: 12,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 24 }}>🔔</div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>
                            {t("analyticsModule", "followUpsRequired")}
                        </h3>
                        <p style={{color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "followUpsRequiredSub")}
                        </p>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
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
                        <p style={{color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "tableCommercialPerformanceSub")}
                        </p>
                    </div>
                    <DataTable<AnalyticsUserStat & { id: string }>
                        columns={commercialColumns}
                        rows={(analytics.byUser ?? []).map((r) => ({ ...r, id: r.userId }))}
                        loading={false}
                        onClearFilters={() => undefined}
                        hasActiveFilters={false}
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
                    <GradientLineChart
                        xData={accessDates}
                        yData={opensPerDay}
                        label={t("analyticsModule", "funnelOpened")}
                        color="#06b6d4"
                        areaOpacityTop={0.5}
                        emptyMessage={t("analyticsModule", "noOpensInPeriod")}
                    />
                </ChartPanel>
            )}

            {/* ── Simulation Content ─────────────────────────────────────────── */}
            {(analytics.energyTypeSplit?.length || analytics.tariffBreakdown?.length || analytics.avgConsumoAnual != null) && (
                <div>
                    <div style={{ marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--scheme-neutral-100)", marginBottom: 4 }}>
                            {t("analyticsModule", "sectionSimContent")}
                        </h3>
                        <p style={{color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "sectionSimContentSub")}
                        </p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, paddingBottom: "2rem" }}>
                        {/* Energy type split */}
                        <ChartPanel title={t("analyticsModule", "chartEnergyType")} subtitle={t("analyticsModule", "chartEnergyTypeSub")}>
                            {(analytics.energyTypeSplit?.length ?? 0) > 0 ? (
                                <ResponsivePieChart
                                    series={[{
                                        data: (analytics.energyTypeSplit ?? []).map((e, i) => ({
                                            id: i,
                                            value: e.count,
                                            label: e.type === "ELECTRICITY"
                                                ? t("analyticsModule", "labelElectricity")
                                                : t("analyticsModule", "labelGas"),
                                            color: e.type === "ELECTRICITY" ? "#f59e0b" : "#3b82f6",
                                        })),
                                        innerRadius: 40,
                                        outerRadius: 70,
                                        paddingAngle: 3,
                                        cornerRadius: 4,
                                        cx: 80,
                                    }]}
                                    height={300}
                                    sx={chartSx}
                                    slotProps={{ legend: { direction: "vertical" as const, position: { vertical: "middle" as const, horizontal: "end" as const } } }}
                                    margin={{ left: 0, right: 120, top: 10, bottom: 10 }}
                                />
                            ) : (
                                <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, }}>
                                    {t("analyticsModule", "noDataAvailable")}
                                </div>
                            )}
                        </ChartPanel>

                        {/* Tariff breakdown */}
                        <ChartPanel title={t("analyticsModule", "chartTariffBreakdown")} subtitle={t("analyticsModule", "chartTariffBreakdownSub")}>
                            <GradientBarChart
                                xData={(analytics.tariffBreakdown ?? []).map((r) => r.tariff)}
                                series={[{
                                    data: (analytics.tariffBreakdown ?? []).map((r) => r.count),
                                    label: t("analyticsModule", "labelSimulations"),
                                    color: "#8b5cf6",
                                }]}
                                margin={{ left: 32, right: 8, top: 12, bottom: 36 }}
                                emptyMessage={t("analyticsModule", "noDataAvailable")}
                            />
                        </ChartPanel>

                        {/* Avg consumption */}
                        <ChartPanel title={t("analyticsModule", "kpiAvgConsumption")} subtitle={t("analyticsModule", "kpiAvgConsumptionSub")}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 150, gap: 8 }}>
                                {analytics.avgConsumoAnual != null ? (
                                    <>
                                        <div style={{ fontSize: 44, fontWeight: 700, color: "#10b981", lineHeight: 1 }}>
                                            {analytics.avgConsumoAnual.toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: 14, color: "var(--scheme-neutral-400)", fontWeight: 500 }}>kWh / año</div>
                                        <div style={{ fontSize: 11, color: "var(--scheme-neutral-500)", textAlign: "center", marginTop: 4 }}>
                                            {t("analyticsModule", "kpiAvgConsumptionContext")}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ opacity: 0.4, }}>{t("analyticsModule", "noDataAvailable")}</div>
                                )}
                            </div>
                        </ChartPanel>
                    </div>
                </div>
            )}
        </>
    );
}
