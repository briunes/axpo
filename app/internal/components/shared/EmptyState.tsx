"use client";

import { Paper, Stack, Typography } from "@mui/material";

export function EmptyState({ message }: { message: string }) {
  return (
    <Paper
      className="panel-card"
      sx={{
        width: "100%",
        p: 3,
        border: "1px solid var(--scheme-neutral-900)",
        bgcolor: "var(--scheme-surface-raised)",
        boxShadow: "none",
      }}
    >
      <Stack alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Stack>
    </Paper>
  );
}
