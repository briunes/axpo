import { Prisma } from "@prisma/client";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";

type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";

interface NotificationInput {
  type: string;
  category: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  audienceRole?: UserRole;
  audienceUserId?: string;
  sourceType?: string;
  sourceId?: string;
  dedupeKey: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date;
}

export interface NotificationListParams {
  userId: string;
  role: UserRole;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  includeDismissed?: boolean;
  status?: "all" | "unread" | "read" | "dismissed";
  severity?: NotificationSeverity;
  type?: string;
  category?: string;
  sourceType?: string;
}

const SYS_ADMIN_AUDIENCE = UserRole.SYS_ADMIN;
const DEFAULT_SYS_ADMIN_SYNC_TTL_MS = 60_000;

let sysAdminSyncLastSuccessAt = 0;
let sysAdminSyncInFlight: Promise<void> | null = null;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function upsertNotification(input: NotificationInput): Promise<void> {
  const createData: Prisma.NotificationUncheckedCreateInput = {
    type: input.type,
    category: input.category,
    severity: input.severity,
    title: input.title,
    body: input.body,
    audienceRole: input.audienceRole ?? SYS_ADMIN_AUDIENCE,
    audienceUserId: input.audienceUserId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    dedupeKey: input.dedupeKey,
    actionUrl: input.actionUrl,
    metadata: input.metadata,
    expiresAt: input.expiresAt,
    lastSeenAt: new Date(),
  };
  const updateData: Prisma.NotificationUncheckedUpdateInput = {
    type: input.type,
    category: input.category,
    severity: input.severity,
    title: input.title,
    body: input.body,
    audienceRole: input.audienceRole ?? SYS_ADMIN_AUDIENCE,
    audienceUserId: input.audienceUserId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    actionUrl: input.actionUrl,
    metadata: input.metadata,
    expiresAt: input.expiresAt,
    resolvedAt: null,
    lastSeenAt: new Date(),
  };

  await prisma.notification.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: createData,
    update: updateData,
  });
}

