// Configuration API client functions

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
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  userCreationEmailTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PdfTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  active: boolean;
  htmlContent: string;
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

// System Config
export async function getSystemConfig(): Promise<SystemConfig> {
  const res = await fetch("/api/v1/internal/config/system", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch system config");
  return res.json();
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
  data: Omit<PdfTemplate, "id" | "createdAt" | "updatedAt">,
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
  data: Partial<PdfTemplate>,
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
  type?: string;
  active?: boolean;
  excludeType?: string;
}): Promise<EmailTemplate[]> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.set("type", params.type);
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
  data: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt">,
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
  data: Partial<EmailTemplate>,
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
export async function getTemplateVariables(): Promise<TemplateVariable[]> {
  const res = await fetch("/api/v1/internal/config/template-variables", {
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
