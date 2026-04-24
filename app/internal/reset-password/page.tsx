"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSession } from "../lib/authSession";
import { resetPassword } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import "../globals.css";

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordContent />
        </Suspense>
    );
}

function ResetPasswordContent() {
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
            setErrorText(t("resetPassword", "missingToken"));
        }
    }, [token, t]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) {
            setStatus("error");
            if (password !== confirm) {
                setErrorText(t("resetPassword", "passwordMismatch"));
            }
            return;
        }
        setStatus("loading");
        setErrorText(null);
        try {
            const result = await resetPassword(token, password);
            saveSession({ token: result.token, user: result.user });
            setStatus("success");
            setTimeout(() => router.replace("/internal/simulations"), 1200);
        } catch (err) {
            setStatus("error");
            const msg = err instanceof Error ? err.message : "";
            if (msg.toLowerCase().includes("expired")) {
                setErrorText(t("resetPassword", "expiredToken"));
            } else if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("used")) {
                setErrorText(t("resetPassword", "invalidToken"));
            } else {
                setErrorText(msg || t("resetPassword", "invalidToken"));
            }
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
                    <h2 className="login-form-title-v2">{t("resetPassword", "title")}</h2>
                    <p className="login-form-subtitle-v2">
                        {t("resetPassword", "subtitle")}
                    </p>

                    {status === "success" ? (
                        <div className="login-success-v2" style={{ color: "var(--scheme-green, #22c55e)", fontWeight: 500, padding: "12px 0" }}>
                            {t("resetPassword", "success")}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                <div className="login-form-field-v2">
                                    <label htmlFor="rp-password">{t("resetPassword", "newPassword")}</label>
                                    <input
                                        id="rp-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="new-password"
                                        disabled={status === "loading" || !token}
                                    />
                                    <span style={{ fontSize: 12, color: "var(--scheme-neutral-500, #6b7280)", marginTop: 4 }}>
                                        {t("resetPassword", "passwordHint")}
                                    </span>
                                </div>

                                <div className="login-form-field-v2">
                                    <label htmlFor="rp-confirm">{t("resetPassword", "confirmPassword")}</label>
                                    <input
                                        id="rp-confirm"
                                        type="password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        autoComplete="new-password"
                                        disabled={status === "loading" || !token}
                                    />
                                    {confirm.length > 0 && password !== confirm && (
                                        <span style={{ fontSize: 12, color: "var(--scheme-red, #ef4444)", marginTop: 4 }}>
                                            {t("resetPassword", "passwordMismatch")}
                                        </span>
                                    )}
                                </div>

                                {/* Password strength indicator */}
                                {password.length > 0 && (
                                    <PasswordStrengthBar password={password} />
                                )}

                                {errorText && (
                                    <div className="login-error-v2">{errorText}</div>
                                )}

                                <button
                                    type="submit"
                                    className="login-submit-v2"
                                    disabled={!canSubmit || status === "loading"}
                                >
                                    {status === "loading"
                                        ? t("resetPassword", "submitting")
                                        : t("resetPassword", "submit")}
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
    const score = getStrengthScore(password);
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
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
