import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { EmailService } from "@/application/services/emailService";

/**
 * @swagger
 * /api/v1/internal/config/smtp/test:
 *   post:
 *     tags: [Configuration]
 *     summary: Test SMTP connection
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SMTP test result
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const result = await EmailService.testSMTPConnection();

  return NextResponse.json(result);
});
