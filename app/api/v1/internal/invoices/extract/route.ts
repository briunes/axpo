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

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: ⚠️ MANDATORY — CUPS code (Código Universal del Punto de Suministro). Look for the label "Identificación punto de suministro (CUPS)", "CUPS", or "Punto de suministro". The value ALWAYS starts with "ES" and is 20-22 characters long. It is often printed with spaces between groups (e.g. "ES 0021 0000 0046 0347 YE") — you MUST strip ALL spaces and return it as one continuous string (e.g. "ES0021000000460347YE"). IMPORTANT: do NOT confuse with barcodes or long numeric reference codes printed elsewhere on the invoice — only use the value next to the explicit CUPS label. Never skip this field.
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
   - tarifaAcceso: ⚠️ MANDATORY — Access tariff. Read this EXACTLY as printed on the invoice. Look for fields labeled "Peaje de acceso a la red (ATR)", "Tarifa de acceso", or "Tipo de tarifa". Valid electricity values are ONLY "2.0TD", "3.0TD", or "6.1TD". Valid gas values are "RL.1", "RL.2", "RL.3", etc. Do NOT infer the tariff from the number of billed periods — always read the explicit label. Both 3.0TD and 6.1TD have 6 power periods (P1-P6), so the number of periods does NOT distinguish them. Never skip this field.
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
   - consumoP4: Consumption in period P4 (kWh) - if 3.0TD/6.1TD
   - consumoP5: Consumption in period P5 (kWh) - if 3.0TD/6.1TD
   - consumoP6: Consumption in period P6 (kWh) - if 3.0TD/6.1TD
   - consumoAnual: Annual consumption (kWh)
   
   For gas:
   - consumoTotal: Total gas consumption (kWh or m³)

5. CONTRACTED POWER (Potencia Contratada - electricity only):
   - potenciaP1: Contracted power P1 (kW)
   - potenciaP2: Contracted power P2 (kW)
   - potenciaP3: Contracted power P3 (kW)
   - potenciaP4: Contracted power P4 (kW) - if 3.0TD/6.1TD
   - potenciaP5: Contracted power P5 (kW) - if 3.0TD/6.1TD
   - potenciaP6: Contracted power P6 (kW) - if 3.0TD/6.1TD

6. FINANCIAL INFORMATION:
   - facturaActual: Total invoice amount including taxes (€)
   - excesoPotencia: Total excess power charge ("Exceso de potencia" / "Excesos de potencia") in € — extract the total € amount, NOT the unit price.
   - reactiva: Reactive energy charges (€)
   - alquiler: Equipment rental charges (alquiler contador/equipo de medida) (€)
   - otrosCargos: Other charges/concepts (€)

7. CURRENT SUPPLIER POWER UNIT PRICES (electricity only, from "Detalle de factura"):
   Look for lines like "P1 40 kW x 28 días x 0.061139 €/kW día" and extract only the unit price value.
   - precioPotenciaP1: Power unit price for P1 (€/kW/día)
   - precioPotenciaP2: Power unit price for P2 (€/kW/día)
   - precioPotenciaP3: Power unit price for P3 (€/kW/día)
   - precioPotenciaP4: Power unit price for P4 (€/kW/día) - if 3.0TD/6.1TD
   - precioPotenciaP5: Power unit price for P5 (€/kW/día) - if 3.0TD/6.1TD
   - precioPotenciaP6: Power unit price for P6 (€/kW/día) - if 3.0TD/6.1TD

8. CURRENT SUPPLIER ENERGY UNIT PRICES (electricity only, from "Detalle de factura"):
   Look for lines like "Horas no promocionadas 2.684 kWh x 0.234331 €/kWh" or "P1 ... €/kWh".
   For invoices using "horas no promocionadas" / "horas promocionadas" instead of P1-P6:
   map horas no promocionadas → precioEnergiaP1, horas promocionadas → precioEnergiaP2.
   - precioEnergiaP1: Energy unit price for P1 or horas no promocionadas (€/kWh)
   - precioEnergiaP2: Energy unit price for P2 or horas promocionadas (€/kWh)
   - precioEnergiaP3: Energy unit price for P3 (€/kWh) - if available
   - precioEnergiaP4: Energy unit price for P4 (€/kWh) - if 3.0TD/6.1TD
   - precioEnergiaP5: Energy unit price for P5 (€/kWh) - if 3.0TD/6.1TD
   - precioEnergiaP6: Energy unit price for P6 (€/kWh) - if 3.0TD/6.1TD

9. GAS SPECIFIC:
   - telemedida: Remote metering ("SI" or "NO")

10. TYPE DETECTION:
   - invoiceType: Determine if "ELECTRICITY", "GAS", or "BOTH"

IMPORTANT NOTES:
- Look for keywords like: "Consumo", "Potencia", "Periodo", "CUPS", "Titular", "Tarifa", "Factura"
- Periods are labeled as P1, P2, P3, P4, P5, P6 or Punta, Llano, Valle
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- If a field is not found, DO NOT include it in the response
- Be precise with decimal numbers

