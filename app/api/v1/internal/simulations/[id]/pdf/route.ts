import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { launchBrowser } from "@/infrastructure/pdf/browserLauncher";
import { installPdfResourceGuard } from "@/infrastructure/pdf/pdfResourceGuard";
import {
  extractVariableValues,
  replaceVariables,
} from "@/infrastructure/pdf/variableReplacer";
import {
  buildSimulationPdfFilenameFromSimulation,
  resolveSimulationProductName,
} from "@/infrastructure/pdf/pdfFilename";
import type { SimulationPayload } from "@/domain/types/simulation";
import { normalizeLanguageCode } from "@/lib/supportedLanguages";
import type { EditableSectionsConfig } from "@/infrastructure/templates/editableSections";

const PDF_PAGE_BREAK_STYLE = `<style>
  @media print {
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .asim-page { min-height: 0 !important; }
    .asim-data-section + .asim-cost-breakdown {
      margin-top: -8px !important;
    }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) { padding-top: 6px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) > .asim-section-title { margin-bottom: 14px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-comparison { margin-bottom: 16px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-plan-body { padding: 12px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-plan-tariff { margin-bottom: 10px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-data-section { margin-bottom: 10px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-data-section-title { margin-bottom: 5px !important; padding-bottom: 3px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-period-grid { gap: 6px !important; margin-bottom: 6px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-period-item { padding: 6px 4px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-cost-item { padding: 5px 0 !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-total-item { padding: 8px 12px !important; }
    .asim-page--comparison .asim-energy-price-table--electricity { margin-top: 10px !important; }
    .asim-page--comparison .asim-energy-price-table--electricity .asim-energy-price-header,
    .asim-page--comparison .asim-energy-price-table--electricity .asim-energy-price-grid { padding-top: 7px !important; padding-bottom: 7px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-notice { margin-top: 6px !important; }
    .asim-page--comparison:has(.asim-energy-price-table--electricity) .asim-footer { margin-top: 8px !important; padding-top: 7px !important; }
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

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/pdf:
 *   get:
 *     tags: [Simulations]
 *     summary: Generate a simulation PDF snapshot
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    await SimulationService.assertSimulationAccess(auth, id);

    const simulation = await prisma.simulation.findFirst({
      where: { id, isDeleted: false },
      include: {
        ownerUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            commercialEmail: true,
            commercialPhone: true,
            mobilePhone: true,
            preferences: { select: { language: true } },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            language: true,
          },
        },
      },
    });
    if (!simulation) {
      throw new ValidationError("Simulation not found");
    }

    const recentVersions = await prisma.simulationVersion.findMany({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const baseVersion =
      recentVersions.find(
        (version) =>
          (version.payloadJson as Record<string, unknown> | null)?.results,
      ) ?? recentVersions[0];
    const latestOfferPayload = recentVersions.find((version) => {
      const payload = version.payloadJson as Record<string, unknown> | null;
      return (
        payload !== null &&
        Object.prototype.hasOwnProperty.call(payload, "selectedOffer")
      );
    })?.payloadJson as Record<string, unknown> | null;
    const mergedPayload: Record<string, unknown> | null = baseVersion?.payloadJson
      ? {
          ...(baseVersion.payloadJson as Record<string, unknown>),
          ...(latestOfferPayload?.selectedOffer !== undefined
            ? { selectedOffer: latestOfferPayload.selectedOffer }
            : {}),
        }
      : null;

    const preferredLanguage = normalizeLanguageCode(
      simulation.client?.language ?? simulation.ownerUser?.preferences?.language,
    );
    const commodity = mergedPayload?.type as "ELECTRICITY" | "GAS" | undefined;
    let pdfTemplate: {
      id: string;
      active: boolean;
      htmlContent: string;
      editableSections: unknown;
      translations: { languageCode: string; htmlContent: string }[];
    } | null = null;

    if (commodity) {
      const systemConfig = await prisma.systemConfig.findFirst({
        select: {
          defaultPdfTemplateGasId: true,
          defaultPdfTemplateElectricityId: true,
        },
      });
      const templateId =
        commodity === "GAS"
          ? systemConfig?.defaultPdfTemplateGasId
          : systemConfig?.defaultPdfTemplateElectricityId;
      if (templateId) {
        pdfTemplate = await prisma.pdfTemplate.findFirst({
          where: { id: templateId, isDeleted: false, active: true, commodity },
          select: {
            id: true,
            active: true,
            htmlContent: true,
            editableSections: true,
            translations: { select: { languageCode: true, htmlContent: true } },
          },
        });
      }
    }

    if (!pdfTemplate) {
      pdfTemplate = (await prisma.pdfTemplate.findUnique({
        where: { id: "simulation-output-default" },
        select: {
          id: true,
          active: true,
          htmlContent: true,
          editableSections: true,
          translations: { select: { languageCode: true, htmlContent: true } },
        },
      })) as typeof pdfTemplate;
    }
    if (!pdfTemplate?.active) {
      throw new ValidationError("PDF template not found or inactive");
    }

    const templateHtml =
      pdfTemplate.translations.find(
        (translation) =>
          translation.languageCode.trim().toLowerCase() === preferredLanguage,
      )?.htmlContent ?? pdfTemplate.htmlContent;
    const processedHtml = replaceVariables(
      templateHtml,
      extractVariableValues(
        simulation,
        (mergedPayload as SimulationPayload | null) ?? undefined,
        undefined,
        (pdfTemplate.editableSections as EditableSectionsConfig | null) ??
          undefined,
        undefined,
        preferredLanguage,
      ),
    );
    const fullHtml = processedHtml.includes("<!DOCTYPE html>")
      ? processedHtml
      : `<!DOCTYPE html><html lang="${preferredLanguage || "es"}"><head><meta charset="UTF-8"></head><body>${processedHtml}</body></html>`;
    const enrichedHtml = fullHtml.includes("</head>")
      ? fullHtml.replace("</head>", `${PDF_PAGE_BREAK_STYLE}\n</head>`)
      : `${PDF_PAGE_BREAK_STYLE}\n${fullHtml}`;

    const browser = await launchBrowser();
    let pdfBuffer: Uint8Array;
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(30_000);
      page.setDefaultNavigationTimeout(30_000);
      await installPdfResourceGuard(page);
      await page.setContent(enrichedHtml, { waitUntil: "load", timeout: 30_000 });
      pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "15mm", right: "12mm", bottom: "15mm", left: "12mm" },
        printBackground: true,
        preferCSSPageSize: false,
      });
    } finally {
      await browser.close();
    }

    const filename = buildSimulationPdfFilenameFromSimulation(
      {
        id: simulation.id,
        referenceNumber: simulation.referenceNumber,
        client: simulation.client,
        payloadJson: mergedPayload as any,
      },
      {
        productName: resolveSimulationProductName(mergedPayload as any),
      },
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
