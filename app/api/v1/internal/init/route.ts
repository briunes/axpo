import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import {
  ROLE_PERMISSION_DEFAULTS,
  type PermissionKey,
} from "../../../../internal/lib/permissionsDefinitions";
import { getCachedAppVersion } from "@/application/lib/appVersionCache";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  const [user, systemConfig, roleOverrides] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        isActive: true,
        maxActiveDevices: true,
        agency: {
          select: {
            id: true,
            name: true,
            isTlv: true,
            isActive: true,
          },
        },
        preferences: true,
      },
    }),
    prisma.systemConfig.findFirst({
      select: {
        appVersion: true,
        defaultLanguage: true,
        defaultDateFormat: true,
        defaultTimeFormat: true,
        defaultTimezone: true,
        defaultNumberFormat: true,
        defaultItemsPerPage: true,
        enableAnalyticsModule: true,
        enableAuditLogsModule: true,
        enableRealtimeReports: true,
        enablePixelTracking: true,
        maintenanceMode: true,
        maintenanceUntil: true,
        maintenanceMessage: true,
        requestCacheConfig: true,
        simulationExpirationDays: true,
        requirePinForAccess: true,
        pinLength: true,
        autoCreateClientOnSim: true,
        defaultPdfTemplateElectricityId: true,
        defaultPdfTemplateGasId: true,
      },
    }),
    prisma.rolePermission.findMany({
      where: { role: auth.role },
      select: { permissionKey: true, allowed: true },
    }),
  ]);

  const defaults = ROLE_PERMISSION_DEFAULTS[auth.role] ?? {};
  const permissions = { ...defaults } as Record<PermissionKey, boolean>;
  for (const override of roleOverrides) {
    permissions[override.permissionKey as PermissionKey] = override.allowed;
  }

  return ResponseHandler.ok(
    {
      user,
      permissions,
      system: {
        appVersion: systemConfig?.appVersion ?? getCachedAppVersion(),
        defaultLanguage: systemConfig?.defaultLanguage ?? "en",
        defaultDateFormat: systemConfig?.defaultDateFormat ?? "DD/MM/YYYY",
        defaultTimeFormat: systemConfig?.defaultTimeFormat ?? "24h",
        defaultTimezone: systemConfig?.defaultTimezone ?? "Europe/Madrid",
        defaultNumberFormat: systemConfig?.defaultNumberFormat ?? "eu",
        defaultItemsPerPage: systemConfig?.defaultItemsPerPage ?? 10,
        featureFlags: {
          analytics: systemConfig?.enableAnalyticsModule ?? true,
          auditLogs: systemConfig?.enableAuditLogsModule ?? true,
          realtimeReports: systemConfig?.enableRealtimeReports ?? false,
          pixelTracking: systemConfig?.enablePixelTracking ?? true,
        },
        maintenance: {
          enabled: systemConfig?.maintenanceMode ?? false,
          until: systemConfig?.maintenanceUntil ?? null,
          message: systemConfig?.maintenanceMessage ?? null,
        },
        simulationDefaults: {
          expirationDays: systemConfig?.simulationExpirationDays ?? 30,
          requirePinForAccess: systemConfig?.requirePinForAccess ?? true,
          pinLength: systemConfig?.pinLength ?? 4,
          autoCreateClientOnSim: systemConfig?.autoCreateClientOnSim ?? false,
          defaultPdfTemplateElectricityId:
            systemConfig?.defaultPdfTemplateElectricityId ?? null,
          defaultPdfTemplateGasId:
            systemConfig?.defaultPdfTemplateGasId ?? null,
        },
        requestCacheConfig: systemConfig?.requestCacheConfig ?? null,
      },
    },
    200,
  );
});
