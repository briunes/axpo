import { Prisma } from "@prisma/client";
import { getAiUsage, isOpenAiCompatibleProvider, resolveAiConfigFromSystemConfig } from "@/application/lib/aiConfig";
import { prisma } from "@/infrastructure/database/prisma";
import {
  convertPdfToImages,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_RENDER_SCALE,
} from "@/lib/pdfToImage";

type InvoiceType = "ELECTRICITY" | "GAS";

type StoredOcrLog = Prisma.OcrLogGetPayload<{
  include: { ocrFiles: true; simulation: { select: { referenceNumber: true } } };
}>;

type Correction = {
  field: string;
  ocrValue: unknown;
  correctedValue: unknown;
};

type EncodedFile = {
  base64: string;
  mimeType: string;
  fileName: string;
};

export type OcrPromptImprovementBatchOptions = {
  since?: Date;
  maxAttempts?: number;
  maxLogsPerProvider?: number;
  minimumCorrectionsPerProvider?: number;
};

export type OcrPromptImprovementBatchResult = {
  processedGroups: number;
  proposalsCreated: number;
  skippedGroups: number;
  totalSourceLogs: number;
  groups: Array<{
    groupKey: string;
    invoiceProviderId: string | null;
    invoiceProviderName: string | null;
    invoiceType: InvoiceType;
    sourceLogIds: string[];
    attempts: number;
    accepted: boolean;
    proposalLogId: string | null;
    recurringIssues: Record<string, number>;
    failedChecks: Array<{ logId: string; field: string; expected: unknown; actual: unknown }>;
    message?: string;
  }>;
};

const isNvidiaBedrockRuntime = (provider: string): boolean =>
  provider === "aws-bedrock-nvidia";

const isPdf = (mime: string) => mime === "application/pdf" || mime.endsWith("/pdf");
const isImage = (mime: string) => mime.startsWith("image/");

const getBedrockImageFormat = (mimeType: string): "png" | "jpeg" | "gif" | "webp" => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpeg";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normaliseComparable = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
};

const hasCorrections = (value: unknown): boolean => Object.keys(asRecord(value)).length > 0;

function getInvoiceContext(log: StoredOcrLog): {
  invoiceProviderId: string | null;
  invoiceProviderName: string | null;
  invoiceType: InvoiceType;
} {
  const metadata = asRecord(log.metadata);
  const rawType = String(metadata.invoiceType ?? "").toUpperCase();
  return {
    invoiceProviderId:
      typeof metadata.invoiceProviderId === "string" ? metadata.invoiceProviderId : null,
    invoiceProviderName:
      typeof metadata.invoiceProviderName === "string" ? metadata.invoiceProviderName : null,
    invoiceType: rawType === "GAS" ? "GAS" : "ELECTRICITY",
  };
}

function getCorrections(log: StoredOcrLog): Correction[] {
  return Object.entries(asRecord(log.userCorrections)).map(([field, value]) => {
    const correction = asRecord(value);
    return {
      field,
      ocrValue: correction.ocr ?? null,
      correctedValue: correction.corrected ?? null,
    };
  });
}

