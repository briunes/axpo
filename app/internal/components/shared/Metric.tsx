"use client";

import { Paper, Stack, Typography } from "@mui/material";

type MetricTone = "default" | "success" | "warning" | "brand" | "accent";

const toneColor: Record<MetricTone, string> = {
  success: "success.main",
  warning: "warning.main",
  brand: "primary.main",
  accent: "secondary.main",
  default: "text.primary",
};

export function Metric({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: MetricTone;
}) {
  return (
    <Paper
      className={`panel-card metric-card tone-${tone}`}
      sx={{
        width: "100%",
        p: 3,
        border: "1px solid var(--scheme-neutral-900)",
        bgcolor: "var(--scheme-surface-raised)",
        boxShadow: "var(--scheme-shadow-soft)",
      }}
    >
      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography
          component="h3"
          variant="h4"
          color={toneColor[tone]}
          sx={{ fontWeight: 700, lineHeight: 1.1 }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
