import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.simulation-issues");
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const page = Math.max(Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10), 1), 100);
  const reporter = request.nextUrl.searchParams.get("reporter")?.trim() || undefined;
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = request.nextUrl.searchParams.get("dateTo") || undefined;
  const where = {
    ...(status && { status: status as never }),
    ...(reporter && { reportedByUser: { OR: [
      { fullName: { contains: reporter, mode: "insensitive" as const } },
      { email: { contains: reporter, mode: "insensitive" as const } },
    ] } }),
    ...((dateFrom || dateTo) && { createdAt: {
      ...(dateFrom && { gte: new Date(`${dateFrom}T00:00:00.000Z`) }),
      ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
    }}),
  };
  const [items, total] = await Promise.all([prisma.simulationIssue.findMany({
    where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit,
    select: {
      id: true, simulationId: true, simulationReference: true, description: true, status: true,
      snapshotFileName: true, snapshotMimeType: true, snapshotFileSize: true,
      reportedByUserId: true, handledByUserId: true, statusChangedAt: true, createdAt: true, updatedAt: true,
      reportedByUser: { select: { id: true, fullName: true, email: true } },
      handledByUser: { select: { id: true, fullName: true } },
      attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true } },
    },
  }), prisma.simulationIssue.count({ where })]);
  return ResponseHandler.ok({
    items,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  });
});
