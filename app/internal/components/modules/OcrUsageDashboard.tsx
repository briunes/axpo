"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { PieChart } from "@mui/x-charts/PieChart";
import type { SessionState } from "../../lib/authSession";
import { isAdmin as isAdminRole } from "../../lib/internalApi";
import { useI18n } from "../../../../src/lib/i18n-context";
import { LoadingState, EmptyState } from "../shared";
import {
    DataTable,
    GradientLineChart,
    type ColumnDef,
} from "../ui";
import {
    createOcrModelPrice,
    createOcrUsageInvoice,
    deleteOcrModelPrice,
    fetchOcrAvailableModels,
    fetchOcrUsageOverview,
    listOcrModelPrices,
    listOcrUsageInvoices,
    updateOcrModelPrice,
    fetchOcrBillingConfig,
    updateOcrBillingConfig,
    type OcrBillingConfig,
    type OcrAvailableModel,
    type OcrModelPriceItem,
    type OcrModelPriceInput,
    type OcrUsageBucket,
    type OcrUsageOverview,
    type OcrUsageOverviewParams,
    type OcrUsageRecentCall,
    type OcrUsageInvoiceItem,
} from "../../lib/internalApi";
import {
    formatCurrency,
    formatTokens,
    toNumber,
    round6,
} from "@/application/lib/ocrCost";
import "./ocrUsage.css";

export interface OcrUsageDashboardProps {
    session: SessionState;
    onNotify?: (message: string, tone: "success" | "error") => void;
}

type DateRangePreset = "7d" | "30d" | "mtd" | "qtd" | "ytd" | "custom";
type ChartGranularity = "hour" | "day" | "week" | "month";

const STATUS_TONE: Record<string, string> = {
    SUCCESS: "status-badge--success",
    FAILED: "status-badge--error",
    ERROR: "status-badge--error",
    PARSE_ERROR: "status-badge--warning",
};

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function presetDates(preset: DateRangePreset): { from: string; to: string } {
    const now = new Date();
    const to = todayIso();
    if (preset === "7d") {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        return { from: d.toISOString().slice(0, 10), to };
    }
    if (preset === "30d") {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        return { from: d.toISOString().slice(0, 10), to };
    }
    if (preset === "mtd") {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: d.toISOString().slice(0, 10), to };
    }
    if (preset === "qtd") {
        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const d = new Date(now.getFullYear(), qStartMonth, 1);
        return { from: d.toISOString().slice(0, 10), to };
    }
    if (preset === "ytd") {
        const d = new Date(now.getFullYear(), 0, 1);
        return { from: d.toISOString().slice(0, 10), to };
    }
    return { from: "", to: "" };
}

function fmtNumber(n: number, digits = 0) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function fmtPercent(n: number | null) {
    if (n === null || !Number.isFinite(n)) return "—";
    return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(iso: string, withTime = true): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return withTime ? d.toLocaleString() : d.toLocaleDateString();
    } catch {
        return iso;
    }
}

function getInclusiveDateSpanDays(from: string, to: string): number | null {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return null;
    }
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function createEmptyUsageBucket(key: string): OcrUsageBucket {
    return {
        key,
        label: key,
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
    };
}

function fillShortRangeBuckets(
    buckets: OcrUsageBucket[],
    granularity: ChartGranularity,
    from: string,
    to: string,
): OcrUsageBucket[] {
    if (granularity !== "hour") return buckets;

    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return buckets;
    }

    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const filled: OcrUsageBucket[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCHours(cursor.getUTCHours() + 1)) {
        const key = cursor.toISOString().replace(/\.\d{3}Z$/, ".000Z");
        filled.push(byKey.get(key) ?? createEmptyUsageBucket(key));
    }
    return filled;
}

function KpiCard({
    label,
    value,
    hint,
    tone = "neutral",
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: "neutral" | "success" | "warning" | "brand";
}) {
    return (
        <div className={`ocr-kpi ocr-kpi--${tone}`}>
            <div className="ocr-kpi__label">{label}</div>
            <div className="ocr-kpi__value">{value}</div>
            {hint && <div className="ocr-kpi__hint">{hint}</div>}
        </div>
    );
}

// Sortable recent-call row used by the table (DataTable rows need `id`)
type RecentCallRow = OcrUsageRecentCall & { id: string };

// Sortable invoice row used by the table
type InvoiceRow = OcrUsageInvoiceItem & { id: string };

// Sortable price row used by the table
type PriceRow = OcrModelPriceItem & { id: string };

