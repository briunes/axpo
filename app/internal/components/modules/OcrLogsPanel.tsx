"use client";

import { useEffect, useState } from "react";
import {
    alpha,
    Box,
    Button,
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
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import TollRoundedIcon from "@mui/icons-material/TollRounded";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DifferenceRoundedIcon from "@mui/icons-material/DifferenceRounded";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";
import { improveOcrPrompt, testOcrPrompt, type ImproveOcrPromptResult, type TestOcrPromptResult } from "../../lib/internalApi";

interface OcrLogEntry {
    id: string;
    requestedAt: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    type: "INVOICE_EXTRACTION" | "PROVIDER_DETECTION";
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
    promptText?: string;
    metadata?: Record<string, unknown>;
    simulationId?: string | null;
    simulationReferenceNumber?: string | null;
    reportedIssue?: string | null;
    files?: Array<{
        id: string;
        fileName: string;
        fileType?: string | null;
        fileSizeBytes: number;
    }>;
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

function formatLogType(type: OcrLogEntry["type"]): string {
    return type === "PROVIDER_DETECTION" ? "Provider Detection" : "Invoice Extraction";
}

function getStoredFilesSummary(log: OcrLogEntry): string {
    if (!log.files || log.files.length === 0) return "—";
    if (log.files.length === 1) {
        return `${log.files[0].fileName} (${formatFileSize(log.files[0].fileSizeBytes)})`;
    }
    const totalBytes = log.files.reduce((sum, file) => sum + file.fileSizeBytes, 0);
    return `${log.files.length} files · ${formatFileSize(totalBytes)}`;
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

function DetailStatCard({
    label,
    value,
    subvalue,
    icon,
    mono = false,
    accent,
}: {
    label: string;
    value: string;
    subvalue?: string;
    icon?: React.ReactNode;
    mono?: boolean;
    accent?: string;
}) {
    return (
        <Box
            sx={{
                position: "relative",
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: accent ? alpha(accent, 0.28) : "divider",
                background: (theme) =>
                    theme.palette.mode === "dark"
                        ? `linear-gradient(180deg, ${alpha(accent ?? theme.palette.common.white, 0.06)}, rgba(255,255,255,0.02))`
                        : `linear-gradient(180deg, ${alpha(accent ?? theme.palette.primary.main, 0.06)}, rgba(255,255,255,0.94))`,
                p: 1.75,
                minHeight: 104,
                display: "flex",
                flexDirection: "column",
                gap: 0.6,
                overflow: "hidden",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, color: accent ?? "text.secondary" }}>
                {icon}
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "text.secondary" }}>
                    {label}
                </Typography>
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", fontFamily: mono ? "monospace" : undefined, lineHeight: 1.35, wordBreak: "break-word" }}>
                {value}
            </Typography>
            {subvalue && (
                <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.35 }}>
                    {subvalue}
                </Typography>
            )}
        </Box>
    );
}

// ── Detail dialog ────────────────────────────────────────────────────────────

