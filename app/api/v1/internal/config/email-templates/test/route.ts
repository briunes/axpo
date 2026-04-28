import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { EmailService } from "@/application/services/emailService";
import { z } from "zod";

const TestEmailSchema = z.object({
  recipientEmail: z.string().email("Invalid email address"),
  templateId: z.string().min(1, "Template ID is required"),
  sampleVariables: z.record(z.string()).optional(),
});

/**
 * @swagger
 * /api/v1/internal/config/email-templates/test:
 *   post:
 *     tags: [Configuration]
 *     summary: Send test email using a template
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientEmail
 *               - templateId
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 description: Email address to send the test to
 *               templateId:
 *                 type: string
 *                 description: ID of the email template to test
 *               sampleVariables:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Optional sample data for template variables
 *     responses:
 *       200:
 *         description: Test email sent successfully
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();
  const parsed = TestEmailSchema.parse(body);

  // Default sample variables if none provided
  const sampleVariables = parsed.sampleVariables || {
    contactPerson: "John Doe",
    clientName: "Sample Company Ltd.",
    simulationCode: "SIM-2026-001",
    simulationLink: "https://axpo.example.com/simulation/123",
    pin: "1234",
    userName: "Test User",
    userEmail: parsed.recipientEmail,
    magicLink: "https://axpo.example.com/login/magic-link-token",
    expirationDate: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString(),
  };

  await EmailService.sendTemplateEmail({
    to: parsed.recipientEmail,
    templateId: parsed.templateId,
    variables: sampleVariables,
    triggeredBy: "test-email",
    triggeredByUserId: auth.userId,
  });

  return NextResponse.json({
    success: true,
    message: `Test email sent to ${parsed.recipientEmail}`,
  });
});
