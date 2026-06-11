"use client";

import { useState } from "react";
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
import type { SessionState } from "../../lib/authSession";

export interface LLMBenchmarkProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
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
    providerConfigId: string;
    providerName: string;
    provider: string;
    modelName: string;
    detection: BenchmarkStepResult;
    extraction: BenchmarkStepResult;
    overallScore: number;
    totalDurationMs: number;
    expectedDetection: Record<string, any>;
    expectedExtraction: Record<string, any>;
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

interface FieldCompareTableProps {
    fieldScores: Record<string, boolean>;
    expected: Record<string, any>;
    actual?: Record<string, any>;
}

function FieldCompareTable({ fieldScores, expected, actual }: FieldCompareTableProps) {
    const fields = Object.entries(fieldScores);
    if (!fields.length) return null;
    return (
        <Box sx={{ overflowX: "auto", mt: 1 }}>
            <Table size="small" sx={{ fontSize: 12 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>Field</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>Expected</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: 11 }}>Got</TableCell>
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
                        : <Chip label="Error" color="error" size="small" />}
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
                        : <Chip label="Error" color="error" size="small" />}
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
                                        Provider Detection — {result.detection.success ? `${result.detection.correctFields}/${result.detection.totalFields} fields correct` : "Failed"}
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
                                        Invoice Extraction — {result.extraction.success ? `${result.extraction.correctFields}/${result.extraction.totalFields} fields correct` : "Failed"}
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

export function LLMBenchmark({ session, onNotify, providers }: LLMBenchmarkProps) {
    const allIds = providers.map((p) => p.id);
    const [selected, setSelected] = useState<Set<string>>(new Set(allIds));
    const [running, setRunning] = useState(false);
    const [currentlyTesting, setCurrentlyTesting] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BenchmarkResult[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const toggleProvider = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === providers.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allIds));
        }
    };

    const runBenchmark = async () => {
        const toTest = providers.filter((p) => selected.has(p.id));
        if (!toTest.length) return;

        setRunning(true);
        setResults([]);
        setErrors({});
        setProgress(0);

        for (let i = 0; i < toTest.length; i++) {
            const p = toTest[i];
            setCurrentlyTesting(p.id);
            setProgress(Math.round((i / toTest.length) * 100));

            try {
                const res = await fetch("/api/v1/internal/invoices/benchmark", {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({ providerConfigId: p.id }),
                });
                const data = await res.json();
                if (data.success) {
                    setResults((prev) => [...prev, data as BenchmarkResult]);
                } else {
                    setErrors((prev) => ({ ...prev, [p.id]: data.message || "Unknown error" }));
                }
            } catch (err: any) {
                setErrors((prev) => ({ ...prev, [p.id]: err.message || "Request failed" }));
            }
        }

        setProgress(100);
        setCurrentlyTesting(null);
        setRunning(false);
        onNotify("Benchmark complete", "success");
    };

    const selectedCount = selected.size;
    const allSelected = selectedCount === providers.length;
    const someSelected = selectedCount > 0 && !allSelected;

    if (providers.length === 0) {
        return (
            <Box sx={{ color: "var(--axpo-text-secondary)", py: 4, textAlign: "center" }}>
                No LLM providers configured. Add providers in the <strong>Available LLMs</strong> tab first.
            </Box>
        );
    }

    return (
        <Stack spacing={3}>
            {/* Header + description */}
            <Box>
                <h3 className="settings-panel-title">LLM Benchmark</h3>
                <p style={{ margin: 0, color: "var(--axpo-text-secondary)" }}>
                    Test each LLM against a known invoice (<strong>Serigrafia arrigorriaga.pdf</strong>) and compare
                    provider detection and data extraction accuracy, latency, and token usage.
                </p>
            </Box>

            {/* Provider selection */}
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
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                            Select LLMs to benchmark ({selectedCount}/{providers.length})
                        </span>
                    </label>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
                        onClick={runBenchmark}
                        disabled={running || selectedCount === 0}
                    >
                        {running ? "Running…" : "Run Benchmark"}
                    </Button>
                </Box>

                {/* LLM list */}
                <Stack divider={<Box sx={{ borderBottom: "1px solid var(--scheme-neutral-900)" }} />}>
                    {providers.map((p) => {
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
                                        <span>Testing…</span>
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
                            ? `Testing: ${providers.find((p) => p.id === currentlyTesting)?.name ?? currentlyTesting}`
                            : "Preparing…"}
                    </Box>
                </Box>
            )}

            {/* Error summary */}
            {Object.keys(errors).length > 0 && (
                <Stack spacing={1}>
                    {Object.entries(errors).map(([id, msg]) => {
                        const p = providers.find((pr) => pr.id === id);
                        return (
                            <Alert key={id} severity="error" sx={{ fontSize: 13 }}>
                                <strong>{p?.name ?? id}:</strong> {msg}
                            </Alert>
                        );
                    })}
                </Stack>
            )}

            {/* Results table */}
            {results.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Results — click a row to see field-by-field comparison
                    </Typography>
                    <Box sx={{ overflowX: "auto", border: "1px solid var(--scheme-neutral-900)", borderRadius: "8px" }}>
                        <Table size="small" sx={{ minWidth: 900 }}>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "var(--scheme-neutral-1200)" }}>
                                    <TableCell sx={{ width: 32 }} />
                                    <TableCell sx={{ fontWeight: 700 }}>LLM</TableCell>
                                    {/* Detection group */}
                                    <TableCell
                                        colSpan={3}
                                        align="center"
                                        sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                                    >
                                        Provider Detection
                                    </TableCell>
                                    {/* Extraction group */}
                                    <TableCell
                                        colSpan={3}
                                        align="center"
                                        sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                                    >
                                        Invoice Extraction
                                    </TableCell>
                                    {/* Overall group */}
                                    <TableCell
                                        colSpan={3}
                                        align="center"
                                        sx={{ fontWeight: 700, borderLeft: "1px solid var(--scheme-neutral-900)", fontSize: 11, color: "var(--axpo-text-secondary)" }}
                                    >
                                        Overall
                                    </TableCell>
                                </TableRow>
                                <TableRow sx={{ backgroundColor: "var(--scheme-neutral-1200)" }}>
                                    <TableCell />
                                    <TableCell />
                                    {/* Detection sub-headers */}
                                    <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>Score</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Time</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Tokens</TableCell>
                                    {/* Extraction sub-headers */}
                                    <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>Score</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Time</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Tokens</TableCell>
                                    {/* Overall sub-headers */}
                                    <TableCell align="center" sx={{ fontWeight: 600, fontSize: 11, borderLeft: "1px solid var(--scheme-neutral-900)" }}>Score</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Time</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Tokens</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {results
                                    .sort((a, b) => b.overallScore - a.overallScore)
                                    .map((r, idx) => (
                                        <ResultRow key={r.providerConfigId} result={r} idx={idx} />
                                    ))}
                            </TableBody>
                        </Table>
                    </Box>
                    <Box sx={{ mt: 1, fontSize: 12, color: "var(--axpo-text-secondary)" }}>
                        Sorted by overall score. Scores compare output against the known correct answer for <em>Serigrafia arrigorriaga.pdf</em>.
                    </Box>
                </Box>
            )}
        </Stack>
    );
}
