import { getBrowserFingerprint } from "./browserFingerprint";
import { uploadPresigned } from "@vercel/blob/client";
import { getBaseValueWorkbookContentType } from "@/infrastructure/excel/baseValueUpload";
import type {
  EmailTemplate,
  PdfTemplate,
  TemplateVariable,
} from "./configApi";

export interface LoginResult {
  token?: string;
  requiresOtp?: boolean;
  otpSessionToken?: string;
  user: {
    id: string;
    agencyId: string;
    role: "SYS_ADMIN" | "ADMIN" | "AGENT" | "COMMERCIAL";
    fullName: string;
    email: string;
  };
}

export type UserRole = "SYS_ADMIN" | "ADMIN" | "AGENT" | "COMMERCIAL";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  /** App version returned by the server on every response. */
  appVersion?: string;
}

export interface SimulationItem {
  id: string;
  referenceNumber?: string | null;
  agencyId?: string;
  agency?: { id: string; name: string; isTlv?: boolean } | null;
  ownerUserId?: string;
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    contactName?: string | null;
    contactEmail?: string | null;
    street?: string | null;
    city?: string | null;
    postalCode?: string | null;
    province?: string | null;
    country?: string | null;
    language?: string | null;
  } | null;
  status: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  sharedAt?: string | null;
  clientOpenedAt?: string | null;
  sharedVia?: string | null;
  publicToken?: string | null;
  pinSnapshot?: string | null;
  invoiceFilePath?: string | null;
  invoiceFileName?: string | null;
  invoiceFileSize?: number | null;
  expiresAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  payloadJson?: Record<string, unknown> | null;
  cupsNumber?: string | null;
  ownerUser?: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface ListSimulationsResult {
  items: SimulationItem[];
  total: number;
}

export interface AgencyItem {
  id: string;
  name: string;
  isTlv: boolean;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUser: {
    fullName: string;
  };
  createdByUser: {
    fullName: string;
  };
  _count?: {
    users: number;
  };
  users?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
  }>;
}

interface ListAgenciesResult {
  items: AgencyItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListAgenciesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  minimal?: boolean;
  isTlv?: boolean;
  status?: "active" | "inactive";
}

