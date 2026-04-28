"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LayoutProvider } from "@once-ui-system/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { muiTheme } from "./lib/muiTheme";
import { InternalErrorBoundary } from "./components/shared/InternalErrorBoundary";
import { AlertProvider } from "./components/shared/AlertProvider";
import { UserPreferencesProvider } from "./components/providers/UserPreferencesProvider";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a stable QueryClient per browser session
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,    // 5 min — navigating back within this window uses cache
            gcTime: 10 * 60_000,      // 10 min before unused data is garbage-collected
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnMount: false,    // don't re-hit the server just because a component remounts
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
