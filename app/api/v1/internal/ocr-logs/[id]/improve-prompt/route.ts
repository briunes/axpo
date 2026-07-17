import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import {
  convertPdfToImages,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_RENDER_SCALE,
} from "@/lib/pdfToImage";
import {
  getAiUsage,
  getBedrockRuntimeBaseUrl,
  isBedrockMantleProvider,
  isOpenAiCompatibleProvider,
  resolveAiConfigFromSystemConfig,
} from "@/application/lib/aiConfig";

const isNvidiaBedrockRuntime = (provider: string): boolean =>
  provider === "aws-bedrock-nvidia";

const getBedrockImageFormat = (mimeType: string): "png" | "jpeg" | "gif" | "webp" => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpeg";
};

const COMMON_CORRECTION_FIELDS = new Set([
  "cups",
  "nombreTitular",
  "personaContacto",
  "direccion",
  "clienteAddress",
  "comercializadorActual",
  "cif",
  "tarifaAcceso",
  "zonaGeografica",
  "fechaInicio",
  "fechaFin",
  "facturaActual",
  "alquiler",
  "otrosCargos",
  "importePotencia",
  "importeEnergia",
  "importeImpuestoElectrico",
  "importeIva",
  "ivaTasa",
  "invoiceType",
]);

const ELECTRICITY_CORRECTION_FIELDS = new Set([
  ...COMMON_CORRECTION_FIELDS,
  "perfilCarga",
  "consumoAnual",
  "consumoP1",
  "consumoP2",
  "consumoP3",
  "consumoP4",
  "consumoP5",
  "consumoP6",
  "potenciaP1",
  "potenciaP2",
  "potenciaP3",
  "potenciaP4",
  "potenciaP5",
  "potenciaP6",
  "precioPotenciaP1",
  "precioPotenciaP2",
  "precioPotenciaP3",
  "precioPotenciaP4",
  "precioPotenciaP5",
  "precioPotenciaP6",
  "precioEnergiaP1",
  "precioEnergiaP2",
  "precioEnergiaP3",
  "precioEnergiaP4",
  "precioEnergiaP5",
  "precioEnergiaP6",
  "excesoPotencia",
  "reactiva",
  "impuestoElectricoTasa",
]);

