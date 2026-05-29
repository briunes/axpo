"use client";

import { useEffect, useState } from "react";
import {
    alpha,
    Box,
    Chip,
    Drawer,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    useTheme,
    Divider,
    Button,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";

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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selected, setSelected] = useState<AppErrorLogEntry | null>(null);

    const { data, isFetching, error } = useQuery({
        queryKey: ["app-error-logs", session.token, page, pageSize],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
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
        if (error) onNotify?.("Failed to load application error logs", "error");
    }, [error, onNotify]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;

    const columns: ColumnDef<AppErrorLogEntry>[] = [
        {
            key: "createdAt",
            label: "Timestamp",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "errorType",
            label: "Type",
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
            label: "Message",
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
            label: "Endpoint",
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
            key: "user",
            label: "User",
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
            label: "Sentry",
            renderCell: (log) =>
                log.sentryEventId ? (
                    <Tooltip title="Open in Sentry">
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
                    Details
                </Button>
            ),
        },
    ];

    return (
        <div style={{ padding: "24px", color: "var(--scheme-neutral-100)" }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <ErrorOutlineIcon sx={{ color: "error.main", fontSize: 22 }} />
                        <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
                            Application Errors
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary" }}>
                        Server errors captured by the global error handler — saved to the database and reported to Sentry.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                    onClick={() => window.open(`${SENTRY_BASE_URL}/issues/`, "_blank", "noopener,noreferrer")}
                    sx={{ fontSize: 12, whiteSpace: "nowrap", ml: 2 }}
                >
                    Open Sentry
                </Button>
            </Box>

            <DataTable
                columns={columns}
                rows={logs}
                loading={isFetching}
                onClearFilters={() => setPage(1)}
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
                emptyMessage="No application errors recorded"
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
                                Error Details
                            </Typography>
                            <IconButton size="small" onClick={() => setSelected(null)}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        <Stack spacing={2}>
                            {/* Type + code */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">Error Type</Typography>
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
                                <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13 }}>
                                    {new Date(selected.createdAt).toLocaleString("en-GB", {
                                        day: "2-digit", month: "2-digit", year: "numeric",
                                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                                    })}
                                    {" · "}{formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                                </Typography>
                            </Box>

                            {/* Message */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">Message</Typography>
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
                                    <Typography variant="caption" color="text.secondary">Endpoint</Typography>
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

                            {/* User */}
                            {selected.user && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">User</Typography>
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
                                    <Typography variant="caption" color="text.secondary">Sentry Event</Typography>
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
                                            View in Sentry
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
                                    <Typography variant="caption" color="text.secondary">Stack Trace</Typography>
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
                                    <Typography variant="caption" color="text.secondary">Metadata</Typography>
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