export interface ListAgenciesResponse {
  items: AgencyItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientItem {
  id: string;
  agencyId: string;
  agency?: { id: string; name: string } | null;
  name: string;
  cif?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  otherDetails?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country?: string | null;
  language?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUser: {
    fullName: string;
  };
  createdByUser: {
    fullName: string;
  };
}

interface ListClientsResult {
  items: ClientItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListClientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  agencyId?: string;
  minimal?: boolean;
}

export interface ListClientsResponse {
  items: ClientItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserItem {
  id: string;
  agencyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  maxActiveDevices?: number;
  mobilePhone?: string | null;
  commercialPhone?: string | null;
  commercialEmail?: string | null;
  otherDetails?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  pinRotatedAt?: string;
  createdByUser?: { id: string; fullName: string } | null;
  updatedByUser?: { id: string; fullName: string } | null;
}

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  maxActiveDevices?: number;
  mobilePhone?: string;
  commercialPhone?: string;
  commercialEmail?: string;
  otherDetails?: string;
  isActive?: boolean;
  role?: UserRole;
  agencyId?: string;
  password?: string;
  currentPassword?: string;
  preferences?: {
    language?: string | null;
    dateFormat?: string | null;
    timeFormat?: string | null;
    timezone?: string | null;
    numberFormat?: string | null;
    itemsPerPage?: number | null;
  };
}

interface ListUsersResult {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AnalyticsAgencyStat {
  agencyId: string;
  agencyName: string;
  total: number;
  shared: number;
  expired: number;
  opened: number;
}

export interface AnalyticsTrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AnalyticsAccessPoint {
  date: string; // YYYY-MM-DD
  count: number;
  successful: number;
}

export interface AnalyticsUserStat {
  userId: string;
  userName: string;
  total: number;
  shared: number;
  opened: number;
}

export interface AnalyticsOverview {
  totalSimulations: number;
  sharedSimulations: number;
  /** Simulations shared via email — only these can be opened by the client */
  emailSharedSimulations: number;
  expiredSimulations: number;
  draftSimulations: number;
  accessAttempts: number;
  successfulAccess: number;
  simulationTrend?: AnalyticsTrendPoint[];
  accessTrend?: AnalyticsAccessPoint[];
  periodDays: number;
  byAgency?: AnalyticsAgencyStat[];
  byUser?: AnalyticsUserStat[];
  // Simulation content metrics
  energyTypeSplit?: Array<{ type: string; count: number }>;
  tariffBreakdown?: Array<{ tariff: string; count: number }>;
  avgConsumoAnual?: number | null;
}

export type BaseValueScopeType = "GLOBAL" | "AGENCY" | "TLV";
export type ExcelParserConfigScope = Extract<BaseValueScopeType, "GLOBAL" | "TLV">;

export interface BaseValueSetItem {
  id: string;
  scopeType: BaseValueScopeType;
  agencyId: string | null;
  name: string;
  sourceWorkbookRef?: string | null;
  sourceScope?: string | null;
  sourceFileName?: string | null;
  version: number;
  isActive: boolean;
  isProduction: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdByUser?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  items?: BaseValueItem[];
  _count?: {
    items: number;
  };
}

export interface BaseValueItem {
  id?: string;
  baseValueSetId?: string;
  key: string;
  valueNumeric?: number;
  valueText?: string;
  unit?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface ExcelParserConfigItem {
  id?: string;
  scopeType: ExcelParserConfigScope;
  sourceLabel: string;
  productKey: string;
  displayName: string;
  commodity: "ELECTRICITY" | "GAS";
  pricingType: "FIXED" | "INDEXED";
  enabled: boolean;
  singlePeriod: boolean;
  eligibilityMin?: number | null;
  eligibilityMax?: number | null;
  sortOrder: number;
}

interface ListBaseValueSetsResult {
  items: BaseValueSetItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListBaseValueSetsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  sortDir?: "asc" | "desc";
  showArchived?: boolean;
  scopeType?: BaseValueScopeType;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  production?: "production" | "standard";
  forAgencyId?: string;
  minimal?: boolean;
}

export interface ListBaseValueSetsResponse {
  items: BaseValueSetItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ListBaseValueItemsResult {
  items: BaseValueItem[];
}

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  targetName?: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
}

interface ListAuditLogsResult {
  items: AuditLogItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListAuditLogsResponse {
  items: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateUserInput {
  agencyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  maxActiveDevices?: number;
  mobilePhone: string;
  commercialPhone: string;
  commercialEmail: string;
  otherDetails?: string;
  password?: string;
}

interface CreateAgencyInput {
  name: string;
  isTlv?: boolean;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
}

interface UpdateAgencyInput {
  name?: string;
  isTlv?: boolean;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  isActive?: boolean;
  tariffs?: Array<{
    tariffType: string;
    isEnabled: boolean;
  }>;
  products?: Array<{
    productKey: string;
    commodity: "ELECTRICITY" | "GAS";
    pricingType: "FIXED" | "INDEXED";
    isEnabled: boolean;
  }>;
}

interface CreateClientInput {
  name: string;
  agencyId?: string;
  cif?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  otherDetails?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  language?: string;
}

interface UpdateClientInput {
  name?: string;
  agencyId?: string;
  cif?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  otherDetails?: string;
  isActive?: boolean;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  language?: string;
}

interface CreateBaseValueSetInput {
  scopeType: BaseValueScopeType;
  agencyId?: string;
  name: string;
  sourceWorkbookRef?: string;
  sourceScope?: string;
  items?: BaseValueItem[];
}

interface UpdateBaseValueSetInput {
  name?: string;
  sourceWorkbookRef?: string;
  sourceScope?: string;
  isDeleted?: boolean;
}

interface CreateSimulationInput {
  ownerUserId?: string;
  clientId?: string;
  expiresAt?: string;
  payloadJson?: Record<string, unknown>;
  baseValueSetId?: string;
  ocrLogIds?: string[];
}

interface UpdateSimulationInput {
  status?: "DRAFT" | "SHARED" | "EXPIRED";
  expiresAt?: string | null;
  payloadJson?: Record<string, unknown>;
  baseValueSetId?: string | null;
}

type SelectedOfferInput =
  | {
      productKey: string;
      commodity: "ELECTRICITY" | "GAS";
      pricingType: "FIXED" | "INDEXED";
      selectedAt: string;
    }
  | null;

export interface CreateUserResult {
  user: UserItem;
  generatedPin?: string;
  generatedPinMasked?: string;
}

export interface RotatePinResult {
  userId: string;
  newPin: string;
  newPinMasked: string;
  pinRotatedAt: string;
}

export interface UserSessionItem {
  id: string;
  userId: string;
  sessionTokenId: string;
  loginAt: string;
  logoutAt?: string | null;
  isActive: boolean;
  authMethod: string;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastActivityAt: string;
  terminationReason?: string | null;
  metadataJson?: Record<string, unknown> | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    agencyId: string;
    maxActiveDevices: number;
  };
  terminatedByUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface ListSessionsResponse {
  items: UserSessionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CupsValidationResult {
  cups: string;
  normalized: string;
  valid: boolean;
  reason: string;
}

const baseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000");

const INTERNAL_READ_CACHE_TTL_MS = 30_000;
const internalReadCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();

function tokenScopedCacheKey(token: string, url: string): string {
  return `${token.slice(-12)}:${url}`;
}

function cachedInternalRead<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = INTERNAL_READ_CACHE_TTL_MS,
): Promise<T> {
  if (typeof window === "undefined") return fetcher();

  const now = Date.now();
  const cached = internalReadCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  const entry = {
    expiresAt: now + ttlMs,
    promise: fetcher(),
  };
  entry.promise.catch(() => {
    if (internalReadCache.get(key) === entry) {
      internalReadCache.delete(key);
    }
  });
  internalReadCache.set(key, entry);
  return entry.promise as Promise<T>;
}

export function maybePersistRefreshedToken(response: Response): void {
  if (typeof window === "undefined") return;

  const refreshedToken = response.headers.get("x-access-token");
  if (!refreshedToken) return;

  window.localStorage.setItem("axpo.internal.auth.token", refreshedToken);
}

async function reportAuthRedirectToLogin(
  token: string | null,
  response: Response,
  body: ApiEnvelope<unknown>,
  fallbackMessage: string,
): Promise<void> {
  if (typeof window === "undefined" || !token) return;

  try {
    const browserFingerprint = await getBrowserFingerprint();
    await fetch(`${baseUrl}/api/v1/internal/auth/redirect-report`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(browserFingerprint
          ? { "x-browser-fingerprint": browserFingerprint }
          : {}),
      },
      body: JSON.stringify({
        reason: "AUTH_API_REJECTED",
        statusCode: response.status,
        path: new URL(response.url).pathname,
        currentPath: window.location.pathname,
        errorCode: body.error?.code,
        errorMessage: body.error?.message ?? fallbackMessage,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort diagnostics only; never block the redirect.
  }
}

async function parseApiResponse<T>(
  response: Response,
  fallbackMessage: string,
  skipAuthRedirect = false,
): Promise<T> {
  maybePersistRefreshedToken(response);

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success || !body.data) {
    // Token expired / revoked → clear session and force login redirect once.
    // Permission denials (403) should surface to the caller as normal errors.
    // Skip redirect for login/auth endpoints to avoid page reload.
    if (response.status === 401 && !skipAuthRedirect) {
      if (typeof window !== "undefined") {
        const w = window as Window & { __axpoAuthRedirecting?: boolean };
        const token = window.localStorage.getItem("axpo.internal.auth.token");

        await reportAuthRedirectToLogin(
          token,
          response,
          body as ApiEnvelope<unknown>,
          fallbackMessage,
        );

        window.localStorage.removeItem("axpo.internal.auth.token");
        window.localStorage.removeItem("axpo.internal.auth.user");

        if (!w.__axpoAuthRedirecting) {
          w.__axpoAuthRedirecting = true;
          window.location.replace("/internal/login");
        }

        // Avoid bubbling repeated auth errors while redirecting
        return new Promise<T>(() => {
          // intentionally unresolved
        });
      }
    }
    throw new Error(
      body.error?.message ??
        body.error?.code ??
        `${fallbackMessage} (${response.status})`,
    );
  }

  return body.data;
}

function authHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function sessionHeaders(): Promise<HeadersInit> {
  const browserFingerprint = await getBrowserFingerprint();

  return {
    "content-type": "application/json",
    ...(browserFingerprint
      ? { "x-browser-fingerprint": browserFingerprint }
      : {}),
  };
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch(`${baseUrl}/api/v1/internal/auth/login`, {
    method: "POST",
    headers: await sessionHeaders(),
    body: JSON.stringify({ email, password }),
  });

  return parseApiResponse<LoginResult>(response, "Login failed", true);
}

export async function setupPassword(
  token: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/auth/setup-password`,
    {
      method: "POST",
      headers: await sessionHeaders(),
      body: JSON.stringify({ token, password }),
    },
  );
  return parseApiResponse<LoginResult>(response, "Password setup failed", true);
}

export async function forgotPassword(
  email: string,
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/auth/forgot-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  return parseApiResponse<{ success: boolean }>(
    response,
    "Password reset request failed",
    true,
  );
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/auth/reset-password`,
    {
      method: "POST",
      headers: await sessionHeaders(),
      body: JSON.stringify({ token, password }),
    },
  );
  return parseApiResponse<LoginResult>(response, "Password reset failed", true);
}

export async function verifyOtp(
  otpSessionToken: string,
  code: string,
): Promise<LoginResult> {
  const response = await fetch(`${baseUrl}/api/v1/internal/auth/otp/verify`, {
    method: "POST",
    headers: await sessionHeaders(),
    body: JSON.stringify({ otpSessionToken, code }),
  });
  return parseApiResponse<LoginResult>(
    response,
    "OTP verification failed",
    true,
  );
}

export async function logout(token: string): Promise<{ success: boolean }> {
  const response = await fetch(`${baseUrl}/api/v1/internal/auth/logout`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });

  return parseApiResponse<{ success: boolean }>(
    response,
    "Logout failed",
    true,
  );
}

export interface ListSimulationsParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  // filters
  search?: string;
  ownerUserId?: string;
  clientId?: string;
  cups?: string;
  status?: string;
}

export async function listSimulations(
  token: string,
  params?: ListSimulationsParams,
): Promise<{ items: SimulationItem[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.pageSize)
    searchParams.set("pageSize", params.pageSize.toString());
  if (params?.orderBy) searchParams.set("orderBy", params.orderBy);
  if (params?.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params?.includeDeleted) searchParams.set("includeDeleted", "true");
  if (params?.search) searchParams.set("search", params.search);
  if (params?.ownerUserId) searchParams.set("ownerUserId", params.ownerUserId);
  if (params?.clientId) searchParams.set("clientId", params.clientId);
  if (params?.cups) searchParams.set("cups", params.cups);
  if (params?.status) searchParams.set("status", params.status);

  const url = `${baseUrl}/api/v1/internal/simulations${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const body = await parseApiResponse<ListSimulationsResult>(
    response,
    "Simulation list failed",
  );
  return { items: body.items, total: body.total || body.items.length };
}

export async function getSimulation(
  token: string,
  simulationId: string,
): Promise<{ simulation: SimulationItem; versions: unknown[] }> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return parseApiResponse<{ simulation: SimulationItem; versions: unknown[] }>(
    response,
    "Get simulation failed",
  );
}

export interface SimulationShareInit {
  commodity: "ELECTRICITY" | "GAS";
  pdfTemplates: PdfTemplate[];
  emailTemplates: EmailTemplate[];
  templateVariables: TemplateVariable[];
  clientDefaults: {
    contactEmail?: string | null;
    country?: string | null;
    language?: string | null;
  } | null;
}

export async function getSimulationShareInit(
  token: string,
  simulationId: string,
): Promise<SimulationShareInit> {
  const url = `${baseUrl}/api/v1/internal/simulations/${simulationId}/share-init`;
  return cachedInternalRead(tokenScopedCacheKey(token, url), async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return parseApiResponse<SimulationShareInit>(
      response,
      "Get simulation share data failed",
    );
  });
}

export async function createSimulation(
  token: string,
  input: CreateSimulationInput,
): Promise<SimulationItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/simulations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<SimulationItem>(response, "Create simulation failed");
}

export async function cloneSimulation(
  token: string,
  simulationId: string,
): Promise<SimulationItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/clone`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  return parseApiResponse<SimulationItem>(response, "Clone simulation failed");
}

export async function updateSimulation(
  token: string,
  simulationId: string,
  input: UpdateSimulationInput,
): Promise<SimulationItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return parseApiResponse<SimulationItem>(response, "Update simulation failed");
}

export async function updateSimulationSelectedOffer(
  token: string,
  simulationId: string,
  selectedOffer: SelectedOfferInput,
): Promise<{
  simulationId: string;
  selectedOffer: SelectedOfferInput;
  versionId: string;
  updatedAt: string;
}> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/selected-offer`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ selectedOffer }),
    },
  );

  return parseApiResponse(response, "Update selected offer failed");
}

export async function shareSimulation(
  token: string,
  simulationId: string,
  sharedVia?: string,
): Promise<SimulationItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/share`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(sharedVia ? { sharedVia } : {}),
    },
  );

  return parseApiResponse<SimulationItem>(response, "Share simulation failed");
}

