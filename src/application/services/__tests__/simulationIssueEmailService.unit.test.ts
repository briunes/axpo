const findManyMock = jest.fn();
const sendEmailMock = jest.fn();
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { user: { findMany: (...args: unknown[]) => findManyMock(...args) } } }));
jest.mock("../emailService", () => ({ EmailService: { sendEmail: (...args: unknown[]) => sendEmailMock(...args) } }));
jest.mock("../emailOpenTracking", () => ({ resolveTrackingBaseUrl: () => "https://simulator.example.com" }));
import { SimulationIssueEmailService } from "../simulationIssueEmailService";

const input = { issueId: "issue-1", escalationId: "event-1", simulationReference: "001/2026", simulationId: "sim-1", escalatedBy: "Admin <script>", escalatedByUserId: "admin-1", notes: '<img src="x"> & broken calculation' };
describe("Simulation issue escalation emails", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findManyMock.mockResolvedValue([{ id: "sys-1", email: "one@example.com" }, { id: "sys-2", email: "two@example.com" }]);
    sendEmailMock.mockResolvedValue(undefined);
  });
  it("emails active, non-deleted sys admins individually, with escaped content and an authenticated incident link", async () => {
    await SimulationIssueEmailService.notifyEscalation(input);
    expect(findManyMock).toHaveBeenCalledWith({ where: { role: "SYS_ADMIN", isActive: true, isDeleted: false, deletedAt: null }, select: { id: true, email: true } });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: "one@example.com", deliveryId: "simulation-issue-escalation:event-1:sys-1", relatedUserId: "sys-1", relatedSimulationId: "sim-1", triggeredByUserId: "admin-1",
    }));
    const email = sendEmailMock.mock.calls[0][0];
    expect(email.html).toContain("Admin &lt;script&gt;");
    expect(email.html).toContain("&lt;img src=&quot;x&quot;&gt; &amp; broken calculation");
    expect(email.html).toContain('href="https://simulator.example.com/internal/simulations/issues/issue-1"');
    expect(email.text).toContain(input.notes);
    expect(email.attachments).toBeUndefined();
    expect(sendEmailMock.mock.calls[1][0].deliveryId).toBe("simulation-issue-escalation:event-1:sys-2");
  });
  it("attempts every recipient and surfaces partial delivery failure for retry", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP rejected recipient"));
    await expect(SimulationIssueEmailService.notifyEscalation(input)).rejects.toThrow("Save again to retry failed deliveries");
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
  it("uses a new delivery identity when an issue is escalated again", async () => {
    await SimulationIssueEmailService.notifyEscalation({ ...input, escalationId: "event-2" });
    expect(sendEmailMock.mock.calls[0][0].deliveryId).toBe("simulation-issue-escalation:event-2:sys-1");
  });
  it("does not send when no eligible sys admins exist", async () => {
    findManyMock.mockResolvedValue([]);
    await SimulationIssueEmailService.notifyEscalation(input);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
