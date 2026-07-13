"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { alpha, Box, Button, Chip, Stack, Typography, useTheme } from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SessionState } from "../../lib/authSession";
import { DataTable, DateInput, TableFilterButton, TableFiltersDialog, type ColumnDef } from "../ui";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { FormSelect } from "../ui/FormSelect";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDateTime } from "../../lib/formatPreferences";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useLogTableToolbar } from "./logTableToolbar";

interface CronLogEntry {
    id: string;
    executedAt: string;
    jobName: string;
    jobType: string;
    status: string;
    duration?: number;
    totalProcessed: number;
    totalAffected: number;
    metadata?: {
        expiredIds?: string[];
        schedule?: string;
        timezone?: string;
        source?: string;
    };
    errorMessage?: string;
}

export interface CronLogsPanelProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

type CronLogsViewState = {
    status: string;
    source: string;
    dateFrom: string;
    dateTo: string;
};

const CRON_LOG_VIEWS_STORAGE_KEY = "axpo_cron_log_saved_views";

export function CronLogsPanel({ session, onNotify }: CronLogsPanelProps) {
    const cachePolicy = useRequestCachePolicy("logs");
    const theme = useTheme();
    const { locale, t } = useI18n();
    const { preferences } = useUserPreferences();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Applied filters
    const [filterStatus, setFilterStatus] = useState("");
    const [filterSource, setFilterSource] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    // Local (pending) filter state
    const [localStatus, setLocalStatus] = useState("");
    const [localSource, setLocalSource] = useState("");
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(null);
    const [localDateTo, setLocalDateTo] = useState<Date | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        if (!filtersOpen) return;
        setLocalStatus(filterStatus);
        setLocalSource(filterSource);
        setLocalDateFrom(filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null);
        setLocalDateTo(filterDateTo ? new Date(`${filterDateTo}T00:00:00`) : null);
    }, [filterDateFrom, filterDateTo, filterSource, filterStatus, filtersOpen]);

    const formatDate = useCallback((isoString: string) => {
        return formatDisplayDateTime(isoString, preferences, { includeSeconds: true, fallback: isoString });
    }, [preferences]);

    const toDateOnly = (d: Date | null) => {
        if (!d) return "";
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const handleSearch = () => {
        setFilterStatus(localStatus);
        setFilterSource(localSource);
        setFilterDateFrom(toDateOnly(localDateFrom));
        setFilterDateTo(toDateOnly(localDateTo));
        setPage(1);
        setFiltersOpen(false);
    };

    const handleClear = () => {
        setLocalStatus(""); setLocalSource(""); setLocalDateFrom(null); setLocalDateTo(null);
        setFilterStatus(""); setFilterSource(""); setFilterDateFrom(""); setFilterDateTo("");
        setPage(1);
        setFiltersOpen(false);
    };
    const activeFilterCount = [filterStatus, filterSource, filterDateFrom || filterDateTo].filter(Boolean).length;

    const currentView = useMemo<CronLogsViewState>(() => ({
        status: filterStatus,
        source: filterSource,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
    }), [filterDateFrom, filterDateTo, filterSource, filterStatus]);

    const applyView = useCallback((view: CronLogsViewState) => {
        setFilterStatus(view.status ?? "");
        setFilterSource(view.source ?? "");
        setFilterDateFrom(view.dateFrom ?? "");
        setFilterDateTo(view.dateTo ?? "");
        setPage(1);
    }, []);

    const builtInViews = useMemo<Array<{ id: string; name: string; view: CronLogsViewState }>>(() => [
        { id: "recent", name: t("simulationsModule", "presetRecent"), view: { status: "", source: "", dateFrom: "", dateTo: "" } },
        { id: "success", name: t("logs", "success"), view: { status: "SUCCESS", source: "", dateFrom: "", dateTo: "" } },
        { id: "failed", name: t("logs", "failed"), view: { status: "FAILED", source: "", dateFrom: "", dateTo: "" } },
        { id: "manual", name: t("logs", "manualApi"), view: { status: "", source: "api", dateFrom: "", dateTo: "" } },
        { id: "scheduled", name: t("logs", "scheduled"), view: { status: "", source: "scheduled", dateFrom: "", dateTo: "" } },
    ], [t]);

    const {
        activeViewPresetId,
        openSaveViewDialog,
        saveViewDialog,
        searchProps,
    } = useLogTableToolbar<CronLogsViewState>({
        storageKey: CRON_LOG_VIEWS_STORAGE_KEY,
        currentView,
        presets: builtInViews,
        applyView,
        searchValue: searchTerm,
        onSearchChange: (value) => {
            setSearchTerm(value);
            setPage(1);
        },
        searchPlaceholder: t("search", "auditLogs"),
        t,
    });

    const toolbarFilterCount = activeViewPresetId ? 0 : activeFilterCount;

    const { data, isFetching, error } = useQuery({
        queryKey: ["cron-logs", session.token, page, pageSize, filterStatus, filterSource, searchTerm, filterDateFrom, filterDateTo],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (filterStatus) params.append("status", filterStatus);
            if (filterSource) params.append("source", filterSource);
            if (searchTerm) params.append("search", searchTerm);
            if (filterDateFrom) params.append("dateFrom", filterDateFrom);
            if (filterDateTo) params.append("dateTo", filterDateTo);

            const response = await fetch(`/api/v1/internal/cron-logs?${params}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch cron logs");

            const data = await response.json();
            return {
                items: data.data?.items || [],
                total: data.data?.pagination?.total || 0,
            };
        },
        placeholderData: keepPreviousData,
        ...cachePolicy,
    });

    useEffect(() => {
        if (error) {
            onNotify?.(t("logs", "loadCronLogsFailed"), "error");
        }
    }, [error, onNotify, t]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;
    const loading = isFetching;

    const columns: ColumnDef<CronLogEntry>[] = [
        {
            key: "executedAt",
            label: t("logs", "timestamp"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDate(log.executedAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.executedAt), { addSuffix: true, locale: locale === "es" ? es : undefined })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "status",
            label: t("logs", "status"),
            renderCell: (log) => {
                const isSuccess = log.status === "SUCCESS";
                return (
                    <Chip
                        icon={isSuccess ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ErrorIcon sx={{ fontSize: 16 }} />}
                        label={isSuccess ? t("logs", "success") : t("logs", "failed")}
                        size="small"
                        sx={{
                            fontWeight: 600,
                            height: 26,
                            color: isSuccess ? theme.palette.success.main : theme.palette.error.main,
                            backgroundColor: isSuccess
                                ? alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.14)
                                : alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
                            "& .MuiChip-icon": {
                                color: isSuccess ? theme.palette.success.main : theme.palette.error.main,
                            },
                        }}
                    />
                );
            },
        },
        {
            key: "totalAffected",
            label: t("logs", "simulationsExpired"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 700,
                            color: log.totalAffected > 0 ? "primary.main" : "text.secondary",
                        }}
                    >
                        {log.totalAffected}
                    </Typography>
                    {log.totalAffected > 0 && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {t("logs", "expired")}
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            key: "duration",
            label: t("logs", "duration"),
            renderCell: (log) => (
                <Chip
                    label={log.duration ? `${log.duration}ms` : "—"}
                    size="small"
                    variant="outlined"
                    sx={{
                        fontFamily: "monospace",
                        fontWeight: 600,
                        height: 24,
                        borderColor: "divider",
                        color: "text.secondary",
                    }}
                />
            ),
        },
        {
            key: "schedule",
            label: t("logs", "triggerSource"),
            renderCell: (log) => {
                const source = log.metadata?.source || "scheduled";
                const isApi = source === "api";
                return (
                    <Chip
                        label={isApi ? t("logs", "manualApi") : t("logs", "scheduled")}
                        size="small"
                        sx={{
                            fontWeight: 600,
                            height: 24,
                            backgroundColor: isApi
                                ? alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.2 : 0.16)
                                : alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.2 : 0.14),
                            color: isApi ? theme.palette.warning.light : theme.palette.info.light,
                        }}
                    />
                );
            },
        },
        {
            key: "details",
            label: t("logs", "details"),
            renderCell: (log) => {
                if (log.errorMessage) {
                    return (
                        <Typography variant="body2" sx={{ color: "error.main", fontWeight: 500 }}>
                            {t("logs", "error")}: {log.errorMessage}
                        </Typography>
                    );
                }
                if (log.metadata?.expiredIds && log.metadata.expiredIds.length > 0) {
                    return (
                        <Typography variant="body2" sx={{ color: "success.main" }}>
                            {t("logs", "cronProcessed", { count: log.metadata.expiredIds.length })}
                        </Typography>
                    );
                }
                return (
                    <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                        {t("logs", "noSimulationsToExpire")}
                    </Typography>
                );
            },
        },
    ];

    return (
        <div>
            <DataTable
                tableId="cron-logs"
                columns={columns}
                rows={logs}
                loading={loading}
                {...searchProps}
                onClearFilters={() => {
                    handleClear();
                    setSearchTerm("");
                }}
                hasActiveFilters={Boolean(searchTerm || toolbarFilterCount)}
                headerRight={(
                    <TableFilterButton
                        title={t("simulationsModule", "filtersTitle")}
                        activeFilterCount={toolbarFilterCount}
                        onClick={() => setFiltersOpen(true)}
                    />
                )}
                pagination={{
                    page,
                    pageSize,
                    total,
                    onPageChange: setPage,
                    onPageSizeChange: (size: number) => {
                        setPageSize(size);
                        setPage(1);
                    },
                }}
                emptyMessage={t("logs", "noCronLogs")}
            />
            <TableFiltersDialog
                open={filtersOpen}
                title={t("simulationsModule", "filtersTitle")}
                saveViewLabel={t("simulationsModule", "saveView")}
                clearLabel={t("simulationsModule", "clearFilters")}
                applyLabel={t("simulationsModule", "applyFilters")}
                onClose={() => setFiltersOpen(false)}
                onOpenSaveView={openSaveViewDialog}
                onClear={handleClear}
                onApply={handleSearch}
            >
                <FormSelect
                    label={t("logs", "status")}
                    options={[
                        { value: "", label: t("logs", "allStatuses") },
                        { value: "SUCCESS", label: t("logs", "success") },
                        { value: "FAILED", label: t("logs", "failed") },
                    ]}
                    value={localStatus}
                    onChange={(v) => setLocalStatus(String(v ?? ""))}
                    textFieldProps={{ size: "small" }}
                />
                <FormSelect
                    label={t("logs", "triggerSource")}
                    options={[
                        { value: "", label: t("logs", "allSources") },
                        { value: "api", label: t("logs", "manualApi") },
                        { value: "scheduled", label: t("logs", "scheduled") },
                    ]}
                    value={localSource}
                    onChange={(v) => setLocalSource(String(v ?? ""))}
                    textFieldProps={{ size: "small" }}
                />
                <DateInput
                    label={t("datePicker", "from")}
                    labelPosition="top"
                    value={toDateOnly(localDateFrom)}
                    onChange={(value) => setLocalDateFrom(value ? new Date(`${value}T00:00:00`) : null)}
                />
                <DateInput
                    label={t("datePicker", "to")}
                    labelPosition="top"
                    value={toDateOnly(localDateTo)}
                    onChange={(value) => setLocalDateTo(value ? new Date(`${value}T00:00:00`) : null)}
                />
            </TableFiltersDialog>
            {saveViewDialog}
        </div>
    );
}
