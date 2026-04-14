import { prisma } from "@/infrastructure/database/prisma";
import { Prisma } from "@prisma/client";

interface AuditEventInput {
  actorUserId?: string;
  eventType: string;
  targetType: string;
  targetId: string;
  metadataJson?: Record<string, unknown>;
}

export class AuditService {
  static async logEvent(input: AuditEventInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        targetType: input.targetType,
        targetId: input.targetId,
        metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
