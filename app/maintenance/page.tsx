"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "../../src/lib/i18n-context";
import { UI_LANGUAGES } from "../../src/lib/uiLanguages";
import Image from "next/image";

function formatDateTime(isoString: string, locale: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });
    } catch {
        return isoString;
    }
}

function MaintenanceContent() {
    const { t, locale, setLocale } = useI18n();
    const searchParams = useSearchParams();
    const until = searchParams.get("until");
    const messageParam = searchParams.get("message");
    const message = messageParam ? decodeURIComponent(messageParam) : null;

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0a0e1a 0%, #111827 60%, #0f172a 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}>
            {/* Language switcher */}
            <div style={{
                position: "absolute",
                top: 20,
                right: 24,
                display: "flex",
                gap: 8,
            }}>
                {UI_LANGUAGES.map((language) => (
                    <button
                        key={language.code}
                        onClick={() => setLocale(language.code)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            borderColor: locale === language.code ? "#f97316" : "rgba(148,163,184,0.2)",
                            background: locale === language.code ? "rgba(249,115,22,0.12)" : "transparent",
                            color: locale === language.code ? "#f97316" : "#64748b",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                        }}
                    >
                        {t("language", language.code)}
                    </button>
                ))}
            </div>

            <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
                {/* Logo */}
                <div style={{ marginBottom: 32 }}>
                    <Image
                        src="/axpo-mark.svg"
                        alt="AXPO"
                        width={72}
                        height={72}
                        style={{
                            filter: "drop-shadow(0 0 24px rgba(249,115,22,0.35))",
                        }}
                        priority
                    />
                </div>

                {/* Heading */}
                <h1 style={{
                    color: "#f1f5f9",
                    fontSize: "1.875rem",
                    fontWeight: 700,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                }}>
                    {t("maintenance", "title")}
                </h1>

                {/* Subtitle */}
                <p style={{
                    color: "#94a3b8",
                    fontSize: "1rem",
                    lineHeight: 1.65,
                    margin: "0 0 32px",
                }}>
                    {message ?? t("maintenance", "subtitle")}
                </p>

                {/* Expected time card */}
                {until && (
                    <div style={{
                        background: "rgba(249,115,22,0.07)",
                        border: "1px solid rgba(249,115,22,0.22)",
                        borderRadius: 12,
                        padding: "20px 24px",
                        marginBottom: 32,
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            marginBottom: 8,
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span style={{ color: "#f97316", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                {t("maintenance", "expectedOnline")}
                            </span>
                        </div>
                        <p style={{
                            color: "#f1f5f9",
                            fontSize: "1.05rem",
                            fontWeight: 600,
                            margin: 0,
                        }}>
                            {formatDateTime(until, locale)}
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(148,163,184,0.08)", marginBottom: 28 }} />

                {/* Footer note */}
                <p style={{ color: "#475569", fontSize: "0.85rem", margin: "0 0 20px" }}>
                    {t("maintenance", "footerNote")}
                </p>

                {/* Brand */}
                <p style={{
                    color: "#1e293b",
                    fontSize: "0.75rem",
                    margin: 0,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                }}>
                    {t("maintenance", "brand")}
                </p>
            </div>
        </div>
    );
}

export default function MaintenancePage() {
    return (
        <Suspense>
            <MaintenanceContent />
        </Suspense>
    );
}
