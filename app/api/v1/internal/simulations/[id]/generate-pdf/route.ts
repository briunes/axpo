import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { UserRole } from "@/domain/types";
import { assertRole } from "@/application/middleware/rbac";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/generate-pdf:
 *   post:
 *     summary: Generate PDF from simulation HTML template
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
 *               - htmlContent
 *             properties:
 *               htmlContent:
 *                 type: string
 *                 description: HTML content to convert to PDF
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify authentication
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const { id } = await params;
    const body = await request.json();
    const { htmlContent, watermark } = body;

    if (!htmlContent) {
      return NextResponse.json(
        { error: "htmlContent is required" },
        { status: 400 },
      );
    }

    // Inject watermark style if requested
    const watermarkStyle = watermark
      ? `
      <style>
        @media print {
          body::before {
            content: "${watermark}";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.08);
            z-index: 9999;
            pointer-events: none;
            white-space: nowrap;
            font-family: Arial, sans-serif;
            letter-spacing: 0.1em;
          }
        }
      </style>
      `
      : "";

    // Inject page-break CSS so no element is split across PDF pages,
    // regardless of which HTML template is submitted.
    const pageBreakStyle = `
      <style>
        @media print {
          *  { box-sizing: border-box; }
          body { margin: 0; padding: 0; }
          /* Only prevent breaks inside small leaf elements — not large containers */
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

    // Insert styles before closing </head>, or prepend if no <head>
    const stylesHtml = `${watermarkStyle}${pageBreakStyle}`;
    const enrichedHtml = htmlContent.includes("</head>")
      ? htmlContent.replace("</head>", `${stylesHtml}\n</head>`)
      : `${stylesHtml}\n${htmlContent}`;

    // Use Puppeteer to generate PDF
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

    // Return PDF as response
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="simulation-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
