import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { convertPdfToImages } from "@/lib/pdfToImage";

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

  if (
    llmProvider === "ollama-cloud" ||
    llmProvider === "openai" ||
    llmProvider === "azure-openai"
  ) {
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

  if (llmProvider === "anthropic") {
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

  // Get LLM config
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

  // Parse multipart form data — may have multiple files (images)
  const formData = await req.formData();
  const fileEntries = formData.getAll("file") as File[];

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
- Look for labels like "Electricidad", "Energía eléctrica", "CUPS eléctrico" → ELECTRICITY
- Look for labels like "Gas Natural", "Gas", "CUPS gas", "calorífico" → GAS
- If both are present → BOTH
- If unclear → null

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

  try {
    // Prepare images to send
    let imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

    if (fileEntries.length === 1 && fileEntries[0].type === "application/pdf") {
      // PDF: convert to images, use only first page
      const bytes = await fileEntries[0].arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileNameWithoutExt = fileEntries[0].name.replace(/\.[^.]+$/, "");

      if (llmProvider === "ollama-cloud") {
        // Convert PDF to image first (only first page)
        const pdfImages = await convertPdfToImages(buffer, 1, 1.5);
        convertedPdfLogFiles = pdfImages.map((img) => {
          const imageBuffer = Buffer.from(img.base64, "base64");
          return {
            fileName: `${fileNameWithoutExt}_page_${img.pageNumber}.png`,
            fileType: img.mimeType,
            fileSizeBytes: imageBuffer.length,
            fileData: imageBuffer,
          };
        });

        imagesToProcess = pdfImages.map((img) => ({
          base64: img.base64,
          mimeType: img.mimeType,
        }));
      } else {
        // Providers that handle PDF natively — send as is but only first page via image conversion
        const pdfImages = await convertPdfToImages(buffer, 1, 1.5);
        convertedPdfLogFiles = pdfImages.map((img) => {
          const imageBuffer = Buffer.from(img.base64, "base64");
          return {
            fileName: `${fileNameWithoutExt}_page_${img.pageNumber}.png`,
            fileType: img.mimeType,
            fileSizeBytes: imageBuffer.length,
            fileData: imageBuffer,
          };
        });

        if (pdfImages.length > 0) {
          imagesToProcess = [
            { base64: pdfImages[0].base64, mimeType: pdfImages[0].mimeType },
          ];
        } else {
          // Fallback: send raw PDF as base64 (providers like OpenAI, Anthropic, Google support it)
          const base64File = buffer.toString("base64");
          imagesToProcess = [
            { base64: base64File, mimeType: "application/pdf" },
          ];
        }
      }
    } else {
      // Images: send all of them
      for (const file of fileEntries) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
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
        files: fileEntries,
        persistedFiles: convertedPdfLogFiles,
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
        files: fileEntries,
        persistedFiles: convertedPdfLogFiles,
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
      files: fileEntries,
      persistedFiles: convertedPdfLogFiles,
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
      files: fileEntries,
      persistedFiles: convertedPdfLogFiles,
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
  }
});
