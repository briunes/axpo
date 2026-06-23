"use client";

import { useCallback, useEffect, useState } from "react";
import { alpha, Box, Button, Chip, Stack, Typography, useTheme } from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { FormSelect } from "../ui/FormSelect";
import { DateRangePicker } from "../ui/DateRangePicker";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { useI18n } from "../../../../src/lib/i18n-context";

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
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    // Local (pending) filter state
    const [localStatus, setLocalStatus] = useState("");
    const [localSource, setLocalSource] = useState("");
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(null);
    const [localDateTo, setLocalDateTo] = useState<Date | null>(null);

    const formatDate = useCallback((isoString: string) => {
        try {
            const date = new Date(isoString);
            const formatted = formatDisplayDate(date, preferences.dateFormat);
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            const ss = String(date.getSeconds()).padStart(2, "0");
            return `${formatted} ${hh}:${mm}:${ss}`;
        } catch { return isoString; }
    }, [preferences.dateFormat]);

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
    };

    const handleClear = () => {
        setLocalStatus(""); setLocalSource(""); setLocalDateFrom(null); setLocalDateTo(null);
        setFilterStatus(""); setFilterSource(""); setFilterDateFrom(""); setFilterDateTo("");
        setPage(1);
    };

    const { data, isFetching, error } = useQuery({
        queryKey: ["cron-logs", session.token, page, pageSize, filterStatus, filterSource, filterDateFrom, filterDateTo],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (filterStatus) params.append("status", filterStatus);
            if (filterSource) params.append("source", filterSource);
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
                    <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDate(log.executedAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
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
                            fontSize: 12,
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
                            fontSize: 16,
                            fontWeight: 700,
                            color: log.totalAffected > 0 ? "primary.main" : "text.secondary",
                        }}
                    >
                        {log.totalAffected}
                    </Typography>
                    {log.totalAffected > 0 && (
                        <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
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
                        fontSize: 12,
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
                            fontSize: 11,
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
                        <Typography variant="body2" sx={{ fontSize: 12, color: "error.main", fontWeight: 500 }}>
                            {t("logs", "error")}: {log.errorMessage}
                        </Typography>
                    );
                }
                if (log.metadata?.expiredIds && log.metadata.expiredIds.length > 0) {
                    return (
                        <Typography variant="body2" sx={{ fontSize: 12, color: "success.main" }}>
                            {t("logs", "cronProcessed", { count: log.metadata.expiredIds.length })}
                        </Typography>
                    );
                }
                return (
                    <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary", fontStyle: "italic" }}>
                        {t("logs", "noSimulationsToExpire")}
                    </Typography>
                );
            },
        },
    ];

    return (
        <div>
            <DataTable
                columns={columns}
                rows={logs}
                loading={loading}
                onApplyFilters={handleSearch}
                onClearFilters={handleClear}
                renderCustomSearch={() => (
                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                        <Box sx={{ flex: 1, }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allStatuses") },
                                    { value: "SUCCESS", label: t("logs", "success") },
                                    { value: "FAILED", label: t("logs", "failed") },
                                ]}
                                value={localStatus}
                                onChange={(v) => setLocalStatus(String(v ?? ""))}
                                placeholder={t("logs", "status")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ flex: 1, }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allSources") },
                                    { value: "api", label: t("logs", "manualApi") },
                                    { value: "scheduled", label: t("logs", "scheduled") },
                                ]}
                                value={localSource}
                                onChange={(v) => setLocalSource(String(v ?? ""))}
                                placeholder={t("logs", "triggerSource")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ flex: 2, }}>
                            <DateRangePicker
                                variant="inline"
                                label={t("logs", "timestamp")}
                                startDate={localDateFrom}
                                endDate={localDateTo}
                                onChange={(s, e) => { setLocalDateFrom(s); setLocalDateTo(e); }}
                            />
                        </Box>
                    </Box>
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
        </div>
    );
}
