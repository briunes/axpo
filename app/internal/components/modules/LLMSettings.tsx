"use client";

import { useState, useEffect } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ScienceIcon from "@mui/icons-material/Science";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, testLlmConnection, type LlmTestResult } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { FormInput, FormSelect } from "../ui";
import { LLMBenchmark } from "./LLMBenchmark";

export interface LLMSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface LLMConfig {
    llmEnabled: boolean;
    llmProvider: string;
    llmApiKey: string;
    llmModelName: string;
    llmBaseUrl: string;
    llmTemperature: number;
    llmMaxTokens: number;
    aiProviderConfigs: AIProviderConfig[];
    aiTaskConfigs: Record<string, string>;
}

interface AIProviderConfig {
    id: string;
    name: string;
    enabled: boolean;
    provider: string;
    apiKey: string;
    hasApiKey?: boolean;
    modelName: string;
    baseUrl: string;
    temperature: number;
    maxTokens: number;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
    llmEnabled: false,
    llmProvider: "ollama-cloud",
    llmApiKey: "",
    llmModelName: "qwen3-vl:235b",
    llmBaseUrl: "",
    llmTemperature: 0.1,
    llmMaxTokens: 2000,
    aiProviderConfigs: [],
    aiTaskConfigs: {},
};

const AI_TASKS = [
    { key: "invoiceExtraction", labelKey: "taskInvoiceExtraction" },
    { key: "providerDetection", labelKey: "taskProviderDetection" },
    { key: "promptImprovement", labelKey: "taskPromptImprovement" },
    { key: "promptTest", labelKey: "taskPromptTest" },
    { key: "templateBuilder", labelKey: "taskTemplateBuilder" },
];

// Ollama Cloud models - Update by copying JSON from https://ollama.com/v1/models
const OLLAMA_CLOUD_MODELS_DATA = { "object": "list", "data": [{ "id": "minimax-m2.7", "object": "model", "created": 1773792000, "owned_by": "ollama" }, { "id": "devstral-2:123b", "object": "model", "created": 1765152000, "owned_by": "ollama" }, { "id": "devstral-small-2:24b", "object": "model", "created": 1765238400, "owned_by": "ollama" }, { "id": "glm-5.1", "object": "model", "created": 1775577600, "owned_by": "ollama" }, { "id": "kimi-k2.5", "object": "model", "created": 1769385600, "owned_by": "ollama" }, { "id": "qwen3-coder-next", "object": "model", "created": 1738627200, "owned_by": "ollama" }, { "id": "nemotron-3-nano:30b", "object": "model", "created": 1765756800, "owned_by": "ollama" }, { "id": "qwen3-vl:235b", "object": "model", "created": 1758499200, "owned_by": "ollama" }, { "id": "minimax-m2.1", "object": "model", "created": 1766188800, "owned_by": "ollama" }, { "id": "gemini-3-flash-preview", "object": "model", "created": 1765929600, "owned_by": "ollama" }, { "id": "glm-5", "object": "model", "created": 1770768000, "owned_by": "ollama" }, { "id": "minimax-m2", "object": "model", "created": 1761523200, "owned_by": "ollama" }, { "id": "nemotron-3-super", "object": "model", "created": 1773187200, "owned_by": "ollama" }, { "id": "kimi-k2.6", "object": "model", "created": 1774915200, "owned_by": "ollama" }, { "id": "qwen3-next:80b", "object": "model", "created": 1757462400, "owned_by": "ollama" }, { "id": "gpt-oss:120b", "object": "model", "created": 1754352000, "owned_by": "ollama" }, { "id": "minimax-m2.5", "object": "model", "created": 1770854400, "owned_by": "ollama" }, { "id": "ministral-3:3b", "object": "model", "created": 1764633600, "owned_by": "ollama" }, { "id": "ministral-3:8b", "object": "model", "created": 1764633600, "owned_by": "ollama" }, { "id": "ministral-3:14b", "object": "model", "created": 1764633600, "owned_by": "ollama" }, { "id": "mistral-large-3:675b", "object": "model", "created": 1764633600, "owned_by": "ollama" }, { "id": "kimi-k2:1t", "object": "model", "created": 1757030400, "owned_by": "ollama" }, { "id": "qwen3-coder:480b", "object": "model", "created": 1753142400, "owned_by": "ollama" }, { "id": "qwen3-vl:235b-instruct", "object": "model", "created": 1758499200, "owned_by": "ollama" }, { "id": "gemma3:4b", "object": "model", "created": 1741737600, "owned_by": "ollama" }, { "id": "gemma4:31b", "object": "model", "created": 1775149200, "owned_by": "ollama" }, { "id": "gpt-oss:20b", "object": "model", "created": 1754352000, "owned_by": "ollama" }, { "id": "gemma3:27b", "object": "model", "created": 1741737600, "owned_by": "ollama" }, { "id": "rnj-1:8b", "object": "model", "created": 1765238400, "owned_by": "ollama" }, { "id": "glm-4.6", "object": "model", "created": 1759104000, "owned_by": "ollama" }, { "id": "glm-4.7", "object": "model", "created": 1766361600, "owned_by": "ollama" }, { "id": "kimi-k2-thinking", "object": "model", "created": 1762387200, "owned_by": "ollama" }, { "id": "deepseek-v3.1:671b", "object": "model", "created": 1763596800, "owned_by": "ollama" }, { "id": "gemma3:12b", "object": "model", "created": 1741737600, "owned_by": "ollama" }, { "id": "qwen3.5:397b", "object": "model", "created": 1771200000, "owned_by": "ollama" }, { "id": "cogito-2.1:671b", "object": "model", "created": 1763510400, "owned_by": "ollama" }, { "id": "deepseek-v3.2", "object": "model", "created": 1764633600, "owned_by": "ollama" }] };

