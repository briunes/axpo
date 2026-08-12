"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import { FormInput } from "../components/ui/FormInput";
import { FormSelect } from "../components/ui/FormSelect";
import { PhoneInput } from "../components/ui/PhoneInput";
import { useI18n } from "../../../src/lib/i18n-context";
import { UI_LANGUAGES } from "../../../src/lib/uiLanguages";
import { LanguageFlag } from "../../../src/lib/LanguageFlag";
import styles from "../authPages.module.css";

type AgencyOption = { id: string; name: string };
type AccountManagerOption = { id: string; name: string; agencyId: string };

export default function RequestAccessPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManagerOption[]>([]);
  const [optionsError, setOptionsError] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/public/access-request/options", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load access request options");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const data = payload?.data ?? payload;
        setAgencies(data?.agencies ?? []);
        setAccountManagers(data?.accountManagers ?? []);
      })
      .catch(() => {
        if (!cancelled) setOptionsError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const visibleAccountManagers = useMemo(
    () => accountManagers.filter((manager) => manager.agencyId === agencyId),
    [accountManagers, agencyId],
  );

  const canSubmit =
    fullName.trim().length >= 2 &&
    email.includes("@") &&
    /^\+[1-9]\d{6,14}$/.test(phone) &&
    agencyId.length > 0 &&
    accountManagerId.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitStatus === "submitting") return;

    setSubmitStatus("submitting");
    setSubmitError("");
    try {
      const response = await fetch("/api/v1/public/access-request/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone,
          agencyId,
          kamUserId: accountManagerId,
          languageCode: locale,
          website,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || t("requestAccess", "submitFailed"));
      }
      setSubmitStatus("success");
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error instanceof Error ? error.message : t("requestAccess", "submitFailed"));
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

      <div className={`${styles.grid} ${styles.requestGrid}`}>
        <div className={styles.brandPanel}>
          <img src="/axpo-logo.svg" className={styles.brandLogo} width={168} height={80} alt="AXPO" />
          <div className={styles.brandProduct}>{t("common", "offersSimulator")}</div>
          <div className={styles.brandDesc}>{t("login", "brandDesc")}</div>
        </div>

        <div className={`${styles.formPanel} ${styles.requestFormPanel}`}>
          <div className={styles.formLogo}>
            <img src="/axpo-logo.svg" width={84} height={40} alt="AXPO" />
          </div>
          <h2 className={styles.formTitle}>{t("requestAccess", "title")}</h2>
          <p className={styles.formSubtitle}>{t("requestAccess", "subtitle")}</p>

          {submitStatus === "success" ? (
            <div className={styles.requestSuccess}>
              <div className={styles.requestSuccessIcon}>✓</div>
              <h3>{t("requestAccess", "successTitle")}</h3>
              <p>{t("requestAccess", "successMessage")}</p>
              <Button variant="contained" fullWidth onClick={() => router.push("/internal/login")}>
                {t("requestAccess", "backToLogin")}
              </Button>
            </div>
          ) : <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div className={styles.requestFields}>
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className={styles.honeypot}
              />
              <FormInput
                label={t("requestAccess", "fullName")}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
              <FormInput
                label={t("requestAccess", "email")}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value.toLocaleLowerCase())}
                autoComplete="email"
                required
              />
              <div>
                <PhoneInput
                  label={t("requestAccess", "phone")}
                  value={phone}
                  onChange={setPhone}
                  required
                />
              </div>
              <div>
                <FormSelect
                  label={t("requestAccess", "agency")}
                  value={agencyId}
                  onChange={(value) => {
                    setAgencyId(String(value ?? ""));
                    setAccountManagerId("");
                  }}
                  options={agencies.map((agency) => ({ value: agency.id, label: agency.name }))}
                  placeholder={t("requestAccess", "agencyPlaceholder")}
                  required
                />
              </div>
              <div className={styles.requestFieldWide}>
                <FormSelect
                  label={t("requestAccess", "kam")}
                  value={accountManagerId}
                  onChange={(value) => setAccountManagerId(String(value ?? ""))}
                  options={visibleAccountManagers.map((manager) => ({ value: manager.id, label: manager.name }))}
                  placeholder={agencyId ? t("requestAccess", "kamPlaceholder") : t("requestAccess", "kamSelectAgency")}
                  disabled={!agencyId}
                  required
                />
              </div>
            
              {optionsError && <div className={`${styles.error} ${styles.requestFieldWide}`}>{t("requestAccess", "optionsFailed")}</div>}
              {submitError && <div className={`${styles.error} ${styles.requestFieldWide}`}>{submitError}</div>}
              <div className={styles.requestFieldWide} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button type="submit" variant="contained" fullWidth size="large" disabled={!canSubmit || submitStatus === "submitting"}>
                  {submitStatus === "submitting" ? t("requestAccess", "submitting") : t("requestAccess", "submit")}
                </Button>
                <Button type="button" variant="text" size="small" onClick={() => router.push("/internal/login")}>
                  {t("requestAccess", "backToLogin")}
                </Button>
              </div>
            </div>
          </form>}
        </div>
      </div>
    </div>
  );
}
