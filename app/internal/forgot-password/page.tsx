"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import styles from "../authPages.module.css";

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
        <div className={styles.shell}>
            <div className={styles.langSwitcher}>
                <button
                    onClick={() => setLocale("en")}
                    className={`${styles.langBtn} ${locale === "en" ? styles.active : ""}`}
                    title="English"
                >
                    🇬🇧
                </button>
                <button
                    onClick={() => setLocale("es")}
                    className={`${styles.langBtn} ${locale === "es" ? styles.active : ""}`}
                    title="Español"
                >
                    🇪🇸
                </button>
            </div>
            <div className={styles.grid}>

                {/* ── Brand panel ── */}
                <div className={styles.brandPanel}>
                    <img
                        src="/axpo-mark.svg"
                        className={styles.brandMark}
                        width={72}
                        height={72}
                        alt="AXPO"
                    />
                    <div className={styles.brandName}>AXPO</div>
                    <div className={styles.brandDivider} />
                    <div className={styles.brandProduct}>OFFERS SIMULATOR</div>
                    <div className={styles.brandDesc}>
                        {t("login", "brandDesc")}
                    </div>
                </div>

                {/* ── Form panel ── */}
                <div className={styles.formPanel}>
                    <div className={styles.formLogo}>
                        <img src="/axpo-mark.svg" width={32} height={32} alt="AXPO" />
                    </div>
                    <h2 className={styles.formTitle}>{t("forgotPassword", "title")}</h2>
                    <p className={styles.formSubtitle}>
                        {t("forgotPassword", "subtitle")}
                    </p>

                    {status === "success" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className={styles.success} style={{ color: "var(--scheme-green, #22c55e)", fontWeight: 500, padding: "12px 0" }}>
                                {t("forgotPassword", "successMessage")}
                            </div>
                            <button
                                type="button"
                                className={styles.submit}
                                onClick={() => router.push("/internal/login")}
                            >
                                {t("forgotPassword", "backToLogin")}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                <div className={styles.formField}>
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
                                    <div className={styles.error}>{errorText}</div>
                                )}

                                <button
                                    type="submit"
                                    className={styles.submit}
                                    disabled={!canSubmit || status === "loading"}
                                >
                                    {status === "loading"
                                        ? t("forgotPassword", "submitting")
                                        : t("forgotPassword", "submit")}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/internal/login")}
                                    className={styles.link}
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
