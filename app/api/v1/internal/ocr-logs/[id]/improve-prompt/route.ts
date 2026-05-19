import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { convertPdfToImages } from "@/lib/pdfToImage";

/**
 * @swagger
 * /api/v1/internal/ocr-logs/{id}/improve-prompt:
 *   post:
 *     tags: [Invoices]
 *     summary: Improve the OCR extraction prompt based on user corrections in the linked simulation
 *     description: >
 *       Compares the OCR-extracted fields against the current simulation input values.
 *       Fields that the user changed are treated as corrections. The original prompt +
 *       correction context + stored invoice files are sent back to the LLM to generate
 *       an improved extraction prompt.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.configurations");

    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "OCR log id parameter is required" },
        { status: 400 },
      );
    }

    // ── 1. Fetch OCR log with files ────────────────────────────────────────
    const log = await prisma.ocrLog.findUnique({
      where: { id },
      include: {
        ocrFiles: true,
      },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, message: "OCR log not found" },
        { status: 404 },
      );
    }

    if (log.type !== "INVOICE_EXTRACTION") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Prompt improvement is only available for INVOICE_EXTRACTION logs",
        },
        { status: 400 },
      );
    }

    if (!log.promptText) {
      return NextResponse.json(
        { success: false, message: "OCR log has no stored prompt text" },
        { status: 400 },
      );
    }

    if (!log.extractedFields || typeof log.extractedFields !== "object") {
      return NextResponse.json(
        {
          success: false,
          message: "OCR log has no extracted fields to compare",
        },
        { status: 400 },
      );
    }

    // ── 2. Fetch linked simulation and latest version (if linked) ──────────
    const reportedIssue = (log as any).reportedIssue as string | null;

    if (!log.simulationId && !reportedIssue) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This OCR log is not linked to a simulation and has no reported issue. Cannot compare extracted fields against user corrections.",
        },
        { status: 400 },
      );
    }

    const simulation = log.simulationId
      ? await prisma.simulation.findUnique({
          where: { id: log.simulationId },
          select: { id: true, referenceNumber: true },
        })
      : null;

    const latestVersion = log.simulationId
      ? await prisma.simulationVersion.findFirst({
          where: { simulationId: log.simulationId },
          orderBy: { createdAt: "desc" },
          select: { payloadJson: true },
        })
      : null;

    // ── 3. Build field comparison (OCR vs current simulation values) ────────
    const extractedFields = log.extractedFields as Record<string, unknown>;

    const corrections: Array<{
      field: string;
      ocrValue: unknown;
      correctedValue: unknown;
    }> = [];

    const unchanged: string[] = [];

    // Mode A: linked simulation — compare extracted vs current payload
    if (latestVersion?.payloadJson) {
      const payload = latestVersion.payloadJson as Record<string, unknown>;
      // Current invoice data lives at payloadJson.invoiceData
      const currentInvoiceData = (payload.invoiceData ?? {}) as Record<
        string,
        unknown
      >;
      const normalise = (v: unknown) => (typeof v === "string" ? v.trim() : v);

      for (const [field, ocrValue] of Object.entries(extractedFields)) {
        const currentValue = currentInvoiceData[field];
        const ocrNorm = normalise(ocrValue);
        const curNorm = normalise(currentValue);

        if (curNorm === undefined || curNorm === null || curNorm === "") {
          // Field was removed — possibly OCR hallucinated it
          corrections.push({ field, ocrValue, correctedValue: null });
        } else if (String(ocrNorm) !== String(curNorm)) {
          corrections.push({ field, ocrValue, correctedValue: curNorm });
        } else {
          unchanged.push(field);
        }
      }

      // Also flag values that OCR missed but user filled in
      for (const [field, curValue] of Object.entries(currentInvoiceData)) {
        if (
          !(field in extractedFields) &&
          curValue !== null &&
          curValue !== undefined &&
          curValue !== ""
        ) {
          corrections.push({ field, ocrValue: null, correctedValue: curValue });
        }
      }
    } else if (log.simulationId) {
      // Linked simulation but no versions found
      return NextResponse.json(
        {
          success: false,
          message:
            "The linked simulation has no payload versions to compare against.",
        },
        { status: 400 },
      );
    }
    // Mode B: no simulation but has a reported issue — corrections derived from the issue text (handled in metaPrompt below)

    if (corrections.length === 0 && !reportedIssue) {
      return NextResponse.json({
        success: true,
        data: {
          noCorrections: true,
          message:
            "No corrections detected — the user kept all OCR-extracted values unchanged. There is nothing to improve.",
          corrections: [],
          unchanged,
        },
      });
    }

    // ── 3. Get LLM configuration ────────────────────────────────────────────
    const config = await prisma.systemConfig.findFirst();

    if (!(config as any)?.llmEnabled) {
      return NextResponse.json(
        { success: false, message: "LLM features are not enabled" },
        { status: 400 },
      );
    }

    const llmBaseUrl = (config as any).llmBaseUrl as string;
    const llmModelName = (config as any).llmModelName as string;
    const llmProvider = ((config as any).llmProvider as string) || "ollama";
    const llmApiKey = (config as any).llmApiKey as string | null;
    const llmTemperature = Number((config as any).llmTemperature) || 0.1;
    const llmMaxTokens = Number((config as any).llmMaxTokens) || 4000;

    if (!llmBaseUrl || !llmModelName) {
      return NextResponse.json(
        { success: false, message: "LLM is not properly configured" },
        { status: 400 },
      );
    }

    if (llmProvider === "ollama") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Prompt improvement is not supported with local Ollama (no vision). Please use Ollama Cloud, OpenAI, Anthropic, or Google AI.",
        },
        { status: 400 },
      );
    }

    // ── 4. Encode stored files as base64 ───────────────────────────────────
    const encodedFiles = (log as any).ocrFiles.map(
      (f: { fileData: Buffer; fileType: string | null; fileName: string }) => ({
        base64: f.fileData.toString("base64"),
        mimeType: f.fileType ?? "application/octet-stream",
        fileName: f.fileName,
      }),
    );

    if (encodedFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No stored files found for this OCR log. Cannot re-send the invoice to the LLM.",
        },
        { status: 400 },
      );
    }

    // ── 5. Build the improvement meta-prompt ───────────────────────────────
    let metaPrompt: string;

    if (corrections.length > 0) {
      // Simulation-based corrections mode
      const correctionLines = corrections
        .map(({ field, ocrValue, correctedValue }) => {
          if (ocrValue === null && correctedValue !== null) {
            return `  • "${field}": not extracted — correct value is "${correctedValue}"`;
          }
          if (correctedValue === null) {
            return `  • "${field}": extracted as "${ocrValue}" but this field should be empty / was removed by the user`;
          }
          return `  • "${field}": extracted as "${ocrValue}" but the correct value is "${correctedValue}"`;
        })
        .join("\n");

      metaPrompt = `You are an expert invoice-data extraction engineer. Your goal is to write the most efficient prompt possible to make an LLM correctly extract every required field from a Spanish energy invoice.

You have been given:
1. The ORIGINAL extraction prompt
2. A list of FIELDS THAT WERE WRONG OR MISSING after the last extraction run
3. The actual invoice file(s) that were processed

Study the invoice carefully. For each wrong or missing field, find exactly where the correct value appears in the invoice and determine the best way to instruct the LLM to locate and return it.

ORIGINAL PROMPT:
---
${log.promptText}
---

FIELDS THAT WERE WRONG OR MISSING:
${correctionLines}

YOUR TASK:
Rewrite the prompt so it reliably extracts ALL required fields — including every field listed above — from this type of invoice.
Feel free to restructure, rephrase, add examples, add layout hints, or change any instruction you think will help.
The only constraint is that the output JSON field names must stay the same.
Return ONLY the complete rewritten prompt — no commentary, no markdown fences, just the raw prompt text.`;
    } else {
      // Reported-issue mode — no simulation linked, use the user's free-text report
      metaPrompt = `You are an expert invoice-data extraction engineer. Your goal is to write the most efficient prompt possible to make an LLM correctly extract every required field from a Spanish energy invoice.

You have been given:
1. The ORIGINAL extraction prompt
2. A REPORTED ISSUE describing what went wrong with the last extraction
3. The actual invoice file(s) that were processed

Study the invoice carefully. Understand exactly what the problem is, where the correct data appears in the invoice, and determine the best way to instruct the LLM to find and return it.

ORIGINAL PROMPT:
---
${log.promptText}
---

REPORTED ISSUE:
${reportedIssue}

YOUR TASK:
Rewrite the prompt so it reliably extracts ALL required fields and resolves the reported issue.
Feel free to restructure, rephrase, add examples, add layout hints, or change any instruction you think will help.
The only constraint is that the output JSON field names must stay the same.
Return ONLY the complete rewritten prompt — no commentary, no markdown fences, just the raw prompt text.`;
    }

    // ── 6. Call LLM ────────────────────────────────────────────────────────
    // Helper: build the right content part depending on file type and provider
    const isPdf = (mime: string) =>
      mime === "application/pdf" || mime.endsWith("/pdf");
    const isImage = (mime: string) => mime.startsWith("image/");

    const toOpenAIFilePart = (f: {
      base64: string;
      mimeType: string;
      fileName: string;
    }): any => {
      if (isPdf(f.mimeType)) {
        // OpenAI / compatible: use the `file` content type for PDFs
        return {
          type: "file",
          file: {
            filename: f.fileName,
            file_data: `data:${f.mimeType};base64,${f.base64}`,
          },
        };
      }
      // Images → image_url
      return {
        type: "image_url",
        image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
      };
    };

    let llmResponse: Response;
    try {
      if (llmProvider === "ollama-cloud") {
        // Ollama Cloud does not support native PDFs — convert them to images first
        const resolvedFiles: Array<{
          base64: string;
          mimeType: string;
          fileName: string;
        }> = [];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            const pdfImages = await convertPdfToImages(
              Buffer.from(f.base64, "base64"),
              2,
              1.5,
            );
            for (const img of pdfImages) {
              resolvedFiles.push({
                base64: img.base64,
                mimeType: img.mimeType,
                fileName: f.fileName,
              });
            }
          } else {
            resolvedFiles.push(f);
          }
        }

        const content: any[] = [{ type: "text", text: metaPrompt }];
        for (const f of resolvedFiles) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
          });
        }
        llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
          },
          body: JSON.stringify({
            model: llmModelName,
            messages: [{ role: "user", content }],
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }),
          signal: AbortSignal.timeout(300000),
        });
      } else if (llmProvider === "openai" || llmProvider === "azure-openai") {
        const content: any[] = [{ type: "text", text: metaPrompt }];
        for (const f of encodedFiles) {
          content.push(toOpenAIFilePart(f));
        }
        llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
          },
          body: JSON.stringify({
            model: llmModelName,
            messages: [{ role: "user", content }],
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }),
          signal: AbortSignal.timeout(60000),
        });
      } else if (llmProvider === "anthropic") {
        const content: any[] = [{ type: "text", text: metaPrompt }];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            // Anthropic supports PDFs via the `document` content type
            content.push({
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: f.base64,
              },
            });
          } else if (isImage(f.mimeType)) {
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: f.mimeType,
                data: f.base64,
              },
            });
          }
        }
        llmResponse = await fetch(`${llmBaseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": llmApiKey || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: llmModelName,
            max_tokens: llmMaxTokens,
            messages: [{ role: "user", content }],
          }),
          signal: AbortSignal.timeout(60000),
        });
      } else if (llmProvider === "google") {
        const parts: any[] = [{ text: metaPrompt }];
        for (const f of encodedFiles) {
          parts.push({
            inline_data: { mime_type: f.mimeType, data: f.base64 },
          });
        }
        llmResponse = await fetch(
          `${llmBaseUrl}/models/${llmModelName}:generateContent?key=${llmApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts }] }),
            signal: AbortSignal.timeout(60000),
          },
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            message: `Provider "${llmProvider}" is not supported`,
          },
          { status: 400 },
        );
      }
    } catch (fetchError: unknown) {
      const msg =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error("[improve-prompt] LLM fetch error:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to reach the LLM endpoint: ${msg}`,
        },
        { status: 502 },
      );
    }

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return NextResponse.json(
        {
          success: false,
          message: `LLM API error: ${llmResponse.status} ${llmResponse.statusText}`,
          details: errorText.substring(0, 500),
        },
        { status: 500 },
      );
    }

    const llmData = await llmResponse.json();

    // ── 7. Extract text from response ──────────────────────────────────────
    let improvedPrompt = "";
    if (
      llmProvider === "openai" ||
      llmProvider === "azure-openai" ||
      llmProvider === "ollama-cloud"
    ) {
      const msg = llmData.choices?.[0]?.message;
      improvedPrompt = msg?.content || msg?.reasoning || "";
    } else if (llmProvider === "anthropic") {
      improvedPrompt = llmData.content?.[0]?.text || "";
    } else if (llmProvider === "google") {
      improvedPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!improvedPrompt) {
      return NextResponse.json(
        { success: false, message: "LLM returned an empty response" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        improvedPrompt,
        corrections,
        unchanged,
        simulationId: log.simulationId,
        simulationReferenceNumber: simulation?.referenceNumber ?? null,
      },
    });
  },
);
