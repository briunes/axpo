"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import "../globals.css";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { t, locale, setLocale } = useI18n();

    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorText, setErrorText] = useState<string | null>(null);

    const canSubmit = email.includes("@");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) {
            setStatus("error");
            setErrorText(t("forgotPassword", "invalidEmail"));
            return;
        }
        setStatus("loading");
        setErrorText(null);
        try {
            await forgotPassword(email.trim());
            setStatus("success");
        } catch (err) {
            setStatus("error");
            setErrorText(err instanceof Error ? err.message : t("forgotPassword", "requestFailed"));
        }
    };

    return (
        <div className="login-shell-v2">
            <div className="login-lang-switcher-v2">
                <button
                    onClick={() => setLocale("en")}
                    className={`login-lang-btn-v2 ${locale === "en" ? "active" : ""}`}
                    title="English"
                >
                    🇬🇧
                </button>
                <button
                    onClick={() => setLocale("es")}
                    className={`login-lang-btn-v2 ${locale === "es" ? "active" : ""}`}
                    title="Español"
                >
                    🇪🇸
                </button>
            </div>
            <div className="login-grid-v2">

                {/* ── Brand panel ── */}
                <div className="login-brand-panel-v2">
                    <img
                        src="/axpo-mark.svg"
                        className="login-brand-mark-v2"
                        width={72}
                        height={72}
                        alt="AXPO"
                    />
                    <div className="login-brand-name-v2">AXPO</div>
                    <div className="login-brand-divider-v2" />
                    <div className="login-brand-product-v2">OFFERS SIMULATOR</div>
                    <div className="login-brand-desc-v2">
                        {t("login", "brandDesc")}
                    </div>
                </div>

                {/* ── Form panel ── */}
                <div className="login-form-panel-v2">
                    <div className="login-form-logo-v2">
                        <img src="/axpo-mark.svg" width={32} height={32} alt="AXPO" />
                    </div>
                    <h2 className="login-form-title-v2">{t("forgotPassword", "title")}</h2>
                    <p className="login-form-subtitle-v2">
                        {t("forgotPassword", "subtitle")}
                    </p>

                    {status === "success" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className="login-success-v2" style={{ color: "var(--scheme-green, #22c55e)", fontWeight: 500, padding: "12px 0" }}>
                                {t("forgotPassword", "successMessage")}
                            </div>
                            <button
                                type="button"
                                className="login-submit-v2"
                                onClick={() => router.push("/internal/login")}
                            >
                                {t("forgotPassword", "backToLogin")}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                <div className="login-form-field-v2">
                                    <label htmlFor="fp-email">{t("forgotPassword", "emailLabel")}</label>
                                    <input
                                        id="fp-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        disabled={status === "loading"}
                                        placeholder={t("forgotPassword", "emailPlaceholder")}
                                    />
                                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-500, #6b7280)", marginTop: 4 }}>
                                        {t("forgotPassword", "emailHint")}
                                    </span>
                                </div>

                                {errorText && (
                                    <div className="login-error-v2">{errorText}</div>
                                )}

                                <button
                                    type="submit"
                                    className="login-submit-v2"
                                    disabled={!canSubmit || status === "loading"}
                                >
                                    {status === "loading"
                                        ? t("forgotPassword", "submitting")
                                        : t("forgotPassword", "submit")}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/internal/login")}
                                    className="login-link-v2"
                                    style={{ marginTop: 8 }}
                                >
                                    {t("forgotPassword", "backToLogin")}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

            </div>
        </div>
    );
}