const GAS_CORRECTION_FIELDS = new Set([
  ...COMMON_CORRECTION_FIELDS,
  "consumoTotal",
  "impuestoHidrocarburo",
  "telemedida",
]);

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
    assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
    await assertPermission(auth, "section.ocr-logs");

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

    // ── 2. Read invoice provider info from log metadata or request body ───
    let bodyJson: Record<string, unknown> = {};
    try {
      const bodyText = await request.text();
      if (bodyText.trim()) bodyJson = JSON.parse(bodyText);
    } catch {
      // no body or invalid JSON — ignore
    }

    const logMetadata = (log.metadata ?? {}) as Record<string, unknown>;

    // Optional: a previously-improved prompt to iterate on (re-improve flow)
    const previousPromptOverride =
      (bodyJson.previousPrompt as string | null) ?? null;
    // Optional: free-text feedback from the user about what is still wrong
    const feedbackComment = (bodyJson.feedbackComment as string | null) ?? null;

    const invoiceProviderId =
      (bodyJson.invoiceProviderId as string | null) ??
      (logMetadata.invoiceProviderId as string | null) ??
      null;
    const invoiceType: "ELECTRICITY" | "GAS" =
      (bodyJson.invoiceType as "ELECTRICITY" | "GAS" | undefined) ??
      (logMetadata.invoiceType as "ELECTRICITY" | "GAS" | undefined) ??
      "ELECTRICITY";

    let invoiceProviderName: string | null =
      (bodyJson.invoiceProviderName as string | null) ??
      (logMetadata.invoiceProviderName as string | null) ??
      null;

    // Fetch provider record (for name and existing prompts)
    let providerRecord: {
      id: string;
      name: string;
      promptElectricity: string;
      promptGas: string;
    } | null = null;
    if (invoiceProviderId) {
      try {
        providerRecord = await (prisma as any).invoiceProviderPrompt.findUnique(
          {
            where: { id: invoiceProviderId },
            select: {
              id: true,
              name: true,
              promptElectricity: true,
              promptGas: true,
            },
          },
        );
        if (providerRecord) invoiceProviderName = providerRecord.name;
      } catch {
        // non-fatal
      }
    }

    // ── 3. Fetch linked simulation and latest version (if linked) ──────────
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

    // ── 4. Build field comparison (OCR vs current simulation values) ────────
    const extractedFields = log.extractedFields as Record<string, unknown>;

    const corrections: Array<{
      field: string;
      ocrValue: unknown;
      correctedValue: unknown;
    }> = [];
    const correctionFields =
      invoiceType === "GAS" ? GAS_CORRECTION_FIELDS : ELECTRICITY_CORRECTION_FIELDS;

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
        if (!correctionFields.has(field)) continue;

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
        if (!correctionFields.has(field)) continue;

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
          invoiceProviderId,
          invoiceProviderName,
          invoiceType,
          message:
            "No corrections detected — the user kept all OCR-extracted values unchanged. There is nothing to improve.",
          corrections: [],
          unchanged,
        },
      });
    }

    // ── 5. Get LLM configuration ────────────────────────────────────────────
    const config = await prisma.systemConfig.findFirst();

    if (!(config as any)?.llmEnabled) {
      return NextResponse.json(
        { success: false, message: "LLM features are not enabled" },
        { status: 400 },
      );
    }

    const aiConfig = resolveAiConfigFromSystemConfig(
      config as Record<string, any>,
      "promptImprovement",
      { defaultTemperature: 0.1, defaultMaxTokens: 4000, minMaxTokens: 8000 },
    );
    const llmBaseUrl = aiConfig?.baseUrl as string;
    const llmModelName = aiConfig?.modelName as string;
    const llmProvider = aiConfig?.provider || "ollama";
    const llmApiKey = aiConfig?.apiKey as string | null;
    const llmTemperature = aiConfig?.temperature ?? 0.1;
    // For prompt generation we need a much larger token budget than for normal extraction.
    // Use at least 8000 tokens so the generated prompt is never truncated mid-way.
    const llmMaxTokens = aiConfig?.maxTokens ?? 8000;

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

    // ── 6. Encode stored files as base64 ───────────────────────────────────
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

    // ── 7. Build the improvement meta-prompt ───────────────────────────────
    const providerLabel = invoiceProviderName
      ? `${invoiceProviderName} (${invoiceType})`
      : `Unknown provider (${invoiceType})`;

    // When re-improving, use the already-improved prompt as the base instead of
    // the original extraction prompt stored on the log.
    const basePrompt = previousPromptOverride?.trim() || log.promptText || "";
    const isReImprove = !!previousPromptOverride?.trim();

    // Previously extracted data (what OCR returned)
    const extractedFieldsJson = JSON.stringify(
      log.extractedFields ?? {},
      null,
      2,
    );

    // Fields that matched the latest simulation values. These are useful because
    // the generated prompt should preserve working extraction behaviour instead
    // of rewriting everything and causing regressions.
    const unchangedFieldsJson = JSON.stringify(unchanged, null, 2);

    const promptEvolutionInstructions = `PROMPT EVOLUTION WORKFLOW — INTERNAL ONLY
Before writing the final improved prompt, think through this workflow internally:

1. Failure analysis
   - Analyse every corrected or reported field.
   - Identify why the previous extraction failed.
   - Classify each failure as one or more of:
     - label ambiguity
     - layout ambiguity
     - OCR noise
     - provider-specific formatting
     - table extraction issue
     - supplier/client confusion
     - period/date ambiguity
     - unit/decimal/comma conversion issue
     - hallucination
     - missing search instruction

2. Prompt gap analysis
   - Compare the invoice layout against the previous prompt.
   - For each corrected/reported issue, determine whether the previous prompt already covered it.
   - If it was covered, strengthen the rule so it becomes more deterministic.
   - If it was not covered, add the missing extraction rule.

3. Provider template analysis
   - Identify recurring sections in this invoice template.
   - Identify client/holder blocks, supplier blocks, CUPS/supply blocks, tariff blocks, consumption tables, power tables, tax/fee sections, totals, dates, and contract metadata.
   - Use these observations to write provider-specific location hints.

4. Regression prevention
   - Corrections indicate failures.
   - Unchanged fields indicate successful extraction.
   - Preserve all successful extraction logic unless it directly conflicts with a correction.
   - Do not introduce broad rules that could break fields that were already extracted correctly.

5. Minimal improvement strategy
   - The objective is NOT to rewrite the prompt for style.
   - The objective is to evolve the prompt to fix the observed failures while preserving working behaviour.
   - Add the minimum necessary rules to improve accuracy.
   - Remove duplicate or conflicting instructions.
   - Prefer concise, deterministic instructions over long explanations.

6. Confidence and anti-hallucination rules
   - Prefer explicit labels over nearby unrelated values.
   - Prefer client/holder labels over supplier/header labels.
   - If multiple candidate values exist, choose the value with the strongest evidence.
   - Never guess.
   - Return null only if the value is genuinely absent after a thorough search.

IMPORTANT OUTPUT RULE:
Do NOT output the analysis above.
Only output the final complete improved extraction prompt.`;

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

      metaPrompt = `You are an expert invoice-data extraction engineer specialising in Spanish energy invoices.

Your task is to create the BEST POSSIBLE dedicated extraction prompt for ${invoiceType} invoices issued by the provider: ${invoiceProviderName ?? "(unknown — identify from the invoice)"}.

Most invoices from the same provider follow the same template with very minor layout variations. Study the attached invoice carefully and use its structure, field positions, labels, tables, formatting, and repeated sections to craft a prompt that will reliably extract all required fields from any invoice with this template.

You have been provided with:
1. The ${isReImprove ? "PREVIOUSLY IMPROVED prompt (already refined once — iterate further on this one)" : "PREVIOUS prompt that was used for this extraction"}
2. The DATA THAT WAS PREVIOUSLY EXTRACTED by the OCR (what the AI returned)
3. A list of CORRECTIONS that the user applied (fields that were wrong or missing)${feedbackComment ? "\n4. ADDITIONAL USER FEEDBACK on what is still wrong after the last improvement\n5. A list of UNCHANGED fields that were already extracted correctly\n6. The ACTUAL INVOICE FILE(S) that were processed" : "\n4. A list of UNCHANGED fields that were already extracted correctly\n5. The ACTUAL INVOICE FILE(S) that were processed"}

PROVIDER: ${providerLabel}

${isReImprove ? "PREVIOUSLY IMPROVED PROMPT (iterate on this one, not on the original):" : "PREVIOUS PROMPT:"}
---
${basePrompt}
---

PREVIOUSLY EXTRACTED DATA (what the AI returned):
${extractedFieldsJson}

USER CORRECTIONS (fields the AI got wrong or missed):
${correctionLines}${
        feedbackComment
          ? `

