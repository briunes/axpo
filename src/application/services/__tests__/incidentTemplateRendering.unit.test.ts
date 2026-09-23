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
  it.each([false, true])("omits inaccessible incident buttons from the selected template, translated=%s", async translated => {
    const html = '<p>{{DESCRIPTION}}</p><table><tr><td><a style="color:red" href="{{ ISSUE_URL }}"><span>View update</span></a></td></tr></table><a href="https://example.com/help">Help</a>';
    templateMock.mockResolvedValue({ id: "template-1", active: true, subject: "Update", htmlContent: translated ? "Fallback" : html,
      translations: translated ? [{ languageCode: "es", subject: "Actualización", htmlContent: html }] : [] });
    const send = jest.spyOn(EmailService, "sendEmail").mockResolvedValue();
    await EmailService.sendTemplateEmail({ to: "reporter@example.com", templateId: "template-1", languageCode: "es",
      omitLinksForVariables: ["ISSUE_URL"], escapeHtmlVariables: true, variables: { ISSUE_URL: "", DESCRIPTION: "Incident details" } });
    const rendered = send.mock.calls[0][0].html;
    expect(rendered).not.toContain("View update");
    expect(rendered).not.toContain('href=""');
    expect(rendered).toContain("Incident details");
    expect(rendered).toContain('<a href="https://example.com/help">Help</a>');
  });
  it("retains the incident button for recipients with management access", async () => {
    templateMock.mockResolvedValue({ id: "template-1", active: true, subject: "Update", htmlContent: '<a href="{{ISSUE_URL}}">View update</a>', translations: [] });
    const send = jest.spyOn(EmailService, "sendEmail").mockResolvedValue();
    await EmailService.sendTemplateEmail({ to: "admin@example.com", templateId: "template-1", omitLinksForVariables: [],
      variables: { ISSUE_URL: "https://example.com/internal/simulations/issues/1" } });
    expect(send.mock.calls[0][0].html).toBe('<a href="https://example.com/internal/simulations/issues/1">View update</a>');
  });

});
