import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { ValidationError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";

const SIMULATION_ISSUE_STATUSES = ["NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
type SimulationIssueStatusValue = (typeof SIMULATION_ISSUE_STATUSES)[number];

function isSimulationIssueStatus(value: unknown): value is SimulationIssueStatusValue {
  return typeof value === "string" && SIMULATION_ISSUE_STATUSES.includes(value as SimulationIssueStatusValue);
}

const issueSelect = {
  id: true, simulationId: true, simulationReference: true, description: true, status: true,
  snapshotFileName: true, snapshotMimeType: true, snapshotFileSize: true,
  resolutionNotes: true, statusChangedAt: true, createdAt: true, updatedAt: true,
  reportedByUser: { select: { id: true, fullName: true, email: true } },
  handledByUser: { select: { id: true, fullName: true } },
  attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true, createdAt: true } },
  statusChanges: {
    orderBy: { createdAt: "desc" as const },
    select: { id: true, fromStatus: true, toStatus: true, notes: true, createdAt: true, changedByUser: { select: { id: true, fullName: true } } },
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
  if (status === "RESOLVED" && !notes) throw new ValidationError("Resolution notes are required when resolving an issue");
  const current = await prisma.simulationIssue.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw new ValidationError("Issue not found");
  await prisma.simulationIssue.update({
    where: { id }, data: {
      status, handledByUserId: auth.userId, statusChangedAt: new Date(),
      ...(status === "RESOLVED" && { resolutionNotes: notes }),
    },
  });

  // Keep this as an explicit write. The Supabase API Prisma adapter supports
  // nested creates on create(), but intentionally strips them from update().
  if (current.status !== status || notes) {
    await prisma.simulationIssueStatusChange.create({
      data: {
        issueId: id,
        fromStatus: current.status,
        toStatus: status,
        changedByUserId: auth.userId,
        notes: notes || null,
      },
    });
  }

  const item = await prisma.simulationIssue.findUnique({ where: { id }, select: issueSelect });
  if (!item) throw new ValidationError("Issue not found after update");
  return ResponseHandler.ok(item);
});
