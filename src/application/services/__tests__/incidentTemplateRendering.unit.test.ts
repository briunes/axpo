const templateMock = jest.fn();
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { emailTemplate: { findUnique: (...args: unknown[]) => templateMock(...args) } } }));
import { EmailService } from "../emailService";

describe("Incident template rendering", () => {
  afterEach(() => jest.restoreAllMocks());
  it("escapes untrusted HTML, preserves literal dollars, and forwards the delivery ID", async () => {
    templateMock.mockResolvedValue({ id: "template-1", name: "Resolved", active: true, subject: "Incident {{INCIDENT_NUMBER}}", htmlContent: "<p>{{RESOLUTION_NOTES}}</p>", translations: [] });
    const send = jest.spyOn(EmailService, "sendEmail").mockResolvedValue();
    await EmailService.sendTemplateEmail({ to: "admin@example.com", templateId: "template-1", deliveryId: "event:recipient", escapeHtmlVariables: true, requiredHtmlVariables: ["RESOLUTION_NOTES"], variables: { INCIDENT_NUMBER: "42", RESOLUTION_NOTES: '<script> $& "fixed"' } });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: "event:recipient", subject: "Incident 42", html: "<p>&lt;script&gt; $&amp; &quot;fixed&quot;</p>" }));
  });
  it("includes the resolution even if the configured template omits its placeholder", async () => {
    templateMock.mockResolvedValue({ id: "template-1", name: "Resolved", active: true, subject: "Resolved", htmlContent: "<html><body>Done</body></html>", translations: [] });
    const send = jest.spyOn(EmailService, "sendEmail").mockResolvedValue();
    await EmailService.sendTemplateEmail({ to: "admin@example.com", templateId: "template-1", escapeHtmlVariables: true, requiredHtmlVariables: ["RESOLUTION_NOTES"], variables: { RESOLUTION_NOTES: "Fixed <totals>\nChecked." } });
    expect(send.mock.calls[0][0].html).toBe('<html><body>Done<p style="white-space:pre-wrap">Fixed &lt;totals&gt;\nChecked.</p></body></html>');
  });
});
