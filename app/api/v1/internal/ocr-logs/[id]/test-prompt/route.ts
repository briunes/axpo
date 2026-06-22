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
import { getAiUsage, resolveAiConfigFromSystemConfig } from "@/application/lib/aiConfig";

const isNvidiaBedrockRuntime = (provider: string): boolean =>
  provider === "aws-bedrock-nvidia";

const getBedrockImageFormat = (mimeType: string): "png" | "jpeg" | "gif" | "webp" => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpeg";
};

/**
 * POST /api/v1/internal/ocr-logs/{id}/test-prompt
 * Re-run invoice extraction on the stored files of an OCR log using a given prompt.
 * Returns { oldFields, newFields } for side-by-side comparison.
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

    const body = await request.json();
    const { prompt } = body as { prompt: string };
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { success: false, message: "prompt is required in the request body" },
        { status: 400 },
      );
    }

    // ── 1. Fetch log + stored files ────────────────────────────────────────
    const log = await prisma.ocrLog.findUnique({
      where: { id },
      include: { ocrFiles: true },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, message: "OCR log not found" },
        { status: 404 },
      );
    }

    if (!(log as any).ocrFiles?.length) {
      return NextResponse.json(
        { success: false, message: "No stored files found for this OCR log" },
        { status: 400 },
      );
    }

    // ── 2. Get LLM config ──────────────────────────────────────────────────
    const config = await prisma.systemConfig.findFirst();
    if (!(config as any)?.llmEnabled) {
      return NextResponse.json(
        { success: false, message: "LLM features are not enabled" },
        { status: 400 },
      );
    }

    const aiConfig = resolveAiConfigFromSystemConfig(
      config as Record<string, any>,
      "promptTest",
      { defaultTemperature: 0.1, defaultMaxTokens: 4000 },
    );
    const llmBaseUrl = aiConfig?.baseUrl as string;
    const llmModelName = aiConfig?.modelName as string;
    const llmProvider = aiConfig?.provider || "ollama";
    const llmApiKey = aiConfig?.apiKey as string | null;
    const llmTemperature = aiConfig?.temperature ?? 0.1;
    const llmMaxTokens = aiConfig?.maxTokens ?? 4000;

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
            "Local Ollama does not support vision. Please use Ollama Cloud, OpenAI, Anthropic, or Google AI.",
        },
        { status: 400 },
      );
    }

    // ── 3. Encode files ────────────────────────────────────────────────────
    const isPdf = (mime: string) =>
      mime === "application/pdf" || mime.endsWith("/pdf");
    const isImage = (mime: string) => mime.startsWith("image/");

    const encodedFiles = (log as any).ocrFiles.map(
      (f: { fileData: Buffer; fileType: string | null; fileName: string }) => ({
        base64: f.fileData.toString("base64"),
        mimeType: f.fileType ?? "application/octet-stream",
        fileName: f.fileName,
      }),
    );

    // ── 4. Call LLM ────────────────────────────────────────────────────────
    let llmResponse: Response;
    try {
      if (llmProvider === "ollama-cloud") {
        const resolvedFiles: Array<{ base64: string; mimeType: string }> = [];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            const imgs = await convertPdfToImages(
              Buffer.from(f.base64, "base64"),
              OCR_MAX_PDF_PAGES,
              OCR_PDF_RENDER_SCALE,
            );
            for (const img of imgs) resolvedFiles.push(img);
          } else {
            resolvedFiles.push(f);
          }
        }
        const content: any[] = [{ type: "text", text: prompt }];
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
        const resolvedFiles: Array<{ base64: string; mimeType: string }> = [];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            const imgs = await convertPdfToImages(
              Buffer.from(f.base64, "base64"),
              OCR_MAX_PDF_PAGES,
              OCR_PDF_RENDER_SCALE,
            );
            for (const img of imgs) resolvedFiles.push(img);
          } else if (isImage(f.mimeType)) {
            resolvedFiles.push(f);
          }
        }
        const content: any[] = [{ text: prompt }];
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
      } else if (llmProvider === "openai" || llmProvider === "azure-openai") {
        const content: any[] = [{ type: "text", text: prompt }];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
            content.push({
              type: "file",
              file: {
                filename: f.fileName,
                file_data: `data:${f.mimeType};base64,${f.base64}`,
              },
            });
          } else if (isImage(f.mimeType)) {
            content.push({
              type: "image_url",
              image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
            });
          }
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
        const content: any[] = [{ type: "text", text: prompt }];
        for (const f of encodedFiles) {
          if (isPdf(f.mimeType)) {
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
        const parts: any[] = [{ text: prompt }];
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
      console.error("[test-prompt] LLM fetch error:", fetchError);
      return NextResponse.json(
        { success: false, message: `Failed to reach the LLM endpoint: ${msg}` },
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

    // ── 5. Extract text ────────────────────────────────────────────────────
    let extractedText = "";
    if (
      llmProvider === "openai" ||
      llmProvider === "azure-openai" ||
      llmProvider === "ollama-cloud"
    ) {
      const msg = llmData.choices?.[0]?.message;
      extractedText = msg?.content || msg?.reasoning || "";
    } else if (llmProvider === "anthropic") {
      extractedText = llmData.content?.[0]?.text || "";
    } else if (isNvidiaBedrockRuntime(llmProvider)) {
      extractedText = llmData.output?.message?.content?.[0]?.text || "";
    } else if (llmProvider === "google") {
      extractedText = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // ── 6. Parse JSON ──────────────────────────────────────────────────────
    const jsonMatch =
      extractedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      extractedText.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "LLM did not return a valid JSON object",
          debug: extractedText.substring(0, 500),
        },
        { status: 500 },
      );
    }

    let newFields: Record<string, unknown>;
    try {
      newFields = JSON.parse(jsonMatch[1]);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to parse JSON from LLM response",
          debug: extractedText.substring(0, 500),
        },
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
          type: "PROMPT_TEST",
          status: "SUCCESS",
          provider: llmProvider,
          model: llmModelName,
          baseUrl: llmBaseUrl,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          promptText: prompt,
          extractedFields: newFields as any,
          fieldsExtracted: Object.values(newFields).filter(
            (value) => value !== null && value !== undefined && value !== "",
          ).length,
          metadata: {
            sourceOcrLogId: log.id,
            aiProviderConfigId: aiConfig?.id,
            aiTask: "promptTest",
          },
        },
      });
    } catch (err) {
      console.error("[OCR Log] Failed to save prompt-test usage:", err);
    }

    return NextResponse.json({
      success: true,
      data: {
        oldFields: (log.extractedFields ?? {}) as Record<string, unknown>,
        newFields,
      },
    });
  },
);
