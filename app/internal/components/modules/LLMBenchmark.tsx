"use client";

import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    IconButton,
    LinearProgress,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";
import { useUserPreferences, type UserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDateTime } from "../../lib/formatPreferences";

export interface LLMBenchmarkProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
    onHistoryChanged?: () => void;
    providers: Array<{
        id: string;
        name: string;
        enabled: boolean;
        provider: string;
        modelName: string;
    }>;
}

interface BenchmarkStepResult {
    success: boolean;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    result?: Record<string, any>;
    rawText?: string;
    error?: string;
    score: number;
    fieldScores: Record<string, boolean>;
    correctFields: number;
    totalFields: number;
}

interface BenchmarkResult {
    id?: string;
    benchmarkRunId?: string;
    createdAt?: string;
    status?: string;
    providerConfigId: string;
    providerName: string;
    provider: string;
    modelName: string;
    benchmarkFileName?: string;
    detection: BenchmarkStepResult;
    extraction: BenchmarkStepResult;
    overallScore: number;
    totalDurationMs: number;
    totalTokens?: number;
    expectedDetection: Record<string, any>;
    expectedExtraction: Record<string, any>;
    createdBy?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

interface BenchmarkRunGroup {
    id: string;
    createdAt: string;
    createdBy?: {
        id: string;
        name: string;
        email: string;
    } | null;
    benchmarkFileName?: string;
    resultCount: number;
    results: BenchmarkResult[];
}

function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("axpo.internal.auth.token");
}

function authHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? "success" : score >= 50 ? "warning" : "error";
    return (
        <Chip
            label={`${score}%`}
            color={color}
            size="small"
            sx={{ fontWeight: 700, minWidth: 52 }}
        />
    );
}

function DurationCell({ ms }: { ms: number }) {
    const s = (ms / 1000).toFixed(1);
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{s}s</span>;
}

function TokenCell({ total }: { total?: number }) {
    if (!total) return <span style={{ color: "var(--axpo-text-secondary)" }}>—</span>;
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString()}</span>;
}

function getResultTokens(result: BenchmarkResult): number | undefined {
    const stepTokens = (
        (result.detection.totalTokens ?? 0) + (result.extraction.totalTokens ?? 0)
    ) || undefined;
    return result.totalTokens ?? stepTokens;
}

function getBestRunResult(run: BenchmarkRunGroup): BenchmarkResult | null {
    if (!run.results.length) return null;
    return [...run.results].sort((a, b) => {
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        return a.totalDurationMs - b.totalDurationMs;
    })[0];
}

function formatDateTime(value: string | null | undefined, preferences: UserPreferences) {
    return formatDisplayDateTime(value, preferences);
}

interface FieldCompareTableProps {
    fieldScores: Record<string, boolean>;
    expected: Record<string, any>;
    actual?: Record<string, any>;
}

