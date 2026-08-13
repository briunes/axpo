import { NextRequest } from "next/server";
import { z } from "zod";
import { ResponseHandler } from "@/application/middleware/response";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import {
  applyRateLimitShared,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";
import { ValidationError } from "@/domain/errors/errors";
import { ForbiddenError } from "@/domain/errors/errors";
import { EmailService } from "@/application/services/emailService";
import { NotificationService } from "@/application/services/notificationService";
import { prisma } from "@/infrastructure/database/prisma";

const accessRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/),
  agencyId: z.string().trim().min(1).max(64),
  kamUserId: z.string().trim().min(1).max(64),
  comments: z.string().trim().max(2000).optional(),
  languageCode: z.enum(["en", "es", "fr", "pt"]).default("en"),
  website: z.string().max(200).optional(),
});

const acceptedResponse = () =>
  ResponseHandler.ok(
    { message: "Access request received and pending review" },
    202,
  );

async function assertAccessRequestsEnabled() {
  const config = await (prisma as any).systemConfig?.findFirst({ select: { accessRequestsEnabled: true } });
  if (config?.accessRequestsEnabled === false) {
    throw new ForbiddenError("Access requests are currently disabled");
  }
}

export const GET = withErrorHandler(async () => {
  await assertAccessRequestsEnabled();
  const [agencies, accountManagers] = await Promise.all([
    prisma.agency.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, isDeleted: false },
      select: { id: true, fullName: true, agencyId: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return ResponseHandler.ok({
    agencies: agencies.map(({ id, name }) => ({ id, name })),
    accountManagers: accountManagers.map(({ id, fullName, agencyId }) => ({
      id,
      name: fullName,
      agencyId,
    })),
  });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  await assertAccessRequestsEnabled();
  const { ipAddress } = getRequestSessionContext(request);
  await applyRateLimitShared(
    getClientRateLimitKey(ipAddress, "access-request"),
    { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  );

  const payload = accessRequestSchema.parse(await request.json());

  // Honeypot field: acknowledge bots without persisting or sending email.
  if (payload.website) return acceptedResponse();

  const normalizedEmail = payload.email.toLowerCase();
  const [agency, kamUser, existingUser, existingPendingRequest] =
    await Promise.all([
      prisma.agency.findFirst({
        where: { id: payload.agencyId, isActive: true, isDeleted: false },
        select: { id: true, name: true },
      }),
      prisma.user.findFirst({
        where: {
          id: payload.kamUserId,
          agencyId: payload.agencyId,
          role: "ADMIN",
          isActive: true,
          isDeleted: false,
        },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true },
      }),
      prisma.accessRequest.findFirst({
        where: { email: normalizedEmail, status: "PENDING" },
        select: { id: true },
      }),
    ]);

  if (!agency || !kamUser) {
    throw new ValidationError("The selected agency or KAM is not available");
  }

  // Do not reveal whether an account or pending request already exists.
  if (existingUser || existingPendingRequest) return acceptedResponse();

  const created = await prisma.accessRequest.create({
    data: {
      fullName: payload.fullName,
      email: normalizedEmail,
      phone: payload.phone,
      agencyId: agency.id,
      kamUserId: kamUser.id,
      comments: payload.comments || null,
      languageCode: payload.languageCode,
    },
    select: { id: true },
  });

  // In-app delivery is best-effort: the stored request must remain actionable
  // even if the notification store is temporarily unavailable.
  await NotificationService.notifyAccessRequestReceived({
    requestId: created.id,
    kamUserId: kamUser.id,
    applicantName: payload.fullName,
    agencyName: agency.name,
  }).catch(() => undefined);

  try {
    const sent = await EmailService.sendAccessRequestNotification({
      recipientEmail: kamUser.email,
      kamName: kamUser.fullName,
      requestId: created.id,
      applicantName: payload.fullName,
      applicantEmail: normalizedEmail,
      applicantPhone: payload.phone,
      agencyName: agency.name,
      comments: payload.comments,
    });
    if (sent) {
      await prisma.accessRequest.update({
        where: { id: created.id },
        data: { notificationSentAt: new Date(), notificationError: null },
      });
    }
  } catch (error) {
    // The request remains available for review even if SMTP is unavailable.
    await prisma.accessRequest.update({
      where: { id: created.id },
      data: {
        notificationError: (error instanceof Error
          ? error.message
          : "Unknown notification error").slice(0, 1000),
      },
    });
  }

  try {
    const sent = await EmailService.sendAccessRequestApplicantConfirmation({
      recipientEmail: normalizedEmail,
      languageCode: payload.languageCode,
      requestId: created.id,
      applicantName: payload.fullName,
      applicantPhone: payload.phone,
      agencyName: agency.name,
      kamName: kamUser.fullName,
    });
    if (sent) {
      await prisma.accessRequest.update({
        where: { id: created.id },
        data: {
          applicantNotificationSentAt: new Date(),
          applicantNotificationError: null,
        },
      });
    }
  } catch (error) {
    await prisma.accessRequest.update({
      where: { id: created.id },
      data: {
        applicantNotificationError: (error instanceof Error
          ? error.message
          : "Unknown applicant notification error").slice(0, 1000),
      },
    });
  }

  return acceptedResponse();
});
