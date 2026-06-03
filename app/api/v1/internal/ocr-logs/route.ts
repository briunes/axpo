import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

function hasJsonValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

function getIssueStatus(log: {
  issueStatus: string | null;
  reportedIssue: string | null;
  userCorrections: unknown;
}): string | null {
  const hasIssueSignal = Boolean(log.reportedIssue) || hasJsonValue(log.userCorrections);
  if (!hasIssueSignal) return log.issueStatus;
  return log.issueStatus ?? "OPEN";
}

/**
 * @swagger
 * /api/v1/internal/ocr-logs:
 *   get:
 *     tags: [Invoices]
 *     summary: List OCR invoice extraction logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: provider
 *         schema: { type: string }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.configurations");

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
  const skip = (page - 1) * limit;
  const statusFilter = searchParams.get("status") || undefined;
  const providerFilter = searchParams.get("provider") || undefined;
  const typeFilter = searchParams.get("type") || undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const userSearch = searchParams.get("userSearch") || undefined;
  const issueStatus = searchParams.get("issueStatus") || undefined;

  const where: any = {};
  if (statusFilter) where.status = statusFilter;
  if (providerFilter) where.provider = providerFilter;
  if (typeFilter) where.type = typeFilter;
  if (dateFrom || dateTo) {
    where.requestedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
    };
  }
  if (userSearch) {
    where.OR = [
      { user: { fullName: { contains: userSearch, mode: "insensitive" } } },
      { user: { email: { contains: userSearch, mode: "insensitive" } } },
      { userEmail: { contains: userSearch, mode: "insensitive" } },
    ];
  }
  if (issueStatus) {
    const issueSignalWhere = {
      OR: [{ reportedIssue: { not: null } }, { userCorrections: { not: null } }],
    };
    if (issueStatus === "ANY") {
      where.AND = [...(where.AND ?? []), issueSignalWhere];
    } else if (issueStatus === "OPEN") {
      where.AND = [
        ...(where.AND ?? []),
        issueSignalWhere,
        { OR: [{ issueStatus: "OPEN" }, { issueStatus: null }] },
      ];
    } else {
      where.issueStatus = issueStatus;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.ocrLog.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip,
      take: limit,
      include: {
        simulation: {
          select: { id: true, referenceNumber: true },
        },
        ocrFiles: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSizeBytes: true,
          },
        },
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    }),
    prisma.ocrLog.count({ where }),
  ]);

  return ResponseHandler.ok(
    {
      items: logs.map((l) => ({
        id: l.id,
        requestedAt: l.requestedAt.toISOString(),
        userId: l.userId,
        userEmail: l.user?.email ?? l.userEmail,
        userName: l.user?.fullName,
        type: l.type,
        provider: l.provider,
        model: l.model,
        baseUrl: l.baseUrl,
        fileName: l.fileName,
        fileType: l.fileType,
        fileSizeBytes: l.fileSizeBytes,
        pageCount: l.pageCount,
        status: l.status,
        durationMs: l.durationMs,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        extractedFields: l.extractedFields,
        fieldsExtracted: l.fieldsExtracted,
        userCorrections: l.userCorrections ?? null,
        errorMessage: l.errorMessage,
        errorType: l.errorType,
        httpStatusCode: l.httpStatusCode,
        rawResponseSnippet: l.rawResponseSnippet,
        promptText: l.promptText,
        metadata: l.metadata,
        simulationId: l.simulationId,
        simulationReferenceNumber: l.simulation?.referenceNumber ?? null,
        reportedIssue: l.reportedIssue ?? null,
        issueStatus: getIssueStatus(l),
        issueResolution: l.issueResolution ?? null,
        issueNotes: l.issueNotes ?? null,
        issueSubmittedAt: (l.issueSubmittedAt ?? l.requestedAt)?.toISOString(),
        issueHandledAt: l.issueHandledAt?.toISOString() ?? null,
        issueHandledByUserId: l.issueHandledByUserId ?? null,
        issueSignalCount:
          (l.reportedIssue ? 1 : 0) +
          (hasJsonValue(l.userCorrections)
            ? Object.keys(l.userCorrections as Record<string, unknown>).length
            : 0),
        files: l.ocrFiles,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    200,
  );
});
