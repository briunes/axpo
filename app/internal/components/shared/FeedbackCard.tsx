"use client";

import { Paper, Typography } from "@mui/material";

type FeedbackTone = "success" | "danger" | "info" | "warning";

const toneColor: Record<FeedbackTone, string> = {
  success: "success.main",
  danger: "error.main",
  info: "info.main",
  warning: "warning.main",
};

export function FeedbackCard({ tone, text }: { tone: FeedbackTone; text: string }) {
  return (
    <Paper
      sx={{
        width: "100%",
        p: 1.5,
        border: "1px solid var(--scheme-neutral-900)",
        bgcolor: "var(--scheme-surface-raised)",
        boxShadow: "none",
      }}
    >
      <Typography variant="body2" color={toneColor[tone]}>
        {text}
      </Typography>
    </Paper>
  );
}
