import { NextRequest, NextResponse } from "next/server";
import { del, get } from "@vercel/blob";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import {
  convertAllPdfPagesToImages,
  OCR_PROVIDER_DETECTION_PDF_RENDER_SCALE,
} from "@/lib/pdfToImage";
import {
  isOpenAiCompatibleProvider,
  resolveAiConfigFromSystemConfig,
} from "@/application/lib/aiConfig";
import {
  getInvoiceContentType,
  isInvoiceFileName,
  isVercelBlobUrl,
  MAX_INVOICE_UPLOAD_SIZE,
} from "@/infrastructure/invoices/invoiceUpload";

const isAnthropicBedrockRuntime = (
  provider: string,
  baseUrl: string,
): boolean =>
  provider === "aws-bedrock-anthropic" ||
  (provider === "anthropic" &&
    /bedrock-runtime\.[^.]+\.amazonaws\.com/.test(baseUrl));

const isNvidiaBedrockRuntime = (provider: string): boolean =>
  provider === "aws-bedrock-nvidia";

const getBedrockImageFormat = (
  mimeType: string,
): "png" | "jpeg" | "gif" | "webp" => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpeg";
};

/**
 * Sends images to the configured LLM and returns the raw text response.
 */
async function callLlmWithImages(
  images: Array<{ base64: string; mimeType: string }>,
  prompt: string,
  llmProvider: string,
  llmBaseUrl: string,
  llmModelName: string,
  llmApiKey: string | null,
  llmTemperature: number,
  llmMaxTokens: number,
): Promise<{
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}> {
  let llmResponse: Response;

  if (isOpenAiCompatibleProvider(llmProvider)) {
    const content: any[] = [{ type: "text", text: prompt }];
    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
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
      signal: AbortSignal.timeout(60000),
    });
  } else if (isAnthropicBedrockRuntime(llmProvider, llmBaseUrl)) {
    const content: any[] = [];
    for (const img of images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.base64 },
      });
    }
    content.push({ type: "text", text: prompt });

    const bedrockBaseUrl = llmBaseUrl.replace(/\/+$/, "");
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
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: llmMaxTokens,
          temperature: llmTemperature,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
  } else if (isNvidiaBedrockRuntime(llmProvider)) {
    const content: any[] = [{ text: prompt }];
    for (const img of images) {
      content.push({
        image: {
          format: getBedrockImageFormat(img.mimeType),
          source: { bytes: img.base64 },
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
        signal: AbortSignal.timeout(60000),
      },
    );
  } else if (llmProvider === "anthropic") {
    const content: any[] = [];
    for (const img of images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.base64 },
      });
    }
    content.push({ type: "text", text: prompt });
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
    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({
        inline_data: { mime_type: img.mimeType, data: img.base64 },
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
    throw new Error(
      `Provider ${llmProvider} is not supported for provider detection`,
    );
  }

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new Error(`LLM API error: ${llmResponse.status} ${errorText}`);
  }

  const llmData = await llmResponse.json();

  // Extract text from response based on provider
  let text: string;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;

  if (llmProvider === "anthropic" || llmProvider === "aws-bedrock-anthropic") {
    text = llmData.content?.[0]?.text || "";
    promptTokens = llmData.usage?.input_tokens;
    completionTokens = llmData.usage?.output_tokens;
    totalTokens =
      (llmData.usage?.input_tokens ?? 0) + (llmData.usage?.output_tokens ?? 0);
  } else if (llmProvider === "google") {
    text = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    promptTokens = llmData.usageMetadata?.promptTokenCount;
    completionTokens = llmData.usageMetadata?.candidatesTokenCount;
    totalTokens = llmData.usageMetadata?.totalTokenCount;
  } else if (isNvidiaBedrockRuntime(llmProvider)) {
    text = llmData.output?.message?.content?.[0]?.text || "";
    promptTokens = llmData.usage?.inputTokens;
    completionTokens = llmData.usage?.outputTokens;
    totalTokens = llmData.usage?.totalTokens;
  } else {
    const msg = llmData.choices?.[0]?.message;
    text = msg?.content || msg?.reasoning || "";
    promptTokens = llmData.usage?.prompt_tokens;
    completionTokens = llmData.usage?.completion_tokens;
    totalTokens = llmData.usage?.total_tokens;
  }

  return { text, promptTokens, completionTokens, totalTokens };
}

