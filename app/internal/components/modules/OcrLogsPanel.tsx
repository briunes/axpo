"use client";

import { useEffect, useState } from "react";
import {
    alpha,
    Box,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Tab,
    Tabs,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";

interface OcrLogEntry {
    id: string;
    requestedAt: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    provider: string;
    model: string;
    baseUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    pageCount?: number;
    status: string;
    durationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    extractedFields?: Record<string, unknown>;
    fieldsExtracted?: number;
    errorMessage?: string;
    errorType?: string;
    httpStatusCode?: number;
    rawResponseSnippet?: string;
    metadata?: Record<string, unknown>;
}

export interface OcrLogsPanelProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatProvider(provider: string): string {
    const map: Record<string, string> = {
        "ollama-cloud": "Ollama Cloud",
        "ollama": "Ollama (local)",
        "openai": "OpenAI",
        "azure-openai": "Azure OpenAI",
        "anthropic": "Anthropic",
        "google": "Google AI",
    };
    return map[provider] ?? provider;
}

function StatusChip({ status }: { status: string }) {
    const theme = useTheme();

    const config: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
        SUCCESS: {
            label: "Success",
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
        },
        FAILED: {
            label: "Failed",
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <ErrorIcon sx={{ fontSize: 14 }} />,
        },
        ERROR: {
            label: "Error",
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <ErrorIcon sx={{ fontSize: 14 }} />,
        },
        PARSE_ERROR: {
            label: "Parse Error",
            color: theme.palette.warning.main,
            bg: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.2 : 0.14),
            icon: <WarningAmberIcon sx={{ fontSize: 14 }} />,
        },
    };

    const c = config[status] ?? {
        label: status,
        color: theme.palette.text.secondary,
        bg: alpha(theme.palette.text.secondary, 0.1),
        icon: null,
    };

    return (
        <Chip
            icon={c.icon as any}
            label={c.label}
            size="small"
            sx={{
                fontWeight: 600,
                fontSize: 11,
                height: 24,
                color: c.color,
                backgroundColor: c.bg,
                "& .MuiChip-icon": { color: c.color },
            }}
        />
    );
}

// ── Detail dialog ────────────────────────────────────────────────────────────

