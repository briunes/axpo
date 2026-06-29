"use client";
import { useCallback, useEffect, useState } from "react";
import {
    alpha,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
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
import type { Theme } from "@mui/material/styles";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import DoDisturbAltRoundedIcon from "@mui/icons-material/DoDisturbAltRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef } from "../ui";
import { FormSelect } from "../ui/FormSelect";
import { FormInput } from "../ui/FormInput";
import { DateRangePicker } from "../ui/DateRangePicker";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { improveOcrPrompt, testOcrPrompt, type ImproveOcrPromptResult, type TestOcrPromptResult } from "../../lib/internalApi";
import { useI18n } from "../../../../src/lib/i18n-context";

interface OcrLogEntry {
    id: string;
    requestedAt: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    type: "INVOICE_EXTRACTION" | "PROVIDER_DETECTION" | "PROMPT_IMPROVEMENT" | "PROMPT_TEST" | "TEMPLATE_BUILDER";
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
    userCorrections?: Record<string, { ocr: unknown; corrected: unknown }> | null;
    errorMessage?: string;
    errorType?: string;
    httpStatusCode?: number;
    rawResponseSnippet?: string;
    promptText?: string;
    metadata?: Record<string, unknown>;
    simulationId?: string | null;
    simulationReferenceNumber?: string | null;
    reportedIssue?: string | null;
    issueStatus?: OcrIssueStatus | null;
    issueResolution?: string | null;
    issueNotes?: string | null;
    issueSubmittedAt?: string | null;
    issueHandledAt?: string | null;
    issueHandledByUserId?: string | null;
    issueSignalCount?: number;
    files?: Array<{
        id: string;
        fileName: string;
        fileType?: string | null;
        fileSizeBytes: number;
    }>;
}

type OcrIssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

type OcrIssueUpdateInput = {
    status: OcrIssueStatus;
    resolution?: string | null;
    notes?: string | null;
};

function getVisibleCorrections(log: OcrLogEntry): Record<string, { ocr: unknown; corrected: unknown }> {
    return log.userCorrections ?? {};
}

function getIssueSignalCount(log: OcrLogEntry): number {
    return (log.reportedIssue ? 1 : 0) + Object.keys(getVisibleCorrections(log)).length;
}

function hasIssue(log: OcrLogEntry): boolean {
    return getIssueSignalCount(log) > 0 || !!log.issueStatus;
}

function getIssueStatus(log: OcrLogEntry): OcrIssueStatus | null {
    if (!hasIssue(log)) return null;
    return log.issueStatus ?? "OPEN";
}

function getIssueLabel(status: OcrIssueStatus | null, t?: ReturnType<typeof useI18n>["t"]): string {
    const labels: Record<OcrIssueStatus, string> = {
        OPEN: t?.("logs", "open") ?? "Open",
        IN_PROGRESS: t?.("logs", "inProgress") ?? "In progress",
        RESOLVED: t?.("logs", "resolved") ?? "Resolved",
        DISMISSED: t?.("logs", "dismissed") ?? "Dismissed",
    };
    return status ? labels[status] : (t?.("logs", "noIssue") ?? "No issue");
}

function getIssueTone(theme: Theme, status: OcrIssueStatus | null) {
    if (status === "RESOLVED") return { color: theme.palette.success.main, bg: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.11) };
    if (status === "DISMISSED") return { color: theme.palette.text.secondary, bg: alpha(theme.palette.text.secondary, 0.1) };
    if (status === "IN_PROGRESS") return { color: theme.palette.info.main, bg: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.18 : 0.11) };
    if (status === "OPEN") return { color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.2 : 0.12) };
    return { color: theme.palette.text.secondary, bg: alpha(theme.palette.text.secondary, 0.08) };
}

function IssueChip({ log }: { log: OcrLogEntry }) {
    const theme = useTheme();
    const { t } = useI18n();
    const status = getIssueStatus(log);
    const tone = getIssueTone(theme, status);
    const signalCount = getIssueSignalCount(log);
    return (
        <Chip
            icon={status ? <PendingActionsRoundedIcon sx={{ fontSize: 14 }} /> : undefined}
            label={status ? `${getIssueLabel(status, t)} · ${signalCount}` : t("logs", "none")}
            size="small"
            sx={{
                fontWeight: 700,
                fontSize: 11,
                height: 24,
                color: tone.color,
                backgroundColor: tone.bg,
                "& .MuiChip-icon": { color: tone.color },
            }}
        />
    );
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
        "aws-bedrock-mantle": "AWS Bedrock (Mantle)",
        "anthropic": "Anthropic",
        "aws-bedrock-anthropic": "AWS Bedrock (Claude)",
        "google": "Google AI",
    };
    return map[provider] ?? provider;
}

function formatLogType(type: OcrLogEntry["type"], t?: ReturnType<typeof useI18n>["t"]): string {
    const labels: Record<OcrLogEntry["type"], string> = {
        INVOICE_EXTRACTION: t?.("logs", "invoiceExtraction") ?? "Invoice Extraction",
        PROVIDER_DETECTION: t?.("logs", "providerDetection") ?? "Provider Detection",
        PROMPT_IMPROVEMENT: t?.("logs", "promptImprovement") ?? "Prompt Improvement",
        PROMPT_TEST: t?.("logs", "promptTest") ?? "Prompt Test",
        TEMPLATE_BUILDER: t?.("logs", "templateBuilder") ?? "Template Builder",
    };
    return labels[type] ?? type;
}

function getStoredFilesSummary(log: OcrLogEntry, t?: ReturnType<typeof useI18n>["t"]): string {
    if (!log.files || log.files.length === 0) return "—";
    if (log.files.length === 1) {
        return `${log.files[0].fileName} (${formatFileSize(log.files[0].fileSizeBytes)})`;
    }
    const totalBytes = log.files.reduce((sum, file) => sum + file.fileSizeBytes, 0);
    return `${t?.("logs", "fileCount", { count: log.files.length }) ?? `${log.files.length} files`} · ${formatFileSize(totalBytes)}`;
}