function FieldCompareTable({ fieldScores, expected, actual }: FieldCompareTableProps) {
    const { t } = useI18n();
    const fields = Object.entries(fieldScores);
    if (!fields.length) return null;
    return (
        <Box sx={{ overflowX: "auto", mt: 1 }}>
            <Table size="small" sx={{ fontSize: 12 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>{t("llmBenchmark", "field")}</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>{t("llmBenchmark", "expected")}</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>{t("llmBenchmark", "got")}</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11, width: 50 }}>✓</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {fields.map(([field, ok]) => {
                        const expectedVal = field.startsWith("clienteAddress.")
                            ? (expected?.clienteAddress as any)?.[field.replace("clienteAddress.", "")]
                            : expected?.[field];
                        const actualVal = field.startsWith("clienteAddress.")
                            ? (actual?.clienteAddress as any)?.[field.replace("clienteAddress.", "")]
                            : actual?.[field];
                        return (
                            <TableRow key={field} hover sx={{ "&:hover td": { backgroundColor: "var(--scheme-neutral-1100)" } }}>
                                <TableCell sx={{ py: 0.5, fontSize: 11, fontFamily: "monospace" }}>{field}</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {expectedVal === null || expectedVal === undefined ? <em style={{ color: "var(--axpo-text-secondary)" }}>null</em> : String(expectedVal)}
                                </TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ok ? "inherit" : "error.main" }}>
                                    {actualVal === null || actualVal === undefined ? <em style={{ color: "var(--axpo-text-secondary)" }}>null</em> : String(actualVal)}
                                </TableCell>
                                <TableCell sx={{ py: 0.5 }}>
                                    {ok
                                        ? <CheckCircleIcon sx={{ fontSize: 14, color: "success.main" }} />
                                        : <CancelIcon sx={{ fontSize: 14, color: "error.main" }} />}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Box>
    );
}

function ResultRow({ result, idx }: { result: BenchmarkResult; idx: number }) {
    const { t } = useI18n();
    const [expanded, setExpanded] = useState(false);

    const totalTokens =
        (result.detection.totalTokens ?? 0) + (result.extraction.totalTokens ?? 0);

    return (
        <>
            <TableRow
                hover
                sx={{ cursor: "pointer", "&:hover": { backgroundColor: "var(--scheme-neutral-1100)" } }}
                onClick={() => setExpanded((v) => !v)}
            >
                <TableCell sx={{ fontWeight: 600, width: 32 }}>
                    <IconButton size="small" tabIndex={-1}>
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Box sx={{ fontWeight: 600 }}>{result.providerName}</Box>
                    <Box sx={{ fontSize: 11, color: "var(--axpo-text-secondary)" }}>
                        {result.provider} / {result.modelName}
                    </Box>
                </TableCell>
                {/* Detection */}
                <TableCell align="center">
                    {result.detection.success
                        ? <ScoreBadge score={result.detection.score} />
                        : <Chip label={t("llmBenchmark", "error")} color="error" size="small" />}
                </TableCell>
                <TableCell align="right">
                    <DurationCell ms={result.detection.durationMs} />
                </TableCell>
                <TableCell align="right">
                    <TokenCell total={result.detection.totalTokens} />
                </TableCell>
                {/* Extraction */}
                <TableCell align="center">
                    {result.extraction.success
                        ? <ScoreBadge score={result.extraction.score} />
                        : <Chip label={t("llmBenchmark", "error")} color="error" size="small" />}
                </TableCell>
                <TableCell align="right">
                    <DurationCell ms={result.extraction.durationMs} />
                </TableCell>
                <TableCell align="right">
                    <TokenCell total={result.extraction.totalTokens} />
                </TableCell>
                {/* Overall */}
                <TableCell align="center">
                    <ScoreBadge score={result.overallScore} />
                </TableCell>
                <TableCell align="right">
                    <DurationCell ms={result.totalDurationMs} />
                </TableCell>
                <TableCell align="right">
                    <TokenCell total={totalTokens || undefined} />
                </TableCell>
            </TableRow>
            {/* Expanded detail row */}
            <TableRow>
                <TableCell colSpan={11} sx={{ p: 0, border: expanded ? undefined : "none" }}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: "var(--scheme-neutral-1100)", borderTop: "1px solid var(--scheme-neutral-900)" }}>
                            <Stack spacing={3}>
                                {/* Detection detail */}
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        {t("llmBenchmark", "providerDetection")} — {result.detection.success ? t("llmBenchmark", "fieldsCorrect", { correct: result.detection.correctFields, total: result.detection.totalFields }) : t("llmBenchmark", "failed")}
                                    </Typography>
                                    {result.detection.error && (
                                        <Alert severity="error" sx={{ mb: 1, fontSize: 12 }}>{result.detection.error}</Alert>
                                    )}
                                    {result.detection.success && (
                                        <FieldCompareTable
                                            fieldScores={result.detection.fieldScores}
                                            expected={result.expectedDetection}
                                            actual={result.detection.result}
                                        />
                                    )}
                                </Box>

                                {/* Extraction detail */}
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        {t("llmBenchmark", "invoiceExtraction")} — {result.extraction.success ? t("llmBenchmark", "fieldsCorrect", { correct: result.extraction.correctFields, total: result.extraction.totalFields }) : t("llmBenchmark", "failed")}
                                    </Typography>
                                    {result.extraction.error && (
                                        <Alert severity="error" sx={{ mb: 1, fontSize: 12 }}>{result.extraction.error}</Alert>
                                    )}
                                    {result.extraction.success && (
                                        <FieldCompareTable
                                            fieldScores={result.extraction.fieldScores}
                                            expected={result.expectedExtraction}
                                            actual={result.extraction.result}
                                        />
                                    )}
                                </Box>
                            </Stack>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

function ResultsTable({
    title,
    results,
    footer,
}: {
    title: string;
    results: BenchmarkResult[];
    footer?: string;
}) {
    const { t } = useI18n();
    if (results.length === 0) return null;

    return (
        <Box>
            {title && (
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {title}
                </Typography>
            )}
            <Box sx={{ overflowX: "auto", border: "1px solid var(--scheme-neutral-900)", borderRadius: "8px" }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: "var(--scheme-neutral-1200)" }}>
                            <TableCell sx={{ width: 32 }} />
                            <TableCell sx={{ fontWeight: 700 }}>LLM</TableCell>
                            <TableCell
                                colSpan={3}
                                align="center"
                                sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                            >
                                {t("llmBenchmark", "providerDetection")}
                            </TableCell>
                            <TableCell
                                colSpan={3}
                                align="center"
                                sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                            >
                                {t("llmBenchmark", "invoiceExtraction")}
                            </TableCell>
                            <TableCell
                                colSpan={3}
                                align="center"
                                sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                            >
                                {t("llmBenchmark", "overall")}
                            </TableCell>
                        </TableRow>
                        <TableRow sx={{ backgroundColor: "var(--scheme-neutral-1200)" }}>
                            <TableCell />
                            <TableCell />
                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>{t("llmBenchmark", "score")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "time")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "tokens")}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>{t("llmBenchmark", "score")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "time")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "tokens")}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>{t("llmBenchmark", "score")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "time")}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>{t("llmBenchmark", "tokens")}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {results
                            .map((r, originalIdx) => ({ r, originalIdx }))
                            .sort((a, b) => b.r.overallScore - a.r.overallScore)
                            .map(({ r, originalIdx }) => (
                                <ResultRow key={r.id ?? `${r.providerConfigId}-${originalIdx}`} result={r} idx={originalIdx} />
                            ))}
                    </TableBody>
                </Table>
            </Box>
            {footer && (
                <Box sx={{ mt: 1, fontSize: 12, color: "var(--axpo-text-secondary)" }}>
                    {footer}
                </Box>
            )}
        </Box>
    );
}

