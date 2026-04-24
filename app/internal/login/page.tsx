"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import { FormInput } from "../components/ui/FormInput";
import { useAlerts } from "../components/shared";
import { loadSession, saveSession } from "../lib/authSession";
import { login } from "../lib/internalApi";
import { useI18n } from "../../../src/lib/i18n-context";
import "../globals.css";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { showError } = useAlerts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

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
      showError(t("login", "validationError"));
      return;
    }
    setStatus("loading");
    try {
      const logged = await login(email.trim(), password);
      saveSession({ token: logged.token, user: logged.user });
      router.replace("/internal/simulations");
    } catch (error) {
      setStatus("error");
      showError(error instanceof Error ? error.message : t("login", "authFailed"));
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FormInput
                id="login-email"
                label={t("login", "email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                autoComplete="email"
                required
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
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

