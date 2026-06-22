import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { invalidateAppVersionCache } from "@/application/lib/appVersionCache";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { buildLegacyAiProvider, getAiTaskConfigs, getConfiguredAiProviders } from "@/application/lib/aiConfig";

const redactAiProvider = (provider: Record<string, any>) => ({
  ...provider,
  apiKey: "",
  hasApiKey: Boolean(provider.apiKey),
});

const toPublicConfig = (config: Record<string, any>) => ({
  magicLinkEnabled: config.magicLinkEnabled,
  appVersion: config.appVersion,
  maintenanceMode: config.maintenanceMode,
  maintenanceUntil: config.maintenanceUntil,
  maintenanceMessage: config.maintenanceMessage,
});

const toRuntimeConfig = (config: Record<string, any>) => ({
  id: config.id,
  simulationExpirationDays: config.simulationExpirationDays,
  autoCreateClientOnSim: config.autoCreateClientOnSim,
  defaultMaxActiveDevices: config.defaultMaxActiveDevices,
  ivaRate: config.ivaRate,
  electricityTaxRate: config.electricityTaxRate,
  hydrocarbonTaxRate: config.hydrocarbonTaxRate,
  ivaRateOptions: config.ivaRateOptions,
  electricityTaxRateOptions: config.electricityTaxRateOptions,
  hydrocarbonTaxRateOptions: config.hydrocarbonTaxRateOptions,
  electricityTaxConfig: config.electricityTaxConfig,
  gasTaxConfig: config.gasTaxConfig,
  defaultDateFormat: config.defaultDateFormat,
  defaultItemsPerPage: config.defaultItemsPerPage,
  defaultLanguage: config.defaultLanguage,
  defaultNumberFormat: config.defaultNumberFormat,
  defaultTimeFormat: config.defaultTimeFormat,
  defaultTimezone: config.defaultTimezone,
  llmEnabled: config.llmEnabled,
  magicLinkEnabled: config.magicLinkEnabled,
  appVersion: config.appVersion,
  maintenanceMode: config.maintenanceMode,
  maintenanceUntil: config.maintenanceUntil,
  maintenanceMessage: config.maintenanceMessage,
  requestCacheConfig: config.requestCacheConfig,
});

const toAdminConfig = (config: Record<string, any>) => ({
  ...toRuntimeConfig(config),
  simulationShareText: config.simulationShareText,
  enablePixelTracking: config.enablePixelTracking,
  requirePinForAccess: config.requirePinForAccess,
  pinLength: config.pinLength,
  enableAnalyticsModule: config.enableAnalyticsModule,
  enableAuditLogsModule: config.enableAuditLogsModule,
  defaultDashboardView: config.defaultDashboardView,
  enableRealtimeReports: config.enableRealtimeReports,
  updatedAt: config.updatedAt,
  createdAt: config.createdAt,
  smtpFromEmail: config.smtpFromEmail,
  smtpFromName: config.smtpFromName,
  smtpHost: config.smtpHost,
  smtpPort: config.smtpPort,
  smtpSecure: config.smtpSecure,
  smtpUser: config.smtpUser,
  hasSmtpPassword: Boolean(config.smtpPassword),
  userCreationEmailTemplateId: config.userCreationEmailTemplateId,
  setupTokenValidityHours: config.setupTokenValidityHours,
  passwordResetEmailTemplateId: config.passwordResetEmailTemplateId,
  passwordResetTokenValidityHours: config.passwordResetTokenValidityHours,
  magicLinkEnabled: config.magicLinkEnabled,
  magicLinkEmailTemplateId: config.magicLinkEmailTemplateId,
  magicLinkTokenValidityMinutes: config.magicLinkTokenValidityMinutes,
  otpEnabled: config.otpEnabled,
  otpEmailTemplateId: config.otpEmailTemplateId,
  otpCodeValidityMinutes: config.otpCodeValidityMinutes,
  defaultPdfTemplateElectricityId: config.defaultPdfTemplateElectricityId,
  defaultPdfTemplateGasId: config.defaultPdfTemplateGasId,
  cronExpirationEnabled: config.cronExpirationEnabled,
  cronExpirationSchedule: config.cronExpirationSchedule,
  cronExpirationTimezone: config.cronExpirationTimezone,
  llmBaseUrl: config.llmBaseUrl,
  llmMaxTokens: config.llmMaxTokens,
  llmModelName: config.llmModelName,
  llmProvider: config.llmProvider,
  llmTemperature: config.llmTemperature,
  hasLlmApiKey: Boolean(config.llmApiKey),
  aiProviderConfigs: getConfiguredAiProviders(config).map((provider) =>
    redactAiProvider(provider as Record<string, any>),
  ),
  aiTaskConfigs: getAiTaskConfigs(config),
  ocrBillingEnabled: config.ocrBillingEnabled,
  ocrBillingCurrency: config.ocrBillingCurrency,
  ocrBillingUnitTokens: config.ocrBillingUnitTokens,
  ocrBillingMarkupPercent: config.ocrBillingMarkupPercent,
  ocrBillingFixedFeePerCall: config.ocrBillingFixedFeePerCall,
  ocrBillingIncludeFailedCalls: config.ocrBillingIncludeFailedCalls,
  requestCacheConfig: config.requestCacheConfig,
});