function BenchmarkHistoryRow({ run }: { run: BenchmarkRunGroup }) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const [expanded, setExpanded] = useState(false);
    const bestResult = getBestRunResult(run);

    return (
        <>
            <TableRow
                hover
                sx={{ cursor: "pointer", "&:hover": { backgroundColor: "var(--scheme-neutral-1100)" } }}
                onClick={() => setExpanded((v) => !v)}
            >
                <TableCell sx={{ width: 32 }}>
                    <IconButton size="small" tabIndex={-1} aria-label={expanded ? t("llmBenchmark", "closeDetails") : t("llmBenchmark", "openDetails")}>
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{formatDateTime(run.createdAt, preferences)}</TableCell>
                <TableCell>
                    {bestResult ? (
                        <>
                            <Box sx={{ fontWeight: 600 }}>{bestResult.providerName}</Box>
                            <Box sx={{ fontSize: 11, color: "var(--axpo-text-secondary)" }}>
                                {bestResult.provider} / {bestResult.modelName}
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ color: "var(--axpo-text-secondary)" }}>—</Box>
                    )}
                </TableCell>
                <TableCell align="center">
                    {bestResult ? <ScoreBadge score={bestResult.overallScore} /> : "—"}
                </TableCell>
                <TableCell align="right">
                    {bestResult ? <DurationCell ms={bestResult.totalDurationMs} /> : "—"}
                </TableCell>
                <TableCell align="right">
                    {bestResult ? <TokenCell total={getResultTokens(bestResult)} /> : "—"}
                </TableCell>
                <TableCell align="right" sx={{ color: "var(--axpo-text-secondary)", fontSize: 12 }}>
                    {t("llmBenchmark", "runCount", { count: run.resultCount, plural: run.resultCount === 1 ? "" : "s" })}
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={7} sx={{ p: 0, border: expanded ? undefined : "none" }}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: "var(--scheme-neutral-1100)", borderTop: "1px solid var(--scheme-neutral-900)" }}>
                            <ResultsTable title="" results={run.results} />
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

