"use client";

import { Box, Typography } from "@mui/material";
import { GradientLineChart, GradientBarChart, ResponsivePieChart } from "../ui";
import type { AnalyticsOverview, AnalyticsAgencyStat } from "../../lib/internalApi";
import { DataTable } from "../ui";
import type { ColumnDef } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";

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
    const previous = analytics.previousPeriod;
    const percentChange = (current: number, prior: number | undefined) =>
        prior === undefined ? null : prior === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - prior) / prior) * 100);
    const previousOpenRate = previous && previous.emailSharedSimulations > 0
        ? Math.round((previous.openedWebSimulations / previous.emailSharedSimulations) * 100)
        : 0;
    const previousValue = (value: string | number | undefined) => value ?? "—";
    const emailShareRate = analytics.sharedSimulations > 0 ? Math.round((analytics.emailSharedSimulations / analytics.sharedSimulations) * 100) : 0;
    const pdfShareRate = analytics.sharedSimulations > 0 ? 100 - emailShareRate : 0;
    const comparisonLabel = t("analyticsModule", "previousPeriodValue");

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
            renderCell: (r) => <Typography component="span" variant="body2" className="dt-cell-primary">{r.agencyName}</Typography>,
        },
        {
            key: "total",
            label: t("analyticsModule", "colCreated"),
            sortable: true,
            renderCell: (r) => <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{r.total}</Typography>
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
                        minWidth: 60,
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
                const rate = r.shared > 0 ? Math.round((r.opened / r.shared) * 100) : 0;
                return (
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        background: "#8b5cf620",
                        border: "1px solid #8b5cf640",
                        borderRadius: 6,
                    }}>
                        <Typography component="span" variant="body2" sx={{
                            fontWeight: 600,
                            color: "#8b5cf6",
                        }}>
                            {rate}%
                        </Typography>
                    </Box>
                );
            },
        },
        {
            key: "expired",
            label: t("analyticsModule", "colExpired"),
            sortable: true,
            renderCell: (r) => <Typography component="span" variant="body2" sx={{ color: r.expired > 0 ? "#f59e0b" : "inherit" }}>{r.expired}</Typography>,
        },
    ];

    return (
        <>
            {/* ── Admin KPIs ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <KpiCard
                    title={t("analyticsModule", "kpiAgenciesCreating")}
                    icon={<BusinessOutlinedIcon fontSize="small" />}
                    value={analytics.activeAgencies}
                    accent="#8b5cf6"
                    sub={t("analyticsModule", "kpiAgenciesCreatingSub")}
                    comparison={percentChange(analytics.activeAgencies, previous?.activeAgencies)}
                    previousValue={previousValue(previous?.activeAgencies)}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={[previous?.activeAgencies ?? 0, analytics.activeAgencies]}
                />
                <KpiCard
                    title={t("analyticsModule", "kpiSimsCreated")}
                    icon={<AssessmentOutlinedIcon fontSize="small" />}
                    value={analytics.totalSimulations}
                    accent="#3b82f6"
                    sub={t("analyticsModule", "kpiSimsCreatedSub")}
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
                <KpiCard
                    title={t("analyticsModule", "kpiUsersCreating")}
                    icon={<GroupOutlinedIcon fontSize="small" />}
                    value={analytics.activeUsers}
                    accent="#a78bfa"
                    sub={t("analyticsModule", "kpiUsersCreatingSub")}
                    comparison={percentChange(analytics.activeUsers, previous?.activeUsers)}
                    previousValue={previousValue(previous?.activeUsers)}
                    comparisonLabel={comparisonLabel}
                    sparklineValues={[previous?.activeUsers ?? 0, analytics.activeUsers]}
                />
            </div>

            {/* ── Core Funnel (MOST IMPORTANT) ──────────────────────────────── */}
            <ChartPanel title={t("analyticsModule", "chartEngagementFunnel")} subtitle={t("analyticsModule", "chartEngagementFunnelSub")}>
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

            {/* ── Activity Trends ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
                <ChartPanel
                    title={t("analyticsModule", "chartSimsCreated")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
                >
                    <GradientLineChart
                        xData={simDates}
                        yData={simCounts}
                        label={t("analyticsModule", "funnelCreated")}
                        color="#3b82f6"
                        areaOpacityTop={0.5}
                        emptyMessage={t("analyticsModule", "noSimulationsInPeriod")}
                    />
                </ChartPanel>

                <ChartPanel
                    title={t("analyticsModule", "chartSimsOpened")}
                    subtitle={t("analyticsModule", "lastDays").replace("{days}", String(selectedDays))}
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
            </div>

            {/* ── Agency Performance Ranking ─────────────────────────────────── */}
            {analytics.byAgency && analytics.byAgency.length > 0 && (
                <div>
                    <div style={{ marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--scheme-neutral-100)", marginBottom: 4 }}>
                            {t("analyticsModule", "tableAgencyPerformance")}
                        </h3>
                        <p style={{color: "var(--scheme-neutral-500)" }}>
                            {t("analyticsModule", "tableAgencyPerformanceSub")}
                        </p>
                    </div>
                    <DataTable<AnalyticsAgencyStat & { id: string }>
                        columns={agencyColumns}
                        rows={(analytics.byAgency ?? []).map((r) => ({ ...r, id: r.agencyId }))}
                        loading={false}
                        onClearFilters={() => undefined}
                        hasActiveFilters={false}
                        emptyMessage={t("analyticsModule", "emptyAgencyData")}
                        headerRight={<span className="dt-meta-pill">{t("analyticsModule", "pillAgencies").replace("{count}", String(analytics.byAgency.length))}</span>}
                    />
                </div>
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
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
                                    height={180}
                                    sx={chartSx}
                                    slotProps={{ legend: { direction: "vertical" as const, position: { vertical: "middle" as const, horizontal: "end" as const } } }}
                                    margin={{ left: 0, right: 120, top: 10, bottom: 10 }}
                                />
                            ) : (
                                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, }}>
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

            {/* ── Alerts / Insights ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, paddingBottom: "2rem" }}>
                <div className="panel-card" style={{
                    padding: "16px",
                    background: "linear-gradient(135deg, #f59e0b14 0%, #f59e0b05 100%), var(--scheme-surface-raised)",
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
                    background: "linear-gradient(135deg, #10b98114 0%, #10b98105 100%), var(--scheme-surface-raised)",
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
                    background: "linear-gradient(135deg, #8b5cf614 0%, #8b5cf605 100%), var(--scheme-surface-raised)",
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
