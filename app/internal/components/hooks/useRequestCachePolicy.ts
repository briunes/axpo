"use client";

import { useQuery } from "@tanstack/react-query";
import { getSystemConfig } from "../../lib/configApi";
import {
  DEFAULT_REQUEST_CACHE_CONFIG,
  getRequestCacheQueryOptions,
  normalizeRequestCacheConfig,
  type RequestCacheModule,
} from "../../lib/requestCacheConfig";

export function useRequestCachePolicy(module: RequestCacheModule) {
  const { data } = useQuery({
    queryKey: ["system-config", "request-cache"],
    queryFn: () => getSystemConfig({ view: "runtime" }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const config = normalizeRequestCacheConfig(data?.requestCacheConfig)[module] ??
    DEFAULT_REQUEST_CACHE_CONFIG[module];

  return getRequestCacheQueryOptions(config);
}
