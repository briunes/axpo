const findManyMock = jest.fn();
const configMock = jest.fn();
const sendTemplateMock = jest.fn();
const notificationMock = jest.fn();
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  user: { findMany: (...args: unknown[]) => findManyMock(...args) },
  systemConfig: { findFirst: (...args: unknown[]) => configMock(...args) },
} }));
jest.mock("../emailService", () => ({ EmailService: { sendTemplateEmail: (...args: unknown[]) => sendTemplateMock(...args) } }));
jest.mock("../notificationService", () => ({ NotificationService: { notifyIncidentEvent: (...args: unknown[]) => notificationMock(...args) } }));
jest.mock("../emailOpenTracking", () => ({ resolveTrackingBaseUrl: () => "https://simulator.example.com" }));
import { SimulationIssueEmailService, IncidentEvent } from "../simulationIssueEmailService";

const input: IncidentEvent = { issueId: "issue-1", incidentNumber: 42, eventId: "event-1", kind: "escalated", simulationReference: "001/2026", simulationId: "sim-1", description: "Broken", reporterId: "reporter-1", escalated: true, status: "NEW", previousStatus: "IN_REVIEW", changedBy: "Admin <script>", changedByUserId: "admin-1", notes: '<img src="x"> & broken calculation', resolutionNotes: "" };
describe("Incident workflow notifications", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findManyMock.mockResolvedValue([{ id: "admin-1", email: "admin@example.com", role: "ADMIN", fullName: "Admin", preferences: { language: "es" } }, { id: "reporter-1", email: "reporter@example.com", role: "AGENT", fullName: "Reporter" }]);
    configMock.mockResolvedValue({ incidentCreatedEmailTemplateId: "created-template", incidentEscalatedEmailTemplateId: "escalated-template", incidentStatusEmailTemplateId: "status-template", incidentResolvedEmailTemplateId: "resolved-template", defaultLanguage: "en" });
  });
  it("notifies all active admins and sys admins plus the reporter on escalation", async () => {
    await SimulationIssueEmailService.notifyEvent(input);
    expect(findManyMock.mock.calls[0][0].where).toEqual({ isActive: true, isDeleted: false, deletedAt: null, OR: [{ role: { in: ["ADMIN", "SYS_ADMIN"] } }, { id: "reporter-1" }] });
    expect(sendTemplateMock).toHaveBeenCalledTimes(2);
    expect(notificationMock).toHaveBeenCalledTimes(2);
    expect(sendTemplateMock.mock.calls[0][0]).toMatchObject({ templateId: "escalated-template", deliveryId: "incident:event-1:admin-1", languageCode: "es", escapeHtmlVariables: true, variables: { INCIDENT_NUMBER: "42", NOTES: input.notes } });
  });
  it("uses each recipient's language for notification titles and both status labels", async () => {
    await SimulationIssueEmailService.notifyEvent(input);
    expect(sendTemplateMock.mock.calls[0][0]).toMatchObject({ languageCode: "es", variables: { STATUS: "Nueva", PREVIOUS_STATUS: "En curso", NOTES: input.notes } });
    expect(notificationMock.mock.calls[0][0]).toMatchObject({ title: "Incidencia escalada a los administradores del sistema #42", body: `En curso → Nueva\n${input.notes}` });
    expect(sendTemplateMock.mock.calls[1][0]).toMatchObject({ languageCode: "en", variables: { STATUS: "New", PREVIOUS_STATUS: "Ongoing" } });
    expect(notificationMock.mock.calls[1][0].title).toBe("Incident escalated to system administrators #42");
  });
  it("uses the configured default when the recipient has no preference", async () => {
    configMock.mockResolvedValue({ defaultLanguage: "es", incidentEscalatedEmailTemplateId: "escalated-template" });
    await SimulationIssueEmailService.notifyEvent(input);
    expect(sendTemplateMock.mock.calls[1][0]).toMatchObject({ languageCode: "es", variables: { STATUS: "Nueva" } });
    expect(notificationMock.mock.calls[1][0].body).toBe(`En curso → Nueva\n${input.notes}`);
  });
  it("notifies only admins for a new incident", async () => {
    await SimulationIssueEmailService.notifyEvent({ ...input, kind: "created", escalated: false });
    expect(findManyMock.mock.calls[0][0].where.OR).toEqual([{ role: { in: ["ADMIN"] } }]);
    expect(sendTemplateMock.mock.calls[0][0].templateId).toBe("created-template");
  });
  it("keeps the reporter updated while admins handle the incident", async () => {
    await SimulationIssueEmailService.notifyEvent({ ...input, kind: "status", escalated: false });
    expect(findManyMock.mock.calls[0][0].where.OR).toEqual([{ role: { in: ["ADMIN"] } }, { id: "reporter-1" }]);
    expect(sendTemplateMock.mock.calls[1][0].variables.ISSUE_URL).toBe("https://simulator.example.com/internal/notifications");
    expect(sendTemplateMock.mock.calls[0][0].variables.ISSUE_URL).toContain("/internal/simulations/issues/issue-1");
  });
  it.each([false, true])("sends the exact resolution note, escalated=%s", async (escalated) => {
    await SimulationIssueEmailService.notifyEvent({ ...input, kind: "resolved", status: "RESOLVED", escalated, resolutionNotes: "Fixed <calculation>\nVerified totals." });
    expect(sendTemplateMock.mock.calls[0][0]).toMatchObject({ templateId: "resolved-template", variables: { RESOLUTION_NOTES: "Fixed <calculation>\nVerified totals." } });
    expect(notificationMock.mock.calls[0][0].body).toContain("Fixed <calculation>\nVerified totals.");
  });
  it("keeps in-app notifications enabled when the email template is cleared", async () => {
    configMock.mockResolvedValue({ incidentEscalatedEmailTemplateId: null });
    await SimulationIssueEmailService.notifyEvent(input);
    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(notificationMock).toHaveBeenCalledTimes(2);
  });
  it("attempts both channels for every recipient despite partial failure", async () => {
    notificationMock.mockRejectedValueOnce(new Error("Unavailable"));
    sendTemplateMock.mockRejectedValueOnce(new Error("SMTP error"));
    await expect(SimulationIssueEmailService.notifyEvent(input)).rejects.toThrow("Save again to retry");
    expect(sendTemplateMock).toHaveBeenCalledTimes(2);
    expect(notificationMock).toHaveBeenCalledTimes(2);
  });
  it("keeps delivery identities stable on retry", async () => {
    await SimulationIssueEmailService.notifyEvent(input);
    await SimulationIssueEmailService.notifyEvent(input);
    expect(sendTemplateMock.mock.calls[0][0].deliveryId).toBe(sendTemplateMock.mock.calls[2][0].deliveryId);
  });
});
