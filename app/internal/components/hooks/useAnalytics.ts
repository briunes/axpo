"use client";

import { useCallback, useState } from "react";
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

export interface AnalyticsActions {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  errorText: string | null;
  refresh: (days?: number) => Promise<void>;
}

export function useAnalytics(session: SessionState | null): AnalyticsActions {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const refresh = useCallback(
    async (days = 30) => {
      if (!session) return;
      setLoading(true);
      setErrorText(null);
      try {
        const data = await getAnalyticsSummary(session.token, days);
        setAnalytics(data);
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : "Could not load analytics.",
        );
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  return { analytics, loading, errorText, refresh };
}