/**
 * Parse multipart FormData
 * For large files (>5MB), the client should upload to Vercel Blob first
 * and send a JSON payload with the blobUrl instead of FormData
 */
async function parseMultipartFormData(req: NextRequest): Promise<File[]> {
  try {
    const formData = await req.formData();
    const fileEntries = Array.from(formData.getAll("file")).filter(
      (entry): entry is File => entry instanceof File,
    );
    return fileEntries;
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    // If it's a size limit error, suggest using blob upload
    if (
      message.includes("413") ||
      message.includes("size") ||
      message.includes("large")
    ) {
      throw new Error(
        `Request body too large for direct FormData. ` +
          `For files larger than 5MB, upload to Vercel Blob first ` +
          `and send a JSON payload with the blobUrl instead.`,
      );
    }
    throw new Error(`Failed to parse FormData: ${message}`);
  }
}

/**
 * POST /api/v1/internal/invoices/detect-provider
 *
 * Accepts a file (PDF or images), sends the first page (PDF) or all images (images)
 * to the LLM and asks it to identify which energy provider issued the invoice.
 *
 * Returns:
 * {
 *   providerId: string | null,       // null if not found in DB
 *   providerName: string,            // name detected by LLM
 *   isKnown: boolean,               // true if matched a DB provider
 *   confidence: "high" | "low"
 * }
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  const requestStartTime = Date.now();

  type OcrPersistedFile = {
    fileName: string;
    fileType?: string | null;
    fileSizeBytes?: number;
    fileData: Buffer;
  };
  type LoadedInvoiceFile = OcrPersistedFile & {
    name: string;
    type: string;
    size: number;
  };

  const loadRequestFiles = async (): Promise<{
    files: LoadedInvoiceFile[];
    temporaryBlobUrls: string[];
  }> => {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const payload = (await req.json().catch(() => ({}))) as {
        files?: Array<{
          blobUrl?: string;
          fileName?: string;
          fileType?: string;
          fileSizeBytes?: number;
        }>;
      };
      const inputFiles = Array.isArray(payload.files) ? payload.files : [];
      const files: LoadedInvoiceFile[] = [];
      const temporaryBlobUrls: string[] = [];

      for (const input of inputFiles) {
        if (!input.blobUrl || !isVercelBlobUrl(input.blobUrl)) {
          throw new Error("Invalid invoice blob URL");
        }
        const fileName = (input.fileName || "invoice").replace(/[\r\n"]/g, "_");
        if (!isInvoiceFileName(fileName)) {
          throw new Error("Invoice must be a PDF, JPEG, PNG, or WebP file");
        }

        const blob = await get(input.blobUrl, {
          access: "private",
          useCache: false,
        });
        if (!blob || blob.statusCode !== 200) {
          throw new Error("Uploaded invoice file could not be retrieved");
        }
        if (blob.blob.size > MAX_INVOICE_UPLOAD_SIZE) {
          throw new Error("Invoice file exceeds the 15 MB upload limit");
        }

        const buffer = Buffer.from(
          await new Response(blob.stream).arrayBuffer(),
        );
        const fileType =
          input.fileType || getInvoiceContentType({ name: fileName });
        files.push({
          name: fileName,
          type: fileType,
          size: input.fileSizeBytes ?? buffer.length,
          fileName,
          fileType,
          fileSizeBytes: input.fileSizeBytes ?? buffer.length,
          fileData: buffer,
        });
        temporaryBlobUrls.push(input.blobUrl);
      }

      return { files, temporaryBlobUrls };
    }

    // Use busboy to parse multipart data to handle files larger than default limits
    let fileEntries: File[];
    try {
      fileEntries = await parseMultipartFormData(req);
    } catch (error: any) {
      throw new Error(
        `Failed to parse multipart FormData: ${error?.message || "Unknown error"}. ${
          error?.message?.includes("exceeds")
            ? ""
            : "This often indicates the request body is malformed."
        }`,
      );
    }

    if (!fileEntries || fileEntries.length === 0) {
      throw new Error("No files provided");
    }

    const files = await Promise.all(
      fileEntries.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          fileName: file.name,
          fileType: file.type || null,
          fileSizeBytes: file.size,
          fileData: buffer,
        };
      }),
    );
    return { files, temporaryBlobUrls: [] };
  };

  // Get LLM config
  const config = await prisma.systemConfig.findFirst();

  if (!(config as any)?.llmEnabled) {
    return NextResponse.json(
      { success: false, message: "LLM features are not enabled" },
      { status: 400 },
    );
  }

  const aiConfig = resolveAiConfigFromSystemConfig(
    config as Record<string, any>,
    "providerDetection",
    { defaultTemperature: 0.1, defaultMaxTokens: 2000 },
  );
  const llmBaseUrl = aiConfig?.baseUrl as string;
  const llmModelName = aiConfig?.modelName as string;
  const llmProvider = aiConfig?.provider || "ollama";
  const llmApiKey = aiConfig?.apiKey as string | null;
  const llmTemperature = aiConfig?.temperature ?? 0.1;

  const saveOcrLog = async (data: {
    status: string;
    durationMs?: number;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    pageCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    errorMessage?: string;
    errorType?: string;
    httpStatusCode?: number;
    rawResponseSnippet?: string;
    promptText?: string;
    metadata?: any;
    files?: File[];
    persistedFiles?: OcrPersistedFile[];
  }) => {
    try {
      const uploadedFiles =
        data.files && data.files.length > 0
          ? await Promise.all(
              data.files.map(async (file) => ({
                fileName: file.name,
                fileType: file.type || null,
                fileSizeBytes: file.size,
                fileData: Buffer.from(await file.arrayBuffer()),
              })),
            )
          : [];

      const persistedFiles = [
        ...uploadedFiles,
        ...(data.persistedFiles ?? []).map((f) => ({
          fileName: f.fileName,
          fileType: f.fileType ?? null,
          fileSizeBytes: f.fileSizeBytes ?? f.fileData.length,
          fileData: f.fileData,
        })),
      ];

      const created = await prisma.ocrLog.create({
        data: {
          userId: auth.userId,
          userEmail: auth.email,
          type: "PROVIDER_DETECTION",
          status: data.status,
          durationMs: data.durationMs,
          provider: llmProvider,
          model: llmModelName,
          baseUrl: llmBaseUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSizeBytes: data.fileSizeBytes,
          pageCount: data.pageCount,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          errorMessage: data.errorMessage,
          errorType: data.errorType,
          httpStatusCode: data.httpStatusCode,
          rawResponseSnippet: data.rawResponseSnippet,
          promptText: data.promptText,
          metadata: { requestType: "provider-detection", ...data.metadata },
          ocrFiles:
            persistedFiles.length > 0
              ? {
                  create: persistedFiles,
                }
              : undefined,
        },
      });
      return created;
    } catch (err) {
      console.error("[OCR Log] Failed to save detect-provider log:", err);
      return null;
    }
  };

  if (!llmBaseUrl || !llmModelName) {
    const createdLog = await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      errorMessage: "LLM is not properly configured",
      errorType: "CONFIG_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "LLM is not properly configured",
        ocrLogId: createdLog?.id ?? null,
      },
      { status: 400 },
    );
  }

  if (llmProvider === "ollama") {
    const createdLog = await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      errorMessage: "Local Ollama is not supported for provider detection",
      errorType: "UNSUPPORTED_PROVIDER",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Local Ollama is not supported for provider detection",
        ocrLogId: createdLog?.id ?? null,
      },
      { status: 400 },
    );
  }

  const { files: fileEntries, temporaryBlobUrls } = await loadRequestFiles();

  if (!fileEntries || fileEntries.length === 0) {
    const createdLog = await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      errorMessage: "No file provided",
      errorType: "VALIDATION_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "No file provided",
        ocrLogId: createdLog?.id ?? null,
      },
      { status: 400 },
    );
  }

  const cleanupTemporaryBlobs = () => {
    for (const url of temporaryBlobUrls) {
      del(url).catch(() => {});
    }
  };

  // Load known providers from DB
  const dbProviders = (await (prisma as any).invoiceProviderPrompt.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  })) as Array<{ id: string; name: string; slug: string }>;

  // Build provider list for the prompt
  const providerListText =
    dbProviders.length > 0
      ? dbProviders.map((p) => `- ${p.name} (slug: ${p.slug})`).join("\n")
      : "(no providers configured yet)";

  const detectionPrompt = `You are analyzing a Spanish energy invoice image to identify the energy supplier/provider company.

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

Important:
- Do NOT classify as ELECTRICITY merely because the invoice contains "kWh" or "CUPS".
- Gas invoices may also use kWh and CUPS.
- Treat "kWh", "CUPS", "consumo", and generic "energía" as neutral unless accompanied by commodity-specific terms.

Strong GAS indicators:
- "gas", "factura gas", "facturagas", "gas natural"
- "hidrocarburos", "impuesto especial hidrocarburos"
- "poder calorífico", "coeficiente de conversión", "Gj", "PCS"
- "caudal", "peaje gas", "término variable gas"

Strong ELECTRICITY indicators:
- "electricidad", "energía eléctrica", "luz"
- "potencia contratada", "término de potencia"
- "peaje de acceso electricidad", "discriminación horaria"
- periods like P1/P2/P3 when tied to power or electricity energy charges
- "alquiler contador electricidad"

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

  let convertedPdfLogFiles: OcrPersistedFile[] = [];
  let processedPdfPageCount: number | undefined;

  try {
    // Prepare images to send
    let imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

    if (fileEntries.length === 1 && fileEntries[0].type === "application/pdf") {
      // Provider details may appear on any page, so inspect the full PDF.
      const buffer = fileEntries[0].fileData;
      const fileNameWithoutExt = fileEntries[0].name.replace(/\.[^.]+$/, "");
      const pdfImages = await convertAllPdfPagesToImages(
        buffer,
        OCR_PROVIDER_DETECTION_PDF_RENDER_SCALE,
      );

      convertedPdfLogFiles = pdfImages.map((img) => {
        const imageBuffer = Buffer.from(img.base64, "base64");
        return {
          fileName: `${fileNameWithoutExt}_page_${img.pageNumber}.${img.fileExtension}`,
          fileType: img.mimeType,
          fileSizeBytes: imageBuffer.length,
          fileData: imageBuffer,
        };
      });

      imagesToProcess = pdfImages.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
      }));
      processedPdfPageCount = pdfImages.length;
    } else {
      // Images: send all of them
      for (const file of fileEntries) {
        const buffer = file.fileData;
        imagesToProcess.push({
          base64: buffer.toString("base64"),
          mimeType: file.type,
        });
      }
    }

    const {
      text: responseText,
      promptTokens,
      completionTokens,
      totalTokens,
    } = await callLlmWithImages(
      imagesToProcess,
      detectionPrompt,
      llmProvider,
      llmBaseUrl,
      llmModelName,
      llmApiKey,
      llmTemperature,
      200, // small max tokens — we only need a tiny JSON response
    );

    console.log("Provider detection raw response:", responseText);

    // Parse JSON response
    const jsonMatch =
      responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      responseText.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      const createdLog = await saveOcrLog({
        status: "PARSE_ERROR",
        durationMs: Date.now() - requestStartTime,
        fileName: fileEntries[0]?.name,
        fileType: fileEntries[0]?.type,
        fileSizeBytes: fileEntries[0]?.size,
        pageCount: processedPdfPageCount,
        persistedFiles: [...fileEntries, ...convertedPdfLogFiles],
        promptTokens,
        completionTokens,
        totalTokens,
        rawResponseSnippet: responseText.slice(0, 500),
        promptText: detectionPrompt,
        errorMessage: "Provider detection did not return valid JSON",
        errorType: "NO_JSON_FOUND",
        httpStatusCode: 200,
      });
      return NextResponse.json({
        success: true,
        providerId: null,
        providerName: null,
        isKnown: false,
        confidence: "low",
        invoiceType: null,
        ocrLogId: createdLog?.id ?? null,
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      const createdLog = await saveOcrLog({
        status: "PARSE_ERROR",
        durationMs: Date.now() - requestStartTime,
        fileName: fileEntries[0]?.name,
        fileType: fileEntries[0]?.type,
        fileSizeBytes: fileEntries[0]?.size,
        pageCount: processedPdfPageCount,
        persistedFiles: [...fileEntries, ...convertedPdfLogFiles],
        promptTokens,
        completionTokens,
        totalTokens,
        rawResponseSnippet: responseText.slice(0, 500),
        promptText: detectionPrompt,
        errorMessage: "Provider detection returned invalid JSON",
        errorType: "JSON_PARSE_ERROR",
        httpStatusCode: 200,
      });
      return NextResponse.json({
        success: true,
        providerId: null,
        providerName: null,
        isKnown: false,
        confidence: "low",
        invoiceType: null,
        ocrLogId: createdLog?.id ?? null,
      });
    }

    const detectedName: string | null = parsed.providerName || null;
    const matchedSlug: string | null = parsed.matchedSlug || null;
    const confidence: "high" | "low" =
      parsed.confidence === "high" ? "high" : "low";
    const invoiceType: "ELECTRICITY" | "GAS" | "BOTH" | null =
      parsed.invoiceType === "ELECTRICITY" ||
      parsed.invoiceType === "GAS" ||
      parsed.invoiceType === "BOTH"
        ? parsed.invoiceType
        : null;

    // Find matched provider in DB
    let matchedProvider: { id: string; name: string; slug: string } | null =
      null;
    if (matchedSlug) {
      matchedProvider = dbProviders.find((p) => p.slug === matchedSlug) ?? null;
    }

    const firstFile = fileEntries[0];
    const createdLog = await saveOcrLog({
      status: "SUCCESS",
      durationMs: Date.now() - requestStartTime,
      fileName: firstFile?.name,
      fileType: firstFile?.type,
      fileSizeBytes: firstFile?.size,
      pageCount: processedPdfPageCount,
      persistedFiles: [...fileEntries, ...convertedPdfLogFiles],
      promptTokens,
      completionTokens,
      totalTokens,
      rawResponseSnippet: responseText.slice(0, 500),
      promptText: detectionPrompt,
      metadata: {
        detectedProviderName: matchedProvider?.name ?? detectedName,
        isKnown: matchedProvider !== null,
        confidence,
        invoiceType,
      },
    });

    return NextResponse.json({
      success: true,
      providerId: matchedProvider?.id ?? null,
      providerName: matchedProvider?.name ?? detectedName,
      isKnown: matchedProvider !== null,
      confidence,
      invoiceType,
      ocrLogId: createdLog?.id ?? null,
    });
  } catch (error: any) {
    console.error("Provider detection error:", error);
    const createdLog = await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      fileName: fileEntries[0]?.name,
      fileType: fileEntries[0]?.type,
      fileSizeBytes: fileEntries[0]?.size,
      pageCount: processedPdfPageCount,
      persistedFiles: [...fileEntries, ...convertedPdfLogFiles],
      errorMessage: error.message || "Failed to detect provider",
      errorType: "DETECTION_ERROR",
      httpStatusCode: 500,
    });
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to detect provider",
        ocrLogId: createdLog?.id ?? null,
      },
      { status: 500 },
    );
  } finally {
    cleanupTemporaryBlobs();
  }
});

/**
 * Route configuration for detect-provider endpoint
 *
 * Note: App Router doesn't support bodyParser size limits like Pages Router.
 * Instead, we extend maxDuration to allow more time for processing large files.
 * The actual body size limit is handled by Vercel infrastructure (default 5MB)
 * or can be set in vercel.json
 */
export const maxDuration = 300;
