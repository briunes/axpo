import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { convertPdfToImages } from "@/lib/pdfToImage";

/**
 * LLM Prompt for Invoice Data Extraction
 *
 * This prompt is designed to extract all necessary fields from Spanish energy invoices
 * (electricity and gas) to populate simulation forms.
 */
const INVOICE_EXTRACTION_PROMPT = `You are an expert at extracting data from Spanish energy invoices (electricity and gas).

IMPORTANT PRIORITY RULE — CLIENT CIF EXTRACTION

Spanish energy invoices often contain TWO CIF/NIF values:
1. the ENERGY COMPANY CIF
2. the CLIENT/HOLDER CIF

You MUST extract ONLY the CLIENT/HOLDER CIF.

NEVER extract the supplier/provider CIF.

EXAMPLE OF WRONG CIF:
"IBERDROLA CLIENTES, S.A.U. CIF A-95758389"
This is the ENERGY COMPANY CIF.
IGNORE IT.

EXAMPLE OF CORRECT CIF:
"CIF titular: B53572871"
This is the CLIENT CIF.
USE THIS VALUE.

When extracting the "cif" field:
- prioritize labels:
  - "CIF titular"
  - "NIF titular"
  - "CIF cliente"
  - "NIF cliente"
  - "Titular"
  - "Cliente"

- NEVER use CIF values:
  - near the logo
  - in the header
  - near supplier company names
  - near "IBERDROLA", "ENDESA", "NATURGY", "REPSOL", etc.

- If the invoice contains:
  - "CIF titular"
  AND
  - another CIF near the supplier name

ALWAYS use ONLY the "CIF titular" value.

For Iberdrola invoices:
the client CIF is usually located inside:
"INFORMACION ADICIONAL"

Example:
"CIF titular: B53572871"

Return:
"cif": "B53572871"

Extract ALL available information from the provided invoice and return it as a JSON object. Be thorough and precise.

CRITICAL BILLING PERIOD RULE:

Invoices may contain multiple unrelated dates:
- issue date
- payment date
- contract dates
- meter reading dates

For fechaInicio and fechaFin:
- prioritize the explicit billing period
- prioritize labels like:
  - "Periodo de facturación"
  - "Periodo facturado"
  - "Facturación desde/hasta"
  - "Desde / Hasta"

The correct billing period usually forms a continuous period of approximately:
- 28 to 31 days for monthly invoices

Example:
"Periodo de facturación: 01.03.2026 - 31.03.2026"

Return:
"fechaInicio": "2026-03-01"
"fechaFin": "2026-03-31"

NEVER use:
- invoice issue date
- payment due date
- contract expiration date
as billing period dates.

CRITICAL PERIOD IDENTIFICATION RULE (VERY IMPORTANT):

The invoice periods MUST be mapped using the ACTUAL printed period labels from the invoice.

NEVER assign values by order or position.

NEVER assume:
- first value = P1
- second value = P2
- third value = P3

ONLY use the explicit period identifier shown on the invoice.

Examples:

If the invoice shows:
- Periodo 2 → 1200 kWh
- Periodo 3 → 800 kWh
- Periodo 6 → 150 kWh

You MUST return:
{
  "consumoP2": 1200,
  "consumoP3": 800,
  "consumoP6": 150
}

You MUST NOT return:
{
  "consumoP1": 1200,
  "consumoP2": 800,
  "consumoP3": 150
}

The same rule applies to:
- consumoP1..P6
- potenciaP1..P6
- precioPotenciaP1..P6
- precioEnergiaP1..P6

If a period does NOT explicitly appear on the invoice:
- DO NOT create the field
- DO NOT infer it
- DO NOT shift another period into it

For example:
If only P2, P3 and P6 exist,
return ONLY:
- consumoP2
- consumoP3
- consumoP6

and OMIT:
- consumoP1
- consumoP4
- consumoP5

CRITICAL TARIFF EXTRACTION RULE (VERY IMPORTANT):

tarifaAcceso MUST ONLY be extracted from an EXPLICIT tariff label printed on the invoice.

NEVER infer tarifaAcceso from:
- number of periods
- existence of P4/P5/P6
- contracted powers
- energy periods
- industrial-looking layouts
- consumption tables

The ONLY valid source is an explicit field such as:
- "Peaje de acceso a la red (ATR)"
- "Tarifa de acceso"
- "Tarifa"
- "Tipo de tarifa"

Examples:

If the invoice explicitly says:
"Peaje de acceso a la red (ATR): 3.0TD"

You MUST return:
"tarifaAcceso": "3.0TD"

Even if:
- periods P1..P6 exist
- six power periods exist
- six energy periods exist

DO NOT convert 3.0TD into 6.1TD.

6.1TD must ONLY be returned if the invoice explicitly prints:
- "6.1TD"

If the invoice explicitly says 3.0TD anywhere,
ALWAYS prioritize that exact printed value.

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: ⚠️ MANDATORY — CUPS code (Código Universal del Punto de Suministro). Look for the label "Identificación punto de suministro (CUPS)", "CUPS", or "Punto de suministro". The value ALWAYS starts with "ES" and is 20-22 characters long. It is often printed with spaces between groups (e.g. "ES 0021 0000 0046 0347 YE") — you MUST strip ALL spaces and return it as one continuous string (e.g. "ES0021000000460347YE"). IMPORTANT: do NOT confuse with barcodes or long numeric reference codes printed elsewhere — only use the value next to the explicit CUPS label. Never skip this field.
   - nombreTitular: Full name of the invoice holder/titular
   - personaContacto: Contact person name
   - direccion: Complete supply address (dirección de suministro)
   - comercializadorActual: Current energy marketer/supplier name
   - cif: Tax ID (CIF/NIF) of the CLIENT/HOLDER only.
     NEVER use the supplier/provider CIF.
     Example of WRONG value:
     "A-95758389" (Iberdrola provider CIF)
     Example of CORRECT value:
     "B53572871" (CIF titular)

2. TARIFF AND ZONE:
   - tarifaAcceso: ⚠️ MANDATORY — Access tariff.

     Look ONLY for explicit labels:
     - "Peaje de acceso a la red (ATR)"
     - "Tarifa de acceso"
     - "Tarifa"
     - "Tipo de tarifa"

     Valid electricity values are ONLY:
     - "2.0TD"
     - "3.0TD"
     - "6.1TD"

     IMPORTANT:
     3.0TD and 6.1TD BOTH commonly contain P1-P6 periods.

     Therefore:
     - the number of periods MUST NEVER be used to determine the tariff
     - the tariff MUST ONLY come from the explicitly printed tariff label

     Valid gas values are:
     - "RL.1"
     - "RL.2"
     - "RL.3"
     - etc.

     Never skip this field.

   - zonaGeografica: Geographic zone ("Peninsula", "Baleares", "Canarias" for electricity, or specific gas zone)
   - perfilCarga: Load profile ("NORMAL", "DIURNO" for electricity)

3. BILLING PERIOD:
   - fechaInicio: Start date of billing period (format: YYYY-MM-DD)
   - fechaFin: End date of billing period (format: YYYY-MM-DD)

4. ENERGY CONSUMPTION (Consumo de Energía):
   For electricity, extract by period:
   - consumoP1: Consumption in period P1 (kWh)
   - consumoP2: Consumption in period P2 (kWh)
   - consumoP3: Consumption in period P3 (kWh)
   - consumoP4: Consumption in period P4 (kWh)
   - consumoP5: Consumption in period P5 (kWh)
   - consumoP6: Consumption in period P6 (kWh)
   - consumoAnual: Annual consumption (kWh)

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

5. CONTRACTED POWER (Potencia Contratada - electricity only):
   - potenciaP1: Contracted power P1 (kW)
   - potenciaP2: Contracted power P2 (kW)
   - potenciaP3: Contracted power P3 (kW)
   - potenciaP4: Contracted power P4 (kW)
   - potenciaP5: Contracted power P5 (kW)
   - potenciaP6: Contracted power P6 (kW)

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

6. FINANCIAL INFORMATION:
   - facturaActual: Total invoice amount including taxes (€)
   - excesoPotencia: Total excess power charge ("Exceso de potencia" / "Excesos de potencia") in €
   - reactiva: Reactive energy charges (€)
   - alquiler: Equipment rental charges (€)
   - otrosCargos: Other charges/concepts (€)

7. CURRENT SUPPLIER POWER UNIT PRICES:
   - precioPotenciaP1
   - precioPotenciaP2
   - precioPotenciaP3
   - precioPotenciaP4
   - precioPotenciaP5
   - precioPotenciaP6

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

8. CURRENT SUPPLIER ENERGY UNIT PRICES:
   - precioEnergiaP1
   - precioEnergiaP2
   - precioEnergiaP3
   - precioEnergiaP4
   - precioEnergiaP5
   - precioEnergiaP6

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

9. GAS SPECIFIC:
   - telemedida: Remote metering ("SI" or "NO")

10. TYPE DETECTION:
   - invoiceType: Determine if "ELECTRICITY", "GAS", or "BOTH"

IMPORTANT NOTES:
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- Convert Spanish decimal commas to standard decimals
- If a field is not found, DO NOT include it
- Return ONLY a valid JSON object with the extracted data.`;

