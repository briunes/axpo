"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { TemplateVariable } from "../../lib/configApi";
import { SUPPORTED_LANGUAGES } from "../../../../src/lib/supportedLanguages";
import { LanguageFlag } from "../../../../src/lib/LanguageFlag";
import { useI18n } from "../../../../src/lib/i18n-context";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

export interface AIGeneratedTemplate {
    name?: string;
    description?: string;
    type?: string;
    commodity?: string;
    translations: Array<{
        languageCode: string;
        htmlContent: string;
        subject?: string;
    }>;
}

export interface AITemplateBuilderProps {
    /** "pdf" or "email" — controls the prompt guidance and expected output */
    mode: "pdf" | "email";
    /** All available template variables to pass as context to the AI */
    variables: TemplateVariable[];
    /** Whether the editor is in edit mode (existing template) */
    isEditing: boolean;
    /** Current form metadata (name, type, commodity, description, subject) */
    currentFormData: Record<string, any>;
    /** Current translations map — used when isEditing + useExistingAsBase */
    currentTranslationsMap: Record<string, { htmlContent: string; subject?: string }>;
    /** Called when user clicks "Apply to Form" on a generated result */
    onApply: (result: AIGeneratedTemplate) => void;
    onNotify: (message: string, tone: "success" | "error") => void;
    session: SessionState;
}

// ────────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────────

