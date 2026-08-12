import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { AuthService } from "@/application/services/authService";
import { AuditService } from "@/application/services/auditService";
import { NotificationService } from "@/application/services/notificationService";
import { prisma } from "@/infrastructure/database/prisma";

export const POST = withErrorHandler(async (request: NextRequest, context) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.create");
  const id = context?.params?.id;
  if (!id) throw new NotFoundError("Access request");

  const accessRequest = await prisma.accessRequest.findFirst({
    where: {
      id,
      ...(auth.role === UserRole.SYS_ADMIN ? {} : { agencyId: auth.agencyId }),
    },
  });
  if (!accessRequest) throw new NotFoundError("Access request");
  if (accessRequest.status !== "PENDING") {
    throw new ValidationError("Only pending access requests can be approved");
  }

  const created = await AuthService.createUser({
    agencyId: accessRequest.agencyId,
    role: UserRole.COMMERCIAL,
    fullName: accessRequest.fullName,
    email: accessRequest.email,
    mobilePhone: accessRequest.phone,
    commercialPhone: accessRequest.phone,
    commercialEmail: accessRequest.email,
    otherDetails: accessRequest.comments || undefined,
    createdByUserId: auth.userId,
  });

  await prisma.accessRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByUserId: auth.userId,
      reviewNotes: null,
    },
  });
  await NotificationService.resolveAccessRequest(id).catch(() => undefined);
  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "ACCESS_REQUEST_APPROVED",
    targetType: "AccessRequest",
    targetId: id,
    metadataJson: { createdUserId: created.user.id, agencyId: accessRequest.agencyId },
  });

  return ResponseHandler.ok({ requestId: id, user: created.user }, 201);
});