export async function rotateSimulationPinSnapshot(
  token: string,
  simulationId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/pin/rotate`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  await parseApiResponse<{
    simulationId: string;
    pinSnapshotRefreshed: boolean;
  }>(response, "Rotate simulation PIN snapshot failed");
}

export async function applySimulationOcrPrefill(
  token: string,
  simulationId: string,
  fields: Record<string, unknown>,
  source = "manual-prefill",
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/ocr-prefill`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ fields, source }),
    },
  );

  await parseApiResponse<{
    simulationId: string;
    versionId: string;
    prefillApplied: boolean;
  }>(response, "OCR prefill failed");
}

export interface ImproveOcrPromptResult {
  improvedPrompt: string;
  corrections: Array<{
    field: string;
    ocrValue: unknown;
    correctedValue: unknown;
  }>;
  unchanged: string[];
  simulationId: string | null;
  simulationReferenceNumber: string | null;
  invoiceProviderId: string | null;
  invoiceProviderName: string | null;
  invoiceType: "ELECTRICITY" | "GAS";
  noCorrections?: boolean;
  message?: string;
}

export interface TestOcrPromptResult {
  oldFields: Record<string, unknown>;
  newFields: Record<string, unknown>;
}

export async function testOcrPrompt(
  token: string,
  ocrLogId: string,
  prompt: string,
): Promise<TestOcrPromptResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/ocr-logs/${ocrLogId}/test-prompt`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    },
  );
  return parseApiResponse<TestOcrPromptResult>(
    response,
    "Test OCR prompt failed",
  );
}

export async function improveOcrPrompt(
  token: string,
  ocrLogId: string,
  options?: {
    invoiceProviderId?: string | null;
    invoiceProviderName?: string | null;
    invoiceType?: "ELECTRICITY" | "GAS";
    previousPrompt?: string | null;
    feedbackComment?: string | null;
  },
): Promise<ImproveOcrPromptResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/ocr-logs/${ocrLogId}/improve-prompt`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    },
  );
  return parseApiResponse<ImproveOcrPromptResult>(
    response,
    "Improve OCR prompt failed",
  );
}

