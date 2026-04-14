export interface LoginResult {
  token: string;
  user: {
    id: string;
    agencyId: string;
    role: "ADMIN" | "AGENT" | "COMMERCIAL";
    fullName: string;
    email: string;
  };
}

export type UserRole = "ADMIN" | "AGENT" | "COMMERCIAL";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface SimulationItem {
  id: string;
  agencyId?: string;
  ownerUserId?: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  status: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  sharedAt?: string | null;
  publicToken?: string | null;
  pinSnapshot?: string | null;
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
}

export interface AgencyItem {
  id: string;
  name: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  name: string;
  cif?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  otherDetails?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  mobilePhone?: string | null;
  commercialPhone?: string | null;
  commercialEmail?: string | null;
  otherDetails?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pinRotatedAt?: string;
}

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  mobilePhone?: string;
  commercialPhone?: string;
  commercialEmail?: string;
  otherDetails?: string;
  isActive?: boolean;
  role?: UserRole;
  agencyId?: string;
  password?: string;
  currentPassword?: string;
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
}

export interface AnalyticsOverview {
  totalSimulations: number;
  sharedSimulations: number;
  expiredSimulations: number;
  draftSimulations: number;
  accessAttempts: number;
  successfulAccess: number;
  simulationTrend?: AnalyticsTrendPoint[];
  accessTrend?: AnalyticsAccessPoint[];
  periodDays: number;
  byAgency?: AnalyticsAgencyStat[];
  byUser?: AnalyticsUserStat[];
}

export type BaseValueScopeType = "GLOBAL" | "AGENCY";

export interface BaseValueSetItem {
  id: string;
  scopeType: BaseValueScopeType;
  agencyId: string | null;
  name: string;
  sourceWorkbookRef?: string | null;
  sourceScope?: string | null;
  version: number;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
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
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
}

interface ListAuditLogsResult {
  items: AuditLogItem[];
}

interface CreateUserInput {
  agencyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  mobilePhone: string;
  commercialPhone: string;
  commercialEmail: string;
  otherDetails?: string;
  password: string;
}

interface CreateAgencyInput {
  name: string;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
}

interface UpdateAgencyInput {
  name?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  isActive?: boolean;
}

interface CreateClientInput {
  name: string;
  agencyId?: string;
  cif?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  otherDetails?: string;
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
}

interface UpdateSimulationInput {
  status?: "DRAFT" | "SHARED" | "EXPIRED";
  expiresAt?: string | null;
  payloadJson?: Record<string, unknown>;
  baseValueSetId?: string | null;
}

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

async function parseApiResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success || !body.data) {
    // Token expired / revoked → clear session and force login redirect
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("axpo.internal.auth.token");
        window.localStorage.removeItem("axpo.internal.auth.user");
        window.location.href = "/internal/login";
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

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch(`${baseUrl}/api/v1/internal/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return parseApiResponse<LoginResult>(response, "Login failed");
}

export async function listSimulations(
  token: string,
): Promise<SimulationItem[]> {
  const response = await fetch(`${baseUrl}/api/v1/internal/simulations`, {
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
  return body.items;
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

export async function shareSimulation(
  token: string,
  simulationId: string,
): Promise<SimulationItem> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/simulations/${simulationId}/share`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
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

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  sortDir?: "asc" | "desc";
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
  if (params?.orderBy) qs.set("orderBy", params.orderBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);
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
  const url = `${baseUrl}/api/v1/internal/clients${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseApiResponse<ListClientsResult>(response, "Client list failed");
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
): Promise<AnalyticsOverview> {
  const response = await fetch(
    `${baseUrl}/api/v1/internal/analytics/overview?days=${days}`,
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
  const url = `${baseUrl}/api/v1/internal/base-values${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseApiResponse<ListBaseValueSetsResult>(
    response,
    "Base values list failed",
  );
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

export async function uploadBaseValueFile(
  token: string,
  file: File,
  replace: boolean = false,
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
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replace", replace.toString());

  const response = await fetch(
    `${baseUrl}/api/v1/internal/base-values/upload`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
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

export interface ListAuditLogsParams {
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export async function listAuditLogs(
  token: string,
  params?: ListAuditLogsParams,
): Promise<AuditLogItem[]> {
  const qs = new URLSearchParams();
  if (params?.eventType) qs.set("eventType", params.eventType);
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
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
  return body.items;
}

export type AnalyticsSummary = AnalyticsOverview;

export async function getAnalyticsSummary(
  token: string,
  days = 30,
): Promise<AnalyticsSummary> {
  return fetchAnalyticsOverview(token, days);
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
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
