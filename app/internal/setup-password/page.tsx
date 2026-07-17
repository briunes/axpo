"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSession } from "../lib/authSession";
import { setupPassword } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import { UI_LANGUAGES } from "../../../src/lib/uiLanguages";
import { LanguageFlag } from "../../../src/lib/LanguageFlag";
import { FormInput } from "../components/ui/FormInput";
import styles from "../authPages.module.css";

export default function SetupPasswordPage() {
    return (
        <Suspense>
            <SetupPasswordContent />
        </Suspense>
    );
}

function SetupPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, locale, setLocale } = useI18n();

    const token = searchParams.get("token") ?? "";

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorText, setErrorText] = useState<string | null>(null);

    // Password policy: min 12 chars, upper, lower, number, special
    const POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/;

    const passwordOk = POLICY_REGEX.test(password);
    const canSubmit = useMemo(
        () => token.length > 0 && passwordOk && password === confirm,
        [token, passwordOk, password, confirm],
    );

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setErrorText(t("setupPassword", "missingToken"));
        }
    }, [token, t]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) {
            setStatus("error");
            if (password !== confirm) {
                setErrorText(t("setupPassword", "passwordMismatch"));
            }
            return;
        }
        setStatus("loading");
        setErrorText(null);
        try {
            const result = await setupPassword(token, password);
            if (result.token && result.user) {
                saveSession({ token: result.token, user: result.user });
            }
            setStatus("success");
            setTimeout(() => router.replace("/internal/simulations"), 1200);
        } catch (err) {
            setStatus("error");
            const msg = err instanceof Error ? err.message : "";
            if (msg.toLowerCase().includes("expired")) {
                setErrorText(t("setupPassword", "expiredToken"));
            } else if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("used")) {
                setErrorText(t("setupPassword", "invalidToken"));
            } else {
                setErrorText(msg || t("setupPassword", "invalidToken"));
            }
        }
    };

    return (
        <div className={styles.shell}>
            <div className={styles.langSwitcher}>
                {UI_LANGUAGES.map((language) => (
                    <button
                        key={language.code}
                        onClick={() => setLocale(language.code)}
                        className={`${styles.langBtn} ${locale === language.code ? styles.active : ""}`}
                        title={language.label}
                    >
                        <LanguageFlag code={language.code} label={language.label} />
                    </button>
                ))}
            </div>
            <div className={styles.grid}>

                {/* ── Brand panel ── */}
                <div className={styles.brandPanel}>
                    <img
                        src="/axpo-logo.svg"
                        className={styles.brandLogo}
                        width={168}
                        height={80}
                        alt="AXPO"
                    />
                    <div className={styles.brandProduct}>{t("common", "offersSimulator")}</div>
                    <div className={styles.brandDesc}>
                        {t("login", "brandDesc")}
                    </div>
                </div>

                {/* ── Form panel ── */}
                <div className={styles.formPanel}>
                    <div className={styles.formLogo}>
                        <img src="/axpo-logo.svg" width={84} height={40} alt="AXPO" />
                    </div>
                    <h2 className={styles.formTitle}>{t("setupPassword", "title")}</h2>
                    <p className={styles.formSubtitle}>
                        {t("setupPassword", "subtitle")}
                    </p>

                    {status === "success" ? (
                        <div className={styles.success} style={{ color: "var(--scheme-green, #22c55e)", fontWeight: 500, padding: "12px 0" }}>
                            {t("setupPassword", "success")}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                <FormInput
                                    id="sp-password"
                                    label={t("setupPassword", "newPassword")}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    disabled={status === "loading" || !token}
                                    helperText={t("setupPassword", "passwordHint")}
                                />

                                <div>
                                    <FormInput
                                        id="sp-confirm"
                                        label={t("setupPassword", "confirmPassword")}
                                        type="password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        autoComplete="new-password"
                                        disabled={status === "loading" || !token}
                                    />
                                    {confirm.length > 0 && password !== confirm && (
                                        <span style={{ fontSize: 12, color: "var(--scheme-red, #ef4444)", marginTop: 4 }}>
                                            {t("setupPassword", "passwordMismatch")}
                                        </span>
                                    )}
                                </div>

                                {/* Password strength indicator */}
                                {password.length > 0 && (
                                    <PasswordStrengthBar password={password} />
                                )}

                                {errorText && (
                                    <div className={styles.error}>{errorText}</div>
                                )}

                                <button
                                    type="submit"
                                    className={styles.submit}
                                    disabled={!canSubmit || status === "loading"}
                                >
                                    {status === "loading"
                                        ? t("setupPassword", "submitting")
                                        : t("setupPassword", "submit")}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

            </div>
        </div>
    );
}

/* ── Inline password strength bar ── */
function PasswordStrengthBar({ password }: { password: string }) {
    const { t } = useI18n();
    const score = getStrengthScore(password);
    const labels = [
        "",
        t("userFormPage", "passwordStrengthWeak"),
        t("userFormPage", "passwordStrengthFair"),
        t("userFormPage", "passwordStrengthGood"),
        t("userFormPage", "passwordStrengthStrong"),
    ];
    const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            background: i <= score ? colors[score] : "var(--scheme-neutral-800, #e5e7eb)",
                            transition: "background 0.2s",
                        }}
                    />
                ))}
            </div>
            {score > 0 && (
                <span style={{ fontSize: 11, color: colors[score], fontWeight: 500 }}>
                    {labels[score]}
                </span>
            )}
        </div>
    );
}

function getStrengthScore(pw: string): number {
    let score = 0;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z\d]/.test(pw)) score++;
    return score;
}
