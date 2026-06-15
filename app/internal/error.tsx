"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { reportClientError } from "./lib/reportClientError";

/**
 * error.tsx for the /internal section.
 * Catches React render errors inside any /internal page or component.
 */
export default function InternalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
        reportClientError(error);
    }, [error]);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                gap: 2,
                p: 4,
                textAlign: "center",
            }}
        >
            <ErrorOutlineIcon sx={{ fontSize: 56, color: "error.main" }} />
            <Typography variant="h5" fontWeight={700}>
                Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" maxWidth={440}>
                An unexpected error occurred on this page. It has been reported
                automatically.
            </Typography>
            {error.digest && (
                <Typography
                    variant="caption"
                    sx={{ fontFamily: "monospace", color: "text.disabled" }}
                >
                    Error ID: {error.digest}
                </Typography>
            )}
            <Button variant="contained" color="error" onClick={reset} sx={{ mt: 1 }}>
                Try again
            </Button>
        </Box>
    );
}
