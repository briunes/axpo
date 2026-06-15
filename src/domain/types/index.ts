/**
 * Domain Types - Core business value types
 */

export type UUID = string & { readonly __brand: "UUID" };

export * from "./simulation";

export enum UserRole {
  SYS_ADMIN = "SYS_ADMIN",
  ADMIN = "ADMIN",
  AGENT = "AGENT",
  COMMERCIAL = "COMMERCIAL",
}

export enum SimulationStatus {
  DRAFT = "DRAFT",
  SHARED = "SHARED",
  EXPIRED = "EXPIRED",
}

export enum BaseValueScope {
  GLOBAL = "GLOBAL",
  AGENCY = "AGENCY",
}

/**
 * Standard API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  /** Current app version — used by the frontend to detect stale deployments. */
  appVersion?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
