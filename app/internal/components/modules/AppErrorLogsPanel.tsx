"use client";

import { useCallback, useEffect, useState } from "react";
import {
    alpha,
    Box,
    Button,
    Chip,
    Drawer,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
    useTheme,
    Divider,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";
import { FormSelect } from "../ui/FormSelect";
import { DateRangePicker } from "../ui/DateRangePicker";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { useI18n } from "../../../../src/lib/i18n-context";

const SENTRY_BASE_URL = "https://signed-axpo.sentry.io";

interface AppErrorLogUser {
    id: string;
    fullName: string;
    email: string;
}

interface AppErrorLogEntry {
    id: string;
    createdAt: string;
    errorType: string;
    errorCode?: string | null;
    message: string;
    stack?: string | null;
    method?: string | null;
    path?: string | null;
    pagePath?: string | null;
    statusCode?: number | null;
    sentryEventId?: string | null;
    metadata?: Record<string, unknown> | null;
    user?: AppErrorLogUser | null;
}

export interface AppErrorLogsPanelProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

export function AppErrorLogsPanel({ session, onNotify }: AppErrorLogsPanelProps) {
    const theme = useTheme();
    const { locale, t } = useI18n();
    const { preferences } = useUserPreferences();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selected, setSelected] = useState<AppErrorLogEntry | null>(null);

    // Applied filters
    const [filterErrorType, setFilterErrorType] = useState("");
    const [filterSearch, setFilterSearch] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    // Local (pending) filter state
    const [localErrorType, setLocalErrorType] = useState("");
    const [localSearch, setLocalSearch] = useState("");
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
        setFilterErrorType(localErrorType);
        setFilterSearch(localSearch);
        setFilterDateFrom(toDateOnly(localDateFrom));
        setFilterDateTo(toDateOnly(localDateTo));
        setPage(1);
    };

    const handleClear = () => {
        setLocalErrorType(""); setLocalSearch(""); setLocalDateFrom(null); setLocalDateTo(null);
        setFilterErrorType(""); setFilterSearch(""); setFilterDateFrom(""); setFilterDateTo("");
        setPage(1);
    };

    const { data, isFetching, error } = useQuery({
        queryKey: ["app-error-logs", session.token, page, pageSize, filterErrorType, filterSearch, filterDateFrom, filterDateTo],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (filterErrorType) params.append("errorType", filterErrorType);
            if (filterSearch) params.append("search", filterSearch);
            if (filterDateFrom) params.append("dateFrom", filterDateFrom);
            if (filterDateTo) params.append("dateTo", filterDateTo);
            const response = await fetch(`/api/v1/internal/app-error-logs?${params}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch app error logs");
            const json = await response.json();
            return {
                items: (json.data?.items ?? []) as AppErrorLogEntry[],
                total: json.data?.pagination?.total ?? 0,
            };
        },
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (error) onNotify?.(t("logs", "loadAppErrorsFailed"), "error");
    }, [error, onNotify, t]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;

    const columns: ColumnDef<AppErrorLogEntry>[] = [
        {
            key: "createdAt",
            label: t("logs", "timestamp"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDate(log.createdAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: locale === "es" ? es : undefined })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "errorType",
            label: t("logs", "type"),
            renderCell: (log) => (
                <Chip
                    label={log.errorCode ?? log.errorType}
                    size="small"
                    sx={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        height: 22,
                        backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
                        color: theme.palette.error.main,
                    }}
                />
            ),
        },
        {
            key: "message",
            label: t("logs", "message"),
            renderCell: (log) => (
                <Typography
                    variant="body2"
                    sx={{
                        fontSize: 12,
                        color: "text.primary",
                        maxWidth: 340,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={log.message}
                >
                    {log.message}
                </Typography>
            ),
        },
        {
            key: "path",
            label: t("logs", "endpoint"),
            renderCell: (log) =>
                log.path ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {log.method && (
                            <Chip
                                label={log.method}
                                size="small"
                                sx={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    height: 18,
                                    fontFamily: "monospace",
                                    backgroundColor: alpha(theme.palette.info.main, 0.12),
                                    color: theme.palette.info.main,
                                }}
                            />
                        )}
                        <Typography
                            variant="caption"
                            sx={{ fontFamily: "monospace", fontSize: 11, color: "text.secondary" }}
                            title={log.path}
                        >
                            {log.path.length > 40 ? `...${log.path.slice(-40)}` : log.path}
                        </Typography>
                    </Box>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                ),
        },
        {
            key: "pagePath",
            label: "Page route",
            renderCell: (log) =>
                log.pagePath ? (
                    <Typography
                        variant="caption"
                        sx={{ fontFamily: "monospace", fontSize: 11, color: "text.secondary" }}
                        title={log.pagePath}
                    >
                        {log.pagePath.length > 40 ? `...${log.pagePath.slice(-40)}` : log.pagePath}
                    </Typography>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                ),
        },
        {
            key: "user",
            label: t("logs", "user"),
            renderCell: (log) =>
                log.user ? (
                    <Typography variant="caption" sx={{ fontSize: 11 }}>
                        {log.user.fullName}
                    </Typography>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 11 }}>—</Typography>
                ),
        },
        {
            key: "sentryEventId",
            label: t("logs", "sentry"),
            renderCell: (log) =>
                log.sentryEventId ? (
                    <Tooltip title={t("logs", "openInSentry")}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                    `${SENTRY_BASE_URL}/issues/?query=${log.sentryEventId}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                );
                            }}
                            sx={{ color: theme.palette.warning.main }}
                        >
                            <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 11 }}>—</Typography>
                ),
        },
        {
            key: "details",
            label: "",
            renderCell: (log) => (
                <Button size="small" variant="text" onClick={() => setSelected(log)} sx={{ fontSize: 11, minWidth: 0 }}>
                    {t("logs", "details")}
                </Button>
            ),
        },
    ];

    return (
        <div>


            <DataTable
                columns={columns}
                rows={logs}
                loading={isFetching}
                renderCustomSearch={({ }) => (
                    <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                        <Box sx={{ flex: 1, }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allTypes") },
                                    { value: "Error", label: "Error" },
                                    { value: "ReferenceError", label: "ReferenceError" },
                                    { value: "TypeError", label: "TypeError" },
                                    { value: "SyntaxError", label: "SyntaxError" },
                                ]}
                                value={localErrorType}
                                onChange={(v) => setLocalErrorType(String(v ?? ""))}
                                placeholder={t("logs", "errorType")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder={t("logs", "searchError")}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
                            />
                        </Box>
                        <Box sx={{ flex: 2 }}>
                            <DateRangePicker
                                variant="inline"
                                label={t("logs", "timestamp")}
                                startDate={localDateFrom}
                                endDate={localDateTo}
                                onChange={(s, e) => { setLocalDateFrom(s); setLocalDateTo(e); }}

                            />
                        </Box>
                        <Button variant="contained" size="small" onClick={handleSearch} aria-label={t("common", "search")}>
                            <SearchIcon />
                        </Button>
                        <Button variant="outlined" size="small" onClick={handleClear}>
                            <ClearIcon />
                        </Button>
                    </Box>
                )}
                headerRight={
                    <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                        onClick={() => window.open(`${SENTRY_BASE_URL}/issues/`, "_blank", "noopener,noreferrer")}
                        sx={{ fontSize: 12, whiteSpace: "nowrap", ml: 2 }}
                    >
                        {t("logs", "openSentry")}
                    </Button>}
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
                emptyMessage={t("logs", "noAppErrors")}
            />

            {/* Detail Drawer */}
            <Drawer
                anchor="right"
                open={!!selected}
                onClose={() => setSelected(null)}
                PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, p: 3 } }}
            >
                {selected && (
                    <Box>
                        {/* Drawer header */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>
                                {t("logs", "errorDetails")}
                            </Typography>
                            <IconButton size="small" onClick={() => setSelected(null)}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        <Stack spacing={2}>
                            {/* Type + code */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">{t("logs", "errorType")}</Typography>
                                <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                                    <Chip
                                        label={selected.errorType}
                                        size="small"
                                        sx={{
                                            fontFamily: "monospace",
                                            fontWeight: 700,
                                            fontSize: 12,
                                            backgroundColor: alpha(theme.palette.error.main, 0.12),
                                            color: theme.palette.error.main,
                                        }}
                                    />
                                    {selected.errorCode && (
                                        <Chip
                                            label={selected.errorCode}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontFamily: "monospace", fontSize: 12 }}
                                        />
                                    )}
                                    {selected.statusCode && (
                                        <Chip label={`HTTP ${selected.statusCode}`} size="small" variant="outlined" sx={{ fontSize: 12 }} />
                                    )}
                                </Box>
                            </Box>

                            {/* Timestamp */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">{t("logs", "timestamp")}</Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13 }}>
                                    {formatDate(selected.createdAt)}
                                    {" · "}{formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true, locale: locale === "es" ? es : undefined })}
                                </Typography>
                            </Box>

                            {/* Message */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">{t("logs", "message")}</Typography>
                                <Box sx={{
                                    mt: 0.5, p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.error.main, 0.06),
                                    border: "1px solid", borderColor: alpha(theme.palette.error.main, 0.2),
                                }}>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, color: "error.main" }}>
                                        {selected.message}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Endpoint */}
                            {selected.path && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t("logs", "endpoint")}</Typography>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                        {selected.method && (
                                            <Chip
                                                label={selected.method}
                                                size="small"
                                                sx={{
                                                    fontFamily: "monospace", fontWeight: 700, fontSize: 11,
                                                    backgroundColor: alpha(theme.palette.info.main, 0.12),
                                                    color: theme.palette.info.main,
                                                }}
                                            />
                                        )}
                                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                            {selected.path}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {selected.pagePath && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Page route</Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, fontFamily: "monospace", fontSize: 12 }}>
                                        {selected.pagePath}
                                    </Typography>
                                </Box>
                            )}

                            {/* User */}
                            {selected.user && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t("logs", "user")}</Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13 }}>
                                        {selected.user.fullName}
                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            {selected.user.email}
                                        </Typography>
                                    </Typography>
                                </Box>
                            )}

                            {/* Sentry link */}
                            {selected.sentryEventId && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t("logs", "sentryEvent")}</Typography>
                                    <Box sx={{ mt: 0.5 }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                            onClick={() =>
                                                window.open(
                                                    `${SENTRY_BASE_URL}/issues/?query=${selected.sentryEventId}`,
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                )
                                            }
                                            sx={{ fontSize: 12 }}
                                        >
                                            {t("logs", "viewInSentry")}
                                        </Button>
                                        <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontFamily: "monospace", color: "text.secondary", fontSize: 10 }}>
                                            {selected.sentryEventId}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Stack trace */}
                            {selected.stack && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t("logs", "stackTrace")}</Typography>
                                    <Box sx={{
                                        mt: 0.5, p: 1.5, borderRadius: 1,
                                        bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                                        border: "1px solid", borderColor: "divider",
                                        maxHeight: 280, overflowY: "auto",
                                    }}>
                                        <Typography
                                            component="pre"
                                            sx={{ fontFamily: "monospace", fontSize: 10, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", m: 0 }}
                                        >
                                            {selected.stack}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Metadata */}
                            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">{t("logs", "metadata")}</Typography>
                                    <Box sx={{
                                        mt: 0.5, p: 1.5, borderRadius: 1,
                                        bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                                        border: "1px solid", borderColor: "divider",
                                    }}>
                                        <Typography
                                            component="pre"
                                            sx={{ fontFamily: "monospace", fontSize: 11, m: 0, whiteSpace: "pre-wrap" }}
                                        >
                                            {JSON.stringify(selected.metadata, null, 2)}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                )}
            </Drawer>
        </div>
    );
}
