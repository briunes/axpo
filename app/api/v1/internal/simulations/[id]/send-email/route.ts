import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { UserRole } from "@/domain/types";
import { assertRole } from "@/application/middleware/rbac";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";
import { EmailService } from "@/application/services/emailService";
import { withErrorHandler } from "@/application/middleware/errorHandler";

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
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const params = context?.params || {};
    const id = params?.id || "";

    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return NextResponse.json(
          { error: "Request body is required" },
          { status: 400 },
        );
      }
      body = JSON.parse(text);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { to, subject, htmlContent, pdfHtmlContent } = body;

    if (!to || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "to, subject, and htmlContent are required" },
        { status: 400 },
      );
    }

    let attachments = undefined;

    if (pdfHtmlContent) {
      try {
        const pageBreakStyle = `
        <style>
          @media print {
            *  { box-sizing: border-box; }
            body { margin: 0; padding: 0; }
            table, figure, img,
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

    try {
      await EmailService.sendEmail({
        to,
        subject,
        html: htmlContent,
        attachments,
        triggeredBy: "simulation-share",
        triggeredByUserId: auth.userId,
        relatedSimulationId: id,
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to send simulation email:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to send email" },
        { status: 500 },
      );
    }
  },
);