IBERDROLA/Iberdrola Clientes, S.A.U. INVOICES — SPECIAL EXTRACTION RULES:
If the invoice is issued by Iberdrola (or any of its subsidiaries: Iberdrola Clientes, i-DE, etc.), it typically contains an "INFORMACION ADICIONAL" section (sometimes titled "Información adicional"). This section is the PRIMARY and most reliable source for the following fields — always prefer values found here over values found elsewhere on the invoice:
- cif: labeled "CIF titular"
  IMPORTANT:
  NEVER use the Iberdrola CIF from the invoice header.
  ONLY use the value labeled "CIF titular".
- cups: labeled "Identificación punto de suministro (CUPS)"
- tarifaAcceso: labeled "Peaje de acceso a la red (ATR)" — e.g., "3.0TD", "6.1TD"
- perfilCarga: labeled "Tipo discriminación horaria" — e.g., "PNEGOC", "NOC", "DIURNO"
- potenciaP1..P6: labeled "Potencia contratada (kW)" as a slash-separated list — e.g., "40 / 40 / 40 / 40 / 40 / 41,6"
- numeroContador: labeled "Nº contador" or "Número de contador"
- direccion: labeled "Dirección fiscal" or "Dirección de suministro"
- fechaFinalContrato: labeled "Fecha final del contrato"
- empresaDistribuidora: labeled "Empresa distribuidora"
Treat ALL fields found in the "INFORMACION ADICIONAL" section as authoritative. Only fall back to other parts of the invoice if a field is missing from this section.

CRITICAL EXTRACTION RULES:
- CUPS: This is MANDATORY. Search every page of the invoice for the LABELED field "Identificación punto de suministro (CUPS)", "CUPS", or "Punto de suministro" and read its value. The value starts with "ES" followed by digits and letters, total length 20-22 characters. Strip ALL spaces — e.g. "ES 0021 0000 0046 0347 YE" → "ES0021000000460347YE". WARNING: invoices often contain long numeric strings in barcodes or reference codes (e.g. "0625598325003391003802030090001...") — these are NOT the CUPS. NEVER extract a CUPS from a barcode, tracking number, or reference code. Only read the value that appears next to the explicit "CUPS" or "Identificación punto de suministro" label. If you cannot find the labeled field, do not guess.

- CIF: The invoice may contain multiple CIF/NIF values — one for the energy provider/supplier company and one for the client/holder. You MUST extract only the CLIENT's CIF, not the provider's.

  VERY IMPORTANT:
  NEVER extract values like:
  - A-95758389
  - A95758389
  when they appear near:
  - IBERDROLA
  - ENDESA
  - NATURGY
  - REPSOL
  - commercial company logos
  - invoice headers

  For Iberdrola invoices:
  ALWAYS prioritize:
  "CIF titular"

  Example:
  WRONG:
  "IBERDROLA CLIENTES, S.A.U. CIF A-95758389"

  CORRECT:
  "CIF titular: B53572871"

  Priority rules (in order):
  1. Look for a CIF/NIF explicitly labeled with client/holder keywords:
     - "CIF titular"
     - "CIF del titular"
     - "NIF titular"
     - "CIF cliente"
     - "NIF cliente"
     - "CIF del cliente"
     - "Titular:"
     - "Cliente:"
  2. If no such label exists but multiple CIF/NIF values are present, prefer the one near section headers like:
     - "Datos del titular"
     - "Datos del cliente"
     - "Información del titular"
     - "Datos de facturación"
  3. As a last resort (only one CIF found), use it.

- Contracted Power: May appear as a slash-separated list like "40 / 40 / 40 / 40 / 40 / 41,6" corresponding to P1/P2/P3/P4/P5/P6. Extract each value as a separate potenciaP1..P6 field. Spanish decimal comma (e.g., "41,6") must be converted to a dot ("41.6")

- All numeric values with Spanish decimal commas (e.g., "3.320,72") must be converted to standard decimals (e.g., "3320.72")

- The supply address ("dirección de suministro" or "dirección fiscal") should be extracted as direccion

- The current supplier/marketer may be labeled "Comercializadora", "Empresa comercializadora", or appear as the company issuing the invoice

Return ONLY a valid JSON object with the extracted data.`;

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

  // Get LLM configuration
  const config = await prisma.systemConfig.findFirst();

  if (!(config as any)?.llmEnabled) {
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
      const cifUpper = String(extractedData.cif).toUpperCase().replace(/\s+/g, "");
      // Spanish CIF/NIF: letter + 7 digits + letter/digit, or 8 digits + letter (NIE)
      const validCifPattern = /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$|^[XYZ]\d{7}[A-Z]$/;
      if (knownPlaceholders.includes(extractedData.cif) || !validCifPattern.test(cifUpper)) {
        console.warn(`⚠️  Discarding invalid/placeholder CIF: "${extractedData.cif}"`);
        delete extractedData.cif;
      } else {
        extractedData.cif = cifUpper;
      }
    }

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
