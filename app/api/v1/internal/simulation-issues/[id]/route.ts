import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { ForbiddenError, ValidationError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { NotificationService } from "@/application/services/notificationService";
import { SimulationIssueEmailService } from "@/application/services/simulationIssueEmailService";

const SIMULATION_ISSUE_STATUSES = ["NEW", "IN_REVIEW", "ESCALATED", "RESOLVED", "DISMISSED"] as const;
type SimulationIssueStatusValue = (typeof SIMULATION_ISSUE_STATUSES)[number];

function isSimulationIssueStatus(value: unknown): value is SimulationIssueStatusValue {
  return typeof value === "string" && SIMULATION_ISSUE_STATUSES.includes(value as SimulationIssueStatusValue);
}

const issueSelect = {
  id: true, incidentNumber: true, simulationId: true, simulationReference: true, description: true, status: true, appStatus: true,
  snapshotFileName: true, snapshotMimeType: true, snapshotFileSize: true,
  resolutionNotes: true, statusChangedAt: true, createdAt: true, updatedAt: true,
  reportedByUser: { select: { id: true, fullName: true, email: true } },
  handledByUser: { select: { id: true, fullName: true } },
  attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true, createdAt: true } },
  statusChanges: {
    orderBy: { createdAt: "desc" as const },
    select: { id: true, fromStatus: true, toStatus: true, fromAppStatus: true, toAppStatus: true, notes: true, createdAt: true, changedByUser: { select: { id: true, fullName: true } } },
  },
};

export const GET = withErrorHandler(async (request: NextRequest, context?: { params?: Record<string, string> }) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.simulation-issues");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Issue is required");
  const item = await prisma.simulationIssue.findUnique({ where: { id }, select: issueSelect });
  if (!item) throw new ValidationError("Issue not found");
  return ResponseHandler.ok(item);
});

export const PATCH = withErrorHandler(async (request: NextRequest, context?: { params?: Record<string, string> }) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.simulation-issues");
  const id = context?.params?.id;
  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" && "status" in body ? body.status : undefined;
  const notes = body && typeof body === "object" && "notes" in body && typeof body.notes === "string" ? body.notes.trim() : "";
  if (!id || !isSimulationIssueStatus(status)) throw new ValidationError("A valid status is required");
  const current = await prisma.simulationIssue.findUnique({ where: { id }, select: { status: true, appStatus: true } });
  if (!current) throw new ValidationError("Issue not found");
  const requestedAppStatus = body?.appStatus;
  if (requestedAppStatus !== undefined && (!isSimulationIssueStatus(requestedAppStatus) || requestedAppStatus === "ESCALATED")) {
    throw new ValidationError("A valid app administrator status is required");
  }
  if (current.status === "ESCALATED" && status !== "ESCALATED") {
    throw new ValidationError("Use the app administrator status to manage an escalated issue");
  }
  if (requestedAppStatus !== undefined && current.status !== "ESCALATED") {
    throw new ValidationError("Escalate the issue before changing its app administrator status");
  }
  if (requestedAppStatus !== undefined && auth.role !== UserRole.SYS_ADMIN) {
    throw new ForbiddenError("Only app administrators can change the escalated issue status");
  }
  const appStatus = status === "ESCALATED"
    ? (requestedAppStatus ?? current.appStatus ?? "NEW") as "NEW" | "IN_REVIEW" | "RESOLVED" | "DISMISSED"
    : null;
  const effectiveStatus = appStatus ?? status;
  if (["RESOLVED", "DISMISSED"].includes(effectiveStatus) && (current.appStatus ?? current.status) !== effectiveStatus && !notes) {
    throw new ValidationError("Resolution notes are required when resolving an issue");
  }
  if (status === "ESCALATED" && current.status !== "ESCALATED" && !notes) {
    throw new ValidationError("Escalation notes are required when escalating an issue to system administrators");
  }
  await prisma.simulationIssue.update({
    where: { id }, data: {
      status, appStatus, handledByUserId: auth.userId, statusChangedAt: new Date(),
      ...(["RESOLVED", "DISMISSED"].includes(effectiveStatus) && (current.appStatus ?? current.status) !== effectiveStatus && notes && { resolutionNotes: notes }),
    },
  });

  // Keep this as an explicit write. The Supabase API Prisma adapter supports
  // nested creates on create(), but intentionally strips them from update().
  if (current.status !== status || (current.appStatus ?? null) !== appStatus || notes) {
    await prisma.simulationIssueStatusChange.create({
      data: {
        issueId: id,
        fromStatus: current.status,
        toStatus: status,
        fromAppStatus: current.appStatus ?? null,
        toAppStatus: appStatus,
        changedByUserId: auth.userId,
        notes: notes || null,
      },
    });
  }

  const item = await prisma.simulationIssue.findUnique({ where: { id }, select: issueSelect });
  if (!item) throw new ValidationError("Issue not found after update");
  const transition = item.statusChanges.find((change) =>
    change.fromStatus !== change.toStatus || change.fromAppStatus !== change.toAppStatus
  );
  if (transition) {
    const finalStatus = transition.toAppStatus ?? transition.toStatus;
    const finalized = finalStatus === "RESOLVED" || finalStatus === "DISMISSED";
    const escalatedNow = transition.toStatus === "ESCALATED" && transition.fromStatus !== "ESCALATED";
    if (finalized && (current.status !== status || current.appStatus !== appStatus)) {
      await NotificationService.resolveSimulationIssue(id);
    }
    await SimulationIssueEmailService.notifyEvent({
      issueId: id, incidentNumber: item.incidentNumber, eventId: transition.id,
      kind: finalized ? "resolved" : escalatedNow ? "escalated" : "status",
      simulationReference: item.simulationReference, simulationId: item.simulationId,
      description: item.description, reporterId: item.reportedByUser.id,
      escalated: transition.toStatus === "ESCALATED", status: finalStatus,
      previousStatus: transition.fromAppStatus ?? transition.fromStatus,
      changedBy: transition.changedByUser.fullName, changedByUserId: transition.changedByUser.id,
      notes: transition.notes || "", resolutionNotes: finalized ? transition.notes || "" : "",
    });
  }
  return ResponseHandler.ok(item);
});