async function getOrCreateSystemConfig() {
  let config = await prisma.systemConfig.findFirst();

  if (!config) {
    config = await prisma.systemConfig.create({
      data: {
        simulationExpirationDays: 30,
        simulationShareText:
          "Your simulation is ready. Access it with PIN: {PIN}",
        enablePixelTracking: true,
        requirePinForAccess: true,
        pinLength: 4,
        autoCreateClientOnSim: false,
        enableAnalyticsModule: true,
        enableAuditLogsModule: true,
        defaultDashboardView: "COMMERCIAL",
        enableRealtimeReports: false,
        defaultMaxActiveDevices: 3,
      },
    });
  }

  return config;
}

/**
 * @swagger
 * /api/v1/internal/config/system:
 *   get:
 *     tags: [Configuration]
 *     summary: Get system configuration
 *     responses:
 *       200:
 *         description: System configuration
 */
const GET = withErrorHandler(async (req: NextRequest) => {
  const view = req.nextUrl.searchParams.get("view");
  const config = await getOrCreateSystemConfig();

  if (view === "admin") {
    const auth = await requireAuth(req);
    await assertPermission(auth, "section.configurations");
    return NextResponse.json(toAdminConfig(config));
  }

  if (view === "runtime") {
    await requireAuth(req);
    return NextResponse.json(toRuntimeConfig(config));
  }

  return NextResponse.json(toPublicConfig(config));
});

/**
 * @swagger
 * /api/v1/internal/config/system:
 *   put:
 *     tags: [Configuration]
 *     summary: Update system configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated configuration
 */
const PUT = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();
  const data = { ...body };
  let config = await prisma.systemConfig.findFirst();

  if (data.smtpPassword === "") {
    delete data.smtpPassword;
  }
  if (data.llmApiKey === "") {
    delete data.llmApiKey;
  }
  if (Array.isArray(data.aiProviderConfigs)) {
    const existingProviders = config
      ? getConfiguredAiProviders(config as Record<string, any>)
      : [buildLegacyAiProvider(data)];
    data.aiProviderConfigs = data.aiProviderConfigs.map((provider: Record<string, any>) => {
      const existing = existingProviders.find((item) => item.id === provider.id);
      if (provider.apiKey === "" || provider.apiKey === undefined) {
        const { apiKey: _apiKey, hasApiKey: _hasApiKey, ...safeProvider } = provider;
        return {
          ...safeProvider,
          ...(existing?.apiKey ? { apiKey: existing.apiKey } : {}),
        };
      }
      const { hasApiKey: _hasApiKey, ...safeProvider } = provider;
      return safeProvider;
    });
  }

  if (!config) {
    config = await prisma.systemConfig.create({ data });
  } else {
    config = await prisma.systemConfig.update({
      where: { id: config.id },
      data,
    });
  }

  // If appVersion changed, invalidate the in-memory cache so all subsequent
  // API responses immediately reflect the new version.
  if (body.appVersion !== undefined) {
    invalidateAppVersionCache();
  }

  return NextResponse.json(toAdminConfig(config));
});

export { GET, PUT };
