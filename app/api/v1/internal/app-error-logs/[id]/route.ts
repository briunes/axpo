import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const isMissingSoftDeleteColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("app_error_logs.isDeleted does not exist") ||
    (message.includes("PGRST204") && message.includes("isDeleted"))
  );
};

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
    await assertPermission(auth, "section.app-error-logs");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Application error log id is required");
    }

    try {
      const existing = await prisma.appErrorLog.findUnique({
        where: { id },
        select: { id: true, isDeleted: true },
      });
      if (!existing || existing.isDeleted) {
        throw new NotFoundError("AppErrorLog", id);
      }

      await prisma.appErrorLog.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      if (!isMissingSoftDeleteColumnError(error)) throw error;
      return ResponseHandler.error(
        "MIGRATION_REQUIRED",
        "App error deletion will be available after pending database migrations are applied",
        503,
      );
    }

    return ResponseHandler.ok({ id, deleted: true }, 200);
  },
);