function StatusChip({ status }: { status: string }) {
    const theme = useTheme();
    const { t } = useI18n();

    const config: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
        SUCCESS: {
            label: t("logs", "success"),
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
        },
        FAILED: {
            label: t("logs", "failed"),
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <ErrorIcon sx={{ fontSize: 14 }} />,
        },
        ERROR: {
            label: t("logs", "error"),
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            icon: <ErrorIcon sx={{ fontSize: 14 }} />,
        },
        PARSE_ERROR: {
            label: t("logs", "parseError"),
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

function OcrLogDetailDialog({
    log,
    token,
    onClose,
    onNotify,
    onIssueUpdate,
}: {
    log: OcrLogEntry;
    token: string;
    onClose: () => void;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onIssueUpdate: (log: OcrLogEntry, input: OcrIssueUpdateInput) => Promise<void>;
}) {
    const theme = useTheme();
    const { locale, t } = useI18n();
    const [tab, setTab] = useState(0);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
    const [improveStep, setImproveStep] = useState<null | "generating" | "testing">(null);
    const [improveResult, setImproveResult] = useState<ImproveOcrPromptResult | null>(null);
    const [showImproveDialog, setShowImproveDialog] = useState(false);
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [isReImproving, setIsReImproving] = useState(false);
    const [testResult, setTestResult] = useState<TestOcrPromptResult | null>(null);
    const [improveDialogTab, setImproveDialogTab] = useState(0);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [issueNotes, setIssueNotes] = useState(log.issueNotes ?? "");
    const [issueResolution, setIssueResolution] = useState(log.issueResolution ?? "");
    const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);
    const [issueAction, setIssueAction] = useState<null | "resolve" | "dismiss">(null);
    const isDark = theme.palette.mode === "dark";

    const visibleCorrections = getVisibleCorrections(log);
    const correctionEntries = Object.entries(visibleCorrections);
    const hasExtracted = !!log.extractedFields;
    const hasCorrections = correctionEntries.length > 0;
    const hasMetadata = !!log.metadata;
    const hasPrompt = !!log.promptText;
    const hasStoredFiles = !!log.files?.length;
    const issueStatus = getIssueStatus(log);

    useEffect(() => {
        setIssueNotes(log.issueNotes ?? "");
        setIssueResolution(log.issueResolution ?? "");
        setIssueAction(null);
    }, [log.id, log.issueNotes, log.issueResolution, log.issueStatus]);

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
            setImproveStep("generating");
            setImproveResult(null);
            setTestResult(null);
            setFeedbackComment("");
            const result = await improveOcrPrompt(token, log.id, {
                invoiceProviderId: (log.metadata?.invoiceProviderId as string | null) ?? null,
                invoiceProviderName: (log.metadata?.invoiceProviderName as string | null) ?? null,
                invoiceType: (log.metadata?.invoiceType as "ELECTRICITY" | "GAS" | undefined) ?? "ELECTRICITY",
            });
            setImproveResult(result);
            if (result.improvedPrompt) {
                setImproveStep("testing");
                try {
                    const testRes = await testOcrPrompt(token, log.id, result.improvedPrompt);
                    setTestResult(testRes);
                } catch {
                    // test failed non-fatally — still open dialog
                }
            }
            setShowImproveDialog(true);
        } catch (err) {
            onNotify?.(
                err instanceof Error ? err.message : "Failed to improve OCR prompt",
                "error",
            );
        } finally {
            setIsImprovingPrompt(false);
            setImproveStep(null);
        }
    };

    const handleIssueUpdate = async (status: OcrIssueStatus, defaultResolution?: string) => {
        try {
            setIsUpdatingIssue(true);
            await onIssueUpdate(log, {
                status,
                resolution: issueResolution.trim() || defaultResolution || null,
                notes: issueNotes.trim() || null,
            });
            setIssueAction(null);
        } finally {
            setIsUpdatingIssue(false);
        }
    };

    // tab indices are dynamic
    const tabPrompt = 1;
    const tabStoredFiles = 1 + (hasPrompt ? 1 : 0);
    const tabExtracted = tabStoredFiles + (hasStoredFiles ? 1 : 0);
    const tabCorrections = tabExtracted + (hasExtracted ? 1 : 0);
    const tabMetadata = tabCorrections + (hasCorrections ? 1 : 0);
    const canImprovePrompt = log.type === "INVOICE_EXTRACTION" && !!log.extractedFields && !!(log.simulationId || log.reportedIssue);

    useEffect(() => {
        setTab(hasCorrections ? tabCorrections : 0);
    }, [hasCorrections, log.id, tabCorrections]);

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
                <DialogTitle sx={{ px: 2.5, pt: 2, pb: 1.25 }}>
                    <Box
                        sx={{
                            borderRadius: 2,
                            px: 1.75,
                            py: 1.15,
                            border: "1px solid",
                            borderColor: isDark ? "rgba(96,165,250,0.20)" : "rgba(59,130,246,0.16)",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.88))"
                                : "linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.96))",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.7, minWidth: 0 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, flexWrap: "wrap" }}>
                                    <StatusChip status={log.status} />
                                    <Chip
                                        label={formatLogType(log.type, t)}
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
                                            icon={<OpenInNewIcon fontSize="small" />}
                                            label={`${t("logs", "simulation")} ${log.simulationReferenceNumber}`}
                                            size="small"
                                            component="a"
                                            href={`/internal/simulations/${log.simulationId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            clickable
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: 11,
                                                height: 24,
                                                color: theme.palette.secondary.main,
                                                backgroundColor: alpha(theme.palette.secondary.main, isDark ? 0.18 : 0.1),
                                                cursor: "pointer",
                                                textDecoration: "none",
                                                "&:hover": {
                                                    backgroundColor: alpha(theme.palette.secondary.main, isDark ? 0.28 : 0.18),
                                                },
                                            }}
                                        />
                                    )}
                                    {issueStatus && <IssueChip log={log} />}
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
                                    <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 850, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                                        {t("logs", "details")}
                                    </Typography>
                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.35 }}>
                                        {new Date(log.requestedAt).toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
                                            day: "2-digit", month: "2-digit", year: "numeric",
                                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                                        })}
                                        {log.userName || log.userEmail ? ` · ${log.userName ?? log.userEmail}` : ""}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
                                {issueStatus === "OPEN" && (
                                    <>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<PendingActionsRoundedIcon sx={{ fontSize: 15 }} />}
                                            disabled={isUpdatingIssue}
                                            onClick={() => handleIssueUpdate("IN_PROGRESS")}
                                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, fontSize: 12 }}
                                        >
                                            {t("logs", "inProgress")}
                                        </Button>
                                        <Button
                                            size="small"
                                            variant={issueAction === "dismiss" ? "contained" : "outlined"}
                                            color="inherit"
                                            startIcon={<DoDisturbAltRoundedIcon sx={{ fontSize: 15 }} />}
                                            disabled={isUpdatingIssue}
                                            onClick={() => setIssueAction(issueAction === "dismiss" ? null : "dismiss")}
                                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, fontSize: 12 }}
                                        >
                                            {t("logs", "dismissed")}
                                        </Button>
                                    </>
                                )}
                                {issueStatus === "IN_PROGRESS" && (
                                    <Button
                                        size="small"
                                        variant={issueAction === "resolve" ? "contained" : "outlined"}
                                        color="success"
                                        startIcon={<AssignmentTurnedInRoundedIcon sx={{ fontSize: 15 }} />}
                                        disabled={isUpdatingIssue}
                                        onClick={() => setIssueAction(issueAction === "resolve" ? null : "resolve")}
                                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, fontSize: 12 }}
                                    >
                                        {t("logs", "resolved")}
                                    </Button>
                                )}
                                {(issueStatus === "RESOLVED" || issueStatus === "DISMISSED") && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={isUpdatingIssue}
                                        onClick={() => handleIssueUpdate("OPEN")}
                                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, fontSize: 12 }}
                                    >
                                        {t("logs", "open")}
                                    </Button>
                                )}
                                {canImprovePrompt && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
                                        onClick={handleImprovePrompt}
                                        disabled={isImprovingPrompt}
                                        sx={{
                                            borderRadius: 999,
                                            fontWeight: 800,
                                            textTransform: "none",
                                            fontSize: 12,
                                            borderColor: isDark ? alpha(theme.palette.warning.main, 0.45) : alpha(theme.palette.warning.main, 0.5),
                                            color: theme.palette.warning.main,
                                            "&:hover": {
                                                borderColor: theme.palette.warning.main,
                                                background: alpha(theme.palette.warning.main, 0.08),
                                            },
                                        }}
                                    >
                                        {isImprovingPrompt ? t("common", "loading") : t("logs", "promptImprovement")}
                                    </Button>
                                )}
                                <IconButton size="small" onClick={onClose}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>
                    </Box>
                </DialogTitle>

                {!isImprovingPrompt && <Box sx={{ px: 2.5, pb: 1.25 }}>
                    <Box
                        sx={{
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: isDark ? "#30363d" : "#d9e1ec",
                            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "#fafbfc",
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                            overflow: "hidden",
                        }}
                    >
                        {[
                            {
                                label: t("logs", "file"),
                                value: primaryFileSummary,
                                subvalue: [primaryFileMeta, getStoredFilesSummary(log, t)].filter(Boolean).join(" · "),
                                icon: <InsertDriveFileOutlinedIcon sx={{ fontSize: 14 }} />,
                            },
                            {
                                label: t("logs", "providerModel"),
                                value: formatProvider(log.provider),
                                subvalue: log.model,
                                icon: <SmartToyOutlinedIcon sx={{ fontSize: 14 }} />,
                            },
                            {
                                label: t("logs", "duration"),
                                value: log.durationMs != null ? `${(log.durationMs / 1000).toFixed(2)}s` : "—",
                                subvalue: log.httpStatusCode != null ? `HTTP ${log.httpStatusCode}` : tokenSummary,
                                icon: <TimerOutlinedIcon sx={{ fontSize: 14 }} />,
                            },
                        ].map((item, index) => (
                            <Box
                                key={item.label}
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderTop: { xs: index === 0 ? "none" : "1px solid", sm: "none" },
                                    borderColor: isDark ? "#30363d" : "#e2e8f0",
                                    minWidth: 0,
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mb: 0.5, color: "text.secondary" }}>
                                    {item.icon}
                                    <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                        {item.label}
                                    </Typography>
                                </Box>
                                <Typography sx={{fontWeight: 700, color: "text.primary", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {item.value}
                                </Typography>
                                <Tooltip title={item.subvalue}>
                                    <Typography sx={{ mt: 0.25, fontSize: 11, color: "text.secondary", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {item.subvalue}
                                    </Typography>
                                </Tooltip>
                            </Box>
                        ))}
                    </Box>
                </Box>}

                {!isImprovingPrompt && log.errorMessage && (
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
                            <Typography sx={labelSx}>{t("logs", "error")}</Typography>
                            <Typography variant="body2" sx={{ fontSize: 12.5, color: "error.main", fontWeight: 600, lineHeight: 1.45 }}>
                                {log.errorType ? `[${log.errorType}] ` : ""}{log.errorMessage}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {issueStatus && issueAction && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <Box
                            sx={{
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: alpha(getIssueTone(theme, issueStatus).color, 0.28),
                                backgroundColor: isDark ? alpha(getIssueTone(theme, issueStatus).color, 0.06) : alpha(getIssueTone(theme, issueStatus).color, 0.035),
                                overflow: "hidden",
                            }}
                        >
                            <Box
                                sx={{
                                    px: 1.75,
                                    py: 1.25,
                                    borderBottom: "1px solid",
                                    borderColor: alpha(getIssueTone(theme, issueStatus).color, 0.18),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1.5,
                                    flexWrap: "wrap",
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <Typography sx={{fontWeight: 800, color: "text.primary" }}>
                                        {t("logs", "issue")}
                                    </Typography>
                                    <IssueChip log={log} />
                                </Box>
                                {log.issueHandledAt && (
                                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                        {formatDistanceToNow(new Date(log.issueHandledAt), { addSuffix: true, locale: locale === "es" ? es : undefined })}
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
                                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
                                    {log.reportedIssue && (
                                        <Chip
                                            size="small"
                                            icon={<WarningAmberIcon fontSize="small" />}
                                            label={t("logs", "reported")}
                                            sx={{ height: 22, fontSize: 10.5, fontWeight: 700, color: theme.palette.warning.main, backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.1), "& .MuiChip-icon": { color: theme.palette.warning.main } }}
                                        />
                                    )}
                                    {correctionEntries.length > 0 && (
                                        <Chip
                                            size="small"
                                            icon={<AssignmentTurnedInRoundedIcon fontSize="small" />}
                                            label={`${correctionEntries.length} correction${correctionEntries.length !== 1 ? "s" : ""}`}
                                            sx={{ height: 22, fontSize: 10.5, fontWeight: 700, color: theme.palette.info.main, backgroundColor: alpha(theme.palette.info.main, isDark ? 0.18 : 0.1), "& .MuiChip-icon": { color: theme.palette.info.main } }}
                                        />
                                    )}
                                </Box>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: { xs: "1fr", md: log.reportedIssue && correctionEntries.length > 0 ? "1fr 1fr" : "1fr" },
                                        gap: 1.25,
                                    }}
                                >
                                    {log.reportedIssue && (
                                        <Box>
                                            <Typography sx={labelSx}>{t("logs", "reportedMessage")}</Typography>
                                            <Typography variant="body2" sx={{ fontSize: 12.5, color: "text.primary", lineHeight: 1.45 }}>
                                                {log.reportedIssue}
                                            </Typography>
                                        </Box>
                                    )}
                                    {correctionEntries.length > 0 && (
                                        <Box>
                                            <Typography sx={labelSx}>{t("logs", "correctionPreview")}</Typography>
                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.45 }}>
                                                {correctionEntries.slice(0, 2).map(([field, { ocr, corrected }]) => (
                                                    <Box
                                                        key={field}
                                                        sx={{
                                                            display: "grid",
                                                            gridTemplateColumns: "112px minmax(0, 1fr)",
                                                            gap: 0.8,
                                                            borderRadius: 1,
                                                            border: "1px solid",
                                                            borderColor: isDark ? "#30363d" : "#e2e8f0",
                                                            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.75)",
                                                            px: 1,
                                                            py: 0.6,
                                                        }}
                                                    >
                                                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: "monospace", color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {field}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: 11.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {ocr === null || ocr === undefined ? t("logs", "emptyValue") : String(ocr)}{" -> "}{corrected === null || corrected === undefined ? t("logs", "clearedValue") : String(corrected)}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                                {correctionEntries.length > 2 && (
                                                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                                        {t("logs", "moreCorrections", { count: correctionEntries.length - 2 })}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                    {!log.reportedIssue && correctionEntries.length === 0 && (
                                        <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.45 }}>
                                            {t("logs", "manualTracking")}
                                        </Typography>
                                    )}
                                </Box>

                                {(log.issueResolution || log.issueNotes) && (
                                    <Box sx={{ borderTop: "1px solid", borderColor: isDark ? "#30363d" : "#e2e8f0", pt: 1 }}>
                                        {log.issueResolution && (
                                            <Typography sx={{ fontSize: 12.5, color: "text.primary", fontWeight: 700, mb: 0.35 }}>
                                                {t("logs", "resolutionWithValue", { resolution: log.issueResolution })}
                                            </Typography>
                                        )}
                                        {log.issueNotes && (
                                            <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.45 }}>
                                                {log.issueNotes}
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                {issueAction && (
                                    <Box
                                        sx={{
                                            borderTop: "1px solid",
                                            borderColor: alpha(getIssueTone(theme, issueStatus).color, 0.18),
                                            pt: 1.25,
                                            display: "grid",
                                            gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr) auto" },
                                            gap: 1,
                                            alignItems: "start",
                                        }}
                                    >
                                        <FormInput
                                            size="small"
                                            label={t("logs", "resolution")}
                                            placeholder={issueAction === "resolve" ? t("logs", "resolvePlaceholder") : t("logs", "dismissPlaceholder")}
                                            value={issueResolution}
                                            onChange={(event) => setIssueResolution(event.target.value)}
                                            sx={{ "& .MuiInputBase-root": { fontSize: 12.5 } }}
                                        />
                                        <FormInput
                                            size="small"
                                            label={t("logs", "notes")}
                                            placeholder={t("logs", "optionalDetails")}
                                            value={issueNotes}
                                            onChange={(event) => setIssueNotes(event.target.value)}
                                            multiline
                                            rows={2}
                                            sx={{ "& .MuiInputBase-root": { fontSize: 12.5, alignItems: "flex-start" } }}
                                        />
                                        <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                                            <Button
                                                size="small"
                                                variant="text"
                                                disabled={isUpdatingIssue}
                                                onClick={() => setIssueAction(null)}
                                                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700, fontSize: 12 }}
                                            >
                                                {t("common", "cancel")}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color={issueAction === "resolve" ? "success" : "inherit"}
                                                disabled={isUpdatingIssue}
                                                onClick={() => handleIssueUpdate(issueAction === "resolve" ? "RESOLVED" : "DISMISSED", issueAction === "resolve" ? t("logs", "fixed") : t("logs", "dismissed"))}
                                                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}
                                            >
                                                {issueAction === "resolve" ? t("logs", "saveResolution") : t("logs", "dismissIssue")}
                                            </Button>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>
                )}

                {canImprovePrompt && isImprovingPrompt && (
                    <Box sx={{ px: 2.5, pb: 1 }}>
                        <Box sx={{
                            borderRadius: 2,
                            border: `1px solid ${isDark ? alpha(theme.palette.warning.main, 0.25) : alpha(theme.palette.warning.main, 0.4)}`,
                            backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.06 : 0.04),
                            p: 1.5,
                        }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
                                <AutoFixHighRoundedIcon sx={{ fontSize: 18, color: theme.palette.warning.main, flexShrink: 0 }} />
                                <Typography sx={{fontWeight: 800, color: theme.palette.warning.main }}>
                                    {improveStep === "generating" ? "Generating improved prompt..." : "Testing the new prompt..."}
                                </Typography>
                            </Box>
                            <Box sx={{ height: 4, borderRadius: 2, background: isDark ? "#21262d" : "#e0e0e0", overflow: "hidden" }}>
                                <Box sx={{
                                    height: "100%",
                                    borderRadius: 2,
                                    background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${alpha(theme.palette.warning.main, 0.5)})`,
                                    width: improveStep === "testing" ? "75%" : "40%",
                                    transition: "width 0.6s ease",
                                }} />
                            </Box>
                        </Box>
                    </Box>
                )}

                {!isImprovingPrompt && <><Divider />

                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{ px: 2, minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 600, textTransform: "none" } }}
                    >
                        <Tab label="LLM Response" />
                        {hasPrompt && <Tab label="Prompt Sent" />}
                        {hasStoredFiles && <Tab label={`Stored Files (${log.files?.length ?? 0})`} />}
                        {hasExtracted && <Tab label="Extracted Fields" />}
                        {hasCorrections && (
                            <Tab
                                label={`User Corrections (${Object.keys(visibleCorrections).length})`}
                                sx={{ color: `${theme.palette.warning.main} !important` }}
                            />
                        )}
                        {hasMetadata && <Tab label="Metadata" />}
                    </Tabs>

                    <DialogContent sx={{ pt: 2, pb: 2.5 }}>
                        {tab === 0 && (
                            <Box>
                                <Typography sx={{ ...labelSx, mb: 1 }}>{t("logs", "rawTextReturned")}</Typography>
                                <Box sx={codeBoxSx}>
                                    {log.rawResponseSnippet
                                        ? log.rawResponseSnippet
                                        : <Typography component="span" sx={{ color: "text.secondary", fontStyle: "italic", fontSize: 12 }}>{t("logs", "noResponseText")}</Typography>
                                    }
                                </Box>
                            </Box>
                        )}
                        {tab === tabPrompt && hasPrompt && (
                            <Box>
                                <Typography sx={{ ...labelSx, mb: 1 }}>{t("logs", "fullPrompt")}</Typography>
                                <Box sx={codeBoxSx}>
                                    {log.promptText}
                                </Box>
                            </Box>
                        )}
                        {tab === tabStoredFiles && hasStoredFiles && (
                            <Box>
                                <Typography sx={{ ...labelSx, mb: 1 }}>{t("logs", "persistedFiles")}</Typography>
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
                                                    <Typography variant="body2" sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                                <Typography sx={{ ...labelSx, mb: 1 }}>{t("logs", "extractedJson")}</Typography>
                                <Box sx={codeBoxSx}>
                                    {JSON.stringify(log.extractedFields, null, 2)}
                                </Box>
                            </Box>
                        )}
                        {tab === tabCorrections && hasCorrections && (
                            <Box>
                                <Typography sx={{ ...labelSx, mb: 1.5 }}>
                                    Fields corrected by the user after OCR extraction
                                </Typography>
                                <Box
                                    sx={{
                                        borderRadius: 2,
                                        border: `1px solid ${isDark ? alpha(theme.palette.warning.main, 0.25) : alpha(theme.palette.warning.main, 0.35)}`,
                                        backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.06 : 0.04),
                                        px: 1.5,
                                        py: 1,
                                        mb: 1.5,
                                    }}
                                >
                                    <Typography variant="caption" sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.5 }}>
                                        These corrections are captured automatically when the user saves a simulation after editing OCR-prefilled fields.
                                        The AI prompt trainer uses this data to improve future extractions for this provider.
                                    </Typography>
                                </Box>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    {Object.entries(visibleCorrections).map(([field, { ocr, corrected }]) => (
                                        <Box
                                            key={field}
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: "180px 1fr 1fr",
                                                gap: 1.5,
                                                alignItems: "start",
                                                borderRadius: 1.5,
                                                border: `1px solid ${isDark ? "#30363d" : "#e2e8f0"}`,
                                                background: isDark
                                                    ? "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))"
                                                    : "linear-gradient(180deg, #ffffff, #f8fafc)",
                                                px: 1.5,
                                                py: 1.25,
                                            }}
                                        >
                                            <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "text.primary", pt: 0.25 }}>
                                                {field}
                                            </Typography>
                                            <Box>
                                                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "error.main", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.4 }}>
                                                    OCR extracted
                                                </Typography>
                                                <Box sx={{
                                                    backgroundColor: isDark ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.error.main, 0.07),
                                                    border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
                                                    borderRadius: 1,
                                                    px: 1,
                                                    py: 0.5,
                                                }}>
                                                    <Typography sx={{ fontSize: 12, fontFamily: "monospace", color: "error.main", wordBreak: "break-all" }}>
                                                            {ocr === null || ocr === undefined ? <em style={{ opacity: 0.6 }}>{t("logs", "notExtracted")}</em> : String(ocr)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "success.main", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.4 }}>
                                                    Corrected to
                                                </Typography>
                                                <Box sx={{
                                                    backgroundColor: isDark ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.success.main, 0.07),
                                                    border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
                                                    borderRadius: 1,
                                                    px: 1,
                                                    py: 0.5,
                                                }}>
                                                    <Typography sx={{ fontSize: 12, fontFamily: "monospace", color: "success.main", wordBreak: "break-all" }}>
                                                        {corrected === null || corrected === undefined ? <em style={{ opacity: 0.6 }}>{t("logs", "clearedValue")}</em> : String(corrected)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}
                        {tab === tabMetadata && hasMetadata && (
                            <Box>
                                <Typography sx={{ ...labelSx, mb: 1 }}>{t("logs", "requestMetadata")}</Typography>
                                <Box sx={codeBoxSx}>
                                    {JSON.stringify(log.metadata, null, 2)}
                                </Box>
                            </Box>
                        )}
                    </DialogContent></>}
            </Dialog>
            {showImproveDialog && improveResult && (
                <Dialog
                    open
                    onClose={() => { setShowImproveDialog(false); setTestResult(null); setFeedbackComment(""); setIsReImproving(false); setImproveDialogTab(0); setFeedbackOpen(false); }}
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
                            <IconButton size="small" onClick={() => { setShowImproveDialog(false); setTestResult(null); setFeedbackComment(""); setIsReImproving(false); setImproveDialogTab(0); setFeedbackOpen(false); }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent sx={{ px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
                        {isReImproving ? (
                            <Box sx={{
                                borderRadius: 2,
                                border: `1px solid ${isDark ? alpha(theme.palette.warning.main, 0.25) : alpha(theme.palette.warning.main, 0.4)}`,
                                backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.06 : 0.04),
                                p: 2,
                            }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                                    <AutoFixHighRoundedIcon sx={{ fontSize: 18, color: theme.palette.warning.main, flexShrink: 0 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                                        {improveStep === "generating" ? "Generating improved prompt…" : "Testing the new prompt…"}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                                    {[{ key: "generating", label: "1. Generate prompt" }, { key: "testing", label: "2. Test on invoice" }].map(step => {
                                        const isDone = improveStep === "testing" && step.key === "generating";
                                        const isActive = improveStep === step.key;
                                        return (
                                            <Box key={step.key} sx={{
                                                display: "flex", alignItems: "center", gap: 0.6,
                                                px: 1.25, py: 0.5, borderRadius: 999,
                                                background: isDone
                                                    ? alpha(theme.palette.success.main, isDark ? 0.18 : 0.12)
                                                    : isActive
                                                        ? alpha(theme.palette.warning.main, isDark ? 0.18 : 0.12)
                                                        : alpha(theme.palette.action.disabled, 0.06),
                                                border: `1px solid ${isDone ? alpha(theme.palette.success.main, 0.3)
                                                    : isActive ? alpha(theme.palette.warning.main, 0.4)
                                                        : isDark ? "#30363d" : "#d0d7de"}`,
                                            }}>
                                                {isDone
                                                    ? <CheckCircleIcon sx={{ fontSize: 11, color: theme.palette.success.main }} />
                                                    : isActive
                                                        ? <CircularProgress size={9} thickness={5} sx={{ color: theme.palette.warning.main }} />
                                                        : <span style={{ fontSize: 11, opacity: 0.3 }}>○</span>
                                                }
                                                <Typography sx={{ fontSize: 11.5, fontWeight: isActive ? 700 : 400, color: isDone ? theme.palette.success.main : isActive ? theme.palette.warning.main : "text.disabled" }}>
                                                    {step.label}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                                <Box sx={{ height: 4, borderRadius: 2, background: isDark ? "#21262d" : "#e0e0e0", overflow: "hidden" }}>
                                    <Box sx={{
                                        height: "100%",
                                        borderRadius: 2,
                                        background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${alpha(theme.palette.warning.main, 0.5)})`,
                                        width: improveStep === "testing" ? "75%" : "40%",
                                        transition: "width 0.6s ease",
                                        animation: "pulse 1.5s ease-in-out infinite",
                                    }} />
                                </Box>
                                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary", fontSize: 11 }}>
                                    {improveStep === "generating"
                                        ? "The AI is analysing the invoice, corrections and previous prompt to write a dedicated extraction prompt…"
                                        : "Running the new prompt against the stored invoice file to compare results…"}
                                </Typography>
                            </Box>
                        ) : improveResult!.noCorrections ? (
                            <Box sx={{
                                p: 2.5, borderRadius: 2,
                                background: alpha(theme.palette.info.main, isDark ? 0.1 : 0.07),
                                border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`,
                            }}>
                                <Typography sx={{ fontSize: 14, lineHeight: 1.6 }}>{improveResult!.message}</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>

                                {/* Re-improve with feedback — collapsible accordion */}
                                <Box sx={{
                                    borderRadius: 2,
                                    border: `1px solid ${isDark ? alpha(theme.palette.warning.main, 0.25) : alpha(theme.palette.warning.main, 0.35)}`,
                                    backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.05 : 0.03),
                                    overflow: "hidden",
                                }}>
                                    <Box
                                        onClick={() => setFeedbackOpen(v => !v)}
                                        sx={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            px: 2, py: 1.25,
                                            cursor: "pointer",
                                            userSelect: "none",
                                            "&:hover": { backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.07 : 0.05) },
                                        }}
                                    >
                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {t("logs", "reImproveWithFeedback")}
                                        </Typography>
                                        <KeyboardArrowDownRoundedIcon sx={{
                                            fontSize: 18, color: "text.secondary",
                                            transition: "transform 0.2s",
                                            transform: feedbackOpen ? "rotate(180deg)" : "rotate(0deg)",
                                        }} />
                                    </Box>
                                    <Collapse in={feedbackOpen}>
                                        <Box sx={{ px: 2, pb: 2 }}>
                                            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5, lineHeight: 1.5 }}>
                                                {t("logs", "feedbackDescription")}
                                            </Typography>
                                            <FormInput
                                                label=""
                                                value={feedbackComment}
                                                onChange={e => setFeedbackComment(e.target.value)}
                                                placeholder={t("logs", "feedbackPlaceholder")}
                                                multiline
                                                rows={3}
                                                sx={{
                                                    "& .MuiInputBase-root": {
                                                        alignItems: "flex-start", },
                                                }}
                                            />
                                            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="warning"
                                                    startIcon={isReImproving ? undefined : <AutoFixHighRoundedIcon sx={{ fontSize: 14 }} />}
                                                    disabled={isReImproving || !feedbackComment.trim()}
                                                    onClick={async () => {
                                                        setIsReImproving(true);
                                                        setImproveStep("generating");
                                                        setTestResult(null);
                                                        setFeedbackOpen(false);
                                                        try {
                                                            const result = await improveOcrPrompt(token, log.id, {
                                                                invoiceProviderId: improveResult!.invoiceProviderId,
                                                                invoiceProviderName: improveResult!.invoiceProviderName,
                                                                invoiceType: improveResult!.invoiceType,
                                                                previousPrompt: improveResult!.improvedPrompt,
                                                                feedbackComment: feedbackComment.trim(),
                                                            });
                                                            setImproveResult(result);
                                                            setFeedbackComment("");
                                                            setImproveDialogTab(0);
                                                            // auto-test the re-improved prompt
                                                            if (result.improvedPrompt) {
                                                                setImproveStep("testing");
                                                                try {
                                                                    const testRes = await testOcrPrompt(token, log.id, result.improvedPrompt);
                                                                    setTestResult(testRes);
                                                                } catch { /* non-fatal */ }
                                                            }
                                                        } catch (err: any) {
                                                            onNotify?.(err?.message ?? t("logs", "reImproveFailed"), "error");
                                                        } finally {
                                                            setIsReImproving(false);
                                                            setImproveStep(null);
                                                        }
                                                    }}
                                                    sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none", fontSize: 12 }}
                                                >
                                                    {isReImproving ? t("logs", "reImproving") : t("logs", "reImproveSubmit")}
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Collapse>
                                </Box>

                                {/* Tabs: Result / Improved Prompt */}
                                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${isDark ? "#30363d" : "#e0e0e0"}`, mb: 0 }}>
                                        <Tabs
                                            value={improveDialogTab}
                                            onChange={(_, v) => setImproveDialogTab(v)}
                                            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 0.5, textTransform: "none", fontWeight: 600, } }}
                                        >
                                            <Tab label={testResult ? (() => {
                                                const allF = Array.from(new Set([...Object.keys(testResult.oldFields), ...Object.keys(testResult.newFields)]));
                                                const changedCount = allF.filter(f => String(testResult.oldFields[f] ?? "") !== String(testResult.newFields[f] ?? "")).length;
                                                return `Result · ${changedCount} field${changedCount !== 1 ? "s" : ""} changed`;
                                            })() : "Result"} />
                                            <Tab label="Improved Prompt" />
                                        </Tabs>
                                        {/* Copy/Save buttons visible on Improved Prompt tab */}
                                        {improveDialogTab === 1 && (
                                            <Box sx={{ display: "flex", gap: 1, pr: 0.5, pb: 0.5 }}>
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
                                                {improveResult!.invoiceProviderId && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="success"
                                                        disabled={isSavingPrompt}
                                                        onClick={async () => {
                                                            setIsSavingPrompt(true);
                                                            try {
                                                                const field = improveResult!.invoiceType === "GAS" ? "promptGas" : "promptElectricity";
                                                                const res = await fetch(`/api/v1/internal/invoice-providers/${improveResult!.invoiceProviderId}`, {
                                                                    method: "PUT",
                                                                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ [field]: improveResult!.improvedPrompt }),
                                                                });
                                                                if (!res.ok) throw new Error("Failed to save prompt");
                                                                onNotify?.(`${improveResult!.invoiceType} prompt saved to ${improveResult!.invoiceProviderName}`, "success");
                                                            } catch (err: any) {
                                                                onNotify?.(err?.message ?? "Save failed", "error");
                                                            } finally {
                                                                setIsSavingPrompt(false);
                                                            }
                                                        }}
                                                        sx={{ borderRadius: 999, fontWeight: 700, textTransform: "none", fontSize: 12 }}
                                                    >
                                                        {isSavingPrompt ? "Saving…" : `Save to ${improveResult!.invoiceProviderName ?? "provider"}`}
                                                    </Button>
                                                )}
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Tab: Result (OCR comparison) */}
                                    {improveDialogTab === 0 && (
                                        <Box sx={{ pt: 2, overflowY: "auto", flex: 1 }}>
                                            {!testResult ? (
                                                <Box sx={{ p: 2.5, borderRadius: 2, background: alpha(theme.palette.info.main, isDark ? 0.1 : 0.07), border: `1px solid ${alpha(theme.palette.info.main, 0.22)}` }}>
                                                    <Typography sx={{color: "text.secondary" }}>{t("logs", "noTestResults")}</Typography>
                                                </Box>
                                            ) : (() => {
                                                const allFields = Array.from(new Set([
                                                    ...Object.keys(testResult.oldFields),
                                                    ...Object.keys(testResult.newFields),
                                                ])).sort();
                                                const changed = allFields.filter(f => String(testResult.oldFields[f] ?? "") !== String(testResult.newFields[f] ?? ""));
                                                return (
                                                    <Box>
                                                        <Box sx={{ borderRadius: 1.5, border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`, overflow: "hidden" }}>
                                                            <Box sx={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", background: isDark ? "#161b22" : "#f6f8fa", borderBottom: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}>
                                                                <Box sx={{ px: 1.5, py: 0.75 }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("logs", "field")}</Typography></Box>
                                                                <Box sx={{ px: 1.5, py: 0.75, borderLeft: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: theme.palette.error.main, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("logs", "oldPromptResult")}</Typography></Box>
                                                                <Box sx={{ px: 1.5, py: 0.75, borderLeft: `1px solid ${isDark ? "#30363d" : "#d0d7de"}` }}><Typography sx={{ fontSize: 10.5, fontWeight: 700, color: theme.palette.success.main, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("logs", "newPromptResult")}</Typography></Box>
                                                            </Box>
                                                            {changed.map((field, i) => {
                                                                const oldVal = testResult.oldFields[field];
                                                                const newVal = testResult.newFields[field];
                                                                const fmt = (v: unknown) => v === null || v === undefined || v === "" ? <em style={{ opacity: 0.4 }}>{t("logs", "emptyValue")}</em> : String(v);
                                                                return (
                                                                    <Box key={field} sx={{
                                                                        display: "grid",
                                                                        gridTemplateColumns: "200px 1fr 1fr",
                                                                        borderBottom: i < changed.length - 1 ? `1px solid ${isDark ? "#21262d" : "#eaecef"}` : "none",
                                                                        background: isDark ? "rgba(248,81,73,0.07)" : "rgba(248,81,73,0.04)",
                                                                    }}>
                                                                        <Box sx={{ px: 1.5, py: 0.85 }}>
                                                                            <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: theme.palette.info.main }}>{field}</Typography>
                                                                        </Box>
                                                                        <Box sx={{ px: 1.5, py: 0.85, borderLeft: `1px solid ${isDark ? "#21262d" : "#eaecef"}` }}>
                                                                            <Typography sx={{ fontSize: 12, color: theme.palette.error.main }}>{fmt(oldVal)}</Typography>
                                                                        </Box>
                                                                        <Box sx={{ px: 1.5, py: 0.85, borderLeft: `1px solid ${isDark ? "#21262d" : "#eaecef"}` }}>
                                                                            <Typography sx={{ fontSize: 12, color: theme.palette.success.main }}>{fmt(newVal)}</Typography>
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

                                    {/* Tab: Improved Prompt */}
                                    {improveDialogTab === 1 && (
                                        <Box sx={{ pt: 2, overflowY: "auto", flex: 1 }}>
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
                                                maxHeight: "55vh",
                                                color: isDark ? "#e6edf3" : "#24292f",
                                            }}>
                                                {improveResult!.improvedPrompt}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
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
    const cachePolicy = useRequestCachePolicy("logs");
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { locale, t } = useI18n();
    const { preferences } = useUserPreferences();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selectedLog, setSelectedLog] = useState<OcrLogEntry | null>(null);

    // Applied filters
    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterUserSearch, setFilterUserSearch] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterIssueStatus, setFilterIssueStatus] = useState("");

    // Local (pending) filter state
    const [localType, setLocalType] = useState("");
    const [localStatus, setLocalStatus] = useState("");
    const [localUserSearch, setLocalUserSearch] = useState("");
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(null);
    const [localDateTo, setLocalDateTo] = useState<Date | null>(null);
    const [localIssueStatus, setLocalIssueStatus] = useState("");

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
        setFilterType(localType);
        setFilterStatus(localStatus);
        setFilterUserSearch(localUserSearch);
        setFilterDateFrom(toDateOnly(localDateFrom));
        setFilterDateTo(toDateOnly(localDateTo));
        setFilterIssueStatus(localIssueStatus);
        setPage(1);
    };

    const handleClear = () => {
        setLocalType(""); setLocalStatus(""); setLocalUserSearch(""); setLocalDateFrom(null); setLocalDateTo(null); setLocalIssueStatus("");
        setFilterType(""); setFilterStatus(""); setFilterUserSearch(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterIssueStatus("");
        setPage(1);
    };

    const { data, isFetching, error } = useQuery({
        queryKey: ["ocr-logs", session.token, page, pageSize, filterType, filterStatus, filterUserSearch, filterDateFrom, filterDateTo, filterIssueStatus],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (filterType) params.append("type", filterType);
            if (filterStatus) params.append("status", filterStatus);
            if (filterUserSearch) params.append("userSearch", filterUserSearch);
            if (filterDateFrom) params.append("dateFrom", filterDateFrom);
            if (filterDateTo) params.append("dateTo", filterDateTo);
            if (filterIssueStatus) params.append("issueStatus", filterIssueStatus);

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
        ...cachePolicy,
    });

    const issueMutation = useMutation({
        mutationFn: async ({ log, input }: { log: OcrLogEntry; input: OcrIssueUpdateInput }) => {
            const response = await fetch(`/api/v1/internal/ocr-logs/${log.id}/issue`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${session.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(input),
            });
            const json = await response.json().catch(() => null);
            if (!response.ok || !json?.success) {
                throw new Error(json?.error?.message ?? "Failed to update OCR issue");
            }
            return { log, data: json.data as Partial<OcrLogEntry> };
        },
        onSuccess: ({ log, data }) => {
            const updatedLog = {
                ...log,
                ...data,
                issueStatus: data.issueStatus ?? log.issueStatus,
                issueResolution: data.issueResolution ?? null,
                issueNotes: data.issueNotes ?? null,
                issueSubmittedAt: data.issueSubmittedAt ?? log.issueSubmittedAt,
                issueHandledAt: data.issueHandledAt ?? null,
                issueHandledByUserId: data.issueHandledByUserId ?? null,
            } as OcrLogEntry;
            setSelectedLog((current) => current?.id === log.id ? updatedLog : current);
            queryClient.invalidateQueries({ queryKey: ["ocr-logs"] });
            onNotify?.(`Issue marked ${getIssueLabel(updatedLog.issueStatus ?? null, t).toLowerCase()}`, "success");
        },
        onError: (err) => {
            onNotify?.(err instanceof Error ? err.message : "Failed to update OCR issue", "error");
        },
    });

    const handleIssueUpdate = async (log: OcrLogEntry, input: OcrIssueUpdateInput) => {
        await issueMutation.mutateAsync({ log, input });
    };

    useEffect(() => {
        if (error) onNotify?.(t("logs", "loadOcrLogsFailed"), "error");
    }, [error, onNotify, t]);

    const logs = data?.items ?? [];
    const total = data?.total ?? 0;

    const columns: ColumnDef<OcrLogEntry>[] = [
        {
            key: "requestedAt",
            label: t("logs", "timestamp"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDate(log.requestedAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.requestedAt), { addSuffix: true, locale: locale === "es" ? es : undefined })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "type",
            label: t("logs", "type"),
            renderCell: (log) => (
                <Chip
                    label={formatLogType(log.type, t)}
                    size="small"
                    sx={{
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
            label: t("logs", "status"),
            renderCell: (log) => <StatusChip status={log.status} />,
        },
        {
            key: "user",
            label: t("logs", "user"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {log.userName ?? log.userEmail ?? t("logs", "unknown")}
                    </Typography>
                    {log.userName && log.userEmail && (
                        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2 }}>
                            {log.userEmail}
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            key: "provider",
            label: t("logs", "providerModel"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {formatProvider(log.provider)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", lineHeight: 1.2 }}>
                        {log.model}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "file",
            label: t("logs", "file"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                    <Tooltip title={log.fileName ?? ""}>
                        <Typography variant="body2" sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                            {log.fileName ?? "—"}
                        </Typography>
                    </Tooltip>
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2 }}>
                        {[
                            log.fileType?.replace("application/", "").replace("image/", ""),
                            formatFileSize(log.fileSizeBytes),
                            log.files && log.files.length > 1 ? t("logs", "fileCount", { count: log.files.length }) : null,
                            log.pageCount ? `${log.pageCount}p` : null,
                        ].filter(Boolean).join(" · ")}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "storedFiles",
            label: t("logs", "storedFiles"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, maxWidth: 180 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {log.files?.length ?? 0}
                    </Typography>
                    <Tooltip title={log.files?.map((file) => `${file.fileName} (${formatFileSize(file.fileSizeBytes)})`).join(" · ") ?? t("logs", "noFilesStored")}>
                        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getStoredFilesSummary(log, t)}
                        </Typography>
                    </Tooltip>
                </Box>
            ),
        },
        {
            key: "simulation",
            label: t("logs", "simulation"),
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, maxWidth: 130 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {log.simulationReferenceNumber ?? "—"}
                    </Typography>
                    {log.simulationId && (
                        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {log.simulationId}
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            key: "duration",
            label: t("logs", "duration"),
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
                    {log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)}s` : "—"}
                </Typography>
            ),
        },
        {
            key: "tokens",
            label: t("logs", "tokens"),
            renderCell: (log) => {
                if (!log.totalTokens && !log.promptTokens && !log.completionTokens) {
                    return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
                }
                return (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "monospace", lineHeight: 1.3 }}>
                            {log.totalTokens != null ? log.totalTokens.toLocaleString() : "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", lineHeight: 1.2 }}>
                            {log.promptTokens ?? 0}↑&nbsp;/&nbsp;{log.completionTokens ?? 0}↓
                        </Typography>
                    </Box>
                );
            },
        },
        {
            key: "fieldsExtracted",
            label: t("logs", "fields"),
            renderCell: (log) => {
                if (log.status !== "SUCCESS") {
                    return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
                }
                return (
                    <Chip
                        label={log.fieldsExtracted != null ? `${log.fieldsExtracted}` : "—"}
                        size="small"
                        sx={{
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
            key: "issue",
            label: t("logs", "issue"),
            renderCell: (log) => {
                const status = getIssueStatus(log);
                const correctionCount = Object.keys(getVisibleCorrections(log)).length;
                if (!status) {
                    return <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>;
                }
                return (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.45, minWidth: 150, maxWidth: 190 }}>
                        <IssueChip log={log} />
                        <Box sx={{ display: "flex", gap: 0.45, flexWrap: "wrap" }}>
                            {log.reportedIssue && (
                                <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 700 }}>
                                    {t("logs", "reported")}
                                </Typography>
                            )}
                            {correctionCount > 0 && (
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                                    {correctionCount} {t("logs", correctionCount === 1 ? "correction" : "corrections")}
                                </Typography>
                            )}
                            {!log.reportedIssue && correctionCount === 0 && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    {t("logs", "manual")}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                );
            },
        },
        {
            key: "view",
            label: "",
            renderCell: (log) => (
                <Tooltip title={t("logs", "viewFullResponse")}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <div >

            <DataTable
                columns={columns}
                rows={logs}
                loading={isFetching}
                onApplyFilters={handleSearch}
                onClearFilters={handleClear}
                renderCustomSearch={() => (
                    <Box sx={{ display: "flex", gap: 1, flex: "0 1 auto", minWidth: 0 }}>
                        <Box sx={{ width: 180, flex: "0 0 auto" }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allTypes") },
                                    { value: "INVOICE_EXTRACTION", label: t("logs", "invoiceExtraction") },
                                    { value: "PROVIDER_DETECTION", label: t("logs", "providerDetection") },
                                    { value: "PROMPT_IMPROVEMENT", label: t("logs", "promptImprovement") },
                                    { value: "PROMPT_TEST", label: t("logs", "promptTest") },
                                    { value: "TEMPLATE_BUILDER", label: t("logs", "templateBuilder") },
                                ]}
                                value={localType}
                                onChange={(v) => setLocalType(String(v ?? ""))}
                                placeholder={t("logs", "type")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ width: 180, flex: "0 0 auto" }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allStatuses") },
                                    { value: "SUCCESS", label: t("logs", "success") },
                                    { value: "FAILED", label: t("logs", "failed") },
                                    { value: "ERROR", label: t("logs", "error") },
                                    { value: "PARSE_ERROR", label: t("logs", "parseError") },
                                ]}
                                value={localStatus}
                                onChange={(v) => setLocalStatus(String(v ?? ""))}
                                placeholder={t("logs", "status")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ width: 180, flex: "0 0 auto" }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "", label: t("logs", "allIssues") },
                                    { value: "ANY", label: t("logs", "hasIssue") },
                                    { value: "OPEN", label: t("logs", "open") },
                                    { value: "IN_PROGRESS", label: t("logs", "inProgress") },
                                    { value: "RESOLVED", label: t("logs", "resolved") },
                                    { value: "DISMISSED", label: t("logs", "dismissed") },
                                ]}
                                value={localIssueStatus}
                                onChange={(v) => setLocalIssueStatus(String(v ?? ""))}
                                placeholder={t("logs", "issue")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ width: 260, flex: "0 0 auto" }}>
                            <FormInput
                                label=""
                                size="small"
                                fullWidth
                                placeholder={t("logs", "searchUser")}
                                value={localUserSearch}
                                onChange={(e) => setLocalUserSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                sx={{ "& .MuiInputBase-root": { } }}
                            />
                        </Box>
                        <Box sx={{ width: 360, flex: "0 0 auto" }}>
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
                emptyMessage={t("logs", "noOcrLogs")}
            />

            {selectedLog && (
                <OcrLogDetailDialog
                    log={selectedLog}
                    token={session.token}
                    onNotify={onNotify}
                    onIssueUpdate={handleIssueUpdate}
                    onClose={() => setSelectedLog(null)}
                />
            )}
        </div>
    );
}
