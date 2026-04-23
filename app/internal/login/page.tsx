"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "../lib/authSession";
import { login } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import "../globals.css";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const restored = loadSession();
    if (restored) {
      router.replace("/internal/simulations");
    }
  }, [router]);

  const canLogin = useMemo(() => email.includes("@") && password.length >= 8, [email, password]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!canLogin) {
      setStatus("error");
      setErrorText(t("login", "validationError"));
      return;
    }
    setStatus("loading");
    setErrorText(null);
    try {
      const logged = await login(email.trim(), password);
      saveSession({ token: logged.token, user: logged.user });
      router.replace("/internal/simulations");
    } catch (error) {
      setStatus("error");
      setErrorText(error instanceof Error ? error.message : t("login", "authFailed"));
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
          <h2 className="login-form-title-v2">{t("login", "title")}</h2>
          <p className="login-form-subtitle-v2">
            {t("login", "subtitle")}
          </p>

          <form onSubmit={handleLogin} style={{ width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="login-form-field-v2">
                <label htmlFor="login-email">{t("login", "email")}</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email"
                  autoComplete="email"
                />
              </div>
              <div className="login-form-field-v2">
                <label htmlFor="login-password">{t("login", "password")}</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                  autoComplete="current-password"
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4, marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => router.push("/internal/forgot-password")}
                  className="login-link-v2"
                >
                  {t("login", "forgotPassword")}
                </button>
              </div>
              {errorText && (
                <div className="login-error-v2">{errorText}</div>
              )}
              <button
                type="submit"
                className="login-submit-v2"
                disabled={!canLogin || status === "loading"}
                data-testid="login-submit"
              >
                {status === "loading" ? t("login", "signingIn") : t("login", "signIn")}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

