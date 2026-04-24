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

Extract ALL available information from the provided invoice and return it as a JSON object. Be thorough and precise.

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: CUPS code (Código Universal del Punto de Suministro) - format ES################
   - nombreTitular: Full name of the invoice holder/titular
   - personaContacto: Contact person name
   - direccion: Complete supply address (dirección de suministro)
   - comercializadorActual: Current energy marketer/supplier name
   - cif: Tax ID (CIF/NIF) of the client

2. TARIFF AND ZONE:
   - tarifaAcceso: Access tariff (e.g., "2.0TD", "3.0TD", "6.1TD" for electricity, "RL.1", "RL.2", "RL.3" for gas)
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
   - reactiva: Reactive energy charges (€)
   - alquiler: Equipment rental charges (alquiler contador/equipo de medida) (€)
   - otrosCargos: Other charges/concepts (€)

7. GAS SPECIFIC:
   - telemedida: Remote metering ("SI" or "NO")

8. TYPE DETECTION:
   - invoiceType: Determine if "ELECTRICITY", "GAS", or "BOTH"

IMPORTANT NOTES:
- Look for keywords like: "Consumo", "Potencia", "Periodo", "CUPS", "Titular", "Tarifa", "Factura"
- Periods are labeled as P1, P2, P3, P4, P5, P6 or Punta, Llano, Valle
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- If a field is not found, DO NOT include it in the response
- Be precise with decimal numbers

Return ONLY a valid JSON object with the extracted data. Example format:
{
  "cups": "ES0021000000000001AB",
  "nombreTitular": "EMPRESA EJEMPLO SL",
  "direccion": "Calle Principal 123, Madrid",
  "comercializadorActual": "Iberdrola",
  "tarifaAcceso": "3.0TD",
  "zonaGeografica": "Peninsula",
  "fechaInicio": "2025-01-01",
  "fechaFin": "2025-01-31",
  "consumoP1": 150.5,
  "consumoP2": 200.3,
  "consumoP3": 180.7,
  "potenciaP1": 15.0,
  "potenciaP2": 15.0,
  "potenciaP3": 15.0,
  "facturaActual": 350.75,
  "alquiler": 2.50,
  "invoiceType": "ELECTRICITY"
}`;

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
        signal: AbortSignal.timeout(120000), // 120 second timeout for vision models
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
      extractedText = llmData.choices?.[0]?.message?.content || "";
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
