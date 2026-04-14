"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { muiTheme } from "./lib/muiTheme";
import { InternalErrorBoundary } from "./components/shared/InternalErrorBoundary";
import { AlertProvider } from "./components/shared/AlertProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AlertProvider>
        <InternalErrorBoundary>{children}</InternalErrorBoundary>
      </AlertProvider>
    </ThemeProvider>
  );
}
