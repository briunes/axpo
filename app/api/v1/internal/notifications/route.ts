import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ForbiddenError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { NotificationService } from "@/application/services/notificationService";

const notificationActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["read", "dismiss"]),
});

const notificationSeveritySchema = z.enum(["INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"]);
const notificationStatusSchema = z.enum(["all", "unread", "read", "dismissed"]);

function cleanFilterValue(value: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "all") return undefined;
  return trimmed;
}

const assertSysAdmin = (role: UserRole) => {
  if (role !== UserRole.SYS_ADMIN) {
    throw new ForbiddenError("Notifications are currently restricted to Sys Admin users");
  }
};

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.SYS_ADMIN]);
  assertSysAdmin(auth.role);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const requestedStatus = notificationStatusSchema.safeParse(searchParams.get("status") ?? "all");
  const status = requestedStatus.success ? requestedStatus.data : "all";
  const includeDismissed = searchParams.get("includeDismissed") === "true" || status === "dismissed";
  const requestedSeverity = notificationSeveritySchema.safeParse(cleanFilterValue(searchParams.get("severity")));
  const severity = requestedSeverity.success ? requestedSeverity.data : undefined;
  const shouldSync =
    offset === 0 &&
    !includeDismissed &&
    (status === "all" || status === "unread") &&
    !severity &&
    !cleanFilterValue(searchParams.get("type")) &&
    !cleanFilterValue(searchParams.get("category")) &&
    !cleanFilterValue(searchParams.get("sourceType"));

  try {
    if (shouldSync) {
      await NotificationService.syncSysAdminNotifications();
    }

    const result = await NotificationService.listForUser({
      userId: auth.userId,
      role: auth.role,
      limit,
      offset,
      unreadOnly,
      includeDismissed,
      status,
      severity,
      type: cleanFilterValue(searchParams.get("type")),
      category: cleanFilterValue(searchParams.get("category")),
      sourceType: cleanFilterValue(searchParams.get("sourceType")),
    });

    return ResponseHandler.ok(result, 200);
  } catch (error) {
    if (NotificationService.isNotificationStoreUnavailable(error)) {
      return ResponseHandler.ok(NotificationService.unavailableResult(), 200);
    }
    throw error;
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.SYS_ADMIN]);
  assertSysAdmin(auth.role);

  try {
    await NotificationService.syncSysAdminNotifications({ force: true });
    const result = await NotificationService.listForUser({
      userId: auth.userId,
      role: auth.role,
      limit: 10,
    });

    return ResponseHandler.ok(result, 200);
  } catch (error) {
    if (NotificationService.isNotificationStoreUnavailable(error)) {
      return ResponseHandler.ok(NotificationService.unavailableResult(), 200);
    }
    throw error;
  }
});

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.SYS_ADMIN]);
  assertSysAdmin(auth.role);

  const parsed = notificationActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new ValidationError("Invalid notification action", {
      issues: parsed.error.issues,
    });
  }

  try {
    const result = await NotificationService.markForUser(
      auth.userId,
      auth.role,
      parsed.data.ids,
      parsed.data.action,
    );

    return ResponseHandler.ok(result, 200);
  } catch (error) {
    if (NotificationService.isNotificationStoreUnavailable(error)) {
      return ResponseHandler.ok({ updated: 0, unavailable: true }, 200);
    }
    throw error;
  }
});
