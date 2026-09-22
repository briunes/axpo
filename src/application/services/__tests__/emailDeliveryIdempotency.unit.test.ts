const findUniqueMock = jest.fn();
const createMock = jest.fn();
const updateManyMock = jest.fn();
const updateMock = jest.fn();
const sendMailMock = jest.fn();
jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport: () => ({ sendMail: (...args: unknown[]) => sendMailMock(...args) }) } }));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  emailLog: { findUnique: (...args: unknown[]) => findUniqueMock(...args), create: (...args: unknown[]) => createMock(...args), update: (...args: unknown[]) => updateMock(...args), updateMany: (...args: unknown[]) => updateManyMock(...args) },
  systemConfig: { findFirst: async () => ({ smtpHost: "smtp.example.com", smtpUser: "user", smtpPassword: "test", smtpFromEmail: "app@example.com" }) },
} }));
import { EmailService } from "../emailService";
const input = { deliveryId: "event-1:sys-1", to: "sys@example.com", subject: "Escalation", html: "<p>Review issue</p>" };
describe("Email delivery idempotency", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    findUniqueMock.mockResolvedValue(null);
    sendMailMock.mockResolvedValue({ messageId: "message-1", rejected: [] });
    updateManyMock.mockResolvedValue({ count: 1 });
  });
  afterEach(() => jest.restoreAllMocks());
  it("records a new delivery before SMTP and marks it sent", async () => {
    await EmailService.sendEmail(input);
    expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ id: input.deliveryId, status: "sending" }) });
    expect(createMock.mock.invocationCallOrder[0]).toBeLessThan(sendMailMock.mock.invocationCallOrder[0]);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: input.deliveryId }, data: expect.objectContaining({ status: "sent" }) });
  });
  it.each(["sent", "sending"])("does not resend a %s delivery", async (status) => {
    findUniqueMock.mockResolvedValue({ status });
    await EmailService.sendEmail(input);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
  it("claims failed deliveries before retrying", async () => {
    findUniqueMock.mockResolvedValue({ status: "failed" });
    await EmailService.sendEmail(input);
    expect(updateManyMock).toHaveBeenCalledWith({ where: { id: input.deliveryId, status: "failed" }, data: expect.objectContaining({ status: "sending" }) });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
  it("does not send when another request has already claimed the failed delivery", async () => {
    findUniqueMock.mockResolvedValue({ status: "failed" });
    updateManyMock.mockResolvedValue({ count: 0 });
    await EmailService.sendEmail(input);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
  it("does not send when another request created the same delivery first", async () => {
    findUniqueMock.mockResolvedValueOnce(null).mockResolvedValue({ status: "sending" });
    createMock.mockRejectedValue(new Error("Duplicate key"));
    await EmailService.sendEmail(input);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
  it("records SMTP failures so only failed deliveries can be retried", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(EmailService.sendEmail(input)).rejects.toThrow("SMTP unavailable");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: input.deliveryId }, data: expect.objectContaining({ status: "failed" }) });
  });
  it("preserves ordinary email delivery without a stable ID", async () => {
    await EmailService.sendEmail({ ...input, deliveryId: undefined });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
});
