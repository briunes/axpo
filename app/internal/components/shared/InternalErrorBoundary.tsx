"use client";

import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface InternalErrorBoundaryProps {
  children: ReactNode;
}

interface InternalErrorBoundaryState {
  hasError: boolean;
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
      return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 3 }}>
          <Paper elevation={1} sx={{ maxWidth: 520, width: "100%", p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={600}>Something went wrong</Typography>
              <Typography variant="body2" color="text.secondary">
                The internal workspace failed to render. You can retry now without losing your session.
              </Typography>
              <Button variant="contained" size="small" onClick={this.handleReset}>
                Retry
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