ADDITIONAL USER FEEDBACK (what is still wrong — highest priority):
${feedbackComment}`
          : ""
      }

UNCHANGED FIELDS (fields that appear to have been extracted correctly and should not regress):
${unchangedFieldsJson}

${promptEvolutionInstructions}

YOUR GOAL:
Write a complete, standalone extraction prompt specifically tailored to ${invoiceProviderName ?? "this provider"}'s ${invoiceType} invoice format.

The improved prompt MUST:
- Be fully self-contained (no references to "previous prompt", "original prompt", "corrections", or "this sample")
- Keep ALL the same output JSON field names as the previous prompt — do NOT drop any field
- Include provider-specific layout hints, label names, nearby text, section names, table names, and field locations as observed in the invoice
- Address every correction listed above with explicit instructions on where/how to find the correct value
- Preserve rules that successfully extracted unchanged fields
- Work reliably for all invoices from this provider, not just this specific one
- Instruct the extraction AI to return ONLY a valid JSON object
- Be concise enough to avoid unnecessary prompt bloat, but detailed enough to prevent the same mistakes

The improved prompt MUST NOT:
- Mention that it was generated from corrections
- Mention this meta-task
- Include analysis, commentary, markdown fences, or explanations outside the final prompt
- Hardcode any value from the sample invoice
- Tell the extraction AI to always return a fixed value for any field
- Remove or skip fields only because they are absent in the sample invoice

⚠️ CRITICAL ANTI-HARDCODING RULE — READ THIS CAREFULLY:
The prompt you write is a TEMPLATE that will be used on MANY different invoices from this provider, not only on the sample invoice you are looking at now.
DIFFERENT invoices from the same provider will have DIFFERENT values, and some fields that appear empty in this sample may be present in other invoices.
Therefore:
- NEVER instruct the extraction AI to return a fixed/hardcoded value for any field (e.g., do NOT write 'always return telemedida: ""' or 'zonaGeografica is not applicable — return ""').
- NEVER instruct the AI to skip or omit a field just because it is absent from this particular sample invoice.
- For every field in the JSON schema, the prompt must tell the AI WHERE to look for it on any invoice of this template, and to return null only if genuinely absent after a thorough search.
- Fields like zonaGeografica, telemedida, perfilCarga, alquiler, otrosCargos, importePotencia, importeEnergia, importeImpuestoElectrico, importeIva, consumoAnual, etc. may be present on other invoices from this provider even if they are absent from the sample. Always try to extract them dynamically.

Return ONLY the complete new prompt text — no commentary, no markdown fences, no preamble.`;
    } else {
      // Reported-issue mode — no simulation linked, use the user's free-text report
      metaPrompt = `You are an expert invoice-data extraction engineer specialising in Spanish energy invoices.

Your task is to create the BEST POSSIBLE dedicated extraction prompt for ${invoiceType} invoices issued by the provider: ${invoiceProviderName ?? "(unknown — identify from the invoice)"}.

Most invoices from the same provider follow the same template with very minor layout variations. Study the attached invoice carefully and use its structure, field positions, labels, tables, formatting, and repeated sections to craft a prompt that will reliably extract all required fields from any invoice with this template.

You have been provided with:
1. The ${isReImprove ? "PREVIOUSLY IMPROVED prompt (already refined once — iterate further on this one)" : "PREVIOUS prompt that was used for this extraction"}
2. The DATA THAT WAS PREVIOUSLY EXTRACTED by the OCR (what the AI returned)
3. A REPORTED ISSUE describing what went wrong with the extraction${feedbackComment ? "\n4. ADDITIONAL USER FEEDBACK on what is still wrong after the last improvement\n5. The ACTUAL INVOICE FILE(S) that were processed" : "\n4. The ACTUAL INVOICE FILE(S) that were processed"}

PROVIDER: ${providerLabel}

${isReImprove ? "PREVIOUSLY IMPROVED PROMPT (iterate on this one, not on the original):" : "PREVIOUS PROMPT:"}
---
${basePrompt}
---

PREVIOUSLY EXTRACTED DATA (what the AI returned):
${extractedFieldsJson}

REPORTED ISSUE:
${reportedIssue}${
        feedbackComment
          ? `

ADDITIONAL USER FEEDBACK (what is still wrong — highest priority):
${feedbackComment}`
          : ""
      }

${promptEvolutionInstructions}

YOUR GOAL:
Write a complete, standalone extraction prompt specifically tailored to ${invoiceProviderName ?? "this provider"}'s ${invoiceType} invoice format.

The improved prompt MUST:
- Be fully self-contained (no references to "previous prompt", "original prompt", "reported issue", or "this sample")
- Keep ALL the same output JSON field names as the previous prompt — do NOT drop any field
- Include provider-specific layout hints, label names, nearby text, section names, table names, and field locations as observed in the invoice
- Directly address the reported issue with explicit extraction instructions
- Preserve any extraction logic that appears to have worked correctly
- Work reliably for all invoices from this provider, not just this specific one
- Instruct the extraction AI to return ONLY a valid JSON object
- Be concise enough to avoid unnecessary prompt bloat, but detailed enough to prevent the same mistakes

The improved prompt MUST NOT:
- Mention that it was generated from a reported issue
- Mention this meta-task
- Include analysis, commentary, markdown fences, or explanations outside the final prompt
- Hardcode any value from the sample invoice
- Tell the extraction AI to always return a fixed value for any field
- Remove or skip fields only because they are absent in the sample invoice

⚠️ CRITICAL ANTI-HARDCODING RULE — READ THIS CAREFULLY:
The prompt you write is a TEMPLATE that will be used on MANY different invoices from this provider, not only on the sample invoice you are looking at now.
DIFFERENT invoices from the same provider will have DIFFERENT values, and some fields that appear empty in this sample may be present in other invoices.
Therefore:
- NEVER instruct the extraction AI to return a fixed/hardcoded value for any field (e.g., do NOT write 'always return telemedida: ""' or 'zonaGeografica is not applicable — return ""').
- NEVER instruct the AI to skip or omit a field just because it is absent from this particular sample invoice.
- For every field in the JSON schema, the prompt must tell the AI WHERE to look for it on any invoice of this template, and to return null only if genuinely absent after a thorough search.
- Fields like zonaGeografica, telemedida, perfilCarga, alquiler, otrosCargos, importePotencia, importeEnergia, importeImpuestoElectrico, importeIva, consumoAnual, etc. may be present on other invoices from this provider even if they are absent from the sample. Always try to extract them dynamically.

Return ONLY the complete new prompt text — no commentary, no markdown fences, no preamble.`;
    }

    // ── 8. Call LLM ────────────────────────────────────────────────────────
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
              OCR_MAX_PDF_PAGES,
              OCR_PDF_RENDER_SCALE,
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
      } else if (isNvidiaBedrockRuntime(llmProvider)) {
        const resolvedFiles: Array<{
          base64: string;
          mimeType: string;
          fileName: string;
        }> = [];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            const pdfImages = await convertPdfToImages(
              Buffer.from(f.base64, "base64"),
              OCR_MAX_PDF_PAGES,
              OCR_PDF_RENDER_SCALE,
            );
            for (const img of pdfImages) {
              resolvedFiles.push({
                base64: img.base64,
                mimeType: img.mimeType,
                fileName: f.fileName,
              });
            }
          } else if (isImage(f.mimeType)) {
            resolvedFiles.push(f);
          }
        }

        const content: any[] = [{ text: metaPrompt }];
        for (const f of resolvedFiles) {
          content.push({
            image: {
              format: getBedrockImageFormat(f.mimeType),
              source: { bytes: f.base64 },
            },
          });
        }
        const bedrockBaseUrl = llmBaseUrl.replace(/\/+$/, "");
        llmResponse = await fetch(
          `${bedrockBaseUrl}/model/${encodeURIComponent(llmModelName)}/converse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
            },
            body: JSON.stringify({
              messages: [{ role: "user", content }],
              inferenceConfig: {
                maxTokens: llmMaxTokens,
                temperature: llmTemperature,
              },
            }),
            signal: AbortSignal.timeout(300000),
          },
        );
      } else if (isBedrockMantleProvider(llmProvider)) {
        const content: any[] = [{ type: "text", text: metaPrompt }];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            const imgs = await convertPdfToImages(
              Buffer.from(f.base64, "base64"),
              OCR_MAX_PDF_PAGES,
              OCR_PDF_RENDER_SCALE,
            );
            for (const img of imgs) {
              content.push({
                type: "image_url",
                image_url: {
                  url: `data:${img.mimeType};base64,${img.base64}`,
                },
              });
            }
          } else if (isImage(f.mimeType)) {
            content.push({
              type: "image_url",
              image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
            });
          }
        }
        const bedrockBaseUrl = getBedrockRuntimeBaseUrl(llmBaseUrl);
        llmResponse = await fetch(
          `${bedrockBaseUrl}/model/${encodeURIComponent(llmModelName)}/invoke`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
            },
            body: JSON.stringify({
              messages: [{ role: "user", content }],
              temperature: llmTemperature,
              max_tokens: llmMaxTokens,
            }),
            signal: AbortSignal.timeout(300000),
          },
        );
      } else if (isOpenAiCompatibleProvider(llmProvider)) {
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

    // ── 9. Extract text from response ──────────────────────────────────────
    let improvedPrompt = "";
    if (
      isOpenAiCompatibleProvider(llmProvider) ||
      isBedrockMantleProvider(llmProvider)
    ) {
      const msg = llmData.choices?.[0]?.message;
      improvedPrompt = msg?.content || msg?.reasoning || "";
    } else if (llmProvider === "anthropic") {
      improvedPrompt = llmData.content?.[0]?.text || "";
    } else if (isNvidiaBedrockRuntime(llmProvider)) {
      improvedPrompt = llmData.output?.message?.content?.[0]?.text || "";
    } else if (llmProvider === "google") {
      improvedPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!improvedPrompt) {
      return NextResponse.json(
        { success: false, message: "LLM returned an empty response" },
        { status: 500 },
      );
    }

    try {
      const usage = getAiUsage(llmData, llmProvider);
      await prisma.ocrLog.create({
        data: {
          userId: auth.userId,
          userEmail: auth.email,
          simulationId: log.simulationId,
          type: "PROMPT_IMPROVEMENT",
          status: "SUCCESS",
          provider: llmProvider,
          model: llmModelName,
          baseUrl: llmBaseUrl,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          promptText: metaPrompt,
          extractedFields: { improvedPrompt },
          fieldsExtracted: 1,
          metadata: {
            sourceOcrLogId: log.id,
            invoiceProviderId,
            invoiceProviderName,
            invoiceType,
            correctionsCount: corrections.length,
            aiProviderConfigId: aiConfig?.id,
            aiTask: "promptImprovement",
          },
        },
      });
    } catch (err) {
      console.error("[OCR Log] Failed to save prompt-improvement usage:", err);
    }

    return NextResponse.json({
      success: true,
      data: {
        improvedPrompt,
        corrections,
        unchanged,
        simulationId: log.simulationId,
        simulationReferenceNumber: simulation?.referenceNumber ?? null,
        invoiceProviderId,
        invoiceProviderName,
        invoiceType,
      },
    });
  },
);