export class NotificationService {
  static isNotificationStoreUnavailable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("PGRST205") &&
      (message.includes("notifications") || message.includes("notification_reads"))
    ) || message.includes("Could not find the table 'public.notifications'");
  }

  static unavailableResult() {
    return {
      items: [],
      unreadCount: 0,
      totalCount: 0,
      unavailable: true,
    };
  }

  private static getSysAdminSyncTtlMs(): number {
    const value = Number(process.env.NOTIFICATION_SYNC_TTL_MS);
    if (!Number.isFinite(value) || value < 0) return DEFAULT_SYS_ADMIN_SYNC_TTL_MS;
    return Math.min(Math.round(value), 10 * 60_000);
  }

  static async syncSysAdminNotifications(options: { force?: boolean } = {}): Promise<void> {
    const now = Date.now();
    if (!options.force && now - sysAdminSyncLastSuccessAt < NotificationService.getSysAdminSyncTtlMs()) {
      return;
    }
    if (sysAdminSyncInFlight) {
      return sysAdminSyncInFlight;
    }

    const syncPromise = NotificationService.performSysAdminNotificationSync()
      .then(() => {
        sysAdminSyncLastSuccessAt = Date.now();
      })
      .finally(() => {
        if (sysAdminSyncInFlight === syncPromise) {
          sysAdminSyncInFlight = null;
        }
      });
    sysAdminSyncInFlight = syncPromise;
    return syncPromise;
  }

  private static async performSysAdminNotificationSync(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      appErrorCount,
      latestAppError,
      failedCronJobs,
      failedEmailCount,
      failedOcrCount,
      openOcrIssueCount,
      providerPromptsNeedingConfig,
      systemConfig,
    ] = await Promise.all([
      prisma.appErrorLog.count({
        where: {
          isDeleted: false,
          createdAt: { gte: since },
          OR: [{ statusCode: { gte: 500 } }, { statusCode: null }],
        },
      }),
      prisma.appErrorLog.findFirst({
        where: {
          isDeleted: false,
          createdAt: { gte: since },
          OR: [{ statusCode: { gte: 500 } }, { statusCode: null }],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, message: true, path: true, statusCode: true },
      }),
      prisma.cronLog.findMany({
        where: { status: { in: ["FAILED", "ERROR", "failed", "error"] } },
        orderBy: { executedAt: "desc" },
        take: 5,
        select: {
          id: true,
          jobName: true,
          status: true,
          errorMessage: true,
          executedAt: true,
        },
      }),
      prisma.emailLog.count({
        where: {
          sentAt: { gte: since },
          status: { notIn: ["sent", "SENT", "success", "SUCCESS"] },
        },
      }),
      prisma.ocrLog.count({
        where: {
          requestedAt: { gte: since },
          status: { in: ["FAILED", "ERROR", "PARSE_ERROR"] },
        },
      }),
      prisma.ocrLog.count({
        where: { issueStatus: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.invoiceProviderPrompt.count({
        where: { isActive: true, needsPromptConfig: true },
      }),
      prisma.systemConfig.findFirst({
        select: {
          maintenanceMode: true,
          maintenanceUntil: true,
          maintenanceMessage: true,
        },
      }),
    ]);

    const notifications: NotificationInput[] = [];

    if (appErrorCount > 0 && latestAppError) {
      notifications.push({
        type: "app_errors.recent_5xx",
        category: "system_health",
        severity: appErrorCount >= 10 ? "CRITICAL" : "ERROR",
        title: `${appErrorCount} application error${appErrorCount === 1 ? "" : "s"} in the last 24h`,
        body: latestAppError.message,
        sourceType: "app_error_logs",
        sourceId: latestAppError.id,
        dedupeKey: "sys_admin:app_errors:recent_5xx:24h",
        actionUrl: "/internal/logs?tab=app-errors",
        metadata: {
          count: appErrorCount,
          latestPath: latestAppError.path,
          latestStatusCode: latestAppError.statusCode,
        },
      });
    }

    for (const job of failedCronJobs) {
      notifications.push({
        type: "cron.failed",
        category: "automation",
        severity: "ERROR",
        title: `Cron job failed: ${job.jobName}`,
        body: job.errorMessage ?? `Last status: ${job.status}`,
        sourceType: "cron_logs",
        sourceId: job.id,
        dedupeKey: `sys_admin:cron.failed:${job.id}`,
        actionUrl: "/internal/logs?tab=cron",
        metadata: { executedAt: toIsoString(job.executedAt), status: job.status },
      });
    }

    if (failedEmailCount > 0) {
      notifications.push({
        type: "email.failed_recent",
        category: "communications",
        severity: failedEmailCount >= 5 ? "ERROR" : "WARNING",
        title: `${failedEmailCount} email delivery issue${failedEmailCount === 1 ? "" : "s"} in the last 24h`,
        body: "Review SMTP delivery logs for failed or rejected emails.",
        sourceType: "email_logs",
        dedupeKey: "sys_admin:email.failed_recent:24h",
        actionUrl: "/internal/email-logs",
        metadata: { count: failedEmailCount },
      });
    }

    if (failedOcrCount > 0) {
      notifications.push({
        type: "ocr.failed_recent",
        category: "integrations",
        severity: failedOcrCount >= 5 ? "ERROR" : "WARNING",
        title: `${failedOcrCount} OCR failure${failedOcrCount === 1 ? "" : "s"} in the last 24h`,
        body: "Check provider health, prompt quality, and recent uploaded invoices.",
        sourceType: "ocr_logs",
        dedupeKey: "sys_admin:ocr.failed_recent:24h",
        actionUrl: "/internal/logs?tab=ocr",
        metadata: { count: failedOcrCount },
      });
    }

    if (openOcrIssueCount > 0) {
      notifications.push({
        type: "ocr.issues_open",
        category: "operations",
        severity: "WARNING",
        title: `${openOcrIssueCount} OCR issue${openOcrIssueCount === 1 ? "" : "s"} awaiting review`,
        body: "User-reported extraction issues are still open or in progress.",
        sourceType: "ocr_logs",
        dedupeKey: "sys_admin:ocr.issues_open",
        actionUrl: "/internal/logs?tab=ocr",
        metadata: { count: openOcrIssueCount },
      });
    }

    if (providerPromptsNeedingConfig > 0) {
      notifications.push({
        type: "invoice_provider.prompt_config_needed",
        category: "configuration",
        severity: "INFO",
        title: `${providerPromptsNeedingConfig} provider prompt${providerPromptsNeedingConfig === 1 ? "" : "s"} need configuration`,
        body: "Auto-detected invoice providers need prompt review before they are reliable.",
        sourceType: "invoice_provider_prompts",
        dedupeKey: "sys_admin:invoice_provider.prompt_config_needed",
        actionUrl: "/internal/configurations?tab=integrations",
        metadata: { count: providerPromptsNeedingConfig },
      });
    }

    if (systemConfig?.maintenanceMode) {
      notifications.push({
        type: "system.maintenance_active",
        category: "system_health",
        severity: "WARNING",
        title: "Maintenance mode is active",
        body: systemConfig.maintenanceMessage ?? "The internal portal is currently in maintenance mode.",
        sourceType: "system_config",
        dedupeKey: "sys_admin:system.maintenance_active",
        actionUrl: "/internal/configurations?tab=system-business",
        metadata: {
          maintenanceUntil: systemConfig.maintenanceUntil ? toIsoString(systemConfig.maintenanceUntil) : null,
        },
      });
    }

    await Promise.all(notifications.map((item) => upsertNotification(item)));
  }

  static async listForUser(params: NotificationListParams) {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const status = params.status ?? (params.unreadOnly ? "unread" : "all");
    const audienceWhere: Prisma.NotificationWhereInput[] =
      params.role === UserRole.SYS_ADMIN
        ? [{ audienceRole: UserRole.SYS_ADMIN }, { audienceUserId: params.userId }]
        : [{ audienceUserId: params.userId }];

    const where: Prisma.NotificationWhereInput = {
      resolvedAt: null,
      OR: audienceWhere,
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.sourceType ? { sourceType: params.sourceType } : {}),
    };

    const rawItems = await prisma.notification.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      include: {
        reads: {
          where: { userId: params.userId },
          select: { readAt: true, dismissedAt: true },
        },
      },
    });

    const unreadCount = rawItems.filter((item) => {
      const readState = item.reads[0];
      return !readState?.readAt && !readState?.dismissedAt;
    }).length;
    const visibleItems = rawItems.filter((item) => {
      const readState = item.reads[0];
      const isRead = Boolean(readState?.readAt);
      const isDismissed = Boolean(readState?.dismissedAt);
      if (status === "unread" && (isRead || isDismissed)) return false;
      if (status === "read" && (!isRead || isDismissed)) return false;
      if (status === "dismissed" && !isDismissed) return false;
      if (!params.includeDismissed && status !== "dismissed" && isDismissed) return false;
      return true;
    });
    const totalCount = visibleItems.length;
    const items = visibleItems.slice(offset, offset + limit);

    return {
      items: items.map((item) => {
        const readState = item.reads[0];
        return {
          id: item.id,
          type: item.type,
          category: item.category,
          severity: item.severity,
          title: item.title,
          body: item.body,
          actionUrl: item.actionUrl,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          metadata: item.metadata,
          firstSeenAt: toIsoString(item.firstSeenAt),
          lastSeenAt: toIsoString(item.lastSeenAt),
          readAt: readState?.readAt ? toIsoString(readState.readAt) : null,
          dismissedAt: readState?.dismissedAt ? toIsoString(readState.dismissedAt) : null,
        };
      }),
      unreadCount,
      totalCount,
    };
  }

  static async markForUser(
    userId: string,
    role: UserRole,
    ids: string[],
    action: "read" | "dismiss",
  ) {
    const now = new Date();
    const uniqueIds = Array.from(new Set(ids));

    const audienceWhere: Prisma.NotificationWhereInput[] =
      role === UserRole.SYS_ADMIN
        ? [{ audienceRole: UserRole.SYS_ADMIN }, { audienceUserId: userId }]
        : [{ audienceUserId: userId }];

    const markableNotifications = await prisma.notification.findMany({
      where: {
        id: { in: uniqueIds },
        OR: audienceWhere,
      },
      select: { id: true },
    });
    const markableIds = markableNotifications.map((item) => item.id);

    const results = await Promise.allSettled(
      markableIds.map((notificationId) =>
        prisma.notificationRead.upsert({
          where: { notificationId_userId: { notificationId, userId } },
          create: {
            notificationId,
            userId,
            readAt: now,
            dismissedAt: action === "dismiss" ? now : null,
          },
          update: {
            readAt: now,
            ...(action === "dismiss" ? { dismissedAt: now } : {}),
          },
        }),
      ),
    );

    const failed = results.find((result) => {
      if (result.status === "fulfilled") return false;
      return !NotificationService.isNotificationReadRace(result.reason);
    });
    if (failed?.status === "rejected") throw failed.reason;

    return {
      updated: results.filter((result) => result.status === "fulfilled").length,
      skipped: uniqueIds.length - markableIds.length,
    };
  }

  private static isNotificationReadRace(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("notification_reads_notificationId_fkey") ||
      message.includes("Key (notificationId)") ||
      message.includes("is not present in table \"notifications\"")
    );
  }
}
