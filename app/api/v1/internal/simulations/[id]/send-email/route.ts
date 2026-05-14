import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";
import { EmailService } from "@/application/services/emailService";
import { withErrorHandler } from "@/application/middleware/errorHandler";

const sendEmailSchema = z.object({
  to: z.string().email("Invalid recipient email address"),
  subject: z.string().min(1, "subject is required"),
  htmlContent: z.string().min(1, "htmlContent is required"),
  pdfHtmlContent: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/send-email:
 *   post:
 *     summary: Send simulation email with optional PDF attachment
 *     tags: [Simulations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Simulation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - htmlContent
 *             properties:
 *               to:
 *                 type: string
 *               subject:
 *                 type: string
 *               htmlContent:
 *                 type: string
 *               pdfHtmlContent:
 *                 type: string
 *                 description: If provided, a PDF will be generated from this HTML and attached
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Invalid request
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "simulations.share");

    const params = context?.params || {};
    const id = params?.id || "";

    let rawBody: unknown;
    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return NextResponse.json(
          { error: "Request body is required" },
          { status: 400 },
        );
      }
      rawBody = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { to, subject, htmlContent, pdfHtmlContent } =
      sendEmailSchema.parse(rawBody);

    let attachments = undefined;

    if (pdfHtmlContent) {
      try {
        const pageBreakStyle = `
        <style>
          @media print {
            *  { box-sizing: border-box; }
            body { margin: 0; padding: 0; }
            table, figure, img,
            .asim-comparison,
            .asim-plan-card, .asim-plan-body,
            .asim-data-section,
            .asim-period-grid, .asim-period-item,
            .asim-cost-breakdown, .asim-cost-item,
            .asim-total-section, .asim-savings-badge,
            .asim-basic-data, .asim-header,
            tr, td, th {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            h1, h2, h3, h4, h5, h6,
            .asim-section-title, .asim-data-section-title, .asim-plan-header {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
          }
        </style>`;

        const stylesHtml = `${pageBreakStyle}`;
        const enrichedHtml = pdfHtmlContent.includes("</head>")
          ? pdfHtmlContent.replace("</head>", `${stylesHtml}\n</head>`)
          : `${stylesHtml}\n${pdfHtmlContent}`;

        const browser = await launchBrowser();

        const page = await browser.newPage();
        await page.setContent(enrichedHtml, {
          waitUntil: "networkidle0",
        });

        const pdfBuffer = await page.pdf({
          format: "A4",
          margin: {
            top: "15mm",
            right: "12mm",
            bottom: "15mm",
            left: "12mm",
          },
          printBackground: true,
          preferCSSPageSize: false,
        });

        await browser.close();

        attachments = [
          {
            filename: `simulation-${id}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: "application/pdf",
          },
        ];
      } catch (err) {
        console.error("Failed to generate PDF attachment:", err);
        return NextResponse.json(
          { error: "Failed to generate PDF attachment" },
          { status: 500 },
        );
      }
    }

    await EmailService.sendEmail({
      to,
      subject,
      html: htmlContent,
      attachments,
      triggeredBy: "simulation-share",
      triggeredByUserId: auth.userId,
      relatedSimulationId: id || undefined,
    });

    return NextResponse.json({ success: true });
  },
);
