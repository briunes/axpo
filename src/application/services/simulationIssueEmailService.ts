import { InternalServerError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";
import { EmailService } from "./emailService";
import { resolveTrackingBaseUrl } from "./emailOpenTracking";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export class SimulationIssueEmailService {
  static async notifyEscalation(input: {
    issueId: string;
    escalationId: string;
    simulationReference: string | null;
    simulationId: string | null;
    escalatedBy: string;
    escalatedByUserId: string;
    notes: string;
  }): Promise<void> {
    const recipients = await prisma.user.findMany({
      where: { role: UserRole.SYS_ADMIN, isActive: true, isDeleted: false, deletedAt: null },
      select: { id: true, email: true },
    });
    const issueUrl = `${resolveTrackingBaseUrl()}/internal/simulations/issues/${encodeURIComponent(input.issueId)}`;
    const reference = input.simulationReference || input.issueId;
    const subject = `Simulation issue escalated: ${reference.replace(/[\r\n]/g, " ")}`;
    const text = `A simulation issue requires technical review.\n\nSimulation: ${reference}\nEscalated by: ${input.escalatedBy}\n\n${input.notes}\n\nOpen incident: ${issueUrl}`;
    const html = `<h2>Simulation issue escalated</h2><p>A simulation issue requires technical review.</p><p><strong>Simulation:</strong> ${escapeHtml(reference)}<br><strong>Escalated by:</strong> ${escapeHtml(input.escalatedBy)}</p><p style="white-space:pre-wrap">${escapeHtml(input.notes)}</p><p><a href="${escapeHtml(issueUrl)}">Open incident</a></p>`;
    const results = await Promise.allSettled(recipients.map((recipient) => EmailService.sendEmail({
      deliveryId: `simulation-issue-escalation:${input.escalationId}:${recipient.id}`,
      to: recipient.email,
      subject,
      html,
      text,
      triggeredBy: "simulation-issue-escalation",
      triggeredByUserId: input.escalatedByUserId,
      relatedUserId: recipient.id,
      relatedSimulationId: input.simulationId ?? undefined,
      variables: { ISSUE_ID: input.issueId, ESCALATION_ID: input.escalationId, ISSUE_URL: issueUrl },
    })));
    if (results.some((result) => result.status === "rejected")) {
      throw new InternalServerError("The issue was escalated, but some notification emails failed. Save again to retry failed deliveries; details are available in email logs.");
    }
  }
}
