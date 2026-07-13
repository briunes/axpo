"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    alpha,
    Box,
    Button,
    Chip,
    Drawer,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    useTheme,
    Divider,
} from "@mui/material";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { SessionState } from "../../lib/authSession";
import { DataTable, DateInput, TableFilterButton, TableFiltersDialog, type ColumnDef } from "../ui";
import { ConfirmDialog } from "../shared";
import { FormSelect } from "../ui/FormSelect";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDateTime } from "../../lib/formatPreferences";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useLogTableToolbar } from "./logTableToolbar";

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

type AppErrorLogsViewState = {
    errorType: string;
    dateFrom: string;
    dateTo: string;
};

const APP_ERROR_LOG_VIEWS_STORAGE_KEY = "axpo_app_error_log_saved_views";

export function AppErrorLogsPanel({ session, onNotify }: AppErrorLogsPanelProps) {
    const cachePolicy = useRequestCachePolicy("logs");
    const theme = useTheme();
    const { locale, t } = useI18n();
    const { preferences } = useUserPreferences();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selected, setSelected] = useState<AppErrorLogEntry | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<AppErrorLogEntry | null>(null);
    const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
    const reportedLoadError = useRef<unknown>(null);

    // Applied filters
    const [filterErrorType, setFilterErrorType] = useState("");
    const [filterSearch, setFilterSearch] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    // Local (pending) filter state
    const [localErrorType, setLocalErrorType] = useState("");
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(null);
    const [localDateTo, setLocalDateTo] = useState<Date | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        if (!filtersOpen) return;
        setLocalErrorType(filterErrorType);
        setLocalDateFrom(filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null);
        setLocalDateTo(filterDateTo ? new Date(`${filterDateTo}T00:00:00`) : null);
    }, [filterDateFrom, filterDateTo, filterErrorType, filtersOpen]);

    const formatDate = useCallback((isoString: string) => {
        return formatDisplayDateTime(isoString, preferences, { includeSeconds: true, fallback: isoString });
    }, [preferences]);

    const toDateOnly = (d: Date | null) => {
        if (!d) return "";
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const handleSearch = () => {
        setFilterErrorType(localErrorType);
        setFilterDateFrom(toDateOnly(localDateFrom));
        setFilterDateTo(toDateOnly(localDateTo));
        setPage(1);
        setFiltersOpen(false);
    };

    const handleClear = () => {
        setLocalErrorType(""); setLocalDateFrom(null); setLocalDateTo(null);
        setFilterErrorType(""); setFilterSearch(""); setFilterDateFrom(""); setFilterDateTo("");
        setPage(1);
        setFiltersOpen(false);
    };
    const activeFilterCount = [filterErrorType, filterDateFrom || filterDateTo].filter(Boolean).length;

    const currentView = useMemo<AppErrorLogsViewState>(() => ({
        errorType: filterErrorType,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
    }), [filterDateFrom, filterDateTo, filterErrorType]);

    const applyView = useCallback((view: AppErrorLogsViewState) => {
        setFilterErrorType(view.errorType ?? "");
        setFilterDateFrom(view.dateFrom ?? "");
        setFilterDateTo(view.dateTo ?? "");
        setPage(1);
    }, []);

    const builtInViews = useMemo<Array<{ id: string; name: string; view: AppErrorLogsViewState }>>(() => [
        { id: "recent", name: t("simulationsModule", "presetRecent"), view: { errorType: "", dateFrom: "", dateTo: "" } },
        { id: "error", name: "Error", view: { errorType: "Error", dateFrom: "", dateTo: "" } },
        { id: "type-error", name: "TypeError", view: { errorType: "TypeError", dateFrom: "", dateTo: "" } },
        { id: "reference-error", name: "ReferenceError", view: { errorType: "ReferenceError", dateFrom: "", dateTo: "" } },
    ], [t]);

    const {
        activeViewPresetId,
        openSaveViewDialog,
        saveViewDialog,
        searchProps,
    } = useLogTableToolbar<AppErrorLogsViewState>({
        storageKey: APP_ERROR_LOG_VIEWS_STORAGE_KEY,
        currentView,
        presets: builtInViews,
        applyView,
        searchValue: filterSearch,
        onSearchChange: (value) => {
            setFilterSearch(value);
            setPage(1);
        },
        searchPlaceholder: t("search", "auditLogs"),
        t,
    });

    const toolbarFilterCount = activeViewPresetId ? 0 : activeFilterCount;

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
        ...cachePolicy,
    });

    useEffect(() => {
        if (!error) {
            reportedLoadError.current = null;
            return;
        }
        if (reportedLoadError.current === error) return;
        reportedLoadError.current = error;
        onNotify?.(t("logs", "loadAppErrorsFailed"), "error");
    }, [error, onNotify, t]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;
    const deleteMutation = useMutation({
        mutationFn: async (log: AppErrorLogEntry) => {
            const response = await fetch(`/api/v1/internal/app-error-logs/${log.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error?.message ?? t("logs", "deleteAppErrorFailed"));
            }
            return log;
        },
        onSuccess: async (log) => {
            if (selected?.id === log.id) setSelected(null);
            setConfirmDelete(null);
            if (logs.length === 1 && page > 1) setPage(page - 1);
            await queryClient.invalidateQueries({ queryKey: ["app-error-logs"] });
            onNotify?.(t("logs", "appErrorDeleted"), "success");
        },
        onError: (mutationError) => {
            onNotify?.(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("logs", "deleteAppErrorFailed"),
                "error",
            );
        },
    });
    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const response = await fetch("/api/v1/internal/app-error-logs", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ids }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(body?.error?.message ?? t("logs", "deleteAppErrorsFailed"));
            }
            return {
                ids,
                deleted: Number(body?.data?.deleted ?? 0),
            };
        },
        onSuccess: async ({ ids, deleted }) => {
            if (selected && ids.includes(selected.id)) setSelected(null);
            setConfirmBulkDeleteIds(null);
            if (logs.length <= deleted && page > 1) setPage(page - 1);
            await queryClient.invalidateQueries({ queryKey: ["app-error-logs"] });
            onNotify?.(t("logs", "appErrorsDeleted", { count: deleted }), "success");
        },
        onError: (mutationError) => {
            onNotify?.(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("logs", "deleteAppErrorsFailed"),
                "error",
            );
        },
    });

    const columns: ColumnDef<AppErrorLogEntry>[] = [
        {
            key: "createdAt",
            label: t("logs", "timestamp"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDate(log.createdAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
                            sx={{ fontFamily: "monospace", color: "text.secondary" }}
                            title={log.path}
                        >
                            {log.path.length > 40 ? `...${log.path.slice(-40)}` : log.path}
                        </Typography>
                    </Box>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>-</Typography>
                ),
        },
        {
            key: "pagePath",
            label: "Page route",
            renderCell: (log) =>
                log.pagePath ? (
                    <Typography
                        variant="caption"
                        sx={{ fontFamily: "monospace", color: "text.secondary" }}
                        title={log.pagePath}
                    >
                        {log.pagePath.length > 40 ? `...${log.pagePath.slice(-40)}` : log.pagePath}
                    </Typography>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>-</Typography>
                ),
        },
        {
            key: "user",
            label: t("logs", "user"),
            renderCell: (log) =>
                log.user ? (
                    <Typography variant="caption">
                        {log.user.fullName}
                    </Typography>
                ) : (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>-</Typography>
                ),
        },
    ];

    return (
        <div>


            <DataTable
                tableId="app-error-logs"
                columns={columns}
                rows={logs}
                loading={isFetching}
                rowActions={(log) => (
                    <>
                        <Button size="small" variant="text" onClick={() => setSelected(log)} sx={{ fontSize: 11, minWidth: 0 }}>
                            {t("logs", "details")}
                        </Button>
                        {log.sentryEventId ? (
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
                            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 11 }}>-</Typography>
                        )}

                        <Tooltip title={t("logs", "deleteAppError")}>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setConfirmDelete(log);
                                }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                        </Tooltip>
                    </>

                )}
                {...searchProps}
                onClearFilters={handleClear}
                hasActiveFilters={Boolean(filterSearch || toolbarFilterCount)}
                headerRight={<Stack direction="row" spacing={1} alignItems="center">
                    <TableFilterButton
                        title={t("simulationsModule", "filtersTitle")}
                        activeFilterCount={toolbarFilterCount}
                        onClick={() => setFiltersOpen(true)}
                    />
                    <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                        onClick={() => window.open(`${SENTRY_BASE_URL}/issues/`, "_blank", "noopener,noreferrer")}
                        sx={{ fontSize: 12, whiteSpace: "nowrap" }}
                    >
                        {t("logs", "openSentry")}
                    </Button>
                </Stack>}
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
                massActions={[
                    {
                        label: t("actions", "delete"),
                        color: "error",
                        icon: <DeleteOutlineIcon fontSize="small" />,
                        onClick: (ids) => setConfirmBulkDeleteIds(ids),
                    },
                ]}
                emptyMessage={t("logs", "noAppErrors")}
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
                    label={t("logs", "errorType")}
                    options={[
                        { value: "", label: t("logs", "allTypes") },
                        { value: "Error", label: "Error" },
                        { value: "ReferenceError", label: "ReferenceError" },
                        { value: "TypeError", label: "TypeError" },
                        { value: "SyntaxError", label: "SyntaxError" },
                    ]}
                    value={localErrorType}
                    onChange={(v) => setLocalErrorType(String(v ?? ""))}
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
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Tooltip title={t("logs", "deleteAppError")}>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => setConfirmDelete(selected)}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <IconButton size="small" onClick={() => setSelected(null)}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
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
                                <Typography variant="body2" sx={{ mt: 0.5, }}>
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
                                    <Typography variant="body2" sx={{ mt: 0.5, }}>
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

            {confirmDelete && (
                <ConfirmDialog
                    title={t("logs", "deleteAppError")}
                    message={t("logs", "deleteAppErrorConfirm")}
                    confirmLabel={t("actions", "delete")}
                    busy={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate(confirmDelete)}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {confirmBulkDeleteIds && (
                <ConfirmDialog
                    title={t("logs", "deleteAppErrors")}
                    message={t("logs", "deleteAppErrorsConfirm", {
                        count: confirmBulkDeleteIds.length,
                    })}
                    confirmLabel={t("actions", "delete")}
                    busy={bulkDeleteMutation.isPending}
                    onConfirm={() => bulkDeleteMutation.mutate(confirmBulkDeleteIds)}
                    onCancel={() => setConfirmBulkDeleteIds(null)}
                />
            )}
        </div>
    );
}