export function AITemplateBuilder({
    mode,
    variables,
    isEditing,
    currentFormData,
    currentTranslationsMap,
    onApply,
    onNotify,
    session: _session,
}: AITemplateBuilderProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [useExistingAsBase, setUseExistingAsBase] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<AIGeneratedTemplate | null>(null);
    const [previewLanguage, setPreviewLanguage] = useState(
        SUPPORTED_LANGUAGES[0]?.code || "en",
    );

    // ── Generate ──────────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!prompt.trim()) {
            onNotify(t("aiTemplateBuilder", "promptRequired"), "error");
            return;
        }

        setIsGenerating(true);
        setGeneratedResult(null);

        try {
            // Build existing-template context only when editing and checkbox is on
            const existingTemplates =
                isEditing && useExistingAsBase
                    ? Object.entries(currentTranslationsMap)
                        .filter(([, val]) => val.htmlContent?.trim())
                        .map(([languageCode, val]) => ({
                            languageCode,
                            htmlContent: val.htmlContent,
                            ...(val.subject ? { subject: val.subject } : {}),
                        }))
                    : [];

            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("axpo.internal.auth.token")
                    : null;

            const res = await fetch("/api/v1/internal/config/ai-template-builder", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    prompt,
                    templateMode: mode,
                    isEditing: isEditing && useExistingAsBase,
                    existingTemplates,
                    variables: variables.map((v) => ({
                        key: v.key,
                        label: v.label,
                        description: v.description,
                        example: v.example,
                    })),
                    currentMeta: {
                        name: currentFormData.name,
                        description: currentFormData.description,
                        type: currentFormData.type,
                        commodity: currentFormData.commodity,
                        subject: currentFormData.subject,
                    },
                }),
            });

            const data = await res.json();

            if (!data.success) {
                onNotify(data.message || t("aiTemplateBuilder", "generateError"), "error");
                return;
            }

            setGeneratedResult(data.result);
            // Default preview to first language returned
            const firstLang = data.result.translations?.[0]?.languageCode;
            if (firstLang) setPreviewLanguage(firstLang);
        } catch (err) {
            onNotify(
                err instanceof Error ? err.message : t("aiTemplateBuilder", "generateError"),
                "error",
            );
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Apply ─────────────────────────────────────────────────────────────────────
    const handleApply = () => {
        if (!generatedResult) return;
        onApply(generatedResult);
        setGeneratedResult(null);
        setIsOpen(false);
        setPrompt("");
        onNotify(
            `✨ ${t("aiTemplateBuilder", "appliedSuccess")}`,
            "success",
        );
    };

    // ── Helpers ───────────────────────────────────────────────────────────────────
    const currentPreview = generatedResult?.translations?.find(
        (t) => t.languageCode === previewLanguage,
    );

    const langLabel = (code: string) =>
        SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label || code.toUpperCase();

    // ── Render ────────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                border: "1px solid #3a2a6a",
                borderRadius: "8px",
                marginBottom: "16px",
                overflow: "hidden",
                background: "linear-gradient(135deg, #1a0a3a 0%, #0d0d1a 100%)",
            }}
        >
            {/* ── Collapse toggle ──────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 18px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                }}
            >
                <span style={{ fontSize: "18px" }}>✨</span>
                <span
                    style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        background: "linear-gradient(90deg, #c084fc, #818cf8)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    {t("aiTemplateBuilder", "title")}
                </span>
                <span
                    style={{
                        marginLeft: "8px",
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "99px",
                        background: "#3b1f7a",
                        color: "#c4b5fd",
                        fontWeight: 600,
                    }}
                >
                    {t("aiTemplateBuilder", "beta")}
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        color: "#6b7280",
                        fontSize: "12px",
                    }}
                >
                    {isOpen ? "▲" : "▼"}
                </span>
            </button>

            {/* ── Expanded panel ───────────────────────────────────────────────────── */}
            {isOpen && (
                <div
                    style={{
                        padding: "18px 18px 20px",
                        borderTop: "1px solid #3a2a6a",
                    }}
                >
                    {/* Prompt area */}
                    <label
                        style={{
                            display: "block", fontWeight: 600,
                            marginBottom: "6px",
                            color: "#c4b5fd",
                        }}
                    >
                        {t("aiTemplateBuilder", "describeLabel")}
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                        }}
                        placeholder={
                            mode === "pdf"
                                ? t("aiTemplateBuilder", "pdfPlaceholder")
                                : t("aiTemplateBuilder", "emailPlaceholder")
                        }
                        rows={4}
                        style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid #3a2a6a",
                            background: "#0d0d1a",
                            color: "#e2e8f0", resize: "vertical",
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                            marginBottom: "12px",
                            outline: "none",
                        }}
                    />

                    {/* Use existing as base — only in edit mode */}
                    {isEditing && (
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px", color: "#a78bfa",
                                marginBottom: "14px",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={useExistingAsBase}
                                onChange={(e) => setUseExistingAsBase(e.target.checked)}
                            />
                            {t("aiTemplateBuilder", "useExistingBase")}
                        </label>
                    )}

                    {/* Generate button */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 20px",
                                borderRadius: "6px",
                                border: "none",
                                background: isGenerating || !prompt.trim()
                                    ? "#3b2f6a"
                                    : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                                color: "#fff",
                                fontSize: "14px",
                                fontWeight: 700,
                                cursor: isGenerating || !prompt.trim() ? "not-allowed" : "pointer",
                                opacity: isGenerating || !prompt.trim() ? 0.6 : 1,
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <span
                                        style={{
                                            display: "inline-block",
                                            animation: "ai-spin 1s linear infinite",
                                        }}
                                    >
                                        ⟳
                                    </span>
                                    {t("aiTemplateBuilder", "generating")}
                                </>
                            ) : (
                                <>✨ {t("aiTemplateBuilder", "generateTemplate")}</>
                            )}
                        </button>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            {isGenerating
                                ? t("aiTemplateBuilder", "generatingHint")
                                : t("aiTemplateBuilder", "shortcutHint")}
                        </span>
                    </div>

                    {/* ── Result ─────────────────────────────────────────────────────────── */}
                    {generatedResult && (
                        <div
                            style={{
                                marginTop: "24px",
                                border: "1px solid #3a2a6a",
                                borderRadius: "8px",
                                overflow: "hidden",
                            }}
                        >
                            {/* Result header */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "12px 16px",
                                    background: "#1a0a3a",
                                    borderBottom: "1px solid #3a2a6a",
                                }}
                            >
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#a78bfa" }}>
                                    ✅ {t("aiTemplateBuilder", "generatedTitle")}
                                </span>
                                {/* Language tabs */}
                                <div style={{ display: "flex", gap: "6px" }}>
                                    {generatedResult.translations?.map((tr) => (
                                        <button
                                            key={tr.languageCode}
                                            type="button"
                                            onClick={() => setPreviewLanguage(tr.languageCode)}
                                            style={{
                                                padding: "4px 12px",
                                                borderRadius: "4px",
                                                border: "1px solid #3a2a6a",
                                                background:
                                                    previewLanguage === tr.languageCode
                                                        ? "#4f46e5"
                                                        : "transparent",
                                                color:
                                                    previewLanguage === tr.languageCode ? "#fff" : "#9ca3af",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                            }}
                                        >
                                            <LanguageFlag code={tr.languageCode} label={langLabel(tr.languageCode)} width={20} height={14} /> {tr.languageCode.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Meta summary chips */}
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                    padding: "10px 16px",
                                    background: "#13082e",
                                    borderBottom: "1px solid #3a2a6a",
                                }}
                            >
                                {generatedResult.name && (
                                    <Chip label={`📝 ${generatedResult.name}`} />
                                )}
                                {generatedResult.type && (
                                    <Chip label={`📂 ${generatedResult.type}`} />
                                )}
                                {generatedResult.commodity && (
                                    <Chip
                                        label={
                                            generatedResult.commodity === "ELECTRICITY"
                                                ? "⚡ Electricity"
                                                : generatedResult.commodity === "GAS"
                                                    ? "🔥 Gas"
                                                    : generatedResult.commodity
                                        }
                                    />
                                )}
                                {currentPreview?.subject && (
                                    <Chip label={`✉️ ${currentPreview.subject}`} />
                                )}
                                {generatedResult.description && (
                                    <Chip label={generatedResult.description} muted />
                                )}
                            </div>

                            {/* HTML preview iframe */}
                            <div
                                style={{
                                    background: "#fff",
                                    borderBottom: "1px solid #3a2a6a",
                                }}
                            >
                                <iframe
                                    key={`${previewLanguage}-${generatedResult.translations.length}`}
                                    srcDoc={currentPreview?.htmlContent || `<p>${t("aiTemplateBuilder", "noContent")}</p>`}
                                    style={{
                                        width: "100%",
                                        height: "420px",
                                        border: "none",
                                        display: "block",
                                    }}
                                    sandbox="allow-same-origin"
                                    title={t("aiTemplateBuilder", "previewTitle")}
                                />
                            </div>

                            {/* Action buttons */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    padding: "12px 16px",
                                    background: "#1a0a3a",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    style={{
                                        padding: "9px 18px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                                        color: "#fff", fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    ✅ {t("aiTemplateBuilder", "applyToForm")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    style={{
                                        padding: "9px 18px",
                                        borderRadius: "6px",
                                        border: "1px solid #3a2a6a",
                                        background: "transparent",
                                        color: "#a78bfa", fontWeight: 600,
                                        cursor: isGenerating ? "not-allowed" : "pointer",
                                        opacity: isGenerating ? 0.5 : 1,
                                    }}
                                >
                                    🔄 {t("aiTemplateBuilder", "regenerate")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGeneratedResult(null)}
                                    style={{
                                        padding: "9px 18px",
                                        borderRadius: "6px",
                                        border: "1px solid #3a2a6a",
                                        background: "transparent",
                                        color: "#6b7280", cursor: "pointer",
                                    }}
                                >
                                    🗑 {t("aiTemplateBuilder", "discard")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Keyframe animation injected once */}
            <style>{`
        @keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}

// ── Tiny helper chip component ────────────────────────────────────────────────
function Chip({ label, muted }: { label: string; muted?: boolean }) {
    return (
        <span
            style={{
                fontSize: "12px",
                padding: "3px 10px",
                borderRadius: "99px",
                background: muted ? "#1e1635" : "#2d1f5e",
                color: muted ? "#6b7280" : "#c4b5fd",
                border: "1px solid #3a2a6a",
                maxWidth: "320px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </span>
    );
}