/**
 * @swagger
 * /api/v1/internal/invoices/extract:
 *   post:
 *     tags: [Invoices]
 *     summary: Extract data from invoice using LLM
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Extracted invoice data
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  const requestStartTime = Date.now();

  // Helper: persist an OCR log entry (fire-and-forget, never throws)
  const saveOcrLog = async (data: {
    status: string;
    durationMs?: number;
    provider?: string;
    model?: string;
    baseUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    pageCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    extractedFields?: any;
    fieldsExtracted?: number;
    errorMessage?: string;
    errorType?: string;
    httpStatusCode?: number;
    rawResponseSnippet?: string;
    metadata?: any;
  }) => {
    try {
      await prisma.ocrLog.create({
        data: {
          userId: auth.userId,
          userEmail: auth.email,
          status: data.status,
          durationMs: data.durationMs,
          provider: data.provider ?? "unknown",
          model: data.model ?? "unknown",
          baseUrl: data.baseUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSizeBytes: data.fileSizeBytes,
          pageCount: data.pageCount,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          extractedFields: data.extractedFields ?? undefined,
          fieldsExtracted: data.fieldsExtracted,
          errorMessage: data.errorMessage,
          errorType: data.errorType,
          httpStatusCode: data.httpStatusCode,
          rawResponseSnippet: data.rawResponseSnippet,
          metadata: data.metadata ?? undefined,
        },
      });
    } catch (err) {
      console.error("[OCR Log] Failed to save log:", err);
    }
  };

  // Get LLM configuration
  const config = await prisma.systemConfig.findFirst();

  if (!(config as any)?.llmEnabled) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: "unknown",
      model: "unknown",
      errorMessage: "LLM features are not enabled",
      errorType: "CONFIG_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM features are not enabled. Please enable them in system configuration.",
      },
      { status: 400 },
    );
  }

  const llmBaseUrl = (config as any).llmBaseUrl;
  const llmModelName = (config as any).llmModelName;
  const llmProvider = (config as any).llmProvider || "ollama";
  const llmApiKey = (config as any).llmApiKey;
  // Convert Decimal to number for temperature and maxTokens
  const llmTemperature = Number((config as any).llmTemperature) || 0.1;
  const llmMaxTokens = Number((config as any).llmMaxTokens) || 2000;

  console.log("=== INVOICE EXTRACTION REQUEST ===");
  console.log("Provider:", llmProvider);
  console.log("Model:", llmModelName);
  console.log("Base URL:", llmBaseUrl);
  console.log("Temperature:", llmTemperature);
  console.log("Max Tokens:", llmMaxTokens);
  console.log("===================================");

  if (!llmBaseUrl || !llmModelName) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName ?? "unknown",
      baseUrl: llmBaseUrl,
      errorMessage:
        "LLM is not properly configured. Please configure the base URL and model in system settings.",
      errorType: "CONFIG_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM is not properly configured. Please configure the base URL and model in system settings.",
      },
      { status: 400 },
    );
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File;

  console.log("File type:", file?.type);
  console.log("File size:", file?.size, "bytes");

  if (!file) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      errorMessage: "No file provided",
      errorType: "VALIDATION_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "No file provided",
      },
      { status: 400 },
    );
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      errorMessage: `Invalid file type: ${file.type}`,
      errorType: "VALIDATION_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Invalid file type. Please upload a PDF or image file.",
      },
      { status: 400 },
    );
  }

  try {
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64File = buffer.toString("base64");

    // Handle PDF conversion for Ollama providers
    let imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

    if (file.type === "application/pdf") {
      // For Ollama (local and cloud), convert PDF to images first
      if (llmProvider === "ollama" || llmProvider === "ollama-cloud") {
        const pdfImages = await convertPdfToImages(buffer, 2, 1.5);
        imagesToProcess = pdfImages.map((img) => ({
          base64: img.base64,
          mimeType: img.mimeType,
        }));
      }
      // For other providers (OpenAI, Anthropic, Google), they handle PDFs natively
      // So we don't need to convert, just use the original base64File
    } else {
      // For images, prepare for processing
      imagesToProcess = [
        {
          base64: base64File,
          mimeType: file.type,
        },
      ];
    }

    // Prepare LLM request based on provider
    let llmResponse: Response;

    if (llmProvider === "ollama") {
      // Local Ollama doesn't support vision API
      await saveOcrLog({
        status: "FAILED",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        errorMessage: "Invoice extraction with local Ollama is not supported.",
        errorType: "UNSUPPORTED_PROVIDER",
        httpStatusCode: 400,
      });
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice extraction with local Ollama is not supported. Please use Ollama Cloud, OpenAI, Anthropic, or Google AI.",
        },
        { status: 400 },
      );
    } else if (llmProvider === "ollama-cloud") {
      // Ollama Cloud with OpenAI-compatible format and vision models (qwen3-vl:235b)

      // Check if model supports vision
      const isVisionModel =
        llmModelName.includes("-vl") || llmModelName.includes("vision");
      if (!isVisionModel) {
        console.warn(
          `⚠️  Model "${llmModelName}" may not support vision/images`,
        );
        console.warn(
          `   Recommended vision models: qwen3-vl:235b, qwen3-vl:235b-instruct`,
        );
      }

      // Build content with all images (PDFs are converted to images)
      const content: any[] = [
        { type: "text", text: INVOICE_EXTRACTION_PROMPT },
      ];

      console.log(
        `Processing ${imagesToProcess.length} image(s) for Ollama Cloud`,
      );

      for (const img of imagesToProcess) {
        const imageDataUrl = `data:${img.mimeType};base64,${img.base64}`;
        console.log(
          `Adding image: ${img.mimeType}, base64 length: ${img.base64.length} chars`,
        );
        console.log(
          `Image data URL preview: ${imageDataUrl.substring(0, 100)}...`,
        );

        content.push({
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        });
      }

      const messages: any[] = [
        {
          role: "user",
          content,
        },
      ];

      console.log(
        "Request payload structure:",
        JSON.stringify(
          {
            model: llmModelName,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content.map((c: any) => ({
                type: c.type,
                ...(c.type === "image_url"
                  ? { image_url: "(base64 data)" }
                  : { text: "(prompt text)" }),
              })),
            })),
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          },
          null,
          2,
        ),
      );

      llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmModelName,
          messages,
          temperature: llmTemperature,
          max_tokens: llmMaxTokens,
        }),
        signal: AbortSignal.timeout(300000), // 300 second timeout for large vision models (e.g. qwen3-vl:235b)
      });
    } else if (llmProvider === "openai" || llmProvider === "azure-openai") {
      // OpenAI Vision API supports both images and PDFs
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: INVOICE_EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${base64File}`,
              },
            },
          ],
        },
      ];

      llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmModelName,
          messages,
          temperature: llmTemperature,
          max_tokens: llmMaxTokens,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } else if (llmProvider === "anthropic") {
      // Anthropic Claude Vision API supports PDFs and images
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
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: INVOICE_EXTRACTION_PROMPT },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: file.type,
                    data: base64File,
                  },
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
    } else if (llmProvider === "google") {
      // Google Gemini Vision API supports PDFs and images
      llmResponse = await fetch(
        `${llmBaseUrl}/models/${llmModelName}:generateContent?key=${llmApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: INVOICE_EXTRACTION_PROMPT },
                  {
                    inline_data: {
                      mime_type: file.type,
                      data: base64File,
                    },
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
    } else {
      await saveOcrLog({
        status: "FAILED",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        errorMessage: `Provider ${llmProvider} is not supported for invoice extraction`,
        errorType: "UNSUPPORTED_PROVIDER",
        httpStatusCode: 400,
      });
      return NextResponse.json(
        {
          success: false,
          message: `Provider ${llmProvider} is not supported for invoice extraction`,
        },
        { status: 400 },
      );
    }

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("=== LLM API ERROR ===");
      console.error("Status:", llmResponse.status, llmResponse.statusText);
      console.error("Provider:", llmProvider);
      console.error("Model:", llmModelName);
      console.error("Base URL:", llmBaseUrl);
      console.error("Response:", errorText);
      console.error("====================");
      await saveOcrLog({
        status: "ERROR",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        errorMessage: `LLM API error: ${llmResponse.status} ${llmResponse.statusText}`,
        errorType: "LLM_API_ERROR",
        httpStatusCode: llmResponse.status,
        rawResponseSnippet: errorText.substring(0, 500),
      });
      return NextResponse.json(
        {
          success: false,
          message: `LLM API error: ${llmResponse.status} ${llmResponse.statusText}`,
          details: errorText.substring(0, 500), // Include first 500 chars of error
          provider: llmProvider,
          model: llmModelName,
        },
        { status: 500 },
      );
    }

    const llmData = await llmResponse.json();

    // Extract the response text based on provider
    let extractedText = "";
    if (
      llmProvider === "openai" ||
      llmProvider === "azure-openai" ||
      llmProvider === "ollama-cloud"
    ) {
      const msg = llmData.choices?.[0]?.message;
      // qwen3 thinking models put the answer in `reasoning` when `content` is empty
      extractedText = msg?.content || msg?.reasoning || "";
    } else if (llmProvider === "anthropic") {
      extractedText = llmData.content?.[0]?.text || "";
    } else if (llmProvider === "google") {
      extractedText = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // Parse JSON from response
    let extractedData: any = {};

    // Try to extract JSON from the response (handling markdown code blocks)
    const jsonMatch =
      extractedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      extractedText.match(/(\{[\s\S]*\})/);

    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse extracted JSON:", e);
        await saveOcrLog({
          status: "PARSE_ERROR",
          durationMs: Date.now() - requestStartTime,
          provider: llmProvider,
          model: llmModelName,
          baseUrl: llmBaseUrl,
          fileName: file.name,
          fileType: file.type,
          fileSizeBytes: file.size,
          errorMessage: "Failed to parse extracted data from LLM response",
          errorType: "JSON_PARSE_ERROR",
          httpStatusCode: 500,
          rawResponseSnippet: extractedText,
          metadata: { usage: llmData.usage ?? llmData.usageMetadata },
        });
        return NextResponse.json(
          {
            success: false,
            message: "Failed to parse extracted data from LLM response",
            debug: extractedText,
          },
          { status: 500 },
        );
      }
    } else {
      await saveOcrLog({
        status: "PARSE_ERROR",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        errorMessage: "No valid JSON data found in LLM response",
        errorType: "NO_JSON_FOUND",
        httpStatusCode: 500,
        rawResponseSnippet: extractedText,
        metadata: { usage: llmData.usage ?? llmData.usageMetadata },
      });
      return NextResponse.json(
        {
          success: false,
          message: "No valid JSON data found in LLM response",
          debug: extractedText,
        },
        { status: 500 },
      );
    }

    // ── Post-processing: sanitize and validate extracted fields ──────────────

    // CUPS validation: Spanish CUPS format is ES + 16-18 digits + 2 uppercase letters.
    // Barcodes are typically all-numeric with no trailing letters.
    // Strip spaces first, then validate.
    if (extractedData.cups) {
      const rawCups = String(extractedData.cups)
        .replace(/\s+/g, "")
        .toUpperCase();
      // Strict pattern: ES + 16-18 digits + exactly 2 uppercase letters at the end
      const cupsPattern = /^ES\d{16,18}[A-Z]{2}$/;
      if (cupsPattern.test(rawCups)) {
        extractedData.cups = rawCups;
      } else {
        console.warn(
          `⚠️  Discarding invalid CUPS value: "${rawCups}" (failed ES+digits+2letters pattern — likely a barcode or reference code)`,
        );
        delete extractedData.cups;
      }
    }

    // CIF sanity check: reject obviously fake/example values
    if (extractedData.cif) {
      const knownPlaceholders = ["X-XXXXXXXX", "B12345678", "B00000000"];
      const cifUpper = String(extractedData.cif)
        .toUpperCase()
        .replace(/\s+/g, "");
      // Spanish CIF/NIF: letter + 7 digits + letter/digit, or 8 digits + letter (NIE)
      const validCifPattern =
        /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$|^[XYZ]\d{7}[A-Z]$/;
      if (
        knownPlaceholders.includes(extractedData.cif) ||
        !validCifPattern.test(cifUpper)
      ) {
        console.warn(
          `⚠️  Discarding invalid/placeholder CIF: "${extractedData.cif}"`,
        );
        delete extractedData.cif;
      } else {
        extractedData.cif = cifUpper;
      }
    }

    // Extract token usage from provider response
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    if (
      llmProvider === "openai" ||
      llmProvider === "azure-openai" ||
      llmProvider === "ollama-cloud"
    ) {
      promptTokens = llmData.usage?.prompt_tokens;
      completionTokens = llmData.usage?.completion_tokens;
      totalTokens = llmData.usage?.total_tokens;
    } else if (llmProvider === "anthropic") {
      promptTokens = llmData.usage?.input_tokens;
      completionTokens = llmData.usage?.output_tokens;
      totalTokens =
        (llmData.usage?.input_tokens ?? 0) +
        (llmData.usage?.output_tokens ?? 0);
    } else if (llmProvider === "google") {
      promptTokens = llmData.usageMetadata?.promptTokenCount;
      completionTokens = llmData.usageMetadata?.candidatesTokenCount;
      totalTokens = llmData.usageMetadata?.totalTokenCount;
    }

    const fieldsExtracted = Object.values(extractedData).filter(
      (v) => v !== null && v !== undefined && v !== "",
    ).length;

    await saveOcrLog({
      status: "SUCCESS",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      pageCount:
        imagesToProcess.length > 0 ? imagesToProcess.length : undefined,
      promptTokens,
      completionTokens,
      totalTokens,
      extractedFields: extractedData,
      fieldsExtracted,
      httpStatusCode: 200,
      rawResponseSnippet: extractedText,
      metadata: {
        temperature: llmTemperature,
        maxTokens: llmMaxTokens,
        imagesProcessed: imagesToProcess.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice data extracted successfully",
      data: extractedData,
    });
  } catch (error: any) {
    console.error("=== INVOICE EXTRACTION ERROR ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Provider:", llmProvider);
    console.error("Model:", llmModelName);
    console.error("Base URL:", llmBaseUrl);
    console.error("================================");
    await saveOcrLog({
      status: "ERROR",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider ?? "unknown",
      model: llmModelName ?? "unknown",
      baseUrl: llmBaseUrl,
      errorMessage: error.message || "Unknown error",
      errorType: error.constructor?.name || "UnknownError",
      httpStatusCode: 500,
    });
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to extract invoice data",
        errorType: error.constructor.name,
        provider: llmProvider,
        model: llmModelName,
      },
      { status: 500 },
    );
  }
});