export function OcrUsageDashboard({ session, onNotify }: OcrUsageDashboardProps) {
    const { t, locale } = useI18n();
    const token = session.token;
    // Pricing configuration, invoice snapshots and the markup breakdown are
    // reserved for SYS_ADMIN. Regular ADMINs see the dashboard with totals only
    // — they don't know that the numbers already include markup.
    const isSysAdminViewer = session.user.role === "SYS_ADMIN";
    const isAdminViewer = isSysAdminViewer
        ? false
        : isAdminRole(session.user.role);

    const [preset, setPreset] = useState<DateRangePreset>("30d");
    const [dateFrom, setDateFrom] = useState<string>(() => presetDates("30d").from);
    const [dateTo, setDateTo] = useState<string>(() => presetDates("30d").to);
    const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
    const [providerFilter, setProviderFilter] = useState<string>("");
    const [modelFilter, setModelFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");

    // Draft values for debounced text inputs
    const [draftProvider, setDraftProvider] = useState<string>("");
    const [draftModel, setDraftModel] = useState<string>("");
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setDebouncedFilters = (provider: string, model: string) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setProviderFilter(provider);
            setModelFilter(model);
        }, 450);
    };

    const [overview, setOverview] = useState<OcrUsageOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [prices, setPrices] = useState<OcrModelPriceItem[]>([]);
    const [availableModels, setAvailableModels] = useState<OcrAvailableModel[]>([]);
    const [invoices, setInvoices] = useState<OcrUsageInvoiceItem[]>([]);
    const [billingConfig, setBillingConfig] = useState<OcrBillingConfig | null>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

    const currency = overview?.totals.currency ?? "USD";
    const intlLocale = locale === "es" ? "es-ES" : "en-US";
    const selectedDateSpanDays = useMemo(
        () => getInclusiveDateSpanDays(dateFrom, dateTo),
        [dateFrom, dateTo],
    );
    const effectiveGranularity: ChartGranularity =
        selectedDateSpanDays !== null && selectedDateSpanDays <= 3
            ? "hour"
            : granularity;

    const loadOverview = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: OcrUsageOverviewParams = {
                dateFrom,
                dateTo,
                granularity: effectiveGranularity,
                groupBy: "model",
                recentLimit: 15,
            };
            if (providerFilter) params.provider = providerFilter;
            if (modelFilter) params.model = modelFilter;
            if (statusFilter) params.status = statusFilter;
            const data = await fetchOcrUsageOverview(token, params);
            setOverview(data);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, dateFrom, dateTo, effectiveGranularity, providerFilter, modelFilter, statusFilter]);

    const loadConfigLists = useCallback(async () => {
        try {
            const [priceRows, available, invoiceRows, billing] = await Promise.all([
                listOcrModelPrices(token),
                fetchOcrAvailableModels(token),
                listOcrUsageInvoices(token, { limit: 50 }),
                fetchOcrBillingConfig(token),
            ]);
            setPrices(priceRows);
            setAvailableModels(available);
            setInvoices(invoiceRows.items);
            setBillingConfig(billing);
        } catch (err) {
            console.error("Failed to load config lists", err);
        }
    }, [token]);

    const handleSaveBillingConfig = async (patch: Partial<OcrBillingConfig>) => {
        const updated = await updateOcrBillingConfig(token, patch);
        setBillingConfig(updated);
        await loadOverview();
    };

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    useEffect(() => {
        loadConfigLists();
    }, [loadConfigLists]);

    const applyPreset = (next: DateRangePreset) => {
        setPreset(next);
        if (next === "custom") return;
        const { from, to } = presetDates(next);
        setDateFrom(from);
        setDateTo(to);
    };

    const series = useMemo(
        () =>
            fillShortRangeBuckets(
                overview?.series.buckets ?? [],
                effectiveGranularity,
                dateFrom,
                dateTo,
            ),
        [overview?.series.buckets, effectiveGranularity, dateFrom, dateTo],
    );
    // Build xData as Date[] for the line charts (band scale would need strings
    // but the chart type only accepts Date[] | number[]).
    const xData = useMemo(
        () => series.map((b) => new Date(b.key)).filter((d) => !Number.isNaN(d.getTime())),
        [series],
    );
    const costSeries = series.map((b) => round6(b.totalCost));
    const tokenSeries = series.map((b) => b.totalTokens);
    const callSeries = series.map((b) => b.calls);

    // Top 6 models by cost (for the model pie chart)
    const modelBuckets = (overview?.groupBy.buckets ?? []).slice(0, 6);

    const unpriced = overview?.billing.unpricedModels ?? [];
    const hasUnpriced = unpriced.length > 0;

    const handleSavePrice = async (input: OcrModelPriceInput, id?: string) => {
        try {
            if (id) {
                await updateOcrModelPrice(token, id, input);
                onNotify?.(t("ocrUsage", "priceUpdated"), "success");
            } else {
                await createOcrModelPrice(token, input);
                onNotify?.(t("ocrUsage", "priceCreated"), "success");
            }
            await loadConfigLists();
            await loadOverview();
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : t("ocrUsage", "priceSaveFailed"),
                "error",
            );
            throw err;
        }
    };

    const handleDeletePrice = async (id: string) => {
        if (!confirm(t("ocrUsage", "confirmDeletePrice"))) return;
        try {
            await deleteOcrModelPrice(token, id);
            onNotify?.(t("ocrUsage", "priceDeleted"), "success");
            await loadConfigLists();
            await loadOverview();
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : t("ocrUsage", "priceDeleteFailed"),
                "error",
            );
        }
    };

    const handleSnapshotInvoice = async (params: {
        label: string;
        note: string;
    }) => {
        try {
            await createOcrUsageInvoice(token, {
                label: params.label,
                dateFrom,
                dateTo,
                note: params.note || null,
                status: "DRAFT",
            });
            onNotify?.(t("ocrUsage", "invoiceCreated"), "success");
            await loadConfigLists();
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : t("ocrUsage", "invoiceCreateFailed"),
                "error",
            );
            throw err;
        }
    };

    const exportCsv = () => {
        if (!overview) return;
        const rows: string[][] = [
            ["Requested At", "User", "Provider", "Model", "Status", "Type", "Prompt", "Completion", "Total", "Duration ms", "Cost", "Currency"],
        ];
        for (const c of overview.recentCalls) {
            rows.push([
                c.requestedAt,
                c.userName ?? c.userEmail ?? "",
                c.provider,
                c.model,
                c.status,
                c.type,
                String(c.promptTokens ?? ""),
                String(c.completionTokens ?? ""),
                String(c.totalTokens ?? ""),
                c.durationMs != null ? String(c.durationMs) : "",
                c.cost.toFixed(6),
                c.currency,
            ]);
        }
        const csv = rows
            .map((r) =>
                r
                    .map((cell) => {
                        if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
                        return cell;
                    })
                    .join(","),
            )
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ocr-usage-${dateFrom}_${dateTo}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // Build rows with required `id` for DataTable
    const recentRows: RecentCallRow[] = useMemo(
        () =>
            (overview?.recentCalls ?? []).map((r) => ({ ...r, id: r.id })),
        [overview?.recentCalls],
    );
    const invoiceRows: InvoiceRow[] = useMemo(
        () => (invoices ?? []).map((i) => ({ ...i, id: i.id })),
        [invoices],
    );
    const priceRows: PriceRow[] = useMemo(
        () => (prices ?? []).map((p) => ({ ...p, id: p.id })),
        [prices],
    );

    const recentColumns: ColumnDef<RecentCallRow>[] = useMemo(
        () => [
            {
                key: "requestedAt",
                label: t("ocrUsage", "colDate"),
                renderCell: (r) => fmtDate(r.requestedAt),
                sortable: true,
            },
            {
                key: "user",
                label: t("ocrUsage", "colUser"),
                renderCell: (r) => r.userName ?? r.userEmail ?? "—",
            },
            {
                key: "model",
                label: t("ocrUsage", "colModel"),
                renderCell: (r) => `${r.provider} / ${r.model}`,
                sortable: true,
            },
            {
                key: "type",
                label: t("ocrUsage", "colType"),
                renderCell: (r) => r.type,
                sortable: true,
            },
            {
                key: "status",
                label: t("ocrUsage", "colStatus"),
                renderCell: (r) => (
                    <Chip label={r.status} color="success" />
                ),
            },
            {
                key: "tokens",
                label: t("ocrUsage", "colTokens"),
                renderCell: (r) => (
                    <Typography
                        component="span"
                        variant="body2"
                        title={`prompt ${r.promptTokens ?? 0} · completion ${r.completionTokens ?? 0}`}
                    >
                        {formatTokens(toNumber(r.totalTokens))}
                    </Typography>
                ),
                sortable: true,
            },
            {
                key: "duration",
                label: t("ocrUsage", "colDuration"),
                renderCell: (r) =>
                    r.durationMs != null ? `${(r.durationMs / 1000).toFixed(2)}s` : "—",
            },
            {
                key: "cost",
                label: t("ocrUsage", "colCost"),
                renderCell: (r) =>
                    r.matched ? (
                        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(r.cost, r.currency, intlLocale)}</Typography>
                    ) : (
                        <Typography component="span" variant="body2" className="ocr-muted">{t("ocrUsage", "unpriced")}</Typography>
                    ),
                sortable: true,
            },
        ],
        [t, intlLocale],
    );

    const invoiceColumns: ColumnDef<InvoiceRow>[] = useMemo(
        () => [
            {
                key: "label",
                label: t("ocrUsage", "invoiceLabel"),
                renderCell: (i) => i.label,
                sortable: true,
            },
            {
                key: "period",
                label: t("ocrUsage", "invoicePeriod"),
                renderCell: (i) =>
                    `${fmtDate(i.periodStart, false)} → ${fmtDate(i.periodEnd, false)}`,
            },
            {
                key: "calls",
                label: t("ocrUsage", "kpiTotalCalls"),
                renderCell: (i) => fmtNumber(i.totalCalls),
            },
            {
                key: "tokens",
                label: t("ocrUsage", "kpiTotalTokens"),
                renderCell: (i) => formatTokens(i.totalTokens),
            },
            {
                key: "cost",
                label: t("ocrUsage", "kpiTotalCost"),
                renderCell: (i) => formatCurrency(i.totalCost, i.currency, intlLocale),
                sortable: true,
            },
            {
                key: "status",
                label: t("ocrUsage", "colStatus"),
                renderCell: (i) => (
                    <Typography
                        component="span"
                        variant="body2"
                        className={`status-badge ${i.status === "PAID"
                            ? "status-badge--success"
                            : i.status === "ISSUED"
                                ? "status-badge--brand"
                                : i.status === "VOID"
                                    ? "status-badge--error"
                                    : "status-badge--neutral"
                            }`}
                    >
                        {i.status}
                    </Typography>
                ),
            },
            {
                key: "createdAt",
                label: t("ocrUsage", "colDate"),
                renderCell: (i) => fmtDate(i.createdAt),
                sortable: true,
            },
        ],
        [t, intlLocale],
    );

    return (
        <div className="ocr-usage-container" data-testid="ocr-usage-dashboard">
            <header className="ocr-usage-header">
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={t("common", "refresh")}>
                        <IconButton
                            onClick={loadOverview}
                            size="small"
                            data-testid="ocr-usage-refresh"
                        >
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={exportCsv}
                        startIcon={<DownloadIcon fontSize="small" />}
                        disabled={!overview || overview.recentCalls.length === 0}
                    >
                        {t("ocrUsage", "exportCsv")}
                    </Button>
                    {isSysAdminViewer && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setInvoiceDialogOpen(true)}
                            startIcon={<ReceiptLongIcon fontSize="small" />}
                            disabled={!overview || overview.totals.totalCalls === 0}
                        >
                            {t("ocrUsage", "createInvoice")}
                        </Button>
                    )}
                    {isSysAdminViewer && (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => setConfigOpen(true)}
                            data-testid="ocr-usage-open-config"
                        >
                            {t("ocrUsage", "configurePricing")}
                        </Button>
                    )}
                </Stack>
            </header>

            {/* Filter bar */}
            <div className="ocr-usage-filters panel-card">
                <div className="ocr-usage-filters__presets">
                    {(
                        [
                            ["7d", t("ocrUsage", "preset7d")],
                            ["30d", t("ocrUsage", "preset30d")],
                            ["mtd", t("ocrUsage", "presetMtd")],
                            ["qtd", t("ocrUsage", "presetQtd")],
                            ["ytd", t("ocrUsage", "presetYtd")],
                            ["custom", t("ocrUsage", "presetCustom")],
                        ] as Array<[DateRangePreset, string]>
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            className={`ocr-chip${preset === key ? " ocr-chip--active" : ""}`}
                            onClick={() => applyPreset(key)}
                            data-testid={`ocr-preset-${key}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="ocr-usage-filters__custom">
                    <TextField
                        size="small"
                        type="date"
                        label={t("ocrUsage", "from")}
                        value={dateFrom}
                        onChange={(e) => {
                            setPreset("custom");
                            setDateFrom(e.target.value);
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                        inputProps={{ "data-testid": "ocr-date-from", max: dateTo || undefined }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label={t("ocrUsage", "to")}
                        value={dateTo}
                        onChange={(e) => {
                            setPreset("custom");
                            setDateTo(e.target.value);
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                        inputProps={{ "data-testid": "ocr-date-to", min: dateFrom || undefined }}
                    />
                    <TextField
                        select
                        size="small"
                        label={t("ocrUsage", "granularity")}
                        value={granularity}
                        onChange={(e) =>
                            setGranularity(e.target.value as typeof granularity)
                        }
                        sx={{ minWidth: 130 }}
                    >
                        <MenuItem value="day">{t("ocrUsage", "granularityDay")}</MenuItem>
                        <MenuItem value="week">{t("ocrUsage", "granularityWeek")}</MenuItem>
                        <MenuItem value="month">{t("ocrUsage", "granularityMonth")}</MenuItem>
                    </TextField>
                    <TextField
                        select
                        size="small"
                        label={t("ocrUsage", "status")}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        sx={{ minWidth: 130 }}
                    >
                        <MenuItem value="">{t("common", "all")}</MenuItem>
                        <MenuItem value="SUCCESS">SUCCESS</MenuItem>
                        <MenuItem value="FAILED">FAILED</MenuItem>
                        <MenuItem value="ERROR">ERROR</MenuItem>
                        <MenuItem value="PARSE_ERROR">PARSE_ERROR</MenuItem>
                    </TextField>
                    <TextField
                        select
                        size="small"
                        label={t("ocrUsage", "provider")}
                        value={draftProvider}
                        onChange={(e) => {
                            setDraftProvider(e.target.value);
                            setDebouncedFilters(e.target.value, draftModel);
                        }}
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value="">{t("common", "all")}</MenuItem>
                        {Array.from(new Set(availableModels.map((m) => m.provider))).sort().map((p) => (
                            <MenuItem key={p} value={p}>{p}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        size="small"
                        label={t("ocrUsage", "model")}
                        value={draftModel}
                        onChange={(e) => {
                            setDraftModel(e.target.value);
                            setDebouncedFilters(draftProvider, e.target.value);
                        }}
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">{t("common", "all")}</MenuItem>
                        {availableModels
                            .filter((m) => !draftProvider || m.provider === draftProvider)
                            .map((m) => (
                                <MenuItem key={`${m.provider}/${m.model}`} value={m.model}>
                                    {m.provider} / {m.model}
                                    {!m.priced && (
                                        <span className="ocr-chip ocr-chip--unpriced" style={{ marginLeft: 6 }}>
                                            unpriced
                                        </span>
                                    )}
                                </MenuItem>
                            ))}
                    </TextField>
                </div>
            </div>

            {error && (
                <div className="ocr-banner ocr-banner--error" role="alert">
                    {error}
                </div>
            )}

            {overview && !overview.billing.enabled && (
                <div className="ocr-banner ocr-banner--info" role="status">
                    <div>
                        <strong>{t("ocrUsage", "billingDisabledTitle")}</strong>
                        <div className="ocr-banner__detail">
                            {t("ocrUsage", "billingDisabledDesc")}
                        </div>
                    </div>
                    {isSysAdminViewer && (
                        <Button size="small" variant="outlined" onClick={() => setConfigOpen(true)}>
                            {t("ocrUsage", "configurePricing")}
                        </Button>
                    )}
                </div>
            )}

            {hasUnpriced && !loading && (
                <div className="ocr-banner ocr-banner--warning" role="status">
                    <div>
                        <strong>{t("ocrUsage", "unpricedWarningTitle")}</strong>
                        <div className="ocr-banner__detail">
                            {t("ocrUsage", "unpricedWarningDesc", {
                                models: unpriced.slice(0, 6).join(", "),
                                more: unpriced.length > 6
                                    ? t("ocrUsage", "andMore", { n: unpriced.length - 6 })
                                    : "",
                            })}
                        </div>
                    </div>
                    {isSysAdminViewer && (
                        <Button size="small" variant="outlined" onClick={() => setConfigOpen(true)}>
                            {t("ocrUsage", "configurePricing")}
                        </Button>
                    )}
                </div>
            )}

            {loading && !overview ? (
                <LoadingState message={t("common", "loading")} />
            ) : !overview ? (
                <EmptyState message={t("common", "noData")} />
            ) : (
                <div className={loading ? "ocr-content--refreshing" : undefined}>
                    {/* KPI grid */}
                    <div className="ocr-kpi-grid">
                        <KpiCard
                            label={t("ocrUsage", "kpiTotalCalls")}
                            value={fmtNumber(overview.totals.totalCalls)}
                            hint={`${fmtNumber(overview.totals.billableCalls)} ${t("ocrUsage", "billable")}`}
                            tone="brand"
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiSuccessRate")}
                            value={fmtPercent(overview.totals.successRate)}
                            hint={`${fmtNumber(overview.totals.successfulCalls)} ${t("ocrUsage", "successful")}`}
                            tone={
                                overview.totals.successRate !== null &&
                                    overview.totals.successRate >= 0.9
                                    ? "success"
                                    : "warning"
                            }
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiPromptTokens")}
                            value={formatTokens(overview.totals.totalPromptTokens)}
                            hint={t("ocrUsage", "inputHint")}
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiCompletionTokens")}
                            value={formatTokens(overview.totals.totalCompletionTokens)}
                            hint={t("ocrUsage", "outputHint")}
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiTotalCost")}
                            value={formatCurrency(overview.totals.totalCost, currency, intlLocale)}
                            hint={
                                overview.totals.unmatchedCalls > 0
                                    ? t("ocrUsage", "unmatchedCallsHint", {
                                        n: overview.totals.unmatchedCalls,
                                    })
                                    : isSysAdminViewer
                                        ? t("ocrUsage", "baseMarkupFee", {
                                            base: formatCurrency(
                                                overview.totals.baseCost,
                                                currency,
                                                intlLocale,
                                            ),
                                            markup: formatCurrency(
                                                overview.totals.markupCost,
                                                currency,
                                                intlLocale,
                                            ),
                                            fee: formatCurrency(
                                                overview.totals.fixedFeeCost,
                                                currency,
                                                intlLocale,
                                            ),
                                        })
                                        : t("ocrUsage", "totalCostSimpleHint", {
                                            calls: fmtNumber(overview.totals.billableCalls),
                                        })
                            }
                            tone="brand"
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiAvgCost")}
                            value={formatCurrency(
                                overview.totals.avgCostPerCall,
                                currency,
                                intlLocale,
                            )}
                            hint={t("ocrUsage", "perSuccessfulCall")}
                        />
                        <KpiCard
                            label={t("ocrUsage", "kpiAvgLatency")}
                            value={
                                overview.totals.avgDurationMs != null
                                    ? `${(overview.totals.avgDurationMs / 1000).toFixed(2)}s`
                                    : "—"
                            }
                            hint={t("ocrUsage", "successfulCalls")}
                        />
                    </div>

                    {/* Time series */}
                    <div className="ocr-grid-2">
                        <div className="panel-card">
                            <div className="ocr-panel__title">
                                {t("ocrUsage", "chartCostOverTime")}
                            </div>
                            <div className="ocr-panel__subtitle">
                                {t("ocrUsage", "chartCostHint")}
                            </div>
                            <GradientLineChart
                                xData={xData}
                                yData={costSeries}
                                label={t("ocrUsage", "kpiTotalCost")}
                                color="#3b82f6"
                                height={260}
                                emptyMessage={t("ocrUsage", "noDataInRange")}
                            />
                        </div>
                        <div className="panel-card">
                            <div className="ocr-panel__title">
                                {t("ocrUsage", "chartTokensOverTime")}
                            </div>
                            <div className="ocr-panel__subtitle">
                                {t("ocrUsage", "chartTokensHint")}
                            </div>
                            <GradientLineChart
                                xData={xData}
                                yData={tokenSeries}
                                label={t("ocrUsage", "kpiTotalTokens")}
                                color="#a855f7"
                                height={260}
                                emptyMessage={t("ocrUsage", "noDataInRange")}
                            />
                        </div>
                    </div>

                    <div className="ocr-grid-2">
                        <div className="panel-card">
                            <div className="ocr-panel__title">
                                {t("ocrUsage", "chartCallsOverTime")}
                            </div>
                            <GradientLineChart
                                xData={xData}
                                yData={callSeries}
                                label={t("ocrUsage", "kpiTotalCalls")}
                                color="#10b981"
                                height={220}
                                emptyMessage={t("ocrUsage", "noDataInRange")}
                            />
                        </div>
                        <div className="panel-card">
                            <div className="ocr-panel__title">
                                {t("ocrUsage", "chartCostByModel")}
                            </div>
                            <div className="ocr-panel__subtitle">
                                {t("ocrUsage", "chartModelHint")}
                            </div>
                            {modelBuckets.length > 0 ? (
                                <div className="ocr-model-pie">
                                    <PieChart
                                        height={220}
                                        series={[
                                            {
                                                data: modelBuckets.map((bucket, index) => ({
                                                    id: bucket.key,
                                                    value: round6(bucket.totalCost),
                                                    label: bucket.label,
                                                    color: [
                                                        "#3b82f6",
                                                        "#10b981",
                                                        "#f59e0b",
                                                        "#ef4444",
                                                        "#8b5cf6",
                                                        "#06b6d4",
                                                    ][index % 6],
                                                })),
                                                innerRadius: 48,
                                                outerRadius: 88,
                                                paddingAngle: 2,
                                                cornerRadius: 4,
                                            },
                                        ]}
                                        slotProps={{
                                            legend: {
                                                direction: "vertical",
                                                position: { vertical: "middle", horizontal: "end" },
                                            },
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="ocr-muted ocr-empty">
                                    {t("ocrUsage", "noDataInRange")}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top users */}
                    <div className="ocr-grid-1">
                        <TopUsersTable
                            title={t("ocrUsage", "topUsers")}
                            items={overview.top.users}
                            currency={currency}
                            locale={intlLocale}
                            emptyMessage={t("ocrUsage", "noDataInRange")}
                        />
                    </div>

                    {/* Recent calls table */}
                    <div className="panel-card">
                        <div className="ocr-panel__title">
                            {t("ocrUsage", "recentCalls")}
                        </div>
                        <div className="ocr-panel__subtitle">
                            {t("ocrUsage", "recentCallsHint")}
                        </div>
                        <DataTable<RecentCallRow>
                            tableId="ocr-usage-recent"
                            columns={recentColumns}
                            rows={recentRows}
                            sortState={{ column: "requestedAt", direction: "desc" }}
                            emptyMessage={t("ocrUsage", "noDataInRange")}
                            t={t}
                        />
                    </div>

                    {/* Existing invoice snapshots — sys-admin only. Admins can
                        consult the live usage numbers but are not allowed to
                        see the historical invoice-snapshot list. */}
                    {isSysAdminViewer && (
                        <div className="panel-card">
                            <div className="ocr-panel__title">
                                {t("ocrUsage", "savedInvoices")}
                            </div>
                            <div className="ocr-panel__subtitle">
                                {t("ocrUsage", "savedInvoicesHint")}
                            </div>
                            {invoiceRows.length === 0 ? (
                                <div className="ocr-muted ocr-empty">
                                    {t("ocrUsage", "noInvoicesYet")}
                                </div>
                            ) : (
                                <DataTable<InvoiceRow>
                                    tableId="ocr-usage-invoices"
                                    columns={invoiceColumns}
                                    rows={invoiceRows}
                                    sortState={{ column: "createdAt", direction: "desc" }}
                                    emptyMessage={t("ocrUsage", "noInvoicesYet")}
                                    t={t}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            <OcrPricingConfigDialog
                open={configOpen}
                onClose={() => setConfigOpen(false)}
                prices={priceRows}
                availableModels={availableModels}
                billingConfig={billingConfig}
                onSave={handleSavePrice}
                onDelete={handleDeletePrice}
                onSaveBillingConfig={handleSaveBillingConfig}
                onNotify={onNotify}
            />

            <OcrInvoiceDialog
                open={invoiceDialogOpen}
                onClose={() => setInvoiceDialogOpen(false)}
                periodLabel={`${dateFrom} → ${dateTo}`}
                totalCost={overview?.totals.totalCost ?? 0}
                currency={currency}
                onSubmit={handleSnapshotInvoice}
                onNotify={onNotify}
            />
        </div>
    );
}

function TopUsersTable({
    title,
    items,
    currency,
    locale,
    emptyMessage,
}: {
    title: string;
    items: OcrUsageBucket[];
    currency: string;
    locale: string;
    emptyMessage: string;
}) {
    return (
        <div className="panel-card">
            <div className="ocr-panel__title">{title}</div>
            {items.length === 0 ? (
                <div className="ocr-muted ocr-empty">{emptyMessage}</div>
            ) : (
                <Table size="small" className="ocr-top-users-table">
                    <TableHead>
                        <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell align="right">Calls</TableCell>
                            <TableCell align="right">Tokens</TableCell>
                            <TableCell align="right">Cost</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((it) => (
                            <TableRow key={it.key} hover>
                                <TableCell title={it.label}>{it.label}</TableCell>
                                <TableCell align="right">{fmtNumber(it.calls)}</TableCell>
                                <TableCell align="right">{formatTokens(it.totalTokens)}</TableCell>
                                <TableCell align="right">
                                    <strong>{formatCurrency(it.totalCost, currency, locale)}</strong>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}

// ============================================================================
// Pricing config dialog
// ============================================================================
function OcrPricingConfigDialog({
    open,
    onClose,
    prices,
    availableModels,
    billingConfig,
    onSave,
    onDelete,
    onSaveBillingConfig,
    onNotify,
}: {
    open: boolean;
    onClose: () => void;
    prices: PriceRow[];
    availableModels: OcrAvailableModel[];
    billingConfig: OcrBillingConfig | null;
    onSave: (input: OcrModelPriceInput, id?: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSaveBillingConfig: (patch: Partial<OcrBillingConfig>) => Promise<void>;
    onNotify?: (message: string, tone: "success" | "error") => void;
}) {
    const { t } = useI18n();
    const [editing, setEditing] = useState<PriceRow | null>(null);
    const [creating, setCreating] = useState<OcrModelPriceInput | null>(null);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return prices;
        return prices.filter(
            (p) =>
                p.provider.toLowerCase().includes(term) ||
                p.model.toLowerCase().includes(term) ||
                p.currency.toLowerCase().includes(term),
        );
    }, [prices, search]);

    const unpricedModels = availableModels.filter((m) => !m.priced);

    const startCreate = (prefill?: { provider: string; model: string }) => {
        setCreating({
            provider: prefill?.provider ?? "",
            model: prefill?.model ?? "",
            inputPricePer1kTokens: 0,
            outputPricePer1kTokens: 0,
            currency: "USD",
            unitTokens: 1000,
            isActive: true,
        });
        setEditing(null);
    };

    const priceColumns: ColumnDef<PriceRow>[] = useMemo(
        () => [
            {
                key: "provider",
                label: t("ocrUsage", "colProvider"),
                renderCell: (p) => p.provider,
                sortable: true,
            },
            {
                key: "model",
                label: t("ocrUsage", "colModel"),
                renderCell: (p) => p.model,
                sortable: true,
            },
            {
                key: "input",
                label: t("ocrUsage", "colInputPrice"),
                renderCell: (p) => p.inputPricePer1kTokens.toFixed(6),
            },
            {
                key: "output",
                label: t("ocrUsage", "colOutputPrice"),
                renderCell: (p) => p.outputPricePer1kTokens.toFixed(6),
            },
            {
                key: "unit",
                label: t("ocrUsage", "colUnit"),
                renderCell: (p) =>
                    `${formatTokens(p.unitTokens)} ${t("ocrUsage", "tokens")}`,
            },
            { key: "currency", label: "Cur.", renderCell: (p) => p.currency },
            {
                key: "active",
                label: t("ocrUsage", "colActive"),
                renderCell: (p) => (
                    <Typography
                        component="span"
                        variant="body2"
                        className={`status-badge ${p.isActive ? "status-badge--success" : "status-badge--neutral"
                            }`}
                    >
                        {p.isActive ? t("common", "yes") : t("common", "no")}
                    </Typography>
                ),
            },
            {
                key: "actions",
                label: "",
                renderCell: (p) => (
                    <Stack direction="row" spacing={0.5}>
                        <IconButton
                            size="small"
                            onClick={() => {
                                setEditing(p);
                                setCreating(null);
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => onDelete(p.id)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                ),
            },
        ],
        [t, onDelete],
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t("ocrUsage", "configTitle")}</DialogTitle>
            <DialogContent dividers>
                <div className="ocr-pricing__intro">
                    {t("ocrUsage", "configIntro")}
                </div>

                <OcrBillingSettingsPanel
                    config={billingConfig}
                    onSave={onSaveBillingConfig}
                    onNotify={onNotify}
                />

                {unpricedModels.length > 0 && (
                    <div className="ocr-pricing__seed">
                        <div className="ocr-pricing__seed-title">
                            {t("ocrUsage", "modelsToPrice")}
                        </div>
                        <div className="ocr-pricing__seed-list">
                            {unpricedModels.slice(0, 20).map((m) => (
                                <button
                                    key={`${m.provider}/${m.model}`}
                                    type="button"
                                    className="ocr-chip"
                                    onClick={() =>
                                        startCreate({ provider: m.provider, model: m.model })
                                    }
                                    title={t("ocrUsage", "addPriceFor", {
                                        model: `${m.provider} / ${m.model}`,
                                    })}
                                >
                                    <AddIcon fontSize="inherit" /> {m.provider} / {m.model}{" "}
                                    <span className="ocr-chip__count">({m.calls})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="ocr-pricing__toolbar">
                    <TextField
                        size="small"
                        label={t("common", "search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => startCreate()}
                    >
                        {t("ocrUsage", "addPrice")}
                    </Button>
                </div>

                <DataTable<PriceRow>
                    tableId="ocr-pricing-table"
                    columns={priceColumns}
                    rows={filtered}
                    sortState={{ column: "provider", direction: "asc" }}
                    emptyMessage={t("ocrUsage", "noPricesConfigured")}
                    t={t}
                />

                {(creating || editing) && (
                    <OcrPriceForm
                        initial={creating ?? mapToInput(editing!)}
                        existingId={editing?.id}
                        onCancel={() => {
                            setCreating(null);
                            setEditing(null);
                        }}
                        onSave={async (input) => {
                            if (editing) {
                                await onSave(input, editing.id);
                            } else {
                                await onSave(input);
                            }
                            setCreating(null);
                            setEditing(null);
                        }}
                        onNotify={onNotify}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t("common", "close")}</Button>
            </DialogActions>
        </Dialog>
    );
}

function mapToInput(p: OcrModelPriceItem): OcrModelPriceInput {
    return {
        provider: p.provider,
        model: p.model,
        inputPricePer1kTokens: p.inputPricePer1kTokens,
        outputPricePer1kTokens: p.outputPricePer1kTokens,
        currency: p.currency,
        unitTokens: p.unitTokens,
        isActive: p.isActive,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
        note: p.note,
    };
}

function OcrPriceForm({
    initial,
    existingId,
    onCancel,
    onSave,
    onNotify,
}: {
    initial: OcrModelPriceInput;
    existingId?: string;
    onCancel: () => void;
    onSave: (input: OcrModelPriceInput) => Promise<void>;
    onNotify?: (message: string, tone: "success" | "error") => void;
}) {
    const { t } = useI18n();
    const [form, setForm] = useState<OcrModelPriceInput>(initial);
    const [submitting, setSubmitting] = useState(false);

    const handle = async () => {
        if (!form.provider.trim() || !form.model.trim()) {
            onNotify?.(t("ocrUsage", "providerModelRequired"), "error");
            return;
        }
        if (form.inputPricePer1kTokens < 0 || form.outputPricePer1kTokens < 0) {
            onNotify?.(t("ocrUsage", "priceMustBeNonNegative"), "error");
            return;
        }
        setSubmitting(true);
        try {
            await onSave(form);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box className="ocr-price-form" sx={{ mt: 2 }}>
            <div className="ocr-price-form__title">
                {existingId ? t("ocrUsage", "editPrice") : t("ocrUsage", "newPrice")}
            </div>
            <div className="ocr-price-form__grid">
                <TextField
                    size="small"
                    label={t("ocrUsage", "colProvider")}
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    fullWidth
                />
                <TextField
                    size="small"
                    label={t("ocrUsage", "colModel")}
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    fullWidth
                />
                <TextField
                    size="small"
                    type="number"
                    label={t("ocrUsage", "inputPricePer1k")}
                    value={form.inputPricePer1kTokens}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            inputPricePer1kTokens: Number(e.target.value),
                        })
                    }
                    inputProps={{ min: 0, step: 0.000001 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    type="number"
                    label={t("ocrUsage", "outputPricePer1k")}
                    value={form.outputPricePer1kTokens}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            outputPricePer1kTokens: Number(e.target.value),
                        })
                    }
                    inputProps={{ min: 0, step: 0.000001 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    label={t("ocrUsage", "colUnit")}
                    select
                    value={String(form.unitTokens ?? 1000)}
                    onChange={(e) =>
                        setForm({ ...form, unitTokens: Number(e.target.value) })
                    }
                    fullWidth
                >
                    <MenuItem value="1000">{t("ocrUsage", "per1k")}</MenuItem>
                    <MenuItem value="1000000">{t("ocrUsage", "per1M")}</MenuItem>
                </TextField>
                <TextField
                    size="small"
                    label={t("ocrUsage", "colCurrency")}
                    value={form.currency ?? "USD"}
                    onChange={(e) =>
                        setForm({ ...form, currency: e.target.value.toUpperCase() })
                    }
                    inputProps={{ maxLength: 3 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    label={t("ocrUsage", "colNote")}
                    value={form.note ?? ""}
                    onChange={(e) => setForm({ ...form, note: e.target.value || null })}
                    fullWidth
                />
                <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1, pl: 1 }}
                >
                    <Switch
                        checked={form.isActive ?? true}
                        onChange={(_, v) => setForm({ ...form, isActive: v })}
                    />
                    <span>{t("ocrUsage", "colActive")}</span>
                </Box>
            </div>
            <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 2 }}
                justifyContent="flex-end"
            >
                <Button onClick={onCancel} disabled={submitting}>
                    {t("common", "cancel")}
                </Button>
                <Button variant="contained" onClick={handle} disabled={submitting}>
                    {t("common", "save")}
                </Button>
            </Stack>
        </Box>
    );
}

// ============================================================================
// Invoice snapshot dialog
// ============================================================================
function OcrInvoiceDialog({
    open,
    onClose,
    periodLabel,
    totalCost,
    currency,
    onSubmit,
    onNotify,
}: {
    open: boolean;
    onClose: () => void;
    periodLabel: string;
    totalCost: number;
    currency: string;
    onSubmit: (input: { label: string; note: string }) => Promise<void>;
    onNotify?: (message: string, tone: "success" | "error") => void;
}) {
    const { t, locale } = useI18n();
    const intlLocale = locale === "es" ? "es-ES" : "en-US";
    const [label, setLabel] = useState("");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setLabel(
                t("ocrUsage", "defaultInvoiceLabel", {
                    period: new Date().toISOString().slice(0, 10),
                }),
            );
            setNote("");
        }
    }, [open, t]);

    const submit = async () => {
        if (!label.trim()) {
            onNotify?.(t("ocrUsage", "labelRequired"), "error");
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit({ label: label.trim(), note: note.trim() });
            onClose();
        } catch {
            // error already surfaced via onNotify
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t("ocrUsage", "createInvoice")}</DialogTitle>
            <DialogContent dividers>
                <div className="ocr-invoice-dialog__summary">
                    <Typography variant="body2">
                        <strong>{t("ocrUsage", "invoicePeriod")}:</strong> {periodLabel}
                    </Typography>
                    <Typography variant="body2">
                        <strong>{t("ocrUsage", "kpiTotalCost")}:</strong>{" "}
                        {formatCurrency(totalCost, currency, intlLocale)}
                    </Typography>
                </div>
                <TextField
                    sx={{ mt: 2 }}
                    size="small"
                    fullWidth
                    label={t("ocrUsage", "invoiceLabel")}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
                <TextField
                    sx={{ mt: 2 }}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    label={t("ocrUsage", "invoiceNote")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
                <div className="ocr-invoice-dialog__hint">
                    {t("ocrUsage", "invoiceSnapshotHint")}
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>
                    {t("common", "cancel")}
                </Button>
                <Button variant="contained" onClick={submit} disabled={submitting}>
                    {t("ocrUsage", "createInvoice")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ============================================================================
// Billing settings panel (inside the pricing config dialog)
// ============================================================================
function OcrBillingSettingsPanel({
    config,
    onSave,
    onNotify,
}: {
    config: OcrBillingConfig | null;
    onSave: (patch: Partial<OcrBillingConfig>) => Promise<void>;
    onNotify?: (message: string, tone: "success" | "error") => void;
}) {
    const { t } = useI18n();
    const [draft, setDraft] = useState<OcrBillingConfig | null>(config);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setDraft(config);
        setDirty(false);
    }, [config]);

    if (!draft) {
        return (
            <div className="ocr-billing-panel">
                <div className="ocr-muted">{t("ocrUsage", "billingLoading")}</div>
            </div>
        );
    }

    const update = <K extends keyof OcrBillingConfig>(
        key: K,
        value: OcrBillingConfig[K],
    ) => {
        setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
        setDirty(true);
    };

    const save = async () => {
        if (!dirty) return;
        setSaving(true);
        try {
            await onSave(draft);
            setDirty(false);
            onNotify?.(t("ocrUsage", "billingSaved"), "success");
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : t("ocrUsage", "billingSaveFailed"),
                "error",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="ocr-billing-panel">
            <div className="ocr-billing-panel__title">
                {t("ocrUsage", "billingPanelTitle")}
            </div>
            <div className="ocr-billing-panel__row">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                    <Switch
                        checked={draft.ocrBillingEnabled}
                        onChange={(_, v) => update("ocrBillingEnabled", v)}
                        data-testid="ocr-billing-enabled"
                    />
                    <div>
                        <div style={{ fontWeight: 500 }}>
                            {t("ocrUsage", "billingEnabledLabel")}
                        </div>
                        <div className="ocr-billing-panel__hint">
                            {t("ocrUsage", "billingEnabledHint")}
                        </div>
                    </div>
                </Box>
            </div>
            <div className="ocr-billing-panel__grid">
                <TextField
                    size="small"
                    type="number"
                    label={t("ocrUsage", "markupPercent")}
                    value={draft.ocrBillingMarkupPercent}
                    onChange={(e) =>
                        update("ocrBillingMarkupPercent", Number(e.target.value))
                    }
                    inputProps={{ min: 0, step: 0.1 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    type="number"
                    label={t("ocrUsage", "fixedFeePerCall")}
                    value={draft.ocrBillingFixedFeePerCall}
                    onChange={(e) =>
                        update("ocrBillingFixedFeePerCall", Number(e.target.value))
                    }
                    inputProps={{ min: 0, step: 0.0001 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    label={t("ocrUsage", "colCurrency")}
                    value={draft.ocrBillingCurrency}
                    onChange={(e) =>
                        update("ocrBillingCurrency", e.target.value.toUpperCase())
                    }
                    inputProps={{ maxLength: 3 }}
                    fullWidth
                />
                <TextField
                    size="small"
                    select
                    label={t("ocrUsage", "colUnit")}
                    value={String(draft.ocrBillingUnitTokens)}
                    onChange={(e) =>
                        update("ocrBillingUnitTokens", Number(e.target.value))
                    }
                    fullWidth
                >
                    <MenuItem value="1000">{t("ocrUsage", "per1k")}</MenuItem>
                    <MenuItem value="1000000">{t("ocrUsage", "per1M")}</MenuItem>
                </TextField>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        pl: 1,
                        gridColumn: "1 / -1",
                    }}
                >
                    <Switch
                        checked={draft.ocrBillingIncludeFailedCalls}
                        onChange={(_, v) =>
                            update("ocrBillingIncludeFailedCalls", v)
                        }
                    />
                    <div>
                        <div style={{ fontWeight: 500 }}>
                            {t("ocrUsage", "includeFailedCalls")}
                        </div>
                        <div className="ocr-billing-panel__hint">
                            {t("ocrUsage", "includeFailedCallsHint")}
                        </div>
                    </div>
                </Box>
            </div>
            {dirty && (
                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                    sx={{ mt: 2 }}
                >
                    <Button
                        size="small"
                        onClick={() => {
                            setDraft(config);
                            setDirty(false);
                        }}
                        disabled={saving}
                    >
                        {t("common", "cancel")}
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={save}
                        disabled={saving}
                        data-testid="ocr-billing-save"
                    >
                        {t("common", "save")}
                    </Button>
                </Stack>
            )}
        </div>
    );
}