export async function downloadSimulationPdf(
  token: string,
  simulationId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/pdf`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`PDF generation failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `simulation-${simulationId}.pdf`;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}

export async function openSimulationInvoice(
  token: string,
  simulationId: string,
): Promise<void> {
  const pendingWindow = window.open("", "_blank");
  if (pendingWindow) {
    pendingWindow.opener = null;
  }
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/invoice`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  maybePersistRefreshedToken(response);

  if (!response.ok) {
    pendingWindow?.close();
    let message = `Invoice download failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiEnvelope<unknown> & {
        message?: string;
      };
      message = body.error?.message ?? body.message ?? message;
    } catch {
      // Keep the status-based fallback if the response is not JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  if (pendingWindow) {
    pendingWindow.location.href = objectUrl;
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `simulation-${simulationId}-invoice`;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}

export async function validateCups(
  token: string,
  cups: string,
): Promise<CupsValidationResult> {
  const response = await fetch(`${baseUrl}/api/v1/internal/cups/validate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ cups }),
  });

  return parseApiResponse<CupsValidationResult>(
    response,
    "CUPS validation failed",
  );
}

export interface CalculateSimulationInput {
  baseValueSetId?: string;
  /** Optional current form payload to save and calculate in a single request. */
  payloadJson?: import("@/domain/types").SimulationPayload;
  /** Billing month override (YYYY-MM) for indexed offers. Fixed offers always use the billing period days. */
  selectedMonth?: string;
}

export interface CalculateSimulationResult {
  simulationId: string;
  versionId: string;
  baseValueSetId: string;
  results: import("@/domain/types").SimulationResults;
}

export async function calculateSimulation(
  token: string,
  simulationId: string,
  input?: CalculateSimulationInput,
): Promise<CalculateSimulationResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/calculate`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(input ?? {}),
    },
  );

  return parseApiResponse<CalculateSimulationResult>(
    response,
    "Calculation failed",
  );
}

export async function softDeleteSimulation(
  token: string,
  simulationId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  await parseApiResponse<{ simulationId: string; deleted: boolean }>(
    response,
    "Delete simulation failed",
  );
}

export interface BulkActionResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkActionResponse {
  results: BulkActionResult[];
  total: number;
  succeeded: number;
}

export async function bulkDeleteSimulations(
  token: string,
  ids: string[],
): Promise<BulkActionResponse> {
  const response = await fetch(`${baseUrl}/api/v1/internal/simulations/bulk`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });

  return parseApiResponse<BulkActionResponse>(
    response,
    "Bulk delete simulations failed",
  );
}

export async function bulkArchiveSimulations(
  token: string,
  ids: string[],
): Promise<BulkActionResponse> {
  const response = await fetch(`${baseUrl}/api/v1/internal/simulations/bulk`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });

  return parseApiResponse<BulkActionResponse>(
    response,
    "Bulk archive simulations failed",
  );
}

export interface CupsLookupEntry {
  cups: string;
  nombreTitular: string;
  personaContacto: string;
  comercial: string;
  direccion: string;
  comercializadorActual: string;
  clientId: string | null;
  lastUsed: string | null;
  lastStatus: string | null;
}

export async function fetchCupsLookup(
  token: string,
  params: { clientId?: string } = {},
): Promise<CupsLookupEntry[]> {
  const qs = params.clientId
    ? `?clientId=${encodeURIComponent(params.clientId)}`
    : "";
  const url = `${baseUrl}/api/v1/internal/cups/lookup${qs}`;
  return cachedInternalRead(tokenScopedCacheKey(token, url), async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: authHeaders(token),
    });

    const result = await parseApiResponse<{ items: CupsLookupEntry[] }>(
      response,
      "CUPS lookup failed",
    );
    return result.items;
  });
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  agencyId?: string;
  orderBy?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  minimal?: boolean;
  contextual?: boolean;
}

export interface ListSessionsParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  search?: string;
  activeOnly?: boolean;
  inactiveOnly?: boolean;
}

