"use client";

import { useRouter } from "next/navigation";

interface ForbiddenStateProps {
    section?: string;
}

export function ForbiddenState({ section }: ForbiddenStateProps) {
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
                Access Denied
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
                    ? `Your role does not have permission to access the "${section}" section.`
                    : "Your role does not have permission to access this section."}
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
                ← Back to Simulations
            </button>
        </div>
    );
}
