import { prisma } from "@/infrastructure/database/prisma";

export type AiTaskKey =
  | "invoiceExtraction"
  | "providerDetection"
  | "promptImprovement"
  | "promptTest"
  | "templateBuilder";

export interface AiProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  provider: string;
  apiKey?: string | null;
  modelName: string;
  baseUrl: string;
  temperature?: number | string | null;
  maxTokens?: number | null;
}

export interface ResolvedAiConfig extends AiProviderConfig {
  temperature: number;
  maxTokens: number;
  task: AiTaskKey;
  isLegacyFallback: boolean;
}

export const AI_TASK_LABELS: Record<AiTaskKey, string> = {
  invoiceExtraction: "Invoice extraction",
  providerDetection: "Provider detection",
  promptImprovement: "Prompt improvement",
  promptTest: "Prompt testing",
  templateBuilder: "Template builder",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asProviderConfigs = (value: unknown): AiProviderConfig[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === "object")
        .map((item) => item as AiProviderConfig)
        .filter((item) => item.id && item.provider && item.modelName && item.baseUrl)
    : [];

const toNumber = (value: unknown, fallback: number): number => {
  const n =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : value && typeof (value as { toString?: unknown }).toString === "function"
        ? Number((value as { toString: () => string }).toString())
        : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export function buildLegacyAiProvider(config: Record<string, any>): AiProviderConfig {
  return {
    id: "legacy-default",
    name: "Default LLM configuration",
    enabled: Boolean(config.llmEnabled),
    provider: config.llmProvider || "ollama",
    apiKey: config.llmApiKey ?? null,
    modelName: config.llmModelName || "",
    baseUrl: config.llmBaseUrl || "",
    temperature: config.llmTemperature ?? 0.1,
    maxTokens: config.llmMaxTokens ?? 2000,
  };
}

export function getConfiguredAiProviders(config: Record<string, any>): AiProviderConfig[] {
  const providers = asProviderConfigs(config.aiProviderConfigs);
  const legacy = buildLegacyAiProvider(config);
  return providers.length > 0 ? providers : [legacy];
}

export function getAiTaskConfigs(config: Record<string, any>): Record<string, string> {
  return asRecord(config.aiTaskConfigs) as Record<string, string>;
}

export function isOpenAiCompatibleProvider(provider: string): boolean {
  return (
    provider === "openai" ||
    provider === "azure-openai" ||
    provider === "ollama-cloud" ||
    provider === "aws-bedrock-mantle"
  );
}

export function resolveAiConfigFromSystemConfig(
  config: Record<string, any> | null | undefined,
  task: AiTaskKey,
  options?: { minMaxTokens?: number; defaultTemperature?: number; defaultMaxTokens?: number },
): ResolvedAiConfig | null {
  if (!config?.llmEnabled) return null;

  const providers = getConfiguredAiProviders(config).filter((provider) => provider.enabled !== false);
  const taskConfigs = getAiTaskConfigs(config);
  const selectedId = taskConfigs[task] || taskConfigs.default;
  const selected =
    providers.find((provider) => provider.id === selectedId) ||
    providers.find((provider) => provider.id === "legacy-default") ||
    providers[0];

  if (!selected?.baseUrl || !selected?.modelName) return null;

  const defaultTemperature = options?.defaultTemperature ?? 0.1;
  const defaultMaxTokens = options?.defaultMaxTokens ?? 2000;
  const maxTokens = Math.max(
    toNumber(selected.maxTokens, defaultMaxTokens),
    options?.minMaxTokens ?? 0,
  );

  return {
    ...selected,
    task,
    temperature: toNumber(selected.temperature, defaultTemperature),
    maxTokens,
    isLegacyFallback: selected.id === "legacy-default",
  };
}

export async function resolveAiConfig(
  task: AiTaskKey,
  options?: { minMaxTokens?: number; defaultTemperature?: number; defaultMaxTokens?: number },
): Promise<ResolvedAiConfig | null> {
  const config = await prisma.systemConfig.findFirst();
  return resolveAiConfigFromSystemConfig(config as Record<string, any> | null, task, options);
}

export function getAiUsage(data: any, provider: string) {
  if (provider === "anthropic") {
    const promptTokens = data.usage?.input_tokens;
    const completionTokens = data.usage?.output_tokens;
    return {
      promptTokens,
      completionTokens,
      totalTokens:
        promptTokens !== undefined || completionTokens !== undefined
          ? (promptTokens ?? 0) + (completionTokens ?? 0)
          : undefined,
    };
  }

  if (provider === "google") {
    return {
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
    };
  }

  if (provider === "aws-bedrock-nvidia") {
    return {
      promptTokens: data.usage?.inputTokens,
      completionTokens: data.usage?.outputTokens,
      totalTokens: data.usage?.totalTokens,
    };
  }

  return {
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
  };
}