const OLLAMA_CLOUD_MODELS = OLLAMA_CLOUD_MODELS_DATA.data.map((model: any) => model.id).sort();

// Provider configurations with default settings
const LLM_PROVIDERS: Record<string, {
    name: string;
    requiresApiKey: boolean;
    defaultBaseUrl: string;
    defaultModel: string;
    description: string;
    commonModels: string[];
}> = {
    ollama: {
        name: "Ollama (Local)",
        requiresApiKey: false,
        defaultBaseUrl: "http://localhost:11434",
        defaultModel: "llama3.2",
        description: "Local Ollama server",
        commonModels: ["llama3.2", "llama3.1", "llama2", "mistral", "mixtral", "codellama", "gemma2", "qwen2.5"],
    },
    "ollama-cloud": {
        name: "Ollama Cloud",
        requiresApiKey: true,
        defaultBaseUrl: "https://ollama.com/v1",
        defaultModel: "qwen3-vl:235b",
        description: "Hosted Ollama service (requires API key). Use qwen3-vl:235b for invoice extraction.",
        commonModels: OLLAMA_CLOUD_MODELS,
    },
    openai: {
        name: "OpenAI",
        requiresApiKey: true,
        defaultBaseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4",
        description: "OpenAI GPT models",
        commonModels: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    },
    anthropic: {
        name: "Anthropic",
        requiresApiKey: true,
        defaultBaseUrl: "https://api.anthropic.com/v1",
        defaultModel: "claude-3-opus-20240229",
        description: "Anthropic Claude models",
        commonModels: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
    },
    "azure-openai": {
        name: "Azure OpenAI",
        requiresApiKey: true,
        defaultBaseUrl: "",
        defaultModel: "gpt-4",
        description: "Azure OpenAI Service",
        commonModels: ["gpt-4", "gpt-4-32k", "gpt-35-turbo"],
    },
    google: {
        name: "Google AI",
        requiresApiKey: true,
        defaultBaseUrl: "https://generativelanguage.googleapis.com/v1",
        defaultModel: "gemini-pro",
        description: "Google Gemini models",
        commonModels: ["gemini-pro", "gemini-pro-vision"],
    },
    custom: {
        name: "Custom",
        requiresApiKey: false,
        defaultBaseUrl: "",
        defaultModel: "",
        description: "Custom LLM endpoint",
        commonModels: [],
    },
};

