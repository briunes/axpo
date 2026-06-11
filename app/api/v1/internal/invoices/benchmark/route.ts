import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import {
  convertAllPdfPagesToImages,
  convertPdfToImages,
  OCR_PROVIDER_DETECTION_PDF_RENDER_SCALE,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_RENDER_SCALE,
} from "@/lib/pdfToImage";
import { getConfiguredAiProviders } from "@/application/lib/aiConfig";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────────────────────────────────────
// Expected results for the benchmark invoice (Serigrafia arrigorriaga.pdf)
// ─────────────────────────────────────────────────────────────────────────────

export const BENCHMARK_EXPECTED_DETECTION = {
  "providerName": "IBERDROLA CLIENTES, S.A.U.",
  "matchedSlug": "iberdrola-clientes-s-a-u",
  "confidence": "high",
  "invoiceType": "ELECTRICITY"
}

export const BENCHMARK_EXPECTED_EXTRACTION = {
  "cups": "ES00210001674304GE",
  "nombreTitular": "SERIGRAFIA INDUSTRIAL ARRIGORRIAGA S.L.L.",
  "personaContacto": "",
  "cif": "B95701827",
  "direccion": "POLIGONO ATXUKARRO, 6, BAJO 4 48480 ARRIGORRIAGA (BIZKAIA)",
  "clienteAddress": {
    "street": "POLIGONO ATXUKARRO, 6 BAJO",
    "city": "ARRIGORRIAGA",
    "postalCode": "48480",
    "province": "BIZKAIA",
    "country": "ES"
  },
  "comercializadorActual": "IBERDROLA CLIENTES, S.A.U.",
  "tarifaAcceso": "3.0TD",
  "zonaGeografica": "Peninsula",
  "perfilCarga": "NORMAL",
  "fechaInicio": "2025-12-31",
  "fechaFin": "2026-01-31",
  "consumoP1": 3461,
  "consumoP2": 1692,
  "consumoP3": 0,
  "consumoP4": 0,
  "consumoP5": 0,
  "consumoP6": 678,
  "consumoAnual": null,
  "potenciaP1": 40,
  "potenciaP2": 40,
  "potenciaP3": 40,
  "potenciaP4": 40,
  "potenciaP5": 40,
  "potenciaP6": 40,
  "precioPotenciaP1": 0.08235,
  "precioPotenciaP2": 0.042435,
  "precioPotenciaP3": 0.018439,
  "precioPotenciaP4": 0.016033,
  "precioPotenciaP5": 0.01063,
  "precioPotenciaP6": 0.020188,
  "precioEnergiaP1": 0.285745,
  "precioEnergiaP2": 0.256311,
  "precioEnergiaP3": null,
  "precioEnergiaP4": null,
  "precioEnergiaP5": null,
  "precioEnergiaP6": 0.198943,
  "facturaActual": 2616.73,
  "excesoPotencia": 211.83,
  "reactiva": 45.94,
  "alquiler": 6.14,
  "otrosCargos": 0.59,
  "ivaTasa": 21,
  "impuestoElectricoTasa": 5.11269,
  "telemedida": "",
  "invoiceType": "ELECTRICITY"
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts (same as production routes)
// ─────────────────────────────────────────────────────────────────────────────

const DETECTION_PROMPT = (
  providerListText: string,
) => `You are analyzing a Spanish energy invoice image to identify the energy supplier/provider company.

KNOWN PROVIDERS LIST:
${providerListText}

TASK:
Look at the invoice and identify the energy company that issued this invoice (the supplier/provider, NOT the customer).

Look for:
- Company logo
- Company name in the header
- "Comercializadora" or "Suministradora" field
- Footer with company details

TASK 2 — COMMODITY TYPE:
Also determine whether this is an electricity or gas invoice.

Strong GAS indicators:
- "gas", "factura gas", "facturagas", "gas natural"
- "hidrocarburos", "impuesto especial hidrocarburos"
- "poder calorífico", "coeficiente de conversión", "Gj", "PCS"

Strong ELECTRICITY indicators:
- "electricidad", "energía eléctrica", "luz"
- "potencia contratada", "término de potencia"
- "peaje de acceso electricidad", "discriminación horaria"
- periods like P1/P2/P3 when tied to power or electricity energy charges

Decision rule:
- If strong GAS indicators appear and no strong ELECTRICITY indicators appear → GAS.
- If strong ELECTRICITY indicators appear and no strong GAS indicators appear → ELECTRICITY.
- If strong indicators for both appear → BOTH.
- If only neutral terms like "kWh", "CUPS", "consumo", or generic "energía" appear → null.
- If unclear → null.

RESPONSE FORMAT:
Respond with ONLY a JSON object, no markdown, no explanation:
{
  "providerName": "exact company name as printed on invoice",
  "matchedSlug": "slug from the known providers list if it matches, or null if not in the list",
  "confidence": "high" or "low",
  "invoiceType": "ELECTRICITY" or "GAS" or "BOTH" or null
}

If the provider is in the known list, set matchedSlug to its slug.
If not in the list, set matchedSlug to null and still return the providerName you found.
If you cannot determine the provider at all, return providerName as null.`;

const EXTRACTION_PROMPT = `You are an expert at extracting data from Spanish ELECTRICITY invoices.

IMPORTANT PRIORITY RULE — CLIENT CIF EXTRACTION

Spanish energy invoices often contain TWO CIF/NIF values:
1. the ENERGY COMPANY CIF
2. the CLIENT/HOLDER CIF

You MUST extract ONLY the CLIENT/HOLDER CIF.
NEVER extract the supplier/provider CIF.

EXAMPLE OF WRONG CIF: "IBERDROLA CLIENTES, S.A.U. CIF A-95758389" — IGNORE IT.
EXAMPLE OF CORRECT CIF: "CIF titular: B53572871" — USE THIS VALUE.

When extracting the "cif" field, prioritize labels: "CIF titular", "NIF titular", "CIF cliente", "NIF cliente", "Titular", "Cliente".
NEVER use CIF values near the logo, header, or supplier company names.
For Iberdrola invoices: the client CIF is usually inside "INFORMACION ADICIONAL".

CRITICAL BILLING PERIOD RULE:
For fechaInicio and fechaFin, prioritize labels like:
- "Periodo de facturación", "Periodo facturado", "Facturación desde/hasta", "Desde / Hasta"
The correct billing period is usually 28–31 days for monthly invoices.
NEVER use invoice issue date, payment due date, or contract expiration date as billing period dates.

CRITICAL PERIOD IDENTIFICATION RULE (VERY IMPORTANT):
The invoice periods MUST be mapped using the ACTUAL printed period labels from the invoice.
NEVER assign values by order or position.
ONLY use the explicit period identifier shown on the invoice.

CRITICAL TARIFF EXTRACTION RULE:
tarifaAcceso MUST ONLY be extracted from an EXPLICIT tariff label printed on the invoice.
NEVER infer tarifaAcceso from number of periods, contracted powers, or energy periods.
The ONLY valid source is an explicit field such as: "Peaje de acceso a la red (ATR)", "Tarifa de acceso", "Tarifa", "Tipo de tarifa".

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: ⚠️ MANDATORY — CUPS code starting with "ES", 20-22 chars. Strip ALL spaces.
   - nombreTitular: Full name of the invoice holder/titular
   - personaContacto: Contact person name
   - direccion: Supply point address (where the meter is installed). Look in "Datos punto de suministro", "Dirección de suministro".
   - clienteAddress: Billing address as object with: street, city, postalCode, province, country (use "ES").
   - comercializadorActual: Current energy marketer/supplier name
   - cif: Tax ID of the CLIENT/HOLDER only.

2. TARIFF AND ZONE:
   - tarifaAcceso: ⚠️ MANDATORY. Valid electricity values: "2.0TD", "3.0TD", "6.1TD".
   - zonaGeografica: "Peninsula", "Baleares", or "Canarias"
   - perfilCarga: Load profile

3. BILLING PERIOD:
   - fechaInicio: Start date (YYYY-MM-DD)
   - fechaFin: End date (YYYY-MM-DD)

4. ENERGY CONSUMPTION:
   - consumoP1..P6: Consumption in each period (kWh). Map to explicit period labels only.

5. CONTRACTED POWER:
   - potenciaP1..P6: Contracted power in each period (kW). Map to explicit period labels only.

6. FINANCIAL INFORMATION:
   - facturaActual: Total invoice amount including taxes (€)
   - excesoPotencia: Total excess power charge (€)
   - reactiva: Reactive energy charges (€)
   - alquiler: Equipment rental charges (€)
   - otrosCargos: Other charges (€)

7. UNIT PRICES:
   - precioPotenciaP1..P6: Unit prices for power per period. Map to explicit period labels only.
   - precioEnergiaP1..P6: Unit prices for energy per period. Map to explicit period labels only.

8. TAX RATES (only if explicitly printed):
   - ivaTasa: IVA/VAT rate as a PERCENTAGE number (e.g. 21 for 21%)
   - impuestoElectricoTasa: Electricity tax rate as a PERCENTAGE number (e.g. 5.11269)

9. OTHER:
   - consumoAnual: Always null for extraction
   - telemedida: Remote metering
   - invoiceType: "ELECTRICITY", "GAS", or "BOTH"

IMPORTANT NOTES:
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- Convert Spanish decimal commas to standard decimals
- ALWAYS return the COMPLETE JSON object with ALL fields listed below, even if empty (use null for missing).
- Return ONLY a valid JSON object. No markdown, no code fences, no explanation.

You MUST always return a JSON that exactly matches this structure (all keys present):
{
  "cups": null,
  "nombreTitular": null,
  "personaContacto": "",
  "cif": null,
  "direccion": null,
  "clienteAddress": { "street": "", "city": "", "postalCode": "", "province": "", "country": "ES" },
  "comercializadorActual": null,
  "tarifaAcceso": null,
  "zonaGeografica": null,
  "perfilCarga": null,
  "fechaInicio": null,
  "fechaFin": null,
  "consumoP1": null, "consumoP2": null, "consumoP3": null, "consumoP4": null, "consumoP5": null, "consumoP6": null,
  "consumoAnual": null,
  "potenciaP1": null, "potenciaP2": null, "potenciaP3": null, "potenciaP4": null, "potenciaP5": null, "potenciaP6": null,
  "precioPotenciaP1": null, "precioPotenciaP2": null, "precioPotenciaP3": null, "precioPotenciaP4": null, "precioPotenciaP5": null, "precioPotenciaP6": null,
  "precioEnergiaP1": null, "precioEnergiaP2": null, "precioEnergiaP3": null, "precioEnergiaP4": null, "precioEnergiaP5": null, "precioEnergiaP6": null,
  "facturaActual": null, "excesoPotencia": null, "reactiva": null, "alquiler": null, "otrosCargos": null,
  "ivaTasa": null, "impuestoElectricoTasa": null,
  "telemedida": "",
  "invoiceType": "ELECTRICITY"
}

---
SYSTEM ALLOWED OPTIONS (MUST FOLLOW)
- zonaGeografica: return ONLY one of: Peninsula, Baleares, Canarias
- tarifaAcceso: return ONLY one of: 2.0TD, 3.0TD, 6.1TD
- ivaTasa: return ONLY one of: 21.00000%, 10.00000%
- impuestoElectricoTasa: return ONLY one of: 5.11270%, 5.11269%
---`;

// ─────────────────────────────────────────────────────────────────────────────
// LLM Calling Helper
// ─────────────────────────────────────────────────────────────────────────────

interface LlmCallResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

async function callLlmForBenchmark(
  provider: string,
  baseUrl: string,
  modelName: string,
  apiKey: string | null,
  prompt: string,
  images: Array<{ base64: string; mimeType: string }>,
  base64File: string,
  fileMimeType: string,
  maxTokens: number,
  temperature: number,
): Promise<LlmCallResult> {
  let llmResponse: Response;

  if (
    provider === "ollama-cloud" ||
    provider === "openai" ||
    provider === "azure-openai"
  ) {
    const content: any[] = [{ type: "text", text: prompt }];
    if (images.length > 0) {
      for (const img of images) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
    } else {
      content.push({
        type: "image_url",
        image_url: { url: `data:${fileMimeType};base64,${base64File}` },
      });
    }
    llmResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content }],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(300000),
    });
  } else if (provider === "anthropic") {
    const content: any[] = [
      { type: "text", text: prompt },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: fileMimeType as any,
          data: base64File,
        },
      },
    ];
    llmResponse = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(120000),
    });
  } else if (provider === "google") {
    const parts: any[] = [
      { text: prompt },
      { inline_data: { mime_type: fileMimeType, data: base64File } },
    ];
    llmResponse = await fetch(
      `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
        signal: AbortSignal.timeout(120000),
      },
    );
  } else {
    throw new Error(`Provider "${provider}" is not supported for benchmarking`);
  }

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new Error(
      `LLM API error ${llmResponse.status}: ${errorText.slice(0, 400)}`,
    );
  }

  const llmData = await llmResponse.json();
  let text = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;

  if (provider === "anthropic") {
    text = llmData.content?.[0]?.text || "";
    promptTokens = llmData.usage?.input_tokens;
    completionTokens = llmData.usage?.output_tokens;
    totalTokens =
      (llmData.usage?.input_tokens ?? 0) + (llmData.usage?.output_tokens ?? 0);
  } else if (provider === "google") {
    text = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    promptTokens = llmData.usageMetadata?.promptTokenCount;
    completionTokens = llmData.usageMetadata?.candidatesTokenCount;
    totalTokens = llmData.usageMetadata?.totalTokenCount;
  } else {
    const msg = llmData.choices?.[0]?.message;
    text = msg?.content || msg?.reasoning || "";
    promptTokens = llmData.usage?.prompt_tokens;
    completionTokens = llmData.usage?.completion_tokens;
    totalTokens = llmData.usage?.total_tokens;
  }

  return { text, promptTokens, completionTokens, totalTokens };
}

function parseJsonFromText(text: string): any | null {
  const match =
    text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
    text.match(/(\{[\s\S]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison helpers
// ─────────────────────────────────────────────────────────────────────────────

function valuesMatch(actual: any, expected: any): boolean {
  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined || actual === "";
  }
  if (actual === null || actual === undefined) {
    return expected === null || expected === undefined || expected === "";
  }
  if (typeof expected === "number") {
    const n = typeof actual === "string" ? parseFloat(actual) : Number(actual);
    if (!Number.isFinite(n)) return false;
    const tolerance = Math.abs(expected) * 0.001 + 0.0001;
    return Math.abs(n - expected) <= tolerance;
  }
  if (typeof expected === "boolean") return Boolean(actual) === expected;
  return (
    String(actual).trim().toLowerCase() ===
    String(expected).trim().toLowerCase()
  );
}

function scoreDetection(actual: any) {
  const fields = [
    "providerName",
    "matchedSlug",
    "confidence",
    "invoiceType",
  ] as const;
  const fieldScores: Record<string, boolean> = {};
  let correct = 0;
  for (const f of fields) {
    fieldScores[f] = valuesMatch(actual?.[f], BENCHMARK_EXPECTED_DETECTION[f]);
    if (fieldScores[f]) correct++;
  }
  return {
    score: Math.round((correct / fields.length) * 100),
    fieldScores,
    correctFields: correct,
    totalFields: fields.length,
  };
}

function scoreExtraction(actual: any) {
  const FLAT_FIELDS = [
    "cups",
    "nombreTitular",
    "personaContacto",
    "cif",
    "direccion",
    "comercializadorActual",
    "tarifaAcceso",
    "zonaGeografica",
    "perfilCarga",
    "fechaInicio",
    "fechaFin",
    "consumoP1",
    "consumoP2",
    "consumoP3",
    "consumoP4",
    "consumoP5",
    "consumoP6",
    "consumoAnual",
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
    "facturaActual",
    "excesoPotencia",
    "reactiva",
    "alquiler",
    "otrosCargos",
    "ivaTasa",
    "impuestoElectricoTasa",
    "telemedida",
    "invoiceType",
  ] as const;
  const ADDRESS_FIELDS = [
    "street",
    "city",
    "postalCode",
    "province",
    "country",
  ] as const;

  const fieldScores: Record<string, boolean> = {};
  let correct = 0;
  const total = FLAT_FIELDS.length + ADDRESS_FIELDS.length;

  for (const f of FLAT_FIELDS) {
    fieldScores[f] = valuesMatch(
      actual?.[f],
      (BENCHMARK_EXPECTED_EXTRACTION as any)[f],
    );
    if (fieldScores[f]) correct++;
  }
  for (const f of ADDRESS_FIELDS) {
    const key = `clienteAddress.${f}`;
    fieldScores[key] = valuesMatch(
      actual?.clienteAddress?.[f],
      BENCHMARK_EXPECTED_EXTRACTION.clienteAddress[f],
    );
    if (fieldScores[key]) correct++;
  }

  return {
    score: Math.round((correct / total) * 100),
    fieldScores,
    correctFields: correct,
    totalFields: total,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/internal/invoices/benchmark
// Body: { providerConfigId: string }
// ─────────────────────────────────────────────────────────────────────────────
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { providerConfigId } = body as { providerConfigId?: string };

  if (!providerConfigId) {
    return NextResponse.json(
      { success: false, message: "providerConfigId is required" },
      { status: 400 },
    );
  }

  // Load system config
  const config = await prisma.systemConfig.findFirst();
  if (!(config as any)?.llmEnabled) {
    return NextResponse.json(
      { success: false, message: "LLM features are not enabled" },
      { status: 400 },
    );
  }

  // Find specific provider config
  const providers = getConfiguredAiProviders(config as Record<string, any>);
  const providerCfg = providers.find((p) => p.id === providerConfigId);

  if (!providerCfg) {
    return NextResponse.json(
      {
        success: false,
        message: `Provider config "${providerConfigId}" not found`,
      },
      { status: 404 },
    );
  }

  const llmProvider = providerCfg.provider;
  const llmBaseUrl = providerCfg.baseUrl;
  const llmModelName = providerCfg.modelName;
  const llmApiKey = providerCfg.apiKey ?? null;
  const llmTemperature = Number(providerCfg.temperature ?? 0.1);
  const llmMaxTokens = Number(providerCfg.maxTokens ?? 2000);

  if (llmProvider === "ollama") {
    return NextResponse.json(
      {
        success: false,
        message: "Local Ollama does not support vision — cannot benchmark.",
      },
      { status: 400 },
    );
  }

  // Read benchmark PDF from project root
  const pdfPath = path.join(process.cwd(), "Serigrafia arrigorriaga.pdf");
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Benchmark PDF file not found: 'Serigrafia arrigorriaga.pdf' must be in the project root.",
      },
      { status: 404 },
    );
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64File = pdfBuffer.toString("base64");
  const fileMimeType = "application/pdf";

  // ─── Provider Detection ─────────────────────────────────────────────────────
  const detectionStart = Date.now();
  let detectionStepResult: {
    success: boolean;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    result?: any;
    rawText?: string;
    error?: string;
    score: number;
    fieldScores: Record<string, boolean>;
    correctFields: number;
    totalFields: number;
  };

  try {
    const dbProviders = (await (prisma as any).invoiceProviderPrompt.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    })) as Array<{ id: string; name: string; slug: string }>;

    const providerListText =
      dbProviders.length > 0
        ? dbProviders
            .map((p: any) => `- ${p.name} (slug: ${p.slug})`)
            .join("\n")
        : "(no providers configured yet)";

    // For Ollama Cloud, convert PDF to images first; others handle PDF natively
    let detectionImages: Array<{ base64: string; mimeType: string }> = [];
    if (llmProvider === "ollama-cloud") {
      const pdfImages = await convertAllPdfPagesToImages(
        pdfBuffer,
        OCR_PROVIDER_DETECTION_PDF_RENDER_SCALE,
      );
      detectionImages = pdfImages.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
      }));
    }

    const detectionPrompt = DETECTION_PROMPT(providerListText);
    const { text, promptTokens, completionTokens, totalTokens } =
      await callLlmForBenchmark(
        llmProvider,
        llmBaseUrl,
        llmModelName,
        llmApiKey,
        detectionPrompt,
        detectionImages,
        base64File,
        fileMimeType,
        200,
        llmTemperature,
      );

    const parsed = parseJsonFromText(text);
    const scores = scoreDetection(parsed);

    detectionStepResult = {
      success: true,
      durationMs: Date.now() - detectionStart,
      promptTokens,
      completionTokens,
      totalTokens,
      result: parsed,
      rawText: text.slice(0, 1000),
      ...scores,
    };
  } catch (err: any) {
    detectionStepResult = {
      success: false,
      durationMs: Date.now() - detectionStart,
      error: err.message,
      score: 0,
      fieldScores: {},
      correctFields: 0,
      totalFields: 4,
    };
  }

  // ─── Invoice Extraction ─────────────────────────────────────────────────────
  const extractionStart = Date.now();
  let extractionStepResult: {
    success: boolean;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    result?: any;
    rawText?: string;
    error?: string;
    score: number;
    fieldScores: Record<string, boolean>;
    correctFields: number;
    totalFields: number;
  };

  try {
    // For Ollama Cloud, convert PDF to images first; others handle PDF natively
    let extractionImages: Array<{ base64: string; mimeType: string }> = [];
    if (llmProvider === "ollama-cloud") {
      const pdfImages = await convertPdfToImages(
        pdfBuffer,
        OCR_MAX_PDF_PAGES,
        OCR_PDF_RENDER_SCALE,
      );
      extractionImages = pdfImages.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
      }));
    }

    // Append PDF text layer to extraction prompt (same as production)
    let activePrompt = EXTRACTION_PROMPT;
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = path.resolve(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      );
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
      const loadingTask = (pdfjsLib as any).getDocument({
        data: new Uint8Array(pdfBuffer),
        verbosity: 0,
      });
      const pdf = await loadingTask.promise;
      const textParts: string[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = (textContent.items as any[])
          .map((item: any) => item.str ?? "")
          .join(" ")
          .replace(/\s{3,}/g, "  ")
          .trim();
        if (pageText) textParts.push(pageText);
      }
      const rawText = textParts.join("\n\n").trim();
      if (rawText && rawText.length > 50) {
        activePrompt += `\n\n---\nEXTRACTED PDF TEXT (use this if the images are unreadable):\n${rawText}\n---`;
      }
    } catch {
      /* non-fatal */
    }

    const { text, promptTokens, completionTokens, totalTokens } =
      await callLlmForBenchmark(
        llmProvider,
        llmBaseUrl,
        llmModelName,
        llmApiKey,
        activePrompt,
        extractionImages,
        base64File,
        fileMimeType,
        llmMaxTokens,
        llmTemperature,
      );

    const parsed = parseJsonFromText(text);
    const scores = scoreExtraction(parsed);

    extractionStepResult = {
      success: true,
      durationMs: Date.now() - extractionStart,
      promptTokens,
      completionTokens,
      totalTokens,
      result: parsed,
      rawText: text.slice(0, 2000),
      ...scores,
    };
  } catch (err: any) {
    extractionStepResult = {
      success: false,
      durationMs: Date.now() - extractionStart,
      error: err.message,
      score: 0,
      fieldScores: {},
      correctFields: 0,
      totalFields: 49,
    };
  }

  const overallScore = Math.round(
    (detectionStepResult.score + extractionStepResult.score) / 2,
  );
  const totalDurationMs =
    detectionStepResult.durationMs + extractionStepResult.durationMs;

  return NextResponse.json({
    success: true,
    providerConfigId,
    providerName: providerCfg.name,
    provider: llmProvider,
    modelName: llmModelName,
    detection: detectionStepResult,
    extraction: extractionStepResult,
    overallScore,
    totalDurationMs,
    expectedDetection: BENCHMARK_EXPECTED_DETECTION,
    expectedExtraction: BENCHMARK_EXPECTED_EXTRACTION,
  });
});