function getRecurringIssues(logs: StoredOcrLog[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    for (const correction of getCorrections(log)) {
      counts[correction.field] = (counts[correction.field] ?? 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function encodedFilesForLog(log: StoredOcrLog): EncodedFile[] {
  return log.ocrFiles.map((file) => ({
    base64: Buffer.from(file.fileData).toString("base64"),
    mimeType: file.fileType ?? "application/octet-stream",
    fileName: file.fileName,
  }));
}

async function resolveVisionFiles(
  files: EncodedFile[],
  provider: string,
): Promise<EncodedFile[]> {
  if (provider !== "ollama-cloud" && !isNvidiaBedrockRuntime(provider)) {
    return files;
  }

  const resolved: EncodedFile[] = [];
  for (const file of files) {
    if (isPdf(file.mimeType)) {
      const images = await convertPdfToImages(
        Buffer.from(file.base64, "base64"),
        OCR_MAX_PDF_PAGES,
        OCR_PDF_RENDER_SCALE,
      );
      for (const image of images) {
        resolved.push({
          base64: image.base64,
          mimeType: image.mimeType,
          fileName: file.fileName,
        });
      }
    } else if (!isNvidiaBedrockRuntime(provider) || isImage(file.mimeType)) {
      resolved.push(file);
    }
  }
  return resolved;
}

async function callVisionLlm(args: {
  prompt: string;
  files: EncodedFile[];
  task: "promptImprovement" | "promptTest";
}) {
  const config = await prisma.systemConfig.findFirst();
  if (!(config as any)?.llmEnabled) {
    throw new Error("LLM features are not enabled");
  }

  const aiConfig = resolveAiConfigFromSystemConfig(
    config as Record<string, any>,
    args.task,
    args.task === "promptImprovement"
      ? { defaultTemperature: 0.1, defaultMaxTokens: 4000, minMaxTokens: 8000 }
      : { defaultTemperature: 0.1, defaultMaxTokens: 4000 },
  );

  const llmBaseUrl = aiConfig?.baseUrl;
  const llmModelName = aiConfig?.modelName;
  const llmProvider = aiConfig?.provider || "ollama";
  const llmApiKey = aiConfig?.apiKey ?? null;
  const llmTemperature = aiConfig?.temperature ?? 0.1;
  const llmMaxTokens = aiConfig?.maxTokens ?? (args.task === "promptImprovement" ? 8000 : 4000);

  if (!llmBaseUrl || !llmModelName) {
    throw new Error("LLM is not properly configured");
  }
  if (llmProvider === "ollama") {
    throw new Error("Local Ollama does not support vision prompt improvement");
  }

  const files = await resolveVisionFiles(args.files, llmProvider);
  let response: Response;

  if (llmProvider === "ollama-cloud" || isOpenAiCompatibleProvider(llmProvider)) {
    const content: any[] = [{ type: "text", text: args.prompt }];
    for (const file of files) {
      if (isPdf(file.mimeType)) {
        content.push({
          type: "file",
          file: {
            filename: file.fileName,
            file_data: `data:${file.mimeType};base64,${file.base64}`,
          },
        });
      } else if (isImage(file.mimeType)) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
        });
      }
    }
    response = await fetch(`${llmBaseUrl}/chat/completions`, {
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
      signal: AbortSignal.timeout(llmProvider === "ollama-cloud" ? 300000 : 60000),
    });
  } else if (isNvidiaBedrockRuntime(llmProvider)) {
    const content: any[] = [{ text: args.prompt }];
    for (const file of files) {
      if (!isImage(file.mimeType)) continue;
      content.push({
        image: {
          format: getBedrockImageFormat(file.mimeType),
          source: { bytes: file.base64 },
        },
      });
    }
    response = await fetch(
      `${llmBaseUrl.replace(/\/+$/, "")}/model/${encodeURIComponent(llmModelName)}/converse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          inferenceConfig: { maxTokens: llmMaxTokens, temperature: llmTemperature },
        }),
        signal: AbortSignal.timeout(300000),
      },
    );
  } else if (llmProvider === "anthropic") {
    const content: any[] = [{ type: "text", text: args.prompt }];
    for (const file of files) {
      if (isPdf(file.mimeType)) {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: file.base64 },
        });
      } else if (isImage(file.mimeType)) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: file.mimeType, data: file.base64 },
        });
      }
    }
    response = await fetch(`${llmBaseUrl}/messages`, {
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
    const parts: any[] = [{ text: args.prompt }];
    for (const file of files) {
      parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });
    }
    response = await fetch(`${llmBaseUrl}/models/${llmModelName}:generateContent?key=${llmApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: AbortSignal.timeout(60000),
    });
  } else {
    throw new Error(`Provider "${llmProvider}" is not supported`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM API error: ${response.status} ${response.statusText} ${errorText.substring(0, 500)}`,
    );
  }

  const data = await response.json();
  const text =
    isOpenAiCompatibleProvider(llmProvider) || llmProvider === "ollama-cloud"
      ? data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || ""
      : llmProvider === "anthropic"
        ? data.content?.[0]?.text || ""
        : isNvidiaBedrockRuntime(llmProvider)
          ? data.output?.message?.content?.[0]?.text || ""
          : llmProvider === "google"
            ? data.candidates?.[0]?.content?.parts?.[0]?.text || ""
            : "";

  return {
    text,
    usage: getAiUsage(data, llmProvider),
    aiConfig,
    llmProvider,
    llmModelName,
    llmBaseUrl,
  };
}

function buildImprovementPrompt(args: {
  log: StoredOcrLog;
  corrections: Correction[];
  recurringIssues: Record<string, number>;
  invoiceProviderName: string | null;
  invoiceType: InvoiceType;
  previousPrompt?: string | null;
  feedback?: string | null;
}) {
  const basePrompt = args.previousPrompt?.trim() || args.log.promptText || "";
  const isReImprove = Boolean(args.previousPrompt?.trim());
  const providerLabel = args.invoiceProviderName
    ? `${args.invoiceProviderName} (${args.invoiceType})`
    : `Unknown provider (${args.invoiceType})`;
  const correctionLines = args.corrections
    .map(({ field, ocrValue, correctedValue }) => {
      if (ocrValue === null && correctedValue !== null) {
        return `- "${field}": not extracted; correct value is "${correctedValue}"`;
      }
      if (correctedValue === null) {
        return `- "${field}": extracted as "${ocrValue}", but should be empty/null`;
      }
      return `- "${field}": extracted as "${ocrValue}", but correct value is "${correctedValue}"`;
    })
    .join("\n");
  const recurringLines =
    Object.entries(args.recurringIssues)
      .filter(([, count]) => count > 1)
      .map(([field, count]) => `- "${field}" was corrected in ${count} recent invoices`)
      .join("\n") || "- No repeated field pattern detected beyond this invoice";

  return `You are an expert invoice-data extraction engineer specialising in Spanish energy invoices.

Create a complete, standalone OCR extraction prompt for invoices from this provider.

PROVIDER: ${providerLabel}

${isReImprove ? "CURRENT CANDIDATE PROMPT TO IMPROVE:" : "CURRENT PROVIDER PROMPT:"}
---
${basePrompt}
---

PREVIOUSLY EXTRACTED DATA:
${JSON.stringify(args.log.extractedFields ?? {}, null, 2)}

USER CORRECTIONS FOR THE REPRESENTATIVE INVOICE:
${correctionLines}

RECURRING PROBLEMS IN THE LAST 24 HOURS FOR THIS PROVIDER:
${recurringLines}
${args.feedback ? `\nFAILED TEST FEEDBACK FROM THE LAST ATTEMPT:\n${args.feedback}\n` : ""}

Write the final prompt only.

Rules:
- Keep every JSON field name used by the current prompt.
- Add provider-specific location hints, labels, nearby text, table names, and section names.
- Fix the corrected fields and the recurring issue patterns without hardcoding sample values.
- Preserve extraction behavior for fields that were already correct.
- The prompt must work for future invoices from the same provider, not only the sample attached now.
- Tell the extraction AI to return only a valid JSON object.
- Never instruct the AI to always return a fixed value.
- Return null only when a value is genuinely absent after searching the invoice.
- Do not mention corrections, this task, tests, or prompt improvement in the final prompt.
- Do not include markdown fences, commentary, or analysis.`;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const match =
    text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error("LLM did not return a valid JSON object");
  return JSON.parse(match[1]);
}

function evaluatePromptResult(log: StoredOcrLog, newFields: Record<string, unknown>) {
  const failedChecks: Array<{ logId: string; field: string; expected: unknown; actual: unknown }> = [];
  for (const correction of getCorrections(log)) {
    const actual = newFields[correction.field];
    if (normaliseComparable(actual) !== normaliseComparable(correction.correctedValue)) {
      failedChecks.push({
        logId: log.id,
        field: correction.field,
        expected: correction.correctedValue,
        actual,
      });
    }
  }
  return failedChecks;
}

function buildFeedback(failures: Array<{ logId: string; field: string; expected: unknown; actual: unknown }>) {
  return failures
    .slice(0, 20)
    .map(
      (failure) =>
        `- Log ${failure.logId}, field "${failure.field}": expected "${failure.expected}", got "${failure.actual ?? "null"}"`,
    )
    .join("\n");
}

async function createPromptImprovementLog(args: {
  sourceLog: StoredOcrLog;
  promptText: string;
  improvedPrompt: string;
  corrections: Correction[];
  recurringIssues: Record<string, number>;
  testResults?: unknown;
  accepted?: boolean;
  reviewStatus?: string;
}) {
  const context = getInvoiceContext(args.sourceLog);
  const aiResult = await callVisionLlm({
    prompt: args.promptText,
    files: encodedFilesForLog(args.sourceLog),
    task: "promptImprovement",
  });

  if (!aiResult.text.trim()) {
    throw new Error("LLM returned an empty prompt improvement response");
  }

  return prisma.ocrLog.create({
    data: {
      userEmail: "system-cron",
      simulationId: args.sourceLog.simulationId,
      type: "PROMPT_IMPROVEMENT",
      status: "SUCCESS",
      provider: aiResult.llmProvider,
      model: aiResult.llmModelName,
      baseUrl: aiResult.llmBaseUrl,
      promptTokens: aiResult.usage.promptTokens,
      completionTokens: aiResult.usage.completionTokens,
      totalTokens: aiResult.usage.totalTokens,
      promptText: args.promptText,
      extractedFields: { improvedPrompt: aiResult.text.trim() },
      fieldsExtracted: 1,
      metadata: {
        source: "auto-ocr-prompt-improvement-cron",
        reviewStatus: args.reviewStatus ?? "AUTO_REVIEW_PENDING",
        sourceOcrLogId: args.sourceLog.id,
        invoiceProviderId: context.invoiceProviderId,
        invoiceProviderName: context.invoiceProviderName,
        invoiceType: context.invoiceType,
        targetProviderPromptField:
          context.invoiceType === "GAS" ? "promptGas" : "promptElectricity",
        correctionsCount: args.corrections.length,
        recurringIssues: args.recurringIssues,
        testResults: args.testResults ?? null,
        accepted: args.accepted ?? null,
        aiProviderConfigId: aiResult.aiConfig?.id,
        aiTask: "promptImprovement",
      },
    },
  });
}

async function testPromptAgainstLog(log: StoredOcrLog, prompt: string) {
  const aiResult = await callVisionLlm({
    prompt,
    files: encodedFilesForLog(log),
    task: "promptTest",
  });
  const newFields = parseJsonObject(aiResult.text);
  await prisma.ocrLog.create({
    data: {
      userEmail: "system-cron",
      simulationId: log.simulationId,
      type: "PROMPT_TEST",
      status: "SUCCESS",
      provider: aiResult.llmProvider,
      model: aiResult.llmModelName,
      baseUrl: aiResult.llmBaseUrl,
      promptTokens: aiResult.usage.promptTokens,
      completionTokens: aiResult.usage.completionTokens,
      totalTokens: aiResult.usage.totalTokens,
      promptText: prompt,
      extractedFields: newFields as Prisma.InputJsonValue,
      fieldsExtracted: Object.values(newFields).filter(
        (value) => value !== null && value !== undefined && value !== "",
      ).length,
      metadata: {
        source: "auto-ocr-prompt-improvement-cron",
        sourceOcrLogId: log.id,
        aiProviderConfigId: aiResult.aiConfig?.id,
        aiTask: "promptTest",
      },
    },
  });
  return newFields;
}

export class OcrPromptImprovementService {
  static async runRecentCorrectionsBatch(
    options: OcrPromptImprovementBatchOptions = {},
  ): Promise<OcrPromptImprovementBatchResult> {
    const since = options.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const maxAttempts = options.maxAttempts ?? 3;
    const maxLogsPerProvider = options.maxLogsPerProvider ?? 5;
    const minimumCorrectionsPerProvider = options.minimumCorrectionsPerProvider ?? 1;

    const logs = (await prisma.ocrLog.findMany({
      where: {
        requestedAt: { gte: since },
        type: "INVOICE_EXTRACTION",
        promptText: { not: null },
        userCorrections: { not: Prisma.JsonNull },
        OR: [{ issueStatus: null }, { issueStatus: { notIn: ["RESOLVED", "DISMISSED"] } }],
      },
      include: {
        ocrFiles: true,
        simulation: { select: { referenceNumber: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
    } as any)) as StoredOcrLog[];

    const correctedLogs = logs.filter(
      (log) => hasCorrections(log.userCorrections) && log.ocrFiles.length > 0,
    );
    const groups = new Map<string, StoredOcrLog[]>();

    for (const log of correctedLogs) {
      const context = getInvoiceContext(log);
      const providerKey =
        context.invoiceProviderId ??
        context.invoiceProviderName ??
        asRecord(log.metadata).invoiceProviderSlug ??
        "unknown-provider";
      const groupKey = `${providerKey}::${context.invoiceType}`;
      const group = groups.get(groupKey) ?? [];
      if (group.length < maxLogsPerProvider) group.push(log);
      groups.set(groupKey, group);
    }

    const result: OcrPromptImprovementBatchResult = {
      processedGroups: 0,
      proposalsCreated: 0,
      skippedGroups: 0,
      totalSourceLogs: correctedLogs.length,
      groups: [],
    };

    for (const [groupKey, groupLogs] of groups.entries()) {
      const sourceLogIds = groupLogs.map((log) => log.id);
      const context = getInvoiceContext(groupLogs[0]);
      const recurringIssues = getRecurringIssues(groupLogs);
      const totalCorrections = groupLogs.reduce((sum, log) => sum + getCorrections(log).length, 0);

      if (totalCorrections < minimumCorrectionsPerProvider) {
        result.skippedGroups += 1;
        result.groups.push({
          groupKey,
          ...context,
          sourceLogIds,
          attempts: 0,
          accepted: false,
          proposalLogId: null,
          recurringIssues,
          failedChecks: [],
          message: "Skipped because there were not enough corrections",
        });
        continue;
      }

      result.processedGroups += 1;
      const representativeLog = [...groupLogs].sort(
        (a, b) => getCorrections(b).length - getCorrections(a).length,
      )[0];
      const representativeCorrections = getCorrections(representativeLog);
      let candidatePrompt: string | null = null;
      let feedback: string | null = null;
      let failedChecks: Array<{ logId: string; field: string; expected: unknown; actual: unknown }> = [];
      let accepted = false;
      let proposalLogId: string | null = null;
      let attempts = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        attempts = attempt;
        const improvementPrompt = buildImprovementPrompt({
          log: representativeLog,
          corrections: representativeCorrections,
          recurringIssues,
          invoiceProviderName: context.invoiceProviderName,
          invoiceType: context.invoiceType,
          previousPrompt: candidatePrompt,
          feedback,
        });

        const improvementLog = await createPromptImprovementLog({
          sourceLog: representativeLog,
          promptText: improvementPrompt,
          improvedPrompt: "",
          corrections: representativeCorrections,
          recurringIssues,
          reviewStatus: "AUTO_TESTING",
        });
        const improvedPrompt = asRecord(improvementLog.extractedFields).improvedPrompt;
        candidatePrompt = typeof improvedPrompt === "string" ? improvedPrompt : null;
        if (!candidatePrompt) throw new Error("Prompt improvement log did not contain a prompt");

        failedChecks = [];
        const testResults: Array<{
          logId: string;
          simulationReferenceNumber: string | null;
          passed: boolean;
          failedChecks: Array<{ field: string; expected: unknown; actual: unknown }>;
        }> = [];

        for (const log of groupLogs) {
          const newFields = await testPromptAgainstLog(log, candidatePrompt);
          const logFailures = evaluatePromptResult(log, newFields);
          failedChecks.push(...logFailures);
          testResults.push({
            logId: log.id,
            simulationReferenceNumber: log.simulation?.referenceNumber ?? null,
            passed: logFailures.length === 0,
            failedChecks: logFailures.map(({ field, expected, actual }) => ({
              field,
              expected,
              actual,
            })),
          });
        }

        accepted = failedChecks.length === 0;
        await prisma.ocrLog.update({
          where: { id: improvementLog.id },
          data: {
            metadata: {
              ...(asRecord(improvementLog.metadata) as Prisma.JsonObject),
              reviewStatus: accepted ? "AUTO_REVIEW_PENDING" : "AUTO_TEST_FAILED",
              accepted,
              attempt,
              sourceOcrLogIds: sourceLogIds,
              testResults,
              failedChecks,
            } as Prisma.InputJsonValue,
          },
        });
        proposalLogId = improvementLog.id;

        if (accepted) break;
        feedback = buildFeedback(failedChecks);
      }

      await prisma.ocrLog.updateMany({
        where: { id: { in: sourceLogIds } },
        data: {
          issueStatus: accepted ? "IN_PROGRESS" : "OPEN",
          issueNotes: accepted
            ? `Automated prompt proposal ${proposalLogId} is ready for sys admin review.`
            : `Automated prompt improvement could not pass all corrected fields after ${maxAttempts} attempts.`,
        },
      });

      if (proposalLogId) result.proposalsCreated += 1;
      result.groups.push({
        groupKey,
        ...context,
        sourceLogIds,
        attempts,
        accepted,
        proposalLogId,
        recurringIssues,
        failedChecks,
      });
    }

    return result;
  }
}
