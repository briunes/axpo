import { InternalServerError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";
import { EmailService } from "./emailService";
import { NotificationService } from "./notificationService";
import { resolveTrackingBaseUrl } from "./emailOpenTracking";
import { incidentNotificationLanguage } from "@/lib/incidentNotificationLanguage";
import { INCIDENT_EMAILS } from "@/lib/incidentEmails";

export interface IncidentEvent {
  issueId: string;
  incidentNumber: number;
  eventId: string;
  kind: "created" | "escalated" | "status" | "resolved";
  simulationReference: string | null;
  simulationId: string | null;
  description: string;
  reporterId: string;
  escalated: boolean;
  status: string;
  previousStatus: string;
  changedBy: string;
  changedByUserId: string;
  notes: string;
  resolutionNotes: string;
}

export class SimulationIssueEmailService {
  // One event ID per persisted transition; retrying never re-sends successful emails.
  static async notifyEvent(input: IncidentEvent): Promise<void> {
    const config = await prisma.systemConfig.findFirst();
    const recipientIds = config?.incidentRecipientIds ?? [];
    const recipients = await prisma.user.findMany({
      where: { isActive: true, isDeleted: false, deletedAt: null, OR: [
        { id: { in: recipientIds }, role: { in: input.escalated ? [UserRole.ADMIN, UserRole.SYS_ADMIN] : [UserRole.ADMIN] } },
        ...(input.kind === "created" ? [] : [{ id: input.reporterId }]),
      ] },
      select: { id: true, email: true, fullName: true, role: true, preferences: { select: { language: true } } },
    });
    const template = INCIDENT_EMAILS.find((event) => event.type === `incident-${input.kind}`)!;
    const templateId = config?.[template.field];
    const results = await Promise.allSettled(recipients.flatMap((recipient) => {
      const language = incidentNotificationLanguage(recipient.preferences?.language, config?.defaultLanguage);
      const title = `${language.title(input.kind)} #${input.incidentNumber}`;
      const status = language.status(input.status);
      const previousStatus = language.status(input.previousStatus);
      const canManage = config?.simulationIssuesEnabled !== false && recipientIds.includes(recipient.id) &&
        (recipient.role === UserRole.ADMIN || recipient.role === UserRole.SYS_ADMIN);
      // Reporters receive the update in their inbox; management pages remain restricted.
      const actionUrl = canManage ? `/internal/simulations/issues/${encodeURIComponent(input.issueId)}` : "/internal/notifications";
      const variables = {
        ISSUE_ID: input.issueId, INCIDENT_NUMBER: String(input.incidentNumber),
        SIMULATION_REFERENCE: input.simulationReference || "—", DESCRIPTION: input.description,
        STATUS: status, PREVIOUS_STATUS: previousStatus, NOTES: input.notes,
        RESOLUTION_NOTES: input.resolutionNotes, CHANGED_BY: input.changedBy,
        RECIPIENT_NAME: recipient.fullName, ISSUE_URL: canManage ? `${resolveTrackingBaseUrl()}${actionUrl}` : "",
      };
      return [
        NotificationService.notifyIncidentEvent({
          eventId: input.eventId, issueId: input.issueId, kind: input.kind,
          recipientId: recipient.id, recipientRole: recipient.role as UserRole,
          title, body: `${previousStatus ? `${previousStatus} → ` : ""}${status}\n${input.resolutionNotes || input.notes || input.description}`,
          actionUrl,
        }),
        ...(templateId ? [EmailService.sendTemplateEmail({
          deliveryId: `incident:${input.eventId}:${recipient.id}`,
          templateId, to: recipient.email, variables, escapeHtmlVariables: true,
          omitLinksForVariables: canManage ? [] : ["ISSUE_URL"],
          requiredHtmlVariables: input.kind === "resolved" ? ["RESOLUTION_NOTES"] : [],
          languageCode: language.languageCode,
          triggeredBy: `incident-${input.kind}`, triggeredByUserId: input.changedByUserId,
          relatedUserId: recipient.id, relatedSimulationId: input.simulationId ?? undefined,
        })] : []),
      ];
    }));
    if (results.some((result) => result.status === "rejected")) {
      throw new InternalServerError("The incident was saved, but some notifications failed. Save again to retry failed deliveries; details are available in email logs.");
    }
  }
}
