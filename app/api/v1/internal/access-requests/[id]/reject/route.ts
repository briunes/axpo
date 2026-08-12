import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { AuditService } from "@/application/services/auditService";
import { NotificationService } from "@/application/services/notificationService";
import { prisma } from "@/infrastructure/database/prisma";

const rejectSchema = z.object({ notes: z.string().trim().max(2000).optional() });

export const POST = withErrorHandler(async (request: NextRequest, context) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.edit");
  const id = context?.params?.id;
  if (!id) throw new NotFoundError("Access request");
  const payload = rejectSchema.parse(await request.json().catch(() => ({})));

  const accessRequest = await prisma.accessRequest.findFirst({
    where: {
      id,
      ...(auth.role === UserRole.SYS_ADMIN ? {} : { agencyId: auth.agencyId }),
    },
    select: { id: true, status: true, agencyId: true },
  });
  if (!accessRequest) throw new NotFoundError("Access request");
  if (accessRequest.status !== "PENDING") {
    throw new ValidationError("Only pending access requests can be rejected");
  }

  await prisma.accessRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByUserId: auth.userId,
      reviewNotes: payload.notes || null,
    },
  });
  await NotificationService.resolveAccessRequest(id).catch(() => undefined);
  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "ACCESS_REQUEST_REJECTED",
    targetType: "AccessRequest",
    targetId: id,
    metadataJson: { agencyId: accessRequest.agencyId, notes: payload.notes || null },
  });

  return ResponseHandler.ok({ requestId: id, status: "REJECTED" });
});
