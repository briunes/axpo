"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import { FormInput } from "../components/ui/FormInput";
import { useAlerts } from "../components/shared";
import { saveSession, validateStoredSession } from "../lib/authSession";
import { login, verifyOtp } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import { UI_LANGUAGES } from "../../../src/lib/uiLanguages";
import { LanguageFlag } from "../../../src/lib/LanguageFlag";
import styles from "../authPages.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { showError } = useAlerts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [mode, setMode] = useState<"password" | "magic-link" | "otp">("password");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(false);
  const [otpSessionToken, setOtpSessionToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;

    validateStoredSession().then((restored) => {
      if (!cancelled && restored) {
        router.replace("/internal/simulations");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  useEffect(() => {
    fetch("/api/v1/internal/config/system", {
      cache: "no-store",
      headers: { pragma: "no-cache", "cache-control": "no-cache" },
    })
      .then((r) => r.json())
      .then((data) => {
        setMagicLinkEnabled(data?.data?.magicLinkEnabled === true || data?.magicLinkEnabled === true);
      })
      .catch(() => { });
  }, []);

  const canLogin = useMemo(() => email.includes("@") && password.length > 0, [email, password]);
  const canRequestMagicLink = useMemo(() => email.includes("@"), [email]);
  const canVerifyOtp = useMemo(() => otpCode.length === 6 && /^\d+$/.test(otpCode), [otpCode]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!canLogin) {
      setStatus("error");
      showError(t("login", "validationError"));
      return;
    }
    setStatus("loading");
    try {
      const logged = await login(email.trim(), password);
      if (logged.requiresOtp && logged.otpSessionToken) {
        setOtpSessionToken(logged.otpSessionToken);
        setMode("otp");
        setOtpAttempts(0);
        setOtpCooldown(60);
        setStatus("idle");
        return;
      }
      saveSession({ token: logged.token!, user: logged.user });
      router.replace("/internal/simulations");
    } catch (error) {
      setStatus("error");
      showError(error instanceof Error ? error.message : t("login", "authFailed"));
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!canVerifyOtp || otpAttempts >= 3) return;
    setStatus("loading");
    try {
      const result = await verifyOtp(otpSessionToken, otpCode);
      saveSession({ token: result.token!, user: result.user });
      router.replace("/internal/simulations");
    } catch (error) {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      setOtpCode("");
      setStatus("error");
      if (newAttempts >= 3) {
        showError(t("otp", "noAttemptsLeft"));
      } else {
        showError(error instanceof Error ? error.message : t("otp", "verifyFailed"));
      }
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || status === "loading") return;
    setStatus("loading");
    try {
      const logged = await login(email.trim(), password);
      if (logged.requiresOtp && logged.otpSessionToken) {
        setOtpSessionToken(logged.otpSessionToken);
        setOtpAttempts(0);
        setOtpCode("");
        setOtpCooldown(60);
        setStatus("idle");
      }
    } catch (error) {
      setStatus("error");
      showError(error instanceof Error ? error.message : t("login", "authFailed"));
    }
  };

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRequestMagicLink) return;
    setStatus("loading");
    try {
      await fetch("/api/v1/internal/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setMagicLinkSent(true);
      setStatus("idle");
    } catch {
      setStatus("error");
      showError(t("magicLink", "requestFailed"));
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
          <h2 className={styles.formTitle}>
            {mode === "magic-link" ? t("magicLink", "title") : mode === "otp" ? t("otp", "title") : t("login", "title")}
          </h2>
          <p className={styles.formSubtitle}>
            {mode === "magic-link" ? t("magicLink", "subtitle") : mode === "otp" ? t("otp", "subtitle") : t("login", "subtitle")}
          </p>

          {/* OTP verification step */}
          {mode === "otp" && (
            <form onSubmit={handleVerifyOtp} style={{ width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ color: "var(--text-secondary, #888)", fontSize: 14, textAlign: "center", margin: 0 }}>
                  {t("otp", "description")}
                </p>
                {otpAttempts < 3 ? (
                  <p style={{textAlign: "center",
                    margin: 0,
                    color: otpAttempts >= 2 ? "var(--color-error, #d32f2f)" : "var(--text-secondary, #888)",
                    fontWeight: otpAttempts >= 2 ? 600 : 400,
                  }}>
                    {t("otp", "attemptsRemaining").replace("{{n}}", String(3 - otpAttempts))}
                  </p>
                ) : (
                  <p style={{textAlign: "center", margin: 0, color: "var(--color-error, #d32f2f)", fontWeight: 600 }}>
                    {t("otp", "noAttemptsLeft")}
                  </p>
                )}
                <FormInput
                  id="otp-code"
                  label={t("otp", "codeLabel")}
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  required={otpAttempts < 3}
                  autoFocus
                  disabled={otpAttempts >= 3}
                />
                {otpAttempts < 3 ? (
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!canVerifyOtp || status === "loading"}
                    fullWidth
                    size="large"
                  >
                    {status === "loading" ? t("otp", "verifying") : t("otp", "verify")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="contained"
                    color="warning"
                    disabled={otpCooldown > 0 || status === "loading"}
                    onClick={handleResendOtp}
                    fullWidth
                    size="large"
                  >
                    {status === "loading"
                      ? t("otp", "resending")
                      : otpCooldown > 0
                        ? t("otp", "resendCooldown").replace("{{n}}", String(otpCooldown))
                        : t("otp", "resendCode")}
                  </Button>
                )}
                {otpCooldown > 0 && otpAttempts < 3 && (
                  <p style={{ fontSize: 12, textAlign: "center", margin: 0, color: "var(--text-secondary, #888)" }}>
                    {t("otp", "resendCooldown").replace("{{n}}", String(otpCooldown))}
                  </p>
                )}
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <Button
                    type="button"
                    variant="text"
                    size="small"
                    onClick={() => { setMode("password"); setOtpCode(""); setOtpSessionToken(""); setOtpAttempts(0); setOtpCooldown(0); setStatus("idle"); }}
                  >
                    {t("otp", "backToLogin")}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Magic link sent confirmation */}
          {mode !== "otp" && magicLinkSent && mode === "magic-link" ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{t("magicLink", "successTitle")}</p>
              <p style={{ color: "var(--text-secondary, #888)", fontSize: 14, marginBottom: 16 }}>
                {t("magicLink", "successDesc")}
              </p>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => { setMagicLinkSent(false); setMode("password"); }}
              >
                {t("magicLink", "backToPassword")}
              </Button>
            </div>
          ) : mode !== "otp" && mode === "magic-link" ? (
            <form onSubmit={handleMagicLink} style={{ width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <FormInput
                  id="magic-email"
                  label={t("magicLink", "emailLabel")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLocaleLowerCase())}
                  autoComplete="email"
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canRequestMagicLink || status === "loading"}
                  fullWidth
                  size="large"
                >
                  {status === "loading" ? t("magicLink", "submitting") : t("magicLink", "submit")}
                </Button>
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <Button
                    type="button"
                    variant="text"
                    size="small"
                    onClick={() => setMode("password")}
                  >
                    {t("magicLink", "backToPassword")}
                  </Button>
                </div>
              </div>
            </form>
          ) : mode !== "otp" ? (
            <form onSubmit={handleLogin} style={{ width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <FormInput
                  id="login-email"
                  label={t("login", "email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLocaleLowerCase())}
                  data-testid="login-email"
                  autoComplete="email"
                  required
                  size="small"
                />



                <FormInput
                  id="login-password"
                  label={t("login", "password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                  autoComplete="current-password"
                  required
                />

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -8, marginBottom: 4 }}>
                  <Button
                    type="button"
                    variant="text"
                    size="small"
                    onClick={() => router.push("/internal/forgot-password")}
                    data-testid="forgot-password-link"
                  >
                    {t("login", "forgotPassword")}
                  </Button>
                </div>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canLogin || status === "loading"}
                  data-testid="login-submit"
                  fullWidth
                  size="large"
                >
                  {status === "loading" ? t("login", "signingIn") : t("login", "signIn")}
                </Button>

                <div style={{ textAlign: "center", marginTop: 4 }}>
                  {magicLinkEnabled && (
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      onClick={() => setMode("magic-link")}
                    >
                      {t("magicLink", "sendMagicLink")}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          ) : null}
        </div>

      </div>
    </div>
  );
}