export interface ListUsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listUsers(
  token: string,
  params?: ListUsersParams,
): Promise<ListUsersResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search) qs.set("search", params.search);
  if (params?.role) qs.set("role", params.role);
  if (params?.agencyId) qs.set("agencyId", params.agencyId);
  if (params?.orderBy) qs.set("orderBy", params.orderBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);
  if (params?.includeDeleted) qs.set("includeDeleted", "true");
  if (params?.minimal) qs.set("minimal", "true");
  if (params?.contextual) qs.set("contextual", "true");
  const url = `${baseUrl}/api/v1/internal/users${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseApiResponse<ListUsersResult>(response, "User list failed");
}

export async function getUser(token: string, id: string): Promise<UserItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/users/${id}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseApiResponse<UserItem>(response, "User not found");
}

export async function listSessions(
  token: string,
  params?: ListSessionsParams,
): Promise<ListSessionsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.userId) qs.set("userId", params.userId);
  if (params?.search) qs.set("search", params.search);
  if (params?.activeOnly) qs.set("activeOnly", "true");
  if (params?.inactiveOnly) qs.set("inactiveOnly", "true");

  const response = await fetch(
    `${baseUrl}/api/v1/internal/sessions${qs.toString() ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: authHeaders(token),
      cache: "no-store",
    },
  );

  return parseApiResponse<ListSessionsResponse>(
    response,
    "List sessions failed",
  );
}

export async function forceLogoutSession(
  token: string,
  sessionId: string,
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/sessions/${sessionId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  return parseApiResponse<{ success: boolean }>(
    response,
    "Force logout session failed",
  );
}

export async function forceLogoutAllUserSessions(
  token: string,
  userId: string,
): Promise<{ success: boolean; revokedCount: number }> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/sessions/user/${userId}/logout-all`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  return parseApiResponse<{ success: boolean; revokedCount: number }>(
    response,
    "Force logout all user sessions failed",
  );
}

export async function forceLogoutAllSessions(
  token: string,
): Promise<{ success: boolean; revokedCount: number }> {
  const response = await fetch(`${baseUrl}/api/v1/internal/sessions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });

  return parseApiResponse<{ success: boolean; revokedCount: number }>(
    response,
    "Force logout all sessions failed",
  );
}

export async function createUser(
  token: string,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const response = await fetch(`${baseUrl}/api/v1/internal/users`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<CreateUserResult>(response, "Create user failed");
}

export async function updateUserStatus(
  token: string,
  userId: string,
  isActive: boolean,
): Promise<UserItem> {
  return updateUser(token, userId, { isActive });
}

export async function updateUser(
  token: string,
  userId: string,
  input: UpdateUserInput,
): Promise<UserItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<UserItem>(response, "Update user failed");
}

export async function rotateUserPin(
  token: string,
  userId: string,
): Promise<RotatePinResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/users/${userId}/pin/rotate`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  return parseApiResponse<RotatePinResult>(response, "Rotate user PIN failed");
}

export async function requestUserPasswordReset(
  token: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/users/${userId}/reset-password`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  return parseApiResponse<{ success: boolean; message: string }>(
    response,
    "Request password reset failed",
  );
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/internal/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });

  await parseApiResponse<{ userId: string; deleted: boolean }>(
    response,
    "Delete user failed",
  );
}

export async function listAgencies(
  token: string,
  params?: ListAgenciesParams,
): Promise<ListAgenciesResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search) qs.set("search", params.search);
  if (params?.orderBy) qs.set("orderBy", params.orderBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);
  if (params?.includeDeleted) qs.set("includeDeleted", "true");
  if (params?.minimal) qs.set("minimal", "true");
  if (params?.isTlv !== undefined) qs.set("isTlv", String(params.isTlv));
  if (params?.status) qs.set("status", params.status);
  const url = `${baseUrl}/api/v1/internal/agencies${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return parseApiResponse<ListAgenciesResult>(response, "Agency list failed");
}

export async function getAgency(
  token: string,
  agencyId: string,
): Promise<AgencyItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/agencies/${agencyId}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return parseApiResponse<AgencyItem>(response, "Get agency failed");
}

export async function createAgency(
  token: string,
  input: CreateAgencyInput,
): Promise<AgencyItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/agencies`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<AgencyItem>(response, "Create agency failed");
}

export async function updateAgency(
  token: string,
  agencyId: string,
  input: UpdateAgencyInput,
): Promise<AgencyItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/agencies/${agencyId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return parseApiResponse<AgencyItem>(response, "Update agency failed");
}

export async function updateAgencyStatus(
  token: string,
  agencyId: string,
  isActive: boolean,
): Promise<AgencyItem> {
  return updateAgency(token, agencyId, { isActive });
}

export async function deleteAgency(
  token: string,
  agencyId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/agencies/${agencyId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  await parseApiResponse<{ agencyId: string; deleted: boolean }>(
    response,
    "Delete agency failed",
  );
}

export async function listClients(
  token: string,
  params?: ListClientsParams,
): Promise<ListClientsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search) qs.set("search", params.search);
  if (params?.orderBy) qs.set("orderBy", params.orderBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);
  if (params?.includeDeleted) qs.set("includeDeleted", "true");
  if (params?.agencyId) qs.set("agencyId", params.agencyId);
  if (params?.minimal) qs.set("minimal", "true");
  const url = `${baseUrl}/api/v1/internal/clients${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseApiResponse<ListClientsResult>(response, "Client list failed");
}

export async function listAllClients(
  token: string,
  params?: Omit<ListClientsParams, "page" | "pageSize">,
): Promise<ClientItem[]> {
  const pageSize = 100;
  const firstPage = await listClients(token, {
    ...params,
    page: 1,
    pageSize,
  });
  const items = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await listClients(token, {
      ...params,
      page,
      pageSize,
    });
    items.push(...result.items);
  }

  return items;
}

export async function getClient(
  token: string,
  clientId: string,
): Promise<ClientItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/clients/${clientId}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return parseApiResponse<ClientItem>(response, "Get client failed");
}

export async function createClient(
  token: string,
  input: CreateClientInput,
): Promise<ClientItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/clients`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<ClientItem>(response, "Create client failed");
}

