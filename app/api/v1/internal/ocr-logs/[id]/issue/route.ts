import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const ISSUE_STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.configurations");

    const id = context?.params?.id;
    if (!id) {
      return ResponseHandler.error("BAD_REQUEST", "Missing OCR log ID", 400);
    }

    const body = await request.json().catch(() => null);
    const status = typeof body?.status === "string" ? body.status : undefined;

    if (!status || !ISSUE_STATUSES.has(status)) {
      return ResponseHandler.error(
        "BAD_REQUEST",
        "A valid issue status is required",
        400,
      );
    }

    const log = await prisma.ocrLog.findUnique({
      where: { id },
      select: { id: true, requestedAt: true },
    });

    if (!log) {
      return ResponseHandler.error("NOT_FOUND", "OCR log not found", 404);
    }

    const resolution =
      typeof body?.resolution === "string" && body.resolution.trim()
        ? body.resolution.trim()
        : null;
    const notes =
      typeof body?.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;
    const handled = status === "RESOLVED" || status === "DISMISSED";

    const updated = await prisma.ocrLog.update({
      where: { id },
      data: {
        issueStatus: status,
        issueResolution: resolution,
        issueNotes: notes,
        issueSubmittedAt: log.requestedAt,
        issueHandledAt: handled ? new Date() : null,
        issueHandledByUserId: handled ? auth.userId : null,
      },
      select: {
        id: true,
        issueStatus: true,
        issueResolution: true,
        issueNotes: true,
        issueSubmittedAt: true,
        issueHandledAt: true,
        issueHandledByUserId: true,
      },
    });

    return ResponseHandler.ok({
      ...updated,
      issueSubmittedAt: updated.issueSubmittedAt?.toISOString() ?? null,
      issueHandledAt: updated.issueHandledAt?.toISOString() ?? null,
    });
  },
);