function OcrLogDetailDialog({ log, onClose }: { log: OcrLogEntry; onClose: () => void }) {
    const theme = useTheme();
    const [tab, setTab] = useState(0);
    const isDark = theme.palette.mode === "dark";

    const hasExtracted = !!log.extractedFields;
    const hasMetadata = !!log.metadata;

    const codeBoxSx = {
        backgroundColor: isDark ? "#0d1117" : "#f6f8fa",
        border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
        borderRadius: 1,
        p: 2,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-all" as const,
        overflowY: "auto" as const,
        maxHeight: "52vh",
        color: isDark ? "#e6edf3" : "#24292f",
    };

    const labelSx = {
        fontSize: 11,
        fontWeight: 700,
        color: "text.secondary",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        mb: 0.5,
    };

    const metaItems = [
        { label: "User", value: log.userName ? `${log.userName}${log.userEmail ? ` (${log.userEmail})` : ""}` : (log.userEmail ?? "—") },
        { label: "Provider", value: formatProvider(log.provider) },
        { label: "Model", value: log.model, mono: true },
        { label: "File", value: log.fileName ? `${log.fileName}  ·  ${formatFileSize(log.fileSizeBytes)}${log.pageCount ? `  ·  ${log.pageCount} page(s)` : ""}` : "—" },
        { label: "Duration", value: log.durationMs != null ? `${(log.durationMs / 1000).toFixed(2)}s` : "—" },
        { label: "Tokens", value: log.totalTokens != null ? `${log.totalTokens.toLocaleString()}  (${log.promptTokens ?? 0}↑ / ${log.completionTokens ?? 0}↓)` : "—" },
        { label: "Fields extracted", value: log.fieldsExtracted != null ? String(log.fieldsExtracted) : "—" },
        { label: "HTTP status", value: log.httpStatusCode != null ? String(log.httpStatusCode) : "—" },
    ];

    // tab indices are dynamic
    const tabExtracted = 1;
    const tabMetadata = hasExtracted ? 2 : 1;

    return (
        <Dialog
            open
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: isDark ? "#161b22" : "#fff",
                    backgroundImage: "none",
                    border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
                },
            }}
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <StatusChip status={log.status} />
                    <Typography variant="h6" sx={{ fontSize: 15, fontWeight: 700 }}>
                        OCR Request &mdash;{" "}
                        {new Date(log.requestedAt).toLocaleString("en-GB", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>

            <Box sx={{ px: 3, pb: 2, display: "flex", flexWrap: "wrap", gap: "12px 28px" }}>
                {metaItems.map(({ label, value, mono }) => (
                    <Box key={label}>
                        <Typography sx={labelSx}>{label}</Typography>
                        <Typography variant="body2" sx={{ fontSize: 12, fontFamily: mono ? "monospace" : undefined }}>
                            {value}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {log.errorMessage && (
                <Box sx={{ px: 3, pb: 1.5 }}>
                    <Typography sx={labelSx}>Error</Typography>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "error.main", fontWeight: 500 }}>
                        {log.errorType ? `[${log.errorType}]  ` : ""}{log.errorMessage}
                    </Typography>
                </Box>
            )}

            <Divider />

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ px: 2, minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 600, textTransform: "none" } }}
            >
                <Tab label="LLM Response" />
                {hasExtracted && <Tab label="Extracted Fields" />}
                {hasMetadata && <Tab label="Metadata" />}
            </Tabs>

            <DialogContent sx={{ pt: 1.5 }}>
                {tab === 0 && (
                    <Box>
                        <Typography sx={{ ...labelSx, mb: 1 }}>Raw text returned by the model</Typography>
                        <Box sx={codeBoxSx}>
                            {log.rawResponseSnippet
                                ? log.rawResponseSnippet
                                : <Typography component="span" sx={{ color: "text.secondary", fontStyle: "italic", fontSize: 12 }}>No response text recorded for this request.</Typography>
                            }
                        </Box>
                    </Box>
                )}
                {tab === tabExtracted && hasExtracted && (
                    <Box>
                        <Typography sx={{ ...labelSx, mb: 1 }}>Extracted & post-processed fields (JSON)</Typography>
                        <Box sx={codeBoxSx}>
                            {JSON.stringify(log.extractedFields, null, 2)}
                        </Box>
                    </Box>
                )}
                {tab === tabMetadata && hasMetadata && (
                    <Box>
                        <Typography sx={{ ...labelSx, mb: 1 }}>Request metadata</Typography>
                        <Box sx={codeBoxSx}>
                            {JSON.stringify(log.metadata, null, 2)}
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function OcrLogsPanel({ session, onNotify }: OcrLogsPanelProps) {
    const theme = useTheme();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selectedLog, setSelectedLog] = useState<OcrLogEntry | null>(null);

    const { data, isFetching, error } = useQuery({
        queryKey: ["ocr-logs", session.token, page, pageSize],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });

            const response = await fetch(`/api/v1/internal/ocr-logs?${params}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch OCR logs");

            const json = await response.json();
            return {
                items: (json.data?.items ?? []) as OcrLogEntry[],
                total: (json.data?.pagination?.total ?? 0) as number,
            };
        },
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (error) onNotify?.("Failed to load OCR logs", "error");
    }, [error, onNotify]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;

    const columns: ColumnDef<OcrLogEntry>[] = [
        {
            key: "requestedAt",
            label: "Timestamp",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {new Date(log.requestedAt).toLocaleString("en-GB", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.requestedAt), { addSuffix: true })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "status",
            label: "Status",
            renderCell: (log) => <StatusChip status={log.status} />,
        },
        {
            key: "user",
            label: "User",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                        {log.userName ?? log.userEmail ?? "Unknown"}
                    </Typography>
                    {log.userName && log.userEmail && (
                        <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1.2 }}>
                            {log.userEmail}
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            key: "provider",
            label: "Provider / Model",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                        {formatProvider(log.provider)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", lineHeight: 1.2 }}>
                        {log.model}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "file",
            label: "File",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Tooltip title={log.fileName ?? ""}>
                        <Typography variant="body2" sx={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                            {log.fileName ?? "—"}
                        </Typography>
                    </Tooltip>
                    <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1.2 }}>
                        {[
                            log.fileType?.replace("application/", "").replace("image/", ""),
                            formatFileSize(log.fileSizeBytes),
                            log.pageCount ? `${log.pageCount}p` : null,
                        ].filter(Boolean).join(" · ")}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "duration",
            label: "Duration",
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
                    {log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)}s` : "—"}
                </Typography>
            ),
        },
        {
            key: "tokens",
            label: "Tokens",
            renderCell: (log) => {
                if (!log.totalTokens && !log.promptTokens && !log.completionTokens) {
                    return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
                }
                return (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", lineHeight: 1.3 }}>
                            {log.totalTokens != null ? log.totalTokens.toLocaleString() : "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", lineHeight: 1.2 }}>
                            {log.promptTokens ?? 0}↑&nbsp;/&nbsp;{log.completionTokens ?? 0}↓
                        </Typography>
                    </Box>
                );
            },
        },
        {
            key: "fieldsExtracted",
            label: "Fields",
            renderCell: (log) => {
                if (log.status !== "SUCCESS") {
                    return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
                }
                return (
                    <Chip
                        label={log.fieldsExtracted != null ? `${log.fieldsExtracted}` : "—"}
                        size="small"
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            height: 22,
                            minWidth: 32,
                            backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.15 : 0.1),
                            color: theme.palette.success.main,
                        }}
                    />
                );
            },
        },
        {
            key: "result",
            label: "Result",
            renderCell: (log) => {
                if (log.errorMessage) {
                    return (
                        <Tooltip title={`${log.errorType ? `[${log.errorType}] ` : ""}${log.errorMessage}`}>
                            <Typography variant="body2" sx={{ fontSize: 11, color: "error.main", fontWeight: 500, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
                                {log.errorMessage}
                            </Typography>
                        </Tooltip>
                    );
                }
                if (log.status === "SUCCESS" && log.extractedFields) {
                    const f = log.extractedFields as Record<string, unknown>;
                    const parts = [
                        f.cups ? `CUPS: …${String(f.cups).slice(-6)}` : null,
                        f.nombreTitular ? String(f.nombreTitular) : null,
                        f.tarifaAcceso ? String(f.tarifaAcceso) : null,
                    ].filter(Boolean);
                    return (
                        <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {parts.join(" · ") || "—"}
                        </Typography>
                    );
                }
                return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
            },
        },
        {
            key: "view",
            label: "",
            renderCell: (log) => (
                <Tooltip title="View full response">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{ padding: "24px", color: "var(--scheme-neutral-100)" }}>
            <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px", color: "var(--scheme-neutral-100)" }}>
                    OCR Invoice Extraction Logs
                </h2>
                <p style={{ fontSize: "13px", color: "var(--scheme-neutral-600)" }}>
                    Track all AI-powered invoice extraction requests — provider, model, token usage, duration, and extracted fields.
                    Click <strong>↗</strong> on any row to view the full LLM response.
                </p>
            </div>

            <DataTable
                columns={columns}
                rows={logs}
                loading={isFetching}
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
                emptyMessage="No OCR extraction requests found"
            />

            {selectedLog && (
                <OcrLogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
            )}
        </div>
    );
}
