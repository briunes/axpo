"use client";

import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";

interface InternalErrorBoundaryProps {
  children: ReactNode;
}

interface InternalErrorBoundaryState {
  hasError: boolean;
}

function InternalErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 3 }}>
      <Paper elevation={1} sx={{ maxWidth: 520, width: "100%", p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={600}>{t("common", "somethingWentWrong")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("internalError", "boundaryDescription")}
          </Typography>
          <Button variant="contained" size="small" onClick={onReset}>
            {t("common", "retry")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export class InternalErrorBoundary extends Component<InternalErrorBoundaryProps, InternalErrorBoundaryState> {
  state: InternalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): InternalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Internal workspace crashed", error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <InternalErrorFallback onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