function OcrLogDetailDialog({
    log,
    token,
    onClose,
    onNotify,
}: {
    log: OcrLogEntry;
    token: string;
    onClose: () => void;
    onNotify?: (text: string, tone: "success" | "error") => void;
}) {
    const theme = useTheme();
    const [tab, setTab] = useState(0);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
    const [improveResult, setImproveResult] = useState<ImproveOcrPromptResult | null>(null);
    const [showImproveDialog, setShowImproveDialog] = useState(false);
    const [isTestingPrompt, setIsTestingPrompt] = useState(false);
    const [testResult, setTestResult] = useState<TestOcrPromptResult | null>(null);
    const isDark = theme.palette.mode === "dark";

    const hasExtracted = !!log.extractedFields;
    const hasMetadata = !!log.metadata;
    const hasPrompt = !!log.promptText;
    const hasStoredFiles = !!log.files?.length;

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

    const tokenSummary = log.totalTokens != null
        ? `${log.totalTokens.toLocaleString()} total`
        : "No token data";
    const tokenBreakdown = log.totalTokens != null
        ? `${log.promptTokens ?? 0} prompt / ${log.completionTokens ?? 0} completion`
        : undefined;
    const primaryFileSummary = log.fileName
        ? `${log.fileName}`
        : "No primary file";
    const primaryFileMeta = [
        log.fileType?.replace("application/", "").replace("image/", ""),
        formatFileSize(log.fileSizeBytes),
        log.pageCount ? `${log.pageCount} page(s)` : null,
    ].filter(Boolean).join(" · ");

    const handleDownloadStoredFile = async (fileId: string, fallbackName: string) => {
        try {
            setDownloadingFileId(fileId);
            const response = await fetch(`/api/v1/internal/ocr-logs/${log.id}/files/${fileId}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to download OCR file");
            }

            const disposition = response.headers.get("Content-Disposition") ?? "";
            const filenameMatch = disposition.match(/filename="?([^\"]+)"?/);
            const filename = filenameMatch?.[1] ?? fallbackName;

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            URL.revokeObjectURL(url);
            onNotify?.(`Downloaded ${filename}`, "success");
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : "Failed to download OCR file",
                "error",
            );
        } finally {
            setDownloadingFileId(null);
        }
    };

    const handleImprovePrompt = async () => {
        try {
            setIsImprovingPrompt(true);
            const result = await improveOcrPrompt(token, log.id);
            setImproveResult(result);
            setShowImproveDialog(true);
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : "Failed to improve OCR prompt",
                "error",
            );
        } finally {
            setIsImprovingPrompt(false);
        }
    };

    // tab indices are dynamic
    const tabPrompt = 1;
    const tabStoredFiles = 1 + (hasPrompt ? 1 : 0);
    const tabExtracted = tabStoredFiles + (hasStoredFiles ? 1 : 0);
    const tabMetadata = tabExtracted + (hasExtracted ? 1 : 0);

    return (
        <>
            <Dialog
                open
                onClose={onClose}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: isDark ? "#10151d" : "#ffffff",
                        backgroundImage: "none",
                        border: `1px solid ${isDark ? "#273244" : "#d9e1ec"}`,
                        borderRadius: 3,
                        boxShadow: isDark
                            ? "0 30px 80px rgba(0,0,0,0.55)"
                            : "0 24px 60px rgba(15, 23, 42, 0.18)",
                    },
                }}
            >
                <DialogTitle sx={{ px: 3, pt: 3, pb: 2 }}>
                    <Box
                        sx={{
                            borderRadius: 3,
                            px: 2.25,
                            py: 2,
                            border: "1px solid",
                            borderColor: isDark ? "rgba(96,165,250,0.20)" : "rgba(59,130,246,0.16)",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.88))"
                                : "linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.96))",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.15, minWidth: 0 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <StatusChip status={log.status} />
                                    <Chip
                                        label={formatLogType(log.type)}
                                        size="small"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: 11,
                                            height: 24,
                                            color: theme.palette.info.main,
                                            backgroundColor: alpha(theme.palette.info.main, isDark ? 0.18 : 0.12),
                                        }}
                                    />
                                    {log.simulationReferenceNumber && (
                                        <Chip
                                            icon={<LinkRoundedIcon sx={{ fontSize: 14 }} />}
                                            label={`Simulation ${log.simulationReferenceNumber}`}
                                            size="small"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: 11,
                                                height: 24,
                                                color: theme.palette.secondary.main,
                                                backgroundColor: alpha(theme.palette.secondary.main, isDark ? 0.18 : 0.1),
                                            }}
                                        />
                                    )}
                                </Box>
                                <Box>
                                    <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                                        OCR Request Detail
                                    </Typography>
                                    <Typography sx={{ mt: 0.6, fontSize: 13, color: "text.secondary", lineHeight: 1.45 }}>
                                        {new Date(log.requestedAt).toLocaleString("en-GB", {
                                            day: "2-digit", month: "2-digit", year: "numeric",
                                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                                        })}
                                        {log.userName || log.userEmail ? ` · ${log.userName ?? log.userEmail}` : ""}
                                    </Typography>
                                </Box>
                            </Box>
                            <IconButton size="small" onClick={onClose} sx={{ mt: -0.25, mr: -0.25 }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>

                <Box sx={{ px: 3, pb: 2.25 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
                            gap: 1.5,
                        }}
                    >
                        <DetailStatCard
                            label="Request"
                            value={primaryFileSummary}
                            subvalue={primaryFileMeta || `Log ID: ${log.id}`}
                            icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.primary.main}
                        />
                        <DetailStatCard
                            label="Model"
                            value={formatProvider(log.provider)}
                            subvalue={log.model}
                            icon={<SmartToyOutlinedIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.info.main}
                        />
                        <DetailStatCard
                            label="Performance"
                            value={log.durationMs != null ? `${(log.durationMs / 1000).toFixed(2)}s` : "—"}
                            subvalue={log.httpStatusCode != null ? `HTTP ${log.httpStatusCode}` : "No status code"}
                            icon={<TimerOutlinedIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.warning.main}
                        />
                        <DetailStatCard
                            label="Tokens"
                            value={tokenSummary}
                            subvalue={tokenBreakdown}
                            icon={<TollRoundedIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.success.main}
                        />
                    </Box>

                    <Box
                        sx={{
                            mt: 1.5,
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                            gap: 1.5,
                        }}
                    >
                        <DetailStatCard
                            label="Stored Files"
                            value={getStoredFilesSummary(log)}
                            subvalue={log.files?.map((file) => file.fileName).join(" · ") || undefined}
                            icon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.secondary.main}
                        />
                        <DetailStatCard
                            label="Simulation"
                            value={log.simulationReferenceNumber ?? "Not linked"}
                            subvalue={log.simulationId ?? undefined}
                            icon={<LinkRoundedIcon sx={{ fontSize: 16 }} />}
                            mono={!log.simulationReferenceNumber && !!log.simulationId}
                            accent={theme.palette.secondary.main}
                        />
                        <DetailStatCard
                            label="Identity"
                            value={log.userName ?? log.userEmail ?? "Unknown user"}
                            subvalue={log.userName && log.userEmail ? log.userEmail : `Log ID: ${log.id}`}
                            icon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                            accent={theme.palette.primary.light}
                        />
                    </Box>
                </Box>

                {log.errorMessage && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <Box
                            sx={{
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: alpha(theme.palette.error.main, 0.22),
                                backgroundColor: alpha(theme.palette.error.main, isDark ? 0.12 : 0.08),
                                px: 1.75,
                                py: 1.4,
                            }}
                        >
                            <Typography sx={labelSx}>Error</Typography>
                            <Typography variant="body2" sx={{ fontSize: 12.5, color: "error.main", fontWeight: 600, lineHeight: 1.45 }}>
                                {log.errorType ? `[${log.errorType}] ` : ""}{log.errorMessage}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {log.reportedIssue && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <Box
                            sx={{
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: alpha(theme.palette.warning.main, 0.35),
                                backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.10 : 0.07),
                                px: 1.75,
                                py: 1.4,
                                display: "flex",
                                gap: 1,
                                alignItems: "flex-start",
                            }}
                        >
                            <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main", mt: "2px", flexShrink: 0 }} />
                            <Box>
                                <Typography sx={{ ...labelSx, color: "warning.main" }}>Reported Issue</Typography>
                                <Typography variant="body2" sx={{ fontSize: 12.5, color: "text.primary", lineHeight: 1.45 }}>
                                    {log.reportedIssue}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                )}

                {log.type === "INVOICE_EXTRACTION" && log.extractedFields && (log.simulationId || log.reportedIssue) && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={isImprovingPrompt ? undefined : <AutoFixHighRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={handleImprovePrompt}
                            disabled={isImprovingPrompt}
                            sx={{
                                borderRadius: 999,
                                fontWeight: 700,
                                textTransform: "none",
                                fontSize: 13,
                                borderColor: isDark ? alpha(theme.palette.warning.main, 0.45) : alpha(theme.palette.warning.main, 0.5),
                                color: theme.palette.warning.main,
                                "&:hover": {
                                    borderColor: theme.palette.warning.main,
                                    background: alpha(theme.palette.warning.main, 0.08),
                                },
                            }}
                        >
                            {isImprovingPrompt ? "Analysing corrections & improving prompt…" : "Improve OCR Prompt with AI"}
                        </Button>
                        <Typography variant="caption" sx={{ display: "block", mt: 0.75, fontSize: 11, color: "text.secondary", lineHeight: 1.4 }}>
                            {log.simulationId
                                ? "Compares OCR-extracted fields with the linked simulation's current values, detects user corrections, and asks the AI to produce an improved extraction prompt."
                                : "Uses the reported issue description to ask the AI to produce an improved extraction prompt targeting the problem described."}
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
                    {hasPrompt && <Tab label="Prompt Sent" />}
                    {hasStoredFiles && <Tab label={`Stored Files (${log.files?.length ?? 0})`} />}
                    {hasExtracted && <Tab label="Extracted Fields" />}
                    {hasMetadata && <Tab label="Metadata" />}
                </Tabs>

                <DialogContent sx={{ pt: 2, pb: 2.5 }}>
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
                    {tab === tabPrompt && hasPrompt && (
                        <Box>
                            <Typography sx={{ ...labelSx, mb: 1 }}>Full prompt sent to the LLM</Typography>
                            <Box sx={codeBoxSx}>
                                {log.promptText}
                            </Box>
                        </Box>
                    )}
                    {tab === tabStoredFiles && hasStoredFiles && (
                        <Box>
                            <Typography sx={{ ...labelSx, mb: 1 }}>Files persisted for this OCR request</Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                                {log.files?.map((file, index) => (
                                    <Box
                                        key={file.id}
                                        sx={{
                                            border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
                                            borderRadius: 2,
                                            p: 1.75,
                                            background: isDark
                                                ? "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))"
                                                : "linear-gradient(180deg, #ffffff, #f8fafc)",
                                            display: "flex",
                                            alignItems: { xs: "flex-start", sm: "center" },
                                            justifyContent: "space-between",
                                            gap: 1.5,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                                                <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    File {index + 1}: {file.fileName}
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: 11.5 }}>
                                                {[
                                                    file.fileType?.replace("application/", "").replace("image/", ""),
                                                    formatFileSize(file.fileSizeBytes),
                                                ].filter(Boolean).join(" · ")}
                                            </Typography>
                                        </Box>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                                            onClick={() => handleDownloadStoredFile(file.id, file.fileName)}
                                            disabled={downloadingFileId === file.id}
                                            sx={{
                                                minWidth: 132,
                                                borderRadius: 999,
                                                fontWeight: 700,
                                                textTransform: "none",
                                            }}
                                        >
                                            {downloadingFileId === file.id ? "Downloading..." : "Download"}
                                        </Button>
                                    </Box>
                                ))}
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
            {showImproveDialog && improveResult && (
                <Dialog
                    open
                    onClose={() => { setShowImproveDialog(false); setTestResult(null); }}
                    maxWidth="xl"
                    fullWidth
                    PaperProps={{
                        sx: {
                            backgroundColor: isDark ? "#10151d" : "#ffffff",
                            backgroundImage: "none",
                            border: `1px solid ${isDark ? "#2d3d22" : "#bde4a8"}`,
                            borderRadius: 3,
                        },
                    }}
                >
                    <DialogTitle sx={{ px: 3, pt: 3, pb: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                                <AutoFixHighRoundedIcon sx={{ fontSize: 22, color: theme.palette.warning.main }} />
                                <Box>
                                    <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                                        {improveResult!.noCorrections ? "No Corrections Found" : "Improved OCR Prompt"}
                                    </Typography>
                                    {!improveResult!.noCorrections && (
                                        <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.3 }}>
                                            {improveResult!.corrections.length} correction{improveResult!.corrections.length !== 1 ? "s" : ""} detected
                                            {improveResult!.simulationReferenceNumber ? ` · Simulation #${improveResult!.simulationReferenceNumber}` : ""}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                            <IconButton size="small" onClick={() => { setShowImproveDialog(false); setTestResult(null); }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent sx={{ px: 3, pb: 3 }}>
                        {improveResult!.noCorrections ? (
                            <Box sx={{
                                p: 2.5, borderRadius: 2,
                                background: alpha(theme.palette.info.main, isDark ? 0.1 : 0.07),
                                border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`,
                            }}>
                                <Typography sx={{ fontSize: 14, lineHeight: 1.6 }}>{improveResult!.message}</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {/* Improved prompt + copy + test buttons */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Improved prompt
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(improveResult!.improvedPrompt);
                                                    onNotify?.("Improved prompt copied to clipboard", "success");
                                                }}
                                                sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none", fontSize: 12 }}
                                            >
                                                Copy
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="warning"
                                                startIcon={isTestingPrompt ? undefined : <AutoFixHighRoundedIcon sx={{ fontSize: 14 }} />}
                                                disabled={isTestingPrompt}
                                                onClick={async () => {
                                                    setIsTestingPrompt(true);
                                                    setTestResult(null);
                                                    try {
                                                        const result = await testOcrPrompt(token, log.id, improveResult!.improvedPrompt);
                                                        setTestResult(result);
                                                    } catch (err: any) {
                                                        onNotify?.(err?.message ?? "Test failed", "error");
                                                    } finally {
                                                        setIsTestingPrompt(false);
                                                    }
                                                }}
                                                sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none", fontSize: 12 }}
                                            >
                                                {isTestingPrompt ? "Running OCR…" : "Test this prompt"}
                                            </Button>
                                        </Box>
                                    </Box>
                                    <Box sx={{
                                        backgroundColor: isDark ? "#0d1117" : "#f6f8fa",
                                        border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
                                        borderRadius: 1,
                                        p: 2,
                                        fontFamily: "monospace",
                                        fontSize: 12,
                                        lineHeight: 1.6,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        overflowY: "auto",
                                        maxHeight: "30vh",
                                        color: isDark ? "#e6edf3" : "#24292f",
                                    }}>
                                        {improveResult!.improvedPrompt}
                                    </Box>
                                </Box>

                                {/* Side-by-side comparison */}
                                {testResult && (() => {
                                    const allFields = Array.from(new Set([
                                        ...Object.keys(testResult.oldFields),
                                        ...Object.keys(testResult.newFields),
                                    ])).sort();
                                    const changed = allFields.filter(f => String(testResult.oldFields[f] ?? "") !== String(testResult.newFields[f] ?? ""));
                                    const unchanged2 = allFields.filter(f => String(testResult.oldFields[f] ?? "") === String(testResult.newFields[f] ?? ""));
                                    return (
                                        <Box>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 1.5 }}>
                                                <DifferenceRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                    OCR comparison — {changed.length} field{changed.length !== 1 ? "s" : ""} changed
                                                </Typography>
                                            </Box>
                                            <Box sx={{ borderRadius: 1.5, border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`, overflow: "hidden" }}>
                                                {/* Header */}
                                                <Box sx={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", background: isDark ? "#161b22" : "#f6f8fa", borderBottom: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}>
                                                    <Box sx={{ px: 1.5, py: 0.75 }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>Field</Typography></Box>
                                                    <Box sx={{ px: 1.5, py: 0.75, borderLeft: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: theme.palette.error.main, textTransform: "uppercase", letterSpacing: "0.05em" }}>Old prompt result</Typography></Box>
                                                    <Box sx={{ px: 1.5, py: 0.75, borderLeft: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: theme.palette.success.main, textTransform: "uppercase", letterSpacing: "0.05em" }}>New prompt result</Typography></Box>
                                                </Box>
                                                {/* Changed rows first */}
                                                {[...changed, ...unchanged2].map((field, i) => {
                                                    const isChanged = changed.includes(field);
                                                    const oldVal = testResult.oldFields[field];
                                                    const newVal = testResult.newFields[field];
                                                    const fmt = (v: unknown) => v === null || v === undefined || v === "" ? <em style={{ opacity: 0.4 }}>(empty)</em> : String(v);
                                                    return (
                                                        <Box key={field} sx={{
                                                            display: "grid",
                                                            gridTemplateColumns: "200px 1fr 1fr",
                                                            borderBottom: i < allFields.length - 1 ? `1px solid ${isDark ? "#21262d" : "#eaecef"}` : "none",
                                                            background: isChanged ? (isDark ? "rgba(248,81,73,0.07)" : "rgba(248,81,73,0.04)") : "transparent",
                                                        }}>
                                                            <Box sx={{ px: 1.5, py: 0.85 }}>
                                                                <Typography sx={{ fontSize: 12, fontWeight: isChanged ? 700 : 400, fontFamily: "monospace", color: isChanged ? theme.palette.info.main : "text.secondary" }}>{field}</Typography>
                                                            </Box>
                                                            <Box sx={{ px: 1.5, py: 0.85, borderLeft: `1px solid ${isDark ? "#21262d" : "#eaecef"}` }}>
                                                                <Typography sx={{ fontSize: 12, color: isChanged ? theme.palette.error.main : "text.primary" }}>{fmt(oldVal)}</Typography>
                                                            </Box>
                                                            <Box sx={{ px: 1.5, py: 0.85, borderLeft: `1px solid ${isDark ? "#21262d" : "#eaecef"}` }}>
                                                                <Typography sx={{ fontSize: 12, color: isChanged ? theme.palette.success.main : "text.primary" }}>{fmt(newVal)}</Typography>
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </Box>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
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
            key: "type",
            label: "Type",
            renderCell: (log) => (
                <Chip
                    label={formatLogType(log.type)}
                    size="small"
                    sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        height: 24,
                        backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.16 : 0.1),
                        color: theme.palette.info.main,
                    }}
                />
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
                            log.files && log.files.length > 1 ? `${log.files.length} files` : null,
                            log.pageCount ? `${log.pageCount}p` : null,
                        ].filter(Boolean).join(" · ")}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "storedFiles",
            label: "Stored Files",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, maxWidth: 180 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                        {log.files?.length ?? 0}
                    </Typography>
                    <Tooltip title={log.files?.map((file) => `${file.fileName} (${formatFileSize(file.fileSizeBytes)})`).join(" · ") ?? "No files stored"}>
                        <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getStoredFilesSummary(log)}
                        </Typography>
                    </Tooltip>
                </Box>
            ),
        },
        {
            key: "simulation",
            label: "Simulation",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, maxWidth: 130 }}>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                        {log.simulationReferenceNumber ?? "—"}
                    </Typography>
                    {log.simulationId && (
                        <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1.2, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {log.simulationId}
                        </Typography>
                    )}
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
                if (log.type === "PROVIDER_DETECTION") {
                    const providerName = (log.metadata?.detectedProviderName as string | undefined) ?? log.fileName;
                    return (
                        <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {providerName ?? "—"}
                        </Typography>
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
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                            <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                                {parts.join(" · ") || "—"}
                            </Typography>
                            {log.reportedIssue && (
                                <Tooltip title={`Reported: ${log.reportedIssue}`}>
                                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, cursor: "default" }}>
                                        <WarningAmberIcon sx={{ fontSize: 12, color: "warning.main" }} />
                                        <Typography variant="caption" sx={{ fontSize: 10, color: "warning.main", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                                            Issue reported
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
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
                    OCR Logs
                </h2>
                <p style={{ fontSize: "13px", color: "var(--scheme-neutral-600)" }}>
                    Track invoice extraction and provider detection requests, including stored request files and linked simulations.
                    Click <strong>↗</strong> on any row to view the full LLM response.
                </p>
            </div>

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
                emptyMessage="No OCR requests found"
            />

            {selectedLog && (
                <OcrLogDetailDialog
                    log={selectedLog}
                    token={session.token}
                    onNotify={onNotify}
                    onClose={() => setSelectedLog(null)}
                />
            )}
        </div>
    );
}
