"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";

interface ForbiddenStateProps {
    section?: string;
}

export function ForbiddenState({ section }: ForbiddenStateProps) {
    const { t } = useI18n();
    const router = useRouter();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: 400,
                gap: 16,
                textAlign: "center",
                padding: "40px 24px",
            }}
        >
            <div
                style={{
                    fontSize: 48,
                    lineHeight: 1,
                    marginBottom: 8,
                }}
            >
                🔒
            </div>
            <h2
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--scheme-neutral-100)",
                    margin: 0,
                }}
            >
                {t("forbiddenState", "title")}
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--scheme-neutral-500)",
                    margin: 0,
                    maxWidth: 360,
                    lineHeight: 1.6,
                }}
            >
                {section
                    ? t("forbiddenState", "withSection", { section })
                    : t("forbiddenState", "generic")}
            </p>
            <button
                onClick={() => router.push("/internal/simulations")}
                style={{
                    marginTop: 8,
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "1px solid var(--scheme-neutral-800)",
                    background: "transparent",
                    color: "var(--scheme-neutral-400)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 500,
                }}
            >
                {t("common", "backToSimulations")}
            </button>
        </div>
    );
}