export async function updateClient(
  token: string,
  clientId: string,
  input: UpdateClientInput,
): Promise<ClientItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/clients/${clientId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return parseApiResponse<ClientItem>(response, "Update client failed");
}

export async function softDeleteClient(
  token: string,
  clientId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/clients/${clientId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  await parseApiResponse<ClientItem>(response, "Delete client failed");
}

export async function fetchAnalyticsOverview(
  token: string,
  days = 30,
  energyType?: string,
): Promise<AnalyticsOverview> {
  const qs = new URLSearchParams({ days: String(days) });
  if (energyType) qs.set("energyType", energyType);
  const response = await fetch(
    `${baseUrl}/api/v1/internal/analytics/overview?${qs}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseApiResponse<AnalyticsOverview>(
    response,
    "Analytics request failed",
  );
}

export async function fetchAnalyticsForAgency(
  token: string,
  agencyId: string,
  days = 30,
  energyType?: string,
): Promise<AnalyticsOverview> {
  const qs = new URLSearchParams({ days: String(days), agencyId });
  if (energyType) qs.set("energyType", energyType);
  const response = await fetch(
    `${baseUrl}/api/v1/internal/analytics/overview?${qs}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseApiResponse<AnalyticsOverview>(
    response,
    "Analytics request failed",
  );
}

export async function listBaseValueSets(
  token: string,
  params?: ListBaseValueSetsParams,
): Promise<ListBaseValueSetsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search) qs.set("search", params.search);
  if (params?.orderBy) qs.set("orderBy", params.orderBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);
  if (params?.showArchived) qs.set("showArchived", "true");
  if (params?.scopeType) qs.set("scopeType", params.scopeType);
  if (params?.status) qs.set("status", params.status);
  if (params?.production) qs.set("production", params.production);
  if (params?.forAgencyId) qs.set("forAgencyId", params.forAgencyId);
  if (params?.minimal) qs.set("minimal", "true");
  const url = `${baseUrl}/api/v1/internal/base-values${qs.toString() ? `?${qs}` : ""}`;
  return cachedInternalRead(tokenScopedCacheKey(token, url), async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return parseApiResponse<ListBaseValueSetsResult>(
      response,
      "Base values list failed",
    );
  });
}

export async function getBaseValueSet(
  token: string,
  setId: string,
): Promise<BaseValueSetItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return parseApiResponse<BaseValueSetItem>(
    response,
    "Get base value set failed",
  );
}

export async function createBaseValueSet(
  token: string,
  input: CreateBaseValueSetInput,
): Promise<BaseValueSetItem> {
  const response = await fetch(`${baseUrl}/api/v1/internal/base-values`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  return parseApiResponse<BaseValueSetItem>(
    response,
    "Create base value set failed",
  );
}

export async function updateBaseValueSet(
  token: string,
  setId: string,
  input: UpdateBaseValueSetInput,
): Promise<BaseValueSetItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return parseApiResponse<BaseValueSetItem>(
    response,
    "Update base value set failed",
  );
}

export async function toggleBaseValueSetProduction(
  token: string,
  setId: string,
  isProduction: boolean,
): Promise<BaseValueSetItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}/production`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ isProduction }),
    },
  );

  return parseApiResponse<BaseValueSetItem>(
    response,
    "Toggle production flag failed",
  );
}

export async function listBaseValueItems(
  token: string,
  setId: string,
): Promise<BaseValueItem[]> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}/items`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const body = await parseApiResponse<ListBaseValueItemsResult>(
    response,
    "Base value items request failed",
  );
  return body.items;
}

export async function replaceBaseValueItems(
  token: string,
  setId: string,
  items: BaseValueItem[],
): Promise<BaseValueItem[]> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}/items`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ items }),
    },
  );

  const body = await parseApiResponse<{
    baseValueSetId: string;
    items: BaseValueItem[];
  }>(response, "Replace base value items failed");
  return body.items;
}

export async function activateBaseValueSet(
  token: string,
  setId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}/activate`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );

  await parseApiResponse<{ id: string; activated: boolean }>(
    response,
    "Activate base value set failed",
  );
}

export async function listExcelParserConfig(
  token: string,
  scopeType: ExcelParserConfigScope,
): Promise<ExcelParserConfigItem[]> {
  const params = new URLSearchParams({ scopeType });
  const response = await fetch(
    `${baseUrl}/api/v1/internal/excel-parser-config?${params.toString()}`,
    { headers: authHeaders(token) },
  );
  const body = await parseApiResponse<{ items: ExcelParserConfigItem[] }>(
    response,
    "Excel parser config list failed",
  );
  return body.items;
}

export async function saveExcelParserConfig(
  token: string,
  scopeType: ExcelParserConfigScope,
  items: ExcelParserConfigItem[],
): Promise<ExcelParserConfigItem[]> {
  const response = await fetch(`${baseUrl}/api/v1/internal/excel-parser-config`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ scopeType, items }),
  });
  const body = await parseApiResponse<{ items: ExcelParserConfigItem[] }>(
    response,
    "Excel parser config save failed",
  );
  return body.items;
}

