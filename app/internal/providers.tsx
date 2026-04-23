"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LayoutProvider } from "@once-ui-system/core";
import { muiTheme } from "./lib/muiTheme";
import { InternalErrorBoundary } from "./components/shared/InternalErrorBoundary";
import { AlertProvider } from "./components/shared/AlertProvider";
import { UserPreferencesProvider } from "./components/providers/UserPreferencesProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <LayoutProvider>
        <AlertProvider>
          <UserPreferencesProvider>
            <InternalErrorBoundary>{children}</InternalErrorBoundary>
          </UserPreferencesProvider>
        </AlertProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
}
