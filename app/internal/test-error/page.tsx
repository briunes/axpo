"use client";

import { Component, useState, type ReactNode } from "react";
import { Box, Button, Typography, Stack, Divider, Alert, Paper } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import * as Sentry from "@sentry/nextjs";
import { reportClientError } from "../lib/reportClientError";

// ── Inline React Error Boundary ───────────────────────────────────────────────
// Wraps only the bomb component so only the card breaks, not the whole page.
interface BoundaryState { crashed: boolean; message?: string }
class LocalErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
    state: BoundaryState = { crashed: false };
    static getDerivedStateFromError(error: Error) {
        return { crashed: true, message: error.message };
    }
    componentDidCatch(error: Error) {
        // Report to Sentry from within the boundary
        Sentry.captureException(error);
    }
    render() {
        if (this.state.crashed) {
            return (
                <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight={700}>Error caught by boundary</Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", mt: 0.5 }}>
                        {this.state.message}
                    </Typography>
                    <Button size="small" color="error" sx={{ mt: 1 }} onClick={() => this.setState({ crashed: false })}>
                        Reset
                    </Button>
                </Alert>
            );
        }
        return this.props.children;
    }
}

function BombComponent({ shouldCrash }: { shouldCrash: boolean }) {
    if (shouldCrash) {
        throw new Error("Test render crash — triggered from /internal/test-error page");
    }
    return null;
}

export default function TestErrorPage() {
    const [crashed, setCrashed] = useState(false);
    const [apiResult, setApiResult] = useState<string | null>(null);

    return (
        <Box sx={{ p: 4, maxWidth: 560 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <BugReportIcon sx={{ color: "error.main", fontSize: 28 }} />
                <Typography variant="h5" fontWeight={700}>Error Testing</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Simulate different error types and verify they appear in Sentry and the App Errors log.
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
                {/* 1 — React render crash (contained) */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        React Render Crash
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Throws inside a component during render. Caught by an inline error boundary —
                        only this card breaks, rest of the page stays intact.
                        Reported to Sentry via <code>captureException</code>.
                    </Typography>
                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => setCrashed(true)}
                    >
                        Trigger Render Crash
                    </Button>
                    <LocalErrorBoundary>
                        <BombComponent shouldCrash={crashed} />
                    </LocalErrorBoundary>
                </Paper>

                {/* 2 — API 500 */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        API Server Error (500)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Throws inside an API route — caught by <code>withErrorHandler</code>,
                        saved to DB + Sentry.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={async () => {
                            const res = await fetch("/api/v1/internal/test-error");
                            const json = await res.json();
                            setApiResult(`HTTP ${res.status} — ${json.error?.message ?? json.message ?? "done"}`);
                        }}
                    >
                        Trigger API Error
                    </Button>
                    {apiResult && (
                        <Alert severity="warning" sx={{ mt: 1.5 }}>
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{apiResult}</Typography>
                        </Alert>
                    )}
                </Paper>

                {/* 3 — Unhandled promise rejection */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        Unhandled Promise Rejection
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Fires a rejected promise without a catch — Sentry captures it
                        client-side via its global handler. Not saved to DB.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => {
                            const err = new Error("Unhandled rejection test — from /internal/test-error page");
                            reportClientError(err);
                            Promise.reject(err);
                        }}
                    >
                        Trigger Promise Rejection
                    </Button>
                </Paper>
            </Stack>
        </Box>
    );
}
