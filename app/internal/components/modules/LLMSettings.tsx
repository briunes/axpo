"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, testLlmConnection, type LlmTestResult } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { FormInput, FormSelect } from "../ui";

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
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
    llmEnabled: false,
    llmProvider: "ollama-cloud",
    llmApiKey: "",
    llmModelName: "qwen3-vl:235b",
    llmBaseUrl: "",
    llmTemperature: 0.1,
    llmMaxTokens: 2000,
};

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
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemConfig();
            setConfig({
                llmEnabled: data.llmEnabled ?? false,
                llmProvider: data.llmProvider ?? "ollama-cloud",
                llmApiKey: data.llmApiKey ?? "",
                llmModelName: data.llmModelName ?? "qwen3-next:80b",
                llmBaseUrl: data.llmBaseUrl ?? "",
                llmTemperature: data.llmTemperature ?? 0.1,
                llmMaxTokens: data.llmMaxTokens ?? 2000,
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

    const handleProviderChange = (provider: string) => {
        const providerConfig = LLM_PROVIDERS[provider as keyof typeof LLM_PROVIDERS];
        setConfig((prev) => ({
            ...prev,
            llmProvider: provider,
            llmBaseUrl: providerConfig?.defaultBaseUrl || prev.llmBaseUrl,
            llmModelName: providerConfig?.defaultModel || prev.llmModelName,
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await updateSystemConfig(config);
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

    const handleTestConnection = async () => {
        try {
            setIsTestingConnection(true);
            setTestResult(null);
            const result = await testLlmConnection({
                provider: config.llmProvider,
                apiKey: config.llmApiKey,
                baseUrl: config.llmBaseUrl,
                modelName: config.llmModelName,
            });
            setTestResult(result);
            if (result.success) {
                onNotify(result.message, "success");
            } else {
                onNotify(result.message, "error");
            }
        } catch (error) {
            console.error("Failed to test LLM connection:", error);
            const errorResult = {
                success: false,
                message: "Failed to test connection",
            };
            setTestResult(errorResult);
            onNotify(errorResult.message, "error");
        } finally {
            setIsTestingConnection(false);
        }
    };

    if (isLoading) {
        return <LoadingState />;
    }

    const selectedProvider = LLM_PROVIDERS[config.llmProvider as keyof typeof LLM_PROVIDERS];

    return (
        <div className="llm-settings-container">
            <div className="settings-header">
                <div>
                    <h2 className="settings-title">{t("llmSettings", "title")}</h2>
                    <p className="settings-description">{t("llmSettings", "description")}</p>
                </div>
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

            <div className="settings-panel">
                <h3 className="settings-panel-title">{t("llmSettings", "generalSettings")}</h3>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.llmEnabled}
                            onChange={(e) => handleChange("llmEnabled", e.target.checked)}
                        />
                        <span>{t("llmSettings", "enableLlm")}</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "32px" }}>
                        {t("llmSettings", "enableLlmDesc")}
                    </span>
                </div>

                {config.llmEnabled && (
                    <Stack spacing={3}>
                        <FormSelect
                            label={t("llmSettings", "provider")}
                            helperText={t("llmSettings", "providerDesc")}
                            value={config.llmProvider}
                            onChange={(value) => handleProviderChange(String(value))}
                            options={Object.entries(LLM_PROVIDERS).map(([key, provider]) => ({
                                value: key,
                                label: `${provider.name} - ${provider.description}`
                            }))}
                        />

                        {selectedProvider?.requiresApiKey && (
                            <Box>
                                <FormInput
                                    label={t("llmSettings", "apiKey")}
                                    helperText={t("llmSettings", "apiKeyDesc")}
                                    type={showApiKey ? "text" : "password"}
                                    value={config.llmApiKey}
                                    onChange={(e) => handleChange("llmApiKey", e.target.value)}
                                    placeholder={t("llmSettings", "apiKeyPlaceholder")}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    sx={{ mt: 1 }}
                                    size="small"
                                >
                                    {showApiKey ? "👁️ Hide" : "👁️ Show"}
                                </Button>
                            </Box>
                        )}

                        <FormInput
                            label={t("llmSettings", "baseUrl")}
                            helperText={
                                t("llmSettings", "baseUrlDesc") +
                                (config.llmProvider === "ollama-cloud" ? "\nCommon endpoints: https://api.ollama.com, https://ollama.ai/api, or your custom URL" : "")
                            }
                            type="text"
                            value={config.llmBaseUrl}
                            onChange={(e) => handleChange("llmBaseUrl", e.target.value)}
                            placeholder={selectedProvider?.defaultBaseUrl || "https://api.example.com/v1"}
                        />

                        {selectedProvider?.commonModels.length > 0 ? (
                            <FormSelect
                                label={t("llmSettings", "modelName")}
                                helperText={t("llmSettings", "modelNameDesc")}
                                value={config.llmModelName}
                                onChange={(value) => handleChange("llmModelName", String(value))}
                                options={[
                                    ...selectedProvider.commonModels.map((model) => ({
                                        value: model,
                                        label: model
                                    })),
                                    { value: "", label: "-- Custom Model --" }
                                ]}
                            />
                        ) : (
                            <FormInput
                                label={t("llmSettings", "modelName")}
                                helperText={t("llmSettings", "modelNameDesc")}
                                type="text"
                                value={config.llmModelName}
                                onChange={(e) => handleChange("llmModelName", e.target.value)}
                                placeholder="model-name"
                            />
                        )}

                        {!selectedProvider?.commonModels.includes(config.llmModelName) &&
                            selectedProvider?.commonModels.length > 0 && (
                                <FormInput
                                    label={t("llmSettings", "customModel")}
                                    helperText={t("llmSettings", "customModelDesc")}
                                    type="text"
                                    value={config.llmModelName}
                                    onChange={(e) => handleChange("llmModelName", e.target.value)}
                                    placeholder="custom-model-name"
                                />
                            )}

                        <Box>
                            <label className="config-field-label">
                                {t("llmSettings", "temperature")} ({config.llmTemperature})
                            </label>
                            <span className="config-field-description">
                                {t("llmSettings", "temperatureDesc")}
                            </span>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={config.llmTemperature}
                                onChange={(e) => handleChange("llmTemperature", parseFloat(e.target.value))}
                                style={{ width: "100%" }}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--axpo-text-secondary)" }}>
                                <span>0.0 (Precise)</span>
                                <span>1.0 (Balanced)</span>
                                <span>2.0 (Creative)</span>
                            </div>
                        </Box>

                        <FormInput
                            label={t("llmSettings", "maxTokens")}
                            helperText={t("llmSettings", "maxTokensDesc")}
                            type="number"
                            slotProps={{
                                htmlInput: { min: 100, max: 128000, step: 100 }
                            }}
                            value={config.llmMaxTokens}
                            onChange={(e) => handleChange("llmMaxTokens", parseInt(e.target.value, 10))}
                        />
                    </Stack>
                )}
            </div>

            {config.llmEnabled && (
                <>
                    {/* Test Connection Section */}
                    <div className="settings-panel" style={{ marginTop: "24px" }}>
                        <h3 className="settings-panel-title">🔧 {t("llmSettings", "testConnection")}</h3>
                        <p style={{ marginBottom: "16px", color: "var(--axpo-text-secondary)" }}>
                            {t("llmSettings", "testConnectionDesc")}
                        </p>
                        <Button
                            variant="outlined"
                            onClick={handleTestConnection}
                            disabled={isTestingConnection || !config.llmProvider || !config.llmModelName || !config.llmBaseUrl}
                            sx={{ marginBottom: testResult ? 2 : 0 }}
                        >
                            {isTestingConnection ? t("llmSettings", "testing") : t("llmSettings", "btnTest")}
                        </Button>

                        {testResult && (
                            <div
                                style={{
                                    padding: "16px",
                                    borderRadius: "8px",
                                    border: testResult.success ? "2px solid #10b981" : "2px solid #ef4444",
                                    backgroundColor: testResult.success ? "#f0fdf4" : "#fef2f2",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                    <span style={{ fontSize: "20px" }}>{testResult.success ? "✅" : "❌"}</span>
                                    <strong style={{ color: testResult.success ? "#065f46" : "#991b1b" }}>
                                        {testResult.success ? t("llmSettings", "testSuccess") : t("llmSettings", "testError")}
                                    </strong>
                                </div>
                                <p style={{ margin: "0", color: testResult.success ? "#065f46" : "#991b1b" }}>
                                    {testResult.message}
                                </p>
                                {testResult.details && (
                                    <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7280" }}>
                                        <div>Provider: {testResult.details.provider}</div>
                                        <div>Model: {testResult.details.model}</div>
                                        <div>Base URL: {testResult.details.baseUrl}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Usage Info Section */}
                    <div className="settings-panel" style={{ marginTop: "24px", backgroundColor: "var(--axpo-bg-info)", border: "1px solid var(--axpo-border-info)" }}>
                        <h3 className="settings-panel-title">ℹ️ {t("llmSettings", "usageInfo")}</h3>
                        <p style={{ marginBottom: "12px" }}>
                            {t("llmSettings", "usageInfoDesc")}
                        </p>
                        <ul style={{ marginLeft: "20px", color: "var(--axpo-text-secondary)" }}>
                            <li>{t("llmSettings", "usageExample1")}</li>
                            <li>{t("llmSettings", "usageExample2")}</li>
                            <li>{t("llmSettings", "usageExample3")}</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
