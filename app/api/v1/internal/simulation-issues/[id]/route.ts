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

export const PATCH = withErrorHandler(async (request: NextRequest, context?: { params?: Record<string, string> }) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.simulation-issues");
  const id = context?.params?.id;
  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" && "status" in body ? body.status : undefined;
  if (!id || !isSimulationIssueStatus(status)) throw new ValidationError("A valid status is required");
  const current = await prisma.simulationIssue.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw new ValidationError("Issue not found");
  const item = await prisma.simulationIssue.update({
    where: { id }, data: {
      status, handledByUserId: auth.userId, statusChangedAt: new Date(),
      ...(current.status !== status && { statusChanges: { create: { fromStatus: current.status, toStatus: status, changedByUserId: auth.userId } } }),
    },
    include: { handledByUser: { select: { id: true, fullName: true } } },
  });
  return ResponseHandler.ok(item);
});
