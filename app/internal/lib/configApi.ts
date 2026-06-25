// Configuration API client functions
import type { RequestCacheConfig } from "./requestCacheConfig";

// Helper to get auth token from localStorage
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("axpo.internal.auth.token");
}

// Helper to create auth headers
function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const RUNTIME_SYSTEM_CONFIG_TTL_MS = 60_000;
const runtimeSystemConfigCache = new Map<
  string,
  { expiresAt: number; promise: Promise<SystemConfig> }
>();

export interface SystemConfig {
  id: string;
  simulationExpirationDays: number;
  simulationShareText: string;
  enablePixelTracking: boolean;
  requirePinForAccess: boolean;
  pinLength: number;
  autoCreateClientOnSim: boolean;
  enableAnalyticsModule: boolean;
  enableAuditLogsModule: boolean;
  defaultDashboardView: string;
  enableRealtimeReports: boolean;
  ivaRate?: number;
  electricityTaxRate?: number;
  hydrocarbonTaxRate?: number;
  ivaRateOptions?: number[];
  electricityTaxRateOptions?: number[];
  hydrocarbonTaxRateOptions?: number[];
  electricityTaxConfig?: any;
  gasTaxConfig?: any;
  defaultDateFormat?: string;
  defaultTimeFormat?: string;
  defaultTimezone?: string;
  defaultNumberFormat?: string;
  defaultItemsPerPage?: number;
  defaultLanguage?: string;
  setupTokenValidityHours?: number;
  defaultPdfTemplateGasId?: string;
  defaultPdfTemplateElectricityId?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  hasSmtpPassword?: boolean;
  userCreationEmailTemplateId?: string;
  passwordResetEmailTemplateId?: string;
  magicLinkEnabled?: boolean;
  magicLinkEmailTemplateId?: string;
  magicLinkTokenValidityMinutes?: number;
  otpEnabled?: boolean;
  otpEmailTemplateId?: string;
  otpCodeValidityMinutes?: number;
  defaultMaxActiveDevices?: number;
  // LLM settings
  llmProvider?: string;
  llmApiKey?: string;
  llmModelName?: string;
  llmBaseUrl?: string;
  llmTemperature?: number;
  llmMaxTokens?: number;
  llmEnabled?: boolean;
  hasLlmApiKey?: boolean;
  aiProviderConfigs?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    provider: string;
    apiKey?: string;
    hasApiKey?: boolean;
    modelName: string;
    baseUrl: string;
    temperature?: number;
    maxTokens?: number;
  }>;
  aiTaskConfigs?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  appVersion: String;
  // Maintenance mode
  maintenanceMode?: boolean;
  maintenanceUntil?: string | null;
  maintenanceMessage?: string | null;
  // OCR billing settings
  ocrBillingEnabled?: boolean;
  ocrBillingCurrency?: string;
  ocrBillingUnitTokens?: number;
  ocrBillingMarkupPercent?: number;
  ocrBillingFixedFeePerCall?: number;
  ocrBillingIncludeFailedCalls?: boolean;
  requestCacheConfig?: RequestCacheConfig;
}

export interface PdfTemplateTranslationInput {
  languageCode: string;
  htmlContent: string;
}

export interface PdfTemplateTranslation extends PdfTemplateTranslationInput {
  id: string;
  pdfTemplateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PdfTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  commodity?: string | null; // ELECTRICITY, GAS - filters which simulations can use this template
  active: boolean;
  htmlContent: string;
  editableSections?: Record<
    string,
    {
      label: string;
      default: string;
      description?: string;
      multiline?: boolean;
      maxLength?: number;
      required?: boolean;
    }
  > | null;
  translations?: PdfTemplateTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateTranslationInput {
  languageCode: string;
  subject: string;
  htmlContent: string;
}

export interface EmailTemplateTranslation extends EmailTemplateTranslationInput {
  id: string;
  emailTemplateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  active: boolean;
  subject: string;
  htmlContent: string;
  editableSections?: Record<
    string,
    {
      label: string;
      default: string;
      description?: string;
      multiline?: boolean;
      maxLength?: number;
      required?: boolean;
    }
  > | null;
  translations?: EmailTemplateTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  description?: string;
  category: string;
  example?: string;
  sortOrder: number;
  active: boolean;
  /** Comma-separated template types this variable applies to (null = all types) */
  templateTypes?: string | null;
  /** Commodity this variable applies to: ELECTRICITY, GAS (null = all commodities) */
  commodity?: string | null;
  createdAt: string;
  updatedAt: string;
}

// SMTP Test
export interface SmtpTestResult {
  success: boolean;
  message: string;
  details?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
  };
}

export async function testSmtpConnection(): Promise<SmtpTestResult> {
  const res = await fetch("/api/v1/internal/config/smtp/test", {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to test SMTP connection" }));
    return {
      success: false,
      message: error.message || "Failed to test SMTP connection",
    };
  }
  return res.json();
}

export interface LlmTestResult {
  success: boolean;
  message: string;
  details?: {
    provider: string;
    model: string;
    baseUrl: string;
    [key: string]: any;
  };
}

export async function testLlmConnection(config: {
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  providerConfigId?: string;
}): Promise<LlmTestResult> {
  const res = await fetch("/api/v1/internal/config/llm/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to test LLM connection" }));
    return {
      success: false,
      message: error.message || "Failed to test LLM connection",
    };
  }
  return res.json();
}

