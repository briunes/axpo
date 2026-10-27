import { UserRole } from "@/domain/types";
import { ForbiddenError, NotFoundError } from "@/domain/errors/errors";
import { hasPermission, isElevatedRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

type Actor = { userId: string; agencyId: string; role: UserRole };
type RecordKind = "clients" | "simulations";

/** Scope never permits access outside the actor's agency for non-admins. */
export async function recordScope(
  actor: Actor,
  kind: RecordKind,
): Promise<{ agencyId?: string; createdByUserId?: string; ownerUserId?: string }> {
  if (isElevatedRole(actor.role)) return {};
  const agencyId = actor.agencyId;
  const shared = await hasPermission(actor, `${kind}.view_agency`);
  return kind === "clients"
    ? { agencyId, ...(shared ? {} : { createdByUserId: actor.userId }) }
    : { agencyId, ...(shared ? {} : { ownerUserId: actor.userId }) };
}

export async function canAccessRecord(
  actor: Actor,
  kind: RecordKind,
  record: { agencyId: string; createdByUserId?: string | null; ownerUserId?: string },
) {
  if (isElevatedRole(actor.role)) return true;
  if (record.agencyId !== actor.agencyId) return false;
  const owner = kind === "clients" ? record.createdByUserId : record.ownerUserId;
  return owner === actor.userId || await hasPermission(actor, `${kind}.view_agency`);
}

export async function assertClientAccess(actor: Actor, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.isDeleted) throw new NotFoundError("Client", clientId);
  if (!(await canAccessRecord(actor, "clients", client))) {
    throw new ForbiddenError("Access denied");
  }
  return client;
}