export async function uploadBaseValueFile(
  token: string,
  file: File,
  replace: boolean = false,
  scopeType?: Extract<BaseValueScopeType, "GLOBAL" | "TLV">,
): Promise<{
  message: string;
  set: {
    id: string;
    name: string;
    version: number;
    itemCount: number;
    isActive: boolean;
  };
}> {
  const isLocalUpload =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  if (isLocalUpload) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("replace", replace ? "true" : "false");
    if (scopeType) {
      formData.append("scopeType", scopeType);
    }

    const response = await fetch(`${baseUrl}/api/v1/internal/base-values/upload`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return parseApiResponse<{
      message: string;
      set: {
        id: string;
        name: string;
        version: number;
        itemCount: number;
        isActive: boolean;
      };
    }>(response, "Upload base value file failed");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await uploadPresigned(
    `base-values/${Date.now()}-${safeFileName}`,
    file,
    {
      access: "private",
      contentType: getBaseValueWorkbookContentType(file.name),
      handleUploadUrl: `${baseUrl}/api/v1/internal/base-values/upload/blob`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      multipart: file.size > 20 * 1024 * 1024,
    },
  );

  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/upload`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        blobUrl: blob.url,
        fileName: file.name,
        replace,
        scopeType,
      }),
    },
  );

  return parseApiResponse<{
    message: string;
    set: {
      id: string;
      name: string;
      version: number;
      itemCount: number;
      isActive: boolean;
    };
  }>(response, "Upload base value file failed");
}

export async function downloadBaseValueFile(
  token: string,
  setId: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/${setId}/download`,
    {
      method: "GET",
      headers: authHeaders(token),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to download file");
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? `base-values-${setId}.xlsm`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  eventType?: string;
  excludeAuthEvents?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  actorSearch?: string;
  targetType?: string;
  targetId?: string;
}

export async function listAuditLogs(
  token: string,
  params?: ListAuditLogsParams,
): Promise<ListAuditLogsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.eventType) qs.set("eventType", params.eventType);
  if (params?.excludeAuthEvents) qs.set("excludeAuthEvents", "true");
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.search) qs.set("search", params.search);
  if (params?.actorSearch) qs.set("actorSearch", params.actorSearch);
  if (params?.targetType) qs.set("targetType", params.targetType);
  if (params?.targetId) qs.set("targetId", params.targetId);
  const queryString = qs.toString();
  const url = `${baseUrl}/api/v1/internal/audit-logs${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const body = await parseApiResponse<ListAuditLogsResult>(
    response,
    "Audit logs request failed",
  );
  return {
    items: body.items,
    pagination: body.pagination ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? body.items.length,
      total: body.items.length,
      totalPages: 1,
    },
  };
}

export type AnalyticsSummary = AnalyticsOverview;

export async function getAnalyticsSummary(
  token: string,
  days = 30,
  energyType?: string,
): Promise<AnalyticsSummary> {
  return fetchAnalyticsOverview(token, days, energyType);
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "SYS_ADMIN";
}

export function isAgent(role: UserRole): boolean {
  return role === "AGENT";
}

export function isCommercial(role: UserRole): boolean {
  return role === "COMMERCIAL";
}

export function simulationStatusTone(
  status: string,
): "neutral" | "brand" | "warning" {
  if (status === "SHARED") {
    return "brand";
  }
  if (status === "EXPIRED") {
    return "warning";
  }
  return "neutral";
}

// ── Role Permissions ────────────────────────────────────────────────────────

export interface RolePermissionItem {
  id: string;
  role: string;
  permissionKey: string;
  allowed: boolean;
  updatedAt: string;
}

export async function listRolePermissions(
  token: string,
): Promise<RolePermissionItem[]> {
  const res = await fetch("/api/v1/internal/config/role-permissions", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<{
    items: RolePermissionItem[];
  }>;
  if (!json.success || !json.data)
    throw new Error("Failed to load role permissions");
  return json.data.items;
}

export async function updateRolePermissions(
  token: string,
  updates: Array<{ role: string; permissionKey: string; allowed: boolean }>,
): Promise<void> {
  const res = await fetch("/api/v1/internal/config/role-permissions", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ updates }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json.success) throw new Error("Failed to update role permissions");
}

// ── OCR Usage Dashboard ─────────────────────────────────────────────────────

export interface OcrUsageBilling {
  enabled: boolean;
  currency: string;
  unitTokens: number;
  markupPercent: number;
  fixedFeePerCall: number;
  includeFailedCalls: boolean;
  pricedModels: number;
  unpricedModels: string[];
}

export interface OcrUsageTotals {
  totalCalls: number;
  billableCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  baseCost: number;
  markupCost: number;
  fixedFeeCost: number;
  totalCost: number;
  unmatchedCalls: number;
  currency: string;
  avgDurationMs: number | null;
  successRate: number | null;
  avgCostPerCall: number;
  avgPromptTokensPerCall: number;
  avgCompletionTokensPerCall: number;
}

export interface OcrUsageBucket {
  key: string;
  label: string;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  userEmail?: string | null;
}

export interface OcrUsageRecentCall {
  id: string;
  requestedAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  provider: string;
  model: string;
  status: string;
  type: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  cost: number;
  currency: string;
  matched: boolean;
}

export interface OcrUsageOverview {
  totals: OcrUsageTotals;
  billing: OcrUsageBilling;
  series: { granularity: string; buckets: OcrUsageBucket[] };
  groupBy: { key: string; buckets: OcrUsageBucket[] };
  top: {
    users: OcrUsageBucket[];
    providers: OcrUsageBucket[];
    models: OcrUsageBucket[];
  };
  recentCalls: OcrUsageRecentCall[];
}

export interface OcrUsageOverviewParams {
  dateFrom?: string;
  dateTo?: string;
  provider?: string;
  model?: string;
  userId?: string;
  status?: string;
  type?: string;
  groupBy?: "day" | "user" | "provider" | "model" | "type";
  granularity?: "hour" | "day" | "week" | "month";
  recentLimit?: number;
}

export async function fetchOcrUsageOverview(
  token: string,
  params: OcrUsageOverviewParams = {},
): Promise<OcrUsageOverview> {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.provider) qs.set("provider", params.provider);
  if (params.model) qs.set("model", params.model);
  if (params.userId) qs.set("userId", params.userId);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.groupBy) qs.set("groupBy", params.groupBy);
  if (params.granularity) qs.set("granularity", params.granularity);
  if (params.recentLimit !== undefined)
    qs.set("recentLimit", String(params.recentLimit));

  const url = `/api/v1/internal/ocr-usage/overview${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseApiResponse<OcrUsageOverview>(res, "OCR usage request failed");
}

export interface OcrAvailableModel {
  provider: string;
  model: string;
  calls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  priced: boolean;
  activePrice: {
    id: string;
    currency: string;
    inputPricePer1kTokens: number;
    outputPricePer1kTokens: number;
    unitTokens: number;
  } | null;
}

