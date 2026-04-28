"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

export interface AnalyticsActions {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  errorText: string | null;
  days: number;
  setDays: (d: number) => void;
  refresh: (days?: number) => Promise<void>;
}

export function useAnalytics(session: SessionState | null): AnalyticsActions {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["analytics", session?.token ?? "", days],
    queryFn: () => getAnalyticsSummary(session!.token, days),
    enabled: !!session,
  });

  const analytics = data ?? null;
  const loading = isFetching;
  const errorText = error instanceof Error ? error.message : null;

  const refresh = useCallback(
    async (overrideDays?: number) => {
      if (overrideDays !== undefined && overrideDays !== days) {
        setDays(overrideDays);
        // The query will auto-run due to key change; also pre-invalidate
        await queryClient.invalidateQueries({
          queryKey: ["analytics", session?.token ?? "", overrideDays],
        });
      } else {
        await refetch();
      }
    },
    [days, refetch, queryClient, session?.token],
  );

  return { analytics, loading, errorText, days, setDays, refresh };
}
