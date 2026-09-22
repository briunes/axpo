import { NextRequest } from "next/server";
import { GET, PATCH } from "../../../../app/api/v1/internal/simulation-issues/[id]/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const historyCreateMock = jest.fn();
const notifyMock = jest.fn();
const resolveMock = jest.fn();
const emailNotifyMock = jest.fn();

jest.mock("@/application/services/simulationIssueEmailService", () => ({ SimulationIssueEmailService: { notifyEscalation: (...args: unknown[]) => emailNotifyMock(...args) } }));
jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => requireAuthMock(...args) }));
jest.mock("@/application/services/errorLoggerService", () => ({ ErrorLoggerService: { capture: async () => undefined } }));
jest.mock("@/application/services/notificationService", () => ({ NotificationService: {
  notifySimulationIssueEscalated: (...args: unknown[]) => notifyMock(...args),
  resolveSimulationIssue: (...args: unknown[]) => resolveMock(...args),
} }));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  rolePermission: { findUnique: async () => null },
  simulationIssue: { findUnique: (...args: unknown[]) => findUniqueMock(...args), update: (...args: unknown[]) => updateMock(...args) },
  simulationIssueStatusChange: { create: (...args: unknown[]) => historyCreateMock(...args) },
} }));

const escalation = { id: "event-1", fromStatus: "NEW", toStatus: "ESCALATED", notes: "Calculation fails", changedByUser: { id: "admin-1", fullName: "Admin" } };
const item = { id: "issue-1", status: "ESCALATED", appStatus: "NEW", simulationReference: "001/2026", statusChanges: [escalation] };
const request = (body: unknown) => new NextRequest("http://localhost/api/v1/internal/simulation-issues/issue-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: { id: "issue-1" } };

describe("Simulation issue escalation API", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    requireAuthMock.mockResolvedValue({ userId: "admin-1", role: UserRole.ADMIN });
    findUniqueMock.mockResolvedValueOnce({ status: "NEW" }).mockResolvedValue(item);
  });
  afterEach(() => jest.restoreAllMocks());

  it("records the admin handoff and notifies system administrators", async () => {
    const response = await PATCH(request({ status: "ESCALATED", notes: "  Calculation fails  " }), context);
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ESCALATED", handledByUserId: "admin-1" }) }));
    expect(historyCreateMock).toHaveBeenCalledWith({ data: { issueId: "issue-1", fromStatus: "NEW", toStatus: "ESCALATED", fromAppStatus: null, toAppStatus: "NEW", changedByUserId: "admin-1", notes: "Calculation fails" } });
    expect(emailNotifyMock).toHaveBeenCalledWith(expect.objectContaining({ issueId: "issue-1", escalationId: "event-1", escalatedByUserId: "admin-1" }));
    expect(notifyMock).toHaveBeenCalledWith({ issueId: "issue-1", escalationId: "event-1", simulationReference: "001/2026", escalatedBy: "Admin", notes: "Calculation fails" });
  });

  it("rejects escalation without a meaningful handoff note", async () => {
    expect((await PATCH(request({ status: "ESCALATED", notes: "  " }), context)).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it.each([UserRole.COMMERCIAL, UserRole.AGENT])("denies escalation by %s", async (role) => {
    requireAuthMock.mockResolvedValue({ userId: "user-1", role });
    expect((await PATCH(request({ status: "ESCALATED", notes: "Broken" }), context)).status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("lets a sys admin open the notification's issue", async () => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValue(item);
    expect((await GET(new NextRequest("http://localhost/api/v1/internal/simulation-issues/issue-1"), context)).status).toBe(200);
  });

  it.each(["RESOLVED", "DISMISSED"])("lets a sys admin close an escalated issue as %s and clear notifications", async (status) => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValueOnce({ status: "ESCALATED", appStatus: "IN_REVIEW" }).mockResolvedValue({ ...item, appStatus: status });
    expect((await PATCH(request({ status: "ESCALATED", appStatus: status, notes: "Fixed application calculation" }), context)).status).toBe(200);
    expect(resolveMock).toHaveBeenCalledWith("issue-1");
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("keeps the alert active when a sys admin begins reviewing", async () => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValueOnce({ status: "ESCALATED", appStatus: "NEW" }).mockResolvedValue({ ...item, appStatus: "IN_REVIEW" });
    expect((await PATCH(request({ status: "ESCALATED", appStatus: "IN_REVIEW" }), context)).status).toBe(200);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("retries notification delivery using the original transition after a delivery failure", async () => {
    notifyMock.mockRejectedValueOnce(new Error("Notification store unavailable"));
    expect((await PATCH(request({ status: "ESCALATED", notes: "Calculation fails" }), context)).status).toBe(500);
    findUniqueMock.mockReset().mockResolvedValueOnce({ status: "ESCALATED", appStatus: "NEW" }).mockResolvedValue(item);
    expect((await PATCH(request({ status: "ESCALATED" }), context)).status).toBe(200);
    expect(notifyMock).toHaveBeenLastCalledWith(expect.objectContaining({ escalationId: "event-1" }));
    expect(historyCreateMock).toHaveBeenCalledTimes(1);
  });

  it("does not turn an additional note into a fresh escalation notification", async () => {
    findUniqueMock.mockReset().mockResolvedValueOnce({ status: "ESCALATED" }).mockResolvedValue({ ...item, statusChanges: [{ ...escalation, id: "note-2", fromStatus: "ESCALATED", notes: "More details" }, escalation] });
    expect((await PATCH(request({ status: "ESCALATED", notes: "More details" }), context)).status).toBe(200);
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ escalationId: "event-1", notes: "Calculation fails" }));
  });
  it("starts an escalation at New in the app administrator workflow", async () => {
    await PATCH(request({ status: "ESCALATED", notes: "Technical investigation needed" }), context);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ESCALATED", appStatus: "NEW" }) }));
  });

  it("blocks ordinary admins from changing app administrator progress", async () => {
    findUniqueMock.mockReset().mockResolvedValue({ status: "ESCALATED", appStatus: "NEW" });
    expect((await PATCH(request({ status: "ESCALATED", appStatus: "IN_REVIEW" }), context)).status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("preserves escalation when a sys admin changes progress and audits both states", async () => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValueOnce({ status: "ESCALATED", appStatus: "NEW" }).mockResolvedValue({ ...item, appStatus: "IN_REVIEW" });
    expect((await PATCH(request({ status: "ESCALATED", appStatus: "IN_REVIEW" }), context)).status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ESCALATED", appStatus: "IN_REVIEW" }) }));
    expect(historyCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({ fromStatus: "ESCALATED", toStatus: "ESCALATED", fromAppStatus: "NEW", toAppStatus: "IN_REVIEW", changedByUserId: "sys-1" }) });
    expect(notifyMock).not.toHaveBeenCalled();
    expect(emailNotifyMock).not.toHaveBeenCalled();
  });

  it("requires notes when app administrators resolve an issue", async () => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValue({ status: "ESCALATED", appStatus: "IN_REVIEW" });
    expect((await PATCH(request({ status: "ESCALATED", appStatus: "RESOLVED", notes: "  " }), context)).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("prevents a status change from removing an issue from the app administrators' workflow", async () => {
    findUniqueMock.mockReset().mockResolvedValue({ status: "ESCALATED", appStatus: "NEW" });
    expect((await PATCH(request({ status: "RESOLVED", notes: "Close" }), context)).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each(["ESCALATED", "UNKNOWN", null])("rejects invalid app progress %s", async (appStatus) => {
    requireAuthMock.mockResolvedValue({ userId: "sys-1", role: UserRole.SYS_ADMIN });
    findUniqueMock.mockReset().mockResolvedValue({ status: "ESCALATED", appStatus: "NEW" });
    expect((await PATCH(request({ status: "ESCALATED", appStatus }), context)).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

});
