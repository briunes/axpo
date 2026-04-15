import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";
import { InvalidTokenError, NotFoundError } from "@/domain/errors/errors";
import { SimulationService } from "@/application/services/simulationService";
import { prisma } from "@/infrastructure/database/prisma";
import {
  extractVariableValues,
  replaceVariables,
} from "@/infrastructure/pdf/variableReplacer";
import type { SimulationPayload } from "@/domain/types/simulation";

interface PublicSessionPayload {
  typ?: string;
  sid?: string;
  tok?: string;
}

const readPublicSessionToken = (request: NextRequest): string => {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice(7).trim();
  }

  const custom = request.headers.get("x-public-session-token");
  if (custom) {
    return custom;
  }

  throw new InvalidTokenError("Missing public access session token");
};

const verifyPublicSessionToken = (
  sessionToken: string,
): PublicSessionPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new InvalidTokenError("JWT secret not configured");
  }

  const decoded = jwt.verify(sessionToken, secret);
  if (!decoded || typeof decoded !== "object") {
    throw new InvalidTokenError("Invalid public session token");
  }

  return decoded as PublicSessionPayload;
};

/**
 * @swagger
 * /api/v1/public/simulations/{token}/pdf:
 *   get:
 *     tags: [Public]
 *     summary: Generate and download PDF for a shared simulation
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Public share token
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - invalid session token
 *       404:
 *         description: Simulation or template not found
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // Verify session token
    const sessionToken = readPublicSessionToken(request);
    const payload = verifyPublicSessionToken(sessionToken);

    if (
      payload.typ !== "PUBLIC_SIM_ACCESS" ||
      payload.tok !== token ||
      !payload.sid
    ) {
      return NextResponse.json(
        { error: "Public access session is invalid for this token" },
        { status: 401 },
      );
    }

    // Fetch simulation with all required data
    const simulation = await prisma.simulation.findFirst({
      where: {
        id: payload.sid,
        publicToken: token,
        isDeleted: false,
      },
      include: {
        ownerUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            commercialEmail: true,
            commercialPhone: true,
            mobilePhone: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
      },
    });

    if (!simulation) {
      return NextResponse.json(
        { error: "Invalid or inactive share token" },
        { status: 404 },
      );
    }

    if (SimulationService.isExpired(simulation.expiresAt)) {
      return NextResponse.json(
        { error: "Simulation link has expired" },
        { status: 401 },
      );
    }

    // Get recent versions to find one with results
    const recentVersions = await prisma.simulationVersion.findMany({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Build a merged payload: use the most recent version with results (which
    // always includes inputs) as the base, then overlay the most recent
    // selectedOffer.
    const baseVersion =
      recentVersions.find(
        (v) => (v.payloadJson as Record<string, unknown> | null)?.results,
      ) ?? recentVersions[0];
    const latestOfferPayload = recentVersions.find(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.selectedOffer,
    )?.payloadJson as Record<string, unknown> | null;
    const mergedPayload: Record<string, unknown> | null =
      baseVersion?.payloadJson
        ? {
            ...(baseVersion.payloadJson as Record<string, unknown>),
            ...(latestOfferPayload?.selectedOffer !== undefined
              ? { selectedOffer: latestOfferPayload.selectedOffer }
              : {}),
          }
        : null;

    // Debug: log what we have
    console.log("[PDF] Simulation ID:", simulation.id);
    console.log("[PDF] Versions found:", recentVersions.length);
    console.log(
      "[PDF] Base version has results:",
      !!(baseVersion?.payloadJson as any)?.results,
    );
    console.log(
      "[PDF] Merged payload keys:",
      mergedPayload ? Object.keys(mergedPayload) : "null",
    );

    // Fetch the PDF template
    const pdfTemplate = await prisma.pdfTemplate.findUnique({
      where: { id: "simulation-output-default" },
    });

    if (!pdfTemplate || !pdfTemplate.active) {
      return NextResponse.json(
        { error: "PDF template not found or inactive" },
        { status: 404 },
      );
    }

    // Extract variable values from simulation data
    const simulationPayload = mergedPayload as SimulationPayload | null;
    const variableValues = extractVariableValues(
      simulation,
      simulationPayload ?? undefined,
    );

    // Debug: log variable values
    console.log("[PDF] Client name:", variableValues.CLIENT_NAME);
    console.log("[PDF] CUPS:", variableValues.CUPS_NUMBER);
    console.log("[PDF] Current Total:", variableValues.CURRENT_TOTAL);
    console.log("[PDF] AXPO Total:", variableValues.AXPO_TOTAL);

    // Replace variables in template
    const processedHtml = replaceVariables(
      pdfTemplate.htmlContent,
      variableValues,
    );

    // Wrap in HTML document structure if needed
    const fullHtml = processedHtml.includes("<!DOCTYPE html>")
      ? processedHtml
      : `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulación AXPO - ${simulation.client?.name || "Cliente"}</title>
</head>
<body>
${processedHtml}
</body>
</html>`;

    // Inject page-break CSS for clean PDF generation
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

    const enrichedHtml = fullHtml.includes("</head>")
      ? fullHtml.replace("</head>", `${pageBreakStyle}\n</head>`)
      : `${pageBreakStyle}\n${fullHtml}`;

    // Generate PDF with Puppeteer
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

    // Generate filename
    const clientName =
      simulation.client?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "simulacion";
    const date = new Date().toISOString().split("T")[0];
    const filename = `simulacion-axpo-${clientName}-${date}.pdf`;

    // Return PDF as response
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Public PDF generation error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