function BenchmarkHistoryTable({ runs }: { runs: BenchmarkRunGroup[] }) {
    const { t } = useI18n();

    return (
        <Box sx={{ overflowX: "auto", border: "1px solid var(--scheme-neutral-900)", borderRadius: "8px" }}>
            <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                    <TableRow sx={{ backgroundColor: "var(--scheme-neutral-1200)" }}>
                        <TableCell sx={{ width: 32 }} />
                        <TableCell sx={{ fontWeight: 700 }}>{t("llmBenchmark", "date")}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{t("llmBenchmark", "bestLlm")}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{t("llmBenchmark", "overall")}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("llmBenchmark", "time")}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("llmBenchmark", "tokens")}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("llmBenchmark", "tested")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {runs.map((run) => (
                        <BenchmarkHistoryRow key={run.id} run={run} />
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

export function LLMBenchmark({ session, onNotify, onHistoryChanged, providers }: LLMBenchmarkProps) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const activeProviders = providers.filter((p) => p.enabled);
    const allIds = activeProviders.map((p) => p.id);
    const [selected, setSelected] = useState<Set<string>>(new Set(allIds));
    const [running, setRunning] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [currentlyTesting, setCurrentlyTesting] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BenchmarkResult[]>([]);
    const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRunGroup[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [historyWarning, setHistoryWarning] = useState<string | null>(null);

    useEffect(() => {
        setSelected((prev) => {
            const activeIds = new Set(allIds);
            const next = new Set(Array.from(prev).filter((id) => activeIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [allIds.join("|")]);

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch("/api/v1/internal/invoices/benchmark?limit=50", {
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || t("llmBenchmark", "loadHistoryError"));
            }
            setBenchmarkRuns(data.benchmarkRuns ?? []);
            setHistoryWarning(
                data.historyAvailable === false
                    ? t("llmBenchmark", "historyNotReady")
                    : null,
            );
        } catch (err: any) {
            onNotify(err.message || t("llmBenchmark", "loadHistoryError"), "error");
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const toggleProvider = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === activeProviders.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allIds));
        }
    };

    const runBenchmark = async () => {
        const toTest = activeProviders.filter((p) => selected.has(p.id));
        if (!toTest.length) return;

        setRunning(true);
        setResults([]);
        setErrors({});
        setHistoryWarning(null);
        setProgress(0);
        const benchmarkRunId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `benchmark-${Date.now()}`;

        // Fetch the benchmark PDF from the public folder once
        let pdfBlob: Blob | null = null;
        try {
            const pdfRes = await fetch("/benchmark/serigrafia-arrigorriaga.pdf");
            if (!pdfRes.ok) throw new Error(t("llmBenchmark", "couldNotLoadPdf", { status: pdfRes.status }));
            pdfBlob = await pdfRes.blob();
        } catch (err: any) {
            onNotify(t("llmBenchmark", "loadPdfError", { message: err.message }), "error");
            setRunning(false);
            return;
        }

        for (let i = 0; i < toTest.length; i++) {
            const p = toTest[i];
            setCurrentlyTesting(p.id);
            setProgress(Math.round((i / toTest.length) * 100));

            try {
                const fd = new FormData();
                fd.append("providerConfigId", p.id);
                fd.append("benchmarkRunId", benchmarkRunId);
                fd.append("file", pdfBlob, "serigrafia-arrigorriaga.pdf");

                const token = getAuthToken();
                const res = await fetch("/api/v1/internal/invoices/benchmark", {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: fd,
                });
                const data = await res.json();
                if (data.success) {
                    setResults((prev) => [...prev, data as BenchmarkResult]);
                    if (data.historySaved === false) {
                        setHistoryWarning(data.historyMessage || t("llmBenchmark", "resultNotSaved"));
                    }
                } else {
                    setErrors((prev) => ({ ...prev, [p.id]: data.message || t("llmBenchmark", "unknownError") }));
                }
            } catch (err: any) {
                setErrors((prev) => ({ ...prev, [p.id]: err.message || t("llmBenchmark", "requestFailed") }));
            }
        }

        setProgress(100);
        setCurrentlyTesting(null);
        setRunning(false);
        await loadHistory();
        onHistoryChanged?.();
        onNotify(t("llmBenchmark", "complete"), "success");
    };

    const selectedCount = selected.size;
    const allSelected = selectedCount === activeProviders.length;
    const someSelected = selectedCount > 0 && !allSelected;
    const latestSavedRun = benchmarkRuns[0];
    const displayedRun: BenchmarkRunGroup | null = results.length
        ? {
            id: results[0]?.benchmarkRunId ?? "current",
            createdAt: new Date().toISOString(),
            createdBy: null,
            benchmarkFileName: "serigrafia-arrigorriaga.pdf",
            resultCount: results.length,
            results,
        }
        : latestSavedRun ?? null;
    const historyRuns = results.length
        ? benchmarkRuns
        : benchmarkRuns.filter((run) => run.id !== latestSavedRun?.id);

    return (
        <Stack spacing={3}>
            {/* Header + description */}
            <Box>
                <h3 className="settings-panel-title">{t("llmBenchmark", "title")}</h3>
                <p style={{ margin: 0, color: "var(--axpo-text-secondary)" }}>
                    {t("llmBenchmark", "description", { file: "Serigrafia arrigorriaga.pdf" })}
                </p>
            </Box>

            {/* Provider selection */}
            {activeProviders.length === 0 ? (
                <Box sx={{ color: "var(--axpo-text-secondary)", py: 2, textAlign: "center" }}>
                    {t("llmBenchmark", "noActiveProviders", { tab: t("llmBenchmark", "availableLlms") })}
                </Box>
            ) : (
                <Box
                    sx={{
                        border: "1px solid var(--scheme-neutral-900)",
                        borderRadius: "8px",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            px: 2,
                            py: 1.5,
                            borderBottom: "1px solid var(--scheme-neutral-900)",
                            backgroundColor: "var(--scheme-neutral-1200)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                        }}
                    >
                        <label className="config-field-inline" style={{ margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                onChange={toggleAll}
                                disabled={running}
                            />
                            <span style={{ fontWeight: 700, }}>
                                {t("llmBenchmark", "selectLlms", { selected: selectedCount, total: activeProviders.length })}
                            </span>
                        </label>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
                            onClick={runBenchmark}
                            disabled={running || selectedCount === 0}
                        >
                            {running ? t("llmBenchmark", "running") : t("llmBenchmark", "runBenchmark")}
                        </Button>
                    </Box>

                    {/* LLM list */}
                    <Stack divider={<Box sx={{ borderBottom: "1px solid var(--scheme-neutral-900)" }} />}>
                        {activeProviders.map((p) => {
                            const isCurrent = currentlyTesting === p.id;
                            const isDone = results.some((r) => r.providerConfigId === p.id);
                            const hasError = Boolean(errors[p.id]);
                            return (
                                <Box
                                    key={p.id}
                                    sx={{
                                        px: 2,
                                        py: 1.2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 2,
                                        backgroundColor: isCurrent ? "var(--scheme-brand-1100)" : "transparent",
                                        transition: "background-color 0.2s",
                                    }}
                                >
                                    <label className="config-field-inline" style={{ margin: 0, flex: 1 }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(p.id)}
                                            onChange={() => toggleProvider(p.id)}
                                            disabled={running}
                                        />
                                        <Box component="span">
                                            <Box component="span" sx={{ fontWeight: 600 }}>{p.name}</Box>
                                            <Box component="span" sx={{ ml: 1, fontSize: 11, color: "var(--axpo-text-secondary)" }}>
                                                {p.provider} / {p.modelName}
                                            </Box>
                                        </Box>
                                    </label>
                                    {isCurrent && (
                                        <Stack direction="row" alignItems="center" gap={1} sx={{ fontSize: 12, color: "var(--scheme-brand-600)" }}>
                                            <CircularProgress size={12} color="inherit" />
                                            <span>{t("llmBenchmark", "testing")}</span>
                                        </Stack>
                                    )}
                                    {isDone && !isCurrent && (
                                        <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                                    )}
                                    {hasError && !isCurrent && (
                                        <Tooltip title={errors[p.id]}>
                                            <CancelIcon sx={{ fontSize: 16, color: "error.main" }} />
                                        </Tooltip>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                </Box>
            )}

            {/* Progress bar */}
            {running && (
                <Box>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 6, borderRadius: 3, backgroundColor: "var(--scheme-neutral-900)" }}
                    />
                    <Box sx={{ mt: 0.5, fontSize: 12, color: "var(--axpo-text-secondary)" }}>
                        {currentlyTesting
                            ? t("llmBenchmark", "testingProvider", { provider: providers.find((p) => p.id === currentlyTesting)?.name ?? currentlyTesting })
                            : t("llmBenchmark", "preparing")}
                    </Box>
                </Box>
            )}

            {historyWarning && (
                <Alert severity="warning">
                    {historyWarning}
                </Alert>
            )}

            {/* Error summary */}
            {Object.keys(errors).length > 0 && (
                <Stack spacing={1}>
                    {Object.entries(errors).map(([id, msg]) => {
                        const p = providers.find((pr) => pr.id === id);
                        return (
                            <Alert key={id} severity="error">
                                <strong>{p?.name ?? id}:</strong> {msg}
                            </Alert>
                        );
                    })}
                </Stack>
            )}

            <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {results.length ? t("llmBenchmark", "currentResults") : t("llmBenchmark", "previousResults")}
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={historyLoading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
                        onClick={loadHistory}
                        disabled={historyLoading || running}
                    >
                        {t("common", "refresh")}
                    </Button>
                </Box>
                {displayedRun ? (
                    <Stack spacing={1.5}>
                        <Box sx={{ fontSize: 12, color: "var(--axpo-text-secondary)" }}>
                            {results.length
                                ? t("llmBenchmark", "llmsTestedCurrent", { count: displayedRun.resultCount, plural: displayedRun.resultCount === 1 ? "" : "s" })
                                : t("llmBenchmark", "llmsTested", { date: formatDateTime(displayedRun.createdAt, preferences), count: displayedRun.resultCount, plural: displayedRun.resultCount === 1 ? "" : "s" })}
                        </Box>
                        <ResultsTable
                            title=""
                            results={displayedRun.results}
                            footer={t("llmBenchmark", "sortedFooter")}
                        />
                    </Stack>
                ) : (
                    <Box sx={{ color: "var(--axpo-text-secondary)", py: 2 }}>
                        {t("llmBenchmark", "noRuns")}
                    </Box>
                )}
            </Box>

            <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {t("llmBenchmark", "history")}
                </Typography>
                {historyRuns.length > 0 ? (
                    <BenchmarkHistoryTable runs={historyRuns} />
                ) : (
                    <Box sx={{ color: "var(--axpo-text-secondary)", py: 2 }}>
                        {t("llmBenchmark", "noOlderRuns")}
                    </Box>
                )}
            </Box>
        </Stack>
    );
}