export function LLMSettings({ session, onNotify }: LLMSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
    const [activeSubTab, setActiveSubTab] = useState<"tasks" | "providers" | "benchmark">("tasks");
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, LlmTestResult>>({});
    const [providerDialogMode, setProviderDialogMode] = useState<"add" | "edit" | null>(null);
    const [draftProvider, setDraftProvider] = useState<AIProviderConfig | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemConfig({ view: "admin" });
            setConfig({
                llmEnabled: data.llmEnabled ?? false,
                llmProvider: data.llmProvider ?? "ollama-cloud",
                llmApiKey: "",
                llmModelName: data.llmModelName ?? "qwen3-next:80b",
                llmBaseUrl: data.llmBaseUrl ?? "",
                llmTemperature: data.llmTemperature ?? 0.1,
                llmMaxTokens: data.llmMaxTokens ?? 2000,
                aiProviderConfigs: (data.aiProviderConfigs ?? []).map((provider: any) => ({
                    id: provider.id,
                    name: provider.name || provider.id,
                    enabled: provider.enabled !== false,
                    provider: provider.provider || "ollama-cloud",
                    apiKey: "",
                    hasApiKey: provider.hasApiKey,
                    modelName: provider.modelName || "",
                    baseUrl: provider.baseUrl || "",
                    temperature: Number(provider.temperature ?? 0.1),
                    maxTokens: Number(provider.maxTokens ?? 2000),
                })),
                aiTaskConfigs: data.aiTaskConfigs ?? {},
            });
        } catch (error) {
            console.error("Failed to load LLM config:", error);
            onNotify(t("llmSettings", "errorLoading"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof LLMConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const createDefaultAiProvider = (): AIProviderConfig => {
        const provider = LLM_PROVIDERS["ollama-cloud"];
        return {
            id: `ai-provider-${Date.now()}`,
            name: `${t("llmSettings", "provider")} ${config.aiProviderConfigs.length + 1}`,
            enabled: true,
            provider: "ollama-cloud",
            apiKey: "",
            modelName: provider.defaultModel,
            baseUrl: provider.defaultBaseUrl,
            temperature: 0.1,
            maxTokens: 4000,
        };
    };

    const openAddProviderDialog = () => {
        setDraftProvider(createDefaultAiProvider());
        setProviderDialogMode("add");
    };

    const openEditProviderDialog = (provider: AIProviderConfig) => {
        setDraftProvider({ ...provider, apiKey: "" });
        setProviderDialogMode("edit");
    };

    const closeProviderDialog = () => {
        setProviderDialogMode(null);
        setDraftProvider(null);
    };

    const updateDraftProvider = (patch: Partial<AIProviderConfig>) => {
        setDraftProvider((prev) => {
            if (!prev) return prev;
            const next = { ...prev, ...patch };
            if (patch.provider) {
                const providerConfig = LLM_PROVIDERS[patch.provider];
                next.baseUrl = providerConfig?.defaultBaseUrl || next.baseUrl;
                next.modelName = providerConfig?.defaultModel || next.modelName;
            }
            return next;
        });
    };

    const saveDraftProvider = () => {
        if (!draftProvider) return;
        setConfig((prev) => {
            if (providerDialogMode === "edit") {
                return {
                    ...prev,
                    aiProviderConfigs: prev.aiProviderConfigs.map((item) =>
                        item.id === draftProvider.id ? draftProvider : item,
                    ),
                };
            }
            return {
                ...prev,
                aiProviderConfigs: [...prev.aiProviderConfigs, draftProvider],
            };
        });
        setIsDirty(true);
        closeProviderDialog();
    };

    const removeAiProvider = (id: string) => {
        setConfig((prev) => {
            const remaining = prev.aiProviderConfigs.filter((item) => item.id !== id);
            const nextTaskConfigs = Object.fromEntries(
                Object.entries(prev.aiTaskConfigs).filter(([, providerId]) => providerId !== id),
            );
            return { ...prev, aiProviderConfigs: remaining, aiTaskConfigs: nextTaskConfigs };
        });
        setIsDirty(true);
    };

    const updateTaskProvider = (taskKey: string, providerId: string) => {
        setConfig((prev) => ({
            ...prev,
            aiTaskConfigs: { ...prev.aiTaskConfigs, [taskKey]: providerId },
        }));
        setIsDirty(true);
    };

    const getProviderSummary = (provider: AIProviderConfig) => {
        const providerName = LLM_PROVIDERS[provider.provider]?.name ?? provider.provider;
        return `${providerName} / ${provider.modelName || t("llmSettings", "noModel")}`;
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const { llmApiKey, ...safeConfig } = config;
            await updateSystemConfig({
                ...safeConfig,
                ...(llmApiKey ? { llmApiKey } : {}),
            });
            setIsDirty(false);
            onNotify(t("llmSettings", "saveSuccess"), "success");
        } catch (error) {
            console.error("Failed to save LLM config:", error);
            onNotify(t("llmSettings", "saveError"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        loadConfig();
        setIsDirty(false);
    };

    const handleTestConnection = async (providerConfig: AIProviderConfig) => {
        try {
            setTestingProviderId(providerConfig.id);
            setTestResults((prev) => {
                const next = { ...prev };
                delete next[providerConfig.id];
                return next;
            });
            const result = await testLlmConnection({
                providerConfigId: providerConfig.id,
                provider: providerConfig.provider,
                apiKey: providerConfig.apiKey,
                baseUrl: providerConfig.baseUrl,
                modelName: providerConfig.modelName,
            });
            setTestResults((prev) => ({ ...prev, [providerConfig.id]: result }));
            if (result.success) {
                onNotify(result.message, "success");
            } else {
                onNotify(result.message, "error");
            }
        } catch (error) {
            console.error("Failed to test LLM connection:", error);
            const errorResult = {
                success: false,
                message: t("llmSettings", "testConnectionFailed"),
            };
            setTestResults((prev) => ({ ...prev, [providerConfig.id]: errorResult }));
            onNotify(errorResult.message, "error");
        } finally {
            setTestingProviderId(null);
        }
    };

    if (isLoading) {
        return <LoadingState />;
    }

    const enabledProviders = config.aiProviderConfigs.filter((provider) => provider.enabled);
    const providerOptions = enabledProviders.length > 0 ? enabledProviders : config.aiProviderConfigs;
    const dialogProviderMeta = draftProvider
        ? LLM_PROVIDERS[draftProvider.provider] ?? LLM_PROVIDERS.custom
        : null;

    return (
        <div className="llm-settings-container">
            <div className="settings-header">
                {isDirty && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={handleReset}
                            disabled={isSaving}
                        >
                            {t("common", "cancel")}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? t("common", "saving") : t("common", "save")}
                        </Button>
                    </Box>
                )}
            </div>

            <div className="settings-panel llm-settings-panel">
                <Tabs
                    value={activeSubTab}
                    onChange={(_, value) => setActiveSubTab(value)}
                    sx={{
                        minHeight: 44,
                        borderBottom: "1px solid var(--scheme-neutral-900)",
                        mb: 3,
                        '& .MuiTabs-indicator': {
                            backgroundColor: 'var(--scheme-brand-600)',
                            height: 2,
                        },
                    }}
                >
                    <Tab value="tasks" label={t("llmSettings", "tabTaskRouting")} sx={{ textTransform: "none", fontWeight: 700 }} />
                    <Tab value="providers" label={t("llmSettings", "tabAvailableLlms")} sx={{ textTransform: "none", fontWeight: 700 }} />
                    <Tab value="benchmark" label="Benchmark" sx={{ textTransform: "none", fontWeight: 700 }} />
                </Tabs>

                {activeSubTab === "tasks" && (
                    <Stack spacing={2.5}>
                        <Box>
                            <h3 className="settings-panel-title">{t("llmSettings", "taskRoutingTitle")}</h3>
                            <p style={{ margin: 0, color: "var(--axpo-text-secondary)" }}>
                                {t("llmSettings", "taskRoutingDesc")}
                            </p>
                        </Box>

                        <Box
                            sx={{
                                border: "1px solid var(--scheme-neutral-900)",
                                borderRadius: "8px",
                                p: 2,
                                backgroundColor: "var(--scheme-neutral-1200)",
                            }}
                        >
                            <label className="config-field-inline">
                                <input
                                    type="checkbox"
                                    checked={config.llmEnabled}
                                    onChange={(e) => handleChange("llmEnabled", e.target.checked)}
                                />
                                <span>{t("llmSettings", "enableLlm")}</span>
                            </label>
                            <span className="config-field-description" style={{ marginLeft: "32px", marginBottom: 0 }}>
                                {t("llmSettings", "enableLlmDesc")}
                            </span>
                        </Box>

                        {!config.llmEnabled ? (
                            <Box sx={{ color: "var(--axpo-text-secondary)" }}>
                                {t("llmSettings", "enableRoutingHint")}
                            </Box>
                        ) : providerOptions.length === 0 ? (
                            <Box sx={{ color: "var(--axpo-text-secondary)" }}>
                                {t("llmSettings", "noLlmsConfiguredHint")}
                            </Box>
                        ) : (
                            <Stack spacing={2}>
                                {AI_TASKS.map((task) => {
                                    const selectedId = config.aiTaskConfigs[task.key] || providerOptions[0]?.id || "";
                                    const selected = config.aiProviderConfigs.find((provider) => provider.id === selectedId);
                                    return (
                                        <Box
                                            key={task.key}
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: { xs: "1fr", md: "220px 1fr 260px" },
                                                gap: 2,
                                                alignItems: "center",
                                                border: "1px solid var(--scheme-neutral-900)",
                                                borderRadius: "8px",
                                                p: 2,
                                            }}
                                        >
                                            <Box sx={{ fontWeight: 700 }}>{t("llmSettings", task.labelKey)}</Box>
                                            <FormSelect
                                                label=""
                                                value={selectedId}
                                                onChange={(value) => updateTaskProvider(task.key, String(value))}
                                                options={providerOptions.map((provider) => ({
                                                    value: provider.id,
                                                    label: provider.name,
                                                    secondaryLabel: getProviderSummary(provider),
                                                }))}
                                            />
                                            <Box sx={{ color: "var(--axpo-text-secondary)", fontSize: 13 }}>
                                                {selected ? getProviderSummary(selected) : t("llmSettings", "noLlmSelected")}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Stack>
                )}

                {activeSubTab === "providers" && (
                    <Stack spacing={2.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                            <Box>
                                <h3 className="settings-panel-title">{t("llmSettings", "providersTitle")}</h3>
                                <p style={{ margin: 0, color: "var(--axpo-text-secondary)" }}>
                                    {t("llmSettings", "providersDesc")}
                                </p>
                            </Box>
                            <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddProviderDialog}>
                                {t("llmSettings", "addLlm")}
                            </Button>
                        </Stack>

                        <Box sx={{ overflowX: "auto", border: "1px solid var(--scheme-neutral-900)", borderRadius: "8px" }}>
                            <Table size="small" sx={{ minWidth: 920 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "enabled")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "name")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "provider")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "modelName")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "baseUrl")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "apiKey")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "temperature")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("llmSettings", "maxTokens")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700, width: 140 }}>{t("llmSettings", "actions")}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {config.aiProviderConfigs.map((providerConfig) => {
                                        const providerMeta = LLM_PROVIDERS[providerConfig.provider] ?? LLM_PROVIDERS.custom;
                                        const testResult = testResults[providerConfig.id];
                                        return (
                                            <TableRow key={providerConfig.id} hover>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={providerConfig.enabled ? t("llmSettings", "enabled") : t("llmSettings", "disabled")}
                                                        color={providerConfig.enabled ? "success" : "default"}
                                                        variant={providerConfig.enabled ? "filled" : "outlined"}
                                                    />
                                                </TableCell>
                                                <TableCell>{providerConfig.name}</TableCell>
                                                <TableCell>{providerMeta.name}</TableCell>
                                                <TableCell>{providerConfig.modelName || "—"}</TableCell>
                                                <TableCell sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {providerConfig.baseUrl || "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {providerMeta.requiresApiKey
                                                        ? providerConfig.hasApiKey
                                                            ? t("llmSettings", "apiKeySaved")
                                                            : t("llmSettings", "apiKeyMissing")
                                                        : t("llmSettings", "apiKeyNotRequired")}
                                                </TableCell>
                                                <TableCell>{providerConfig.temperature}</TableCell>
                                                <TableCell>{providerConfig.maxTokens}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" gap={0.5} alignItems="center">
                                                        <Tooltip title={t("llmSettings", "testConnection")}>
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleTestConnection(providerConfig)}
                                                                    disabled={testingProviderId === providerConfig.id || !providerConfig.baseUrl || !providerConfig.modelName}
                                                                >
                                                                    <ScienceIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title={t("llmSettings", "editLlm")}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => openEditProviderDialog(providerConfig)}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {providerConfig.id !== "legacy-default" && (
                                                            <Tooltip title={t("llmSettings", "removeLlm")}>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => removeAiProvider(providerConfig.id)}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                    {testResult && (
                                                        <Box
                                                            sx={{
                                                                mt: 1,
                                                                fontSize: 12,
                                                                color: testResult.success ? "success.main" : "error.main",
                                                            }}
                                                        >
                                                            {testResult.success ? t("llmSettings", "connected") : testResult.message}
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {config.aiProviderConfigs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} sx={{ color: "var(--axpo-text-secondary)", py: 3 }}>
                                                {t("llmSettings", "noConfiguredLlms")}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Stack>
                )}

                {activeSubTab === "benchmark" && (
                    <LLMBenchmark
                        session={session}
                        onNotify={onNotify}
                        providers={config.aiProviderConfigs.map((p) => ({
                            id: p.id,
                            name: p.name,
                            enabled: p.enabled,
                            provider: p.provider,
                            modelName: p.modelName,
                        }))}
                    />
                )}
            </div>

            <Dialog
                open={Boolean(providerDialogMode && draftProvider)}
                onClose={closeProviderDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {providerDialogMode === "edit" ? t("llmSettings", "editLlmTitle") : t("llmSettings", "addLlmTitle")}
                </DialogTitle>
                <Divider />
                {draftProvider && dialogProviderMeta && (
                    <DialogContent sx={{ pt: 3 }}>
                        <Stack spacing={2.5}>
                            <label className="config-field-inline">
                                <input
                                    type="checkbox"
                                    checked={draftProvider.enabled}
                                    onChange={(e) => updateDraftProvider({ enabled: e.target.checked })}
                                />
                                <span>{t("llmSettings", "enabled")}</span>
                            </label>
                            <FormInput
                                label={t("llmSettings", "configurationName")}
                                type="text"
                                value={draftProvider.name}
                                onChange={(e) => updateDraftProvider({ name: e.target.value })}
                            />
                            <FormSelect
                                label={t("llmSettings", "provider")}
                                value={draftProvider.provider}
                                onChange={(value) => updateDraftProvider({ provider: String(value) })}
                                options={Object.entries(LLM_PROVIDERS).map(([key, provider]) => ({
                                    value: key,
                                    label: provider.name,
                                    secondaryLabel: provider.description,
                                }))}
                            />
                            <FormInput
                                label={t("llmSettings", "modelName")}
                                type="text"
                                value={draftProvider.modelName}
                                onChange={(e) => updateDraftProvider({ modelName: e.target.value })}
                                placeholder={dialogProviderMeta.defaultModel || "model-name"}
                            />
                            <FormInput
                                label={t("llmSettings", "baseUrl")}
                                type="text"
                                value={draftProvider.baseUrl}
                                onChange={(e) => updateDraftProvider({ baseUrl: e.target.value })}
                                placeholder={dialogProviderMeta.defaultBaseUrl || "https://api.example.com/v1"}
                            />
                            {dialogProviderMeta.requiresApiKey && (
                                <FormInput
                                    label={t("llmSettings", "apiKey")}
                                    helperText={draftProvider.hasApiKey ? t("llmSettings", "apiKeySavedHint") : t("llmSettings", "apiKeyRequiredHint")}
                                    type="password"
                                    value={draftProvider.apiKey}
                                    onChange={(e) => updateDraftProvider({ apiKey: e.target.value })}
                                    placeholder={draftProvider.hasApiKey ? t("llmSettings", "savedApiKeyPlaceholder") : t("llmSettings", "apiKeyPlaceholder")}
                                />
                            )}
                            <Stack direction={{ xs: "column", md: "row" }} gap={2}>
                                <FormInput
                                    label={t("llmSettings", "temperature")}
                                    type="number"
                                    value={draftProvider.temperature}
                                    onChange={(e) => updateDraftProvider({ temperature: Number(e.target.value) })}
                                />
                                <FormInput
                                    label={t("llmSettings", "maxTokens")}
                                    type="number"
                                    value={draftProvider.maxTokens}
                                    onChange={(e) => updateDraftProvider({ maxTokens: Number(e.target.value) })}
                                />
                            </Stack>
                        </Stack>
                    </DialogContent>
                )}
                <Divider />
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button variant="outlined" onClick={closeProviderDialog}>
                        {t("common", "cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={saveDraftProvider}
                        disabled={!draftProvider?.name || !draftProvider?.provider || !draftProvider?.modelName || !draftProvider?.baseUrl}
                    >
                        {t("llmSettings", "saveLlm")}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
