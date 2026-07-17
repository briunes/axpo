"use client";

export type RequestCacheModule =
  | "simulations"
  | "users"
  | "agencies"
  | "clients"
  | "baseValues"
  | "notifications"
  | "logs"
  | "analytics";

export interface RequestCacheModuleConfig {
  enabled: boolean;
  durationMs: number;
  autoRefetchOnExpire: boolean;
}

export type RequestCacheConfig = Record<
  RequestCacheModule,
  RequestCacheModuleConfig
>;

export const REQUEST_CACHE_MODULE_LABELS: Record<RequestCacheModule, string> = {
  simulations: "Simulations",
  users: "Users",
  agencies: "Agencies",
  clients: "Clients",
  baseValues: "Base values",
  notifications: "Notifications",
  logs: "Logs",
  analytics: "Analytics",
};

export const REQUEST_CACHE_MODULES = Object.keys(
  REQUEST_CACHE_MODULE_LABELS,
) as RequestCacheModule[];

export const DEFAULT_REQUEST_CACHE_CONFIG: RequestCacheConfig = {
  simulations: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
  users: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
  agencies: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
  clients: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
  baseValues: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
  notifications: { enabled: true, durationMs: 2 * 60_000, autoRefetchOnExpire: true },
  logs: { enabled: true, durationMs: 60_000, autoRefetchOnExpire: false },
  analytics: { enabled: true, durationMs: 5 * 60_000, autoRefetchOnExpire: false },
};

export interface RequestCacheQueryOptions {
  staleTime: number;
  gcTime: number;
  refetchOnMount: false | "always";
  refetchOnWindowFocus: false;
  refetchInterval: number | false;
  refetchIntervalInBackground?: false;
}

const MIN_DURATION_MS = 5_000;
const MAX_DURATION_MS = 24 * 60 * 60_000;

function clampDurationMs(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), MIN_DURATION_MS), MAX_DURATION_MS);
}

export function normalizeRequestCacheConfig(
  value: unknown,
): RequestCacheConfig {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<RequestCacheModule, Partial<RequestCacheModuleConfig>>>)
      : {};

  return REQUEST_CACHE_MODULES.reduce((acc, module) => {
    const defaults = DEFAULT_REQUEST_CACHE_CONFIG[module];
    const item = source[module] ?? {};
    acc[module] = {
      enabled:
        typeof item.enabled === "boolean" ? item.enabled : defaults.enabled,
      durationMs: clampDurationMs(item.durationMs, defaults.durationMs),
      autoRefetchOnExpire:
        typeof item.autoRefetchOnExpire === "boolean"
          ? item.autoRefetchOnExpire
          : defaults.autoRefetchOnExpire,
    };
    return acc;
  }, {} as RequestCacheConfig);
}

export function getRequestCacheQueryOptions(
  config: RequestCacheModuleConfig,
): RequestCacheQueryOptions {
  if (!config.enabled) {
    return {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: false,
      refetchInterval: false as const,
    };
  }

  return {
    staleTime: config.durationMs,
    gcTime: Math.max(config.durationMs * 2, config.durationMs + 60_000),
    refetchOnMount: false as const,
    refetchOnWindowFocus: false,
    refetchInterval: config.autoRefetchOnExpire
      ? config.durationMs
      : false,
    refetchIntervalInBackground: false,
  };
}
