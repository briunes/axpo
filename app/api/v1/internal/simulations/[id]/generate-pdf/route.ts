import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";
import {
  buildSimulationPdfFilenameFromSimulation,
  resolveSimulationProductName,
} from "@/infrastructure/pdf/pdfFilename";
import { installPdfResourceGuard } from "@/infrastructure/pdf/pdfResourceGuard";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { SimulationService } from "@/application/services/simulationService";
import { ValidationError } from "@/domain/errors/errors";

const generatePdfSchema = z.object({
  htmlContent: z.string().min(1, "htmlContent is required"),
  watermark: z.string().optional(),
});

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
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    // Verify authentication
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id ?? "";
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }
    await SimulationService.assertSimulationAccess(auth, id);

    const rawBody = await request.json();
    const { htmlContent, watermark } = generatePdfSchema.parse(rawBody);

    const simulation = await prisma.simulation.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        referenceNumber: true,
        client: { select: { name: true } },
        versions: {
          select: { payloadJson: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const latestPayload = simulation?.versions?.[0]?.payloadJson as any;
    const filename = simulation
      ? buildSimulationPdfFilenameFromSimulation(
          {
            id: simulation.id,
            referenceNumber: simulation.referenceNumber,
            client: simulation.client,
            payloadJson: latestPayload,
          },
          {
            productName: resolveSimulationProductName(latestPayload),
          },
        )
      : `simulation-${id}.pdf`;

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
          .asim-page { min-height: 0 !important; }
          /* Prevent page breaks inside key layout containers and leaf elements */
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

    // Insert styles before closing </head>, or prepend if no <head>
    const stylesHtml = `${watermarkStyle}${pageBreakStyle}`;
    const enrichedHtml = htmlContent.includes("</head>")
      ? htmlContent.replace("</head>", `${stylesHtml}\n</head>`)
      : `${stylesHtml}\n${htmlContent}`;

    // Use Puppeteer to generate PDF
    const browser = await launchBrowser();
    let pdfBuffer: Uint8Array;

    try {
      const page = await browser.newPage();
      await installPdfResourceGuard(page);
      await page.setContent(enrichedHtml, {
        waitUntil: "load",
      });

      pdfBuffer = await page.pdf({
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
    } finally {
      await browser.close();
    }

    // Return PDF as response
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