export async function fetchOcrAvailableModels(
  token: string,
): Promise<OcrAvailableModel[]> {
  const res = await fetch("/api/v1/internal/ocr-usage/available-models", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await parseApiResponse<{ items: OcrAvailableModel[] }>(
    res,
    "OCR available-models request failed",
  );
  return body.items;
}

export interface OcrModelPriceItem {
  id: string;
  provider: string;
  model: string;
  inputPricePer1kTokens: number;
  outputPricePer1kTokens: number;
  currency: string;
  unitTokens: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OcrModelPriceInput {
  provider: string;
  model: string;
  inputPricePer1kTokens: number;
  outputPricePer1kTokens: number;
  currency?: string;
  unitTokens?: number;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  note?: string | null;
}

export async function listOcrModelPrices(
  token: string,
  activeOnly = false,
): Promise<OcrModelPriceItem[]> {
  const qs = activeOnly ? "?activeOnly=true" : "";
  const res = await fetch(`/api/v1/internal/ocr-prices${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await parseApiResponse<{ items: OcrModelPriceItem[] }>(
    res,
    "OCR prices request failed",
  );
  return body.items;
}

export async function createOcrModelPrice(
  token: string,
  input: OcrModelPriceInput,
): Promise<OcrModelPriceItem> {
  const res = await fetch("/api/v1/internal/ocr-prices", {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseApiResponse<OcrModelPriceItem>(res, "Failed to create OCR price");
}

export async function updateOcrModelPrice(
  token: string,
  id: string,
  input: Partial<OcrModelPriceInput>,
): Promise<OcrModelPriceItem> {
  const res = await fetch(`/api/v1/internal/ocr-prices/${id}`, {
    method: "PUT",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseApiResponse<OcrModelPriceItem>(res, "Failed to update OCR price");
}

export async function deleteOcrModelPrice(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`/api/v1/internal/ocr-prices/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseApiResponse<{ id: string; deleted: boolean }>(
    res,
    "Failed to delete OCR price",
  );
}

export interface OcrUsageInvoiceItem {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  clientId: string | null;
  clientName: string | null;
  agencyId: string | null;
  agencyName: string | null;
  userId: string | null;
  userName: string | null;
  currency: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  baseCost: number;
  markupCost: number;
  fixedFeeCost: number;
  totalCost: number;
  status: string;
  note: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface OcrUsageInvoiceDetail extends OcrUsageInvoiceItem {
  userEmail: string | null;
  breakdown: any;
  updatedAt: string;
}

export interface ListOcrInvoicesResult {
  items: OcrUsageInvoiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listOcrUsageInvoices(
  token: string,
  params: { page?: number; limit?: number } = {},
): Promise<ListOcrInvoicesResult> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(
    `/api/v1/internal/ocr-usage/invoices${
      qs.toString() ? `?${qs.toString()}` : ""
    }`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return parseApiResponse<ListOcrInvoicesResult>(
    res,
    "OCR invoices request failed",
  );
}

export async function getOcrUsageInvoice(
  token: string,
  id: string,
): Promise<OcrUsageInvoiceDetail> {
  const res = await fetch(`/api/v1/internal/ocr-usage/invoices/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseApiResponse<OcrUsageInvoiceDetail>(
    res,
    "Failed to load OCR invoice",
  );
}

export interface CreateOcrInvoiceInput {
  label: string;
  dateFrom: string;
  dateTo: string;
  clientId?: string | null;
  clientName?: string | null;
  agencyId?: string | null;
  userId?: string | null;
  status?: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  note?: string | null;
}

export async function createOcrUsageInvoice(
  token: string,
  input: CreateOcrInvoiceInput,
): Promise<{
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalCalls: number;
  totalTokens: string;
  baseCost: number;
  markupCost: number;
  fixedFeeCost: number;
  totalCost: number;
  status: string;
}> {
  const res = await fetch("/api/v1/internal/ocr-usage/invoices", {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseApiResponse(res, "Failed to create OCR invoice");
}

// ── System config (for the OCR billing toggle) ───────────────────────────

export interface OcrBillingConfig {
  ocrBillingEnabled: boolean;
  ocrBillingCurrency: string;
  ocrBillingUnitTokens: number;
  ocrBillingMarkupPercent: number;
  ocrBillingFixedFeePerCall: number;
  ocrBillingIncludeFailedCalls: boolean;
}

export async function fetchOcrBillingConfig(
  token: string,
): Promise<OcrBillingConfig> {
  const res = await fetch("/api/v1/internal/config/system?view=admin", {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to load system config (${res.status})`);
  }
  // System config endpoint returns the raw object (not the {success, data}
  // envelope used by other internal endpoints).
  const data = (await res.json()) as Record<string, unknown>;
  return {
    ocrBillingEnabled: Boolean(data.ocrBillingEnabled),
    ocrBillingCurrency: String(data.ocrBillingCurrency ?? "USD"),
    ocrBillingUnitTokens: Number(data.ocrBillingUnitTokens ?? 1000),
    ocrBillingMarkupPercent: Number(data.ocrBillingMarkupPercent ?? 0),
    ocrBillingFixedFeePerCall: Number(data.ocrBillingFixedFeePerCall ?? 0),
    ocrBillingIncludeFailedCalls: Boolean(data.ocrBillingIncludeFailedCalls),
  };
}

export async function updateOcrBillingConfig(
  token: string,
  patch: Partial<OcrBillingConfig>,
): Promise<OcrBillingConfig> {
  const res = await fetch("/api/v1/internal/config/system", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to update OCR billing config (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    ocrBillingEnabled: Boolean(data.ocrBillingEnabled),
    ocrBillingCurrency: String(data.ocrBillingCurrency ?? "USD"),
    ocrBillingUnitTokens: Number(data.ocrBillingUnitTokens ?? 1000),
    ocrBillingMarkupPercent: Number(data.ocrBillingMarkupPercent ?? 0),
    ocrBillingFixedFeePerCall: Number(data.ocrBillingFixedFeePerCall ?? 0),
    ocrBillingIncludeFailedCalls: Boolean(data.ocrBillingIncludeFailedCalls),
  };
}
