import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const ALLOWED_SORT_FIELDS = new Set(["createdAt", "fullName", "email", "status", "reviewedAt"]);

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.view");

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") || "25", 10)));
  const search = sp.get("search")?.trim();
  const status = sp.get("status")?.trim();
  const agencyId = sp.get("agencyId")?.trim();
  const requestedSort = sp.get("orderBy") || "createdAt";
  const orderBy = ALLOWED_SORT_FIELDS.has(requestedSort) ? requestedSort : "createdAt";
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";

  const where = {
    ...(auth.role === UserRole.SYS_ADMIN
      ? agencyId ? { agencyId } : {}
      : { agencyId: auth.agencyId }),
    ...(status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
      ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { agency: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.accessRequest.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        comments: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewNotes: true,
        notificationSentAt: true,
        applicantNotificationSentAt: true,
        agency: { select: { id: true, name: true } },
        kamUser: { select: { id: true, fullName: true } },
        reviewedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { [orderBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accessRequest.count({ where }),
  ]);

  return ResponseHandler.ok({ items, total, page, pageSize });
});
