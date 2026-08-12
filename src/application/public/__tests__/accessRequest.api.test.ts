import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/public/access-request/options/route";

const applyRateLimitMock = jest.fn();
const getClientRateLimitKeyMock = jest.fn();
const agencyFindFirstMock = jest.fn();
const userFindFirstMock = jest.fn();
const accessRequestFindFirstMock = jest.fn();
const accessRequestCreateMock = jest.fn();
const accessRequestUpdateMock = jest.fn();
const sendNotificationMock = jest.fn();
const sendApplicantConfirmationMock = jest.fn();
const notifyAccessRequestReceivedMock = jest.fn();

jest.mock("@/application/middleware/rateLimit", () => ({
  applyRateLimitShared: (...args: unknown[]) => applyRateLimitMock(...args),
  getClientRateLimitKey: (...args: unknown[]) => getClientRateLimitKeyMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: { findFirst: (...args: unknown[]) => agencyFindFirstMock(...args) },
    user: { findFirst: (...args: unknown[]) => userFindFirstMock(...args) },
    accessRequest: {
      findFirst: (...args: unknown[]) => accessRequestFindFirstMock(...args),
      create: (...args: unknown[]) => accessRequestCreateMock(...args),
      update: (...args: unknown[]) => accessRequestUpdateMock(...args),
    },
  },
}));

jest.mock("@/application/services/emailService", () => ({
  EmailService: {
    sendAccessRequestNotification: (...args: unknown[]) => sendNotificationMock(...args),
    sendAccessRequestApplicantConfirmation: (...args: unknown[]) => sendApplicantConfirmationMock(...args),
  },
}));

jest.mock("@/application/services/notificationService", () => ({
  NotificationService: {
    notifyAccessRequestReceived: (...args: unknown[]) => notifyAccessRequestReceivedMock(...args),
  },
}));

const makeRequest = (overrides: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/v1/public/access-request/options", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({
      fullName: "Applicant Name",
      email: "Applicant@Example.com",
      phone: "+34912345678",
      agencyId: "agency-1",
      kamUserId: "kam-1",
      ...overrides,
    }),
  });

describe("public access request submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getClientRateLimitKeyMock.mockReturnValue("access-request:test");
    applyRateLimitMock.mockResolvedValue(undefined);
    agencyFindFirstMock.mockResolvedValue({ id: "agency-1", name: "Agency One" });
    userFindFirstMock
      .mockResolvedValueOnce({ id: "kam-1", fullName: "KAM Name", email: "kam@example.com" })
      .mockResolvedValueOnce(null);
    accessRequestFindFirstMock.mockResolvedValue(null);
    accessRequestCreateMock.mockResolvedValue({ id: "request-1" });
    accessRequestUpdateMock.mockResolvedValue(undefined);
    sendNotificationMock.mockResolvedValue(true);
    sendApplicantConfirmationMock.mockResolvedValue(true);
    notifyAccessRequestReceivedMock.mockResolvedValue(undefined);
  });

  it("stores a pending request and notifies the selected KAM", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(202);
    expect(accessRequestCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "applicant@example.com",
        agencyId: "agency-1",
        kamUserId: "kam-1",
      }),
    }));
    expect(sendNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "kam@example.com",
      requestId: "request-1",
    }));
    expect(notifyAccessRequestReceivedMock).toHaveBeenCalledWith({
      requestId: "request-1",
      kamUserId: "kam-1",
      applicantName: "Applicant Name",
      agencyName: "Agency One",
    });
    expect(userFindFirstMock.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: "kam-1",
      role: "ADMIN",
    }));
    expect(userFindFirstMock.mock.calls[0][0].where).toEqual(expect.objectContaining({
      agencyId: "agency-1",
    }));
    expect(sendApplicantConfirmationMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "applicant@example.com",
      requestId: "request-1",
    }));
    expect(accessRequestUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "request-1" },
      data: expect.objectContaining({ notificationSentAt: expect.any(Date) }),
    }));
  });

  it("does not create or email again for an existing pending request", async () => {
    accessRequestFindFirstMock.mockResolvedValue({ id: "existing-request" });

    const response = await POST(makeRequest());

    expect(response.status).toBe(202);
    expect(accessRequestCreateMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("keeps the request pending when email delivery fails", async () => {
    sendNotificationMock.mockRejectedValue(new Error("SMTP unavailable"));

    const response = await POST(makeRequest());

    expect(response.status).toBe(202);
    expect(accessRequestUpdateMock).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { notificationError: "SMTP unavailable" },
    });
  });
});