// System Config
export async function getSystemConfig(options?: {
  view?: "runtime" | "admin";
}): Promise<SystemConfig> {
  const view = options?.view ?? "runtime";
  const query = `?view=${view}`;
  const fetchConfig = async () => {
    const res = await fetch(`/api/v1/internal/config/system${query}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch system config");
    return res.json();
  };

  if (view !== "runtime" || typeof window === "undefined") {
    return fetchConfig();
  }

  const token = getAuthToken();
  const key = `${view}:${token ? token.slice(-12) : "anonymous"}`;
  const now = Date.now();
  const cached = runtimeSystemConfigCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const entry = {
    expiresAt: now + RUNTIME_SYSTEM_CONFIG_TTL_MS,
    promise: fetchConfig(),
  };
  entry.promise.catch(() => {
    if (runtimeSystemConfigCache.get(key) === entry) {
      runtimeSystemConfigCache.delete(key);
    }
  });
  runtimeSystemConfigCache.set(key, entry);
  return entry.promise;
}

export async function updateSystemConfig(
  data: Partial<SystemConfig>,
): Promise<SystemConfig> {
  const res = await fetch("/api/v1/internal/config/system", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update system config");
  runtimeSystemConfigCache.clear();
  return res.json();
}

// PDF Templates
export async function getPdfTemplates(params?: {
  type?: string;
  active?: boolean;
  excludeType?: string;
}): Promise<PdfTemplate[]> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.set("type", params.type);
  if (params?.active !== undefined)
    queryParams.set("active", String(params.active));
  if (params?.excludeType) queryParams.set("excludeType", params.excludeType);

  const url = `/api/v1/internal/config/pdf-templates${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch PDF templates");
  return res.json();
}

export async function createPdfTemplate(
  data: Omit<PdfTemplate, "id" | "createdAt" | "updatedAt" | "translations"> & {
    translations?: PdfTemplateTranslationInput[];
  },
): Promise<PdfTemplate> {
  const res = await fetch("/api/v1/internal/config/pdf-templates", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create PDF template");
  return res.json();
}

export async function updatePdfTemplate(
  id: string,
  data: Partial<Omit<PdfTemplate, "translations">> & {
    translations?: PdfTemplateTranslationInput[];
  },
): Promise<PdfTemplate> {
  const res = await fetch(`/api/v1/internal/config/pdf-templates/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update PDF template");
  return res.json();
}

export async function deletePdfTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/v1/internal/config/pdf-templates/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete PDF template");
}

// Email Templates
export async function getEmailTemplates(params?: {
  type?: string | string[];
  active?: boolean;
  excludeType?: string;
}): Promise<EmailTemplate[]> {
  const queryParams = new URLSearchParams();
  if (params?.type) {
    const typeValue = Array.isArray(params.type)
      ? params.type.join(",")
      : params.type;
    queryParams.set("type", typeValue);
  }
  if (params?.active !== undefined)
    queryParams.set("active", String(params.active));
  if (params?.excludeType) queryParams.set("excludeType", params.excludeType);

  const url = `/api/v1/internal/config/email-templates${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch email templates");
  return res.json();
}

export async function createEmailTemplate(
  data: Omit<
    EmailTemplate,
    "id" | "createdAt" | "updatedAt" | "translations"
  > & { translations?: EmailTemplateTranslationInput[] },
): Promise<EmailTemplate> {
  const res = await fetch("/api/v1/internal/config/email-templates", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create email template");
  return res.json();
}

export async function updateEmailTemplate(
  id: string,
  data: Partial<Omit<EmailTemplate, "translations">> & {
    translations?: EmailTemplateTranslationInput[];
  },
): Promise<EmailTemplate> {
  const res = await fetch(`/api/v1/internal/config/email-templates/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update email template");
  return res.json();
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/v1/internal/config/email-templates/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete email template");
}

export interface SendTestEmailParams {
  recipientEmail: string;
  templateId: string;
  sampleVariables?: Record<string, string>;
}

export async function sendTestEmail(
  params: SendTestEmailParams,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/v1/internal/config/email-templates/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to send test email" }));
    throw new Error(error.message || "Failed to send test email");
  }
  return res.json();
}

// Template Variables
export async function getTemplateVariables(filters?: {
  commodity?: string;
  types?: string;
}): Promise<TemplateVariable[]> {
  const params = new URLSearchParams();
  if (filters?.commodity) params.set("commodity", filters.commodity);
  if (filters?.types) params.set("types", filters.types);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/v1/internal/config/template-variables${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch template variables");
  return res.json();
}

export async function createTemplateVariable(
  data: Omit<TemplateVariable, "id" | "createdAt" | "updatedAt">,
): Promise<TemplateVariable> {
  const res = await fetch("/api/v1/internal/config/template-variables", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template variable");
  return res.json();
}

export async function updateTemplateVariable(
  id: string,
  data: Partial<TemplateVariable>,
): Promise<TemplateVariable> {
  const res = await fetch(`/api/v1/internal/config/template-variables/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update template variable");
  return res.json();
}

export async function deleteTemplateVariable(id: string): Promise<void> {
  const res = await fetch(`/api/v1/internal/config/template-variables/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete template variable");
}
