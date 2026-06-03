"use client";

import React from "react";
import { Box } from "@mui/material";
import { getAgency } from "../../lib/internalApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatFieldName(key: string): string {
    return key.replace(/([A-Z])/g, " $1").replace(/^[a-z]/, (c) => c.toUpperCase());
}

export function normalizeAuditFieldKey(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

// ─── Agency name resolver ─────────────────────────────────────────────────────

export function AgencyValueResolver({
    agencyId,
    getAgencyName,
}: {
    agencyId: string;
    getAgencyName: (id: string) => Promise<string | null>;
}) {
    const [name, setName] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const resolve = async () => {
            try {
                const resolved = await getAgencyName(agencyId);
                setName(resolved);
            } finally {
                setLoading(false);
            }
        };
        resolve();
    }, [agencyId, getAgencyName]);

    if (loading) {
        return (
            <span style={{ display: "inline-block", maxWidth: "100%", fontSize: 11, color: "var(--scheme-neutral-500)" }}>
                {agencyId.slice(0, 12)}…
            </span>
        );
    }

    if (name) {
        return (
            <span style={{ display: "inline-block", maxWidth: "100%" }} title={agencyId}>
                {name}
            </span>
        );
    }

    return (
        <span
            style={{
                display: "inline-block",
                maxWidth: "100%",
                fontFamily: "'JetBrains Mono','Fira Code',monospace",
                fontSize: 11,
            }}
            title={agencyId}
        >
            {agencyId.slice(0, 12)}…
        </span>
    );
}

// ─── Create an agency resolver factory (for use in components with a token) ──

export function makeGetAgencyName(
    token: string,
    cacheRef: React.MutableRefObject<Map<string, string>>,
    inFlightRef: React.MutableRefObject<Map<string, Promise<string | null>>>,
): (id: string) => Promise<string | null> {
    return async (agencyId: string) => {
        const cached = cacheRef.current.get(agencyId);
        if (cached !== undefined) return cached;

        const inFlight = inFlightRef.current.get(agencyId);
        if (inFlight) return inFlight;

        const promise = getAgency(token, agencyId)
            .then((agency) => {
                const name = agency?.name ?? null;
                if (name) cacheRef.current.set(agencyId, name);
                inFlightRef.current.delete(agencyId);
                return name;
            })
            .catch(() => {
                inFlightRef.current.delete(agencyId);
                return null;
            });

        inFlightRef.current.set(agencyId, promise);
        return promise;
    };
}

// ─── FieldChangeDetails component ────────────────────────────────────────────

export function FieldChangeDetails({
    metadata,
    resolveFieldLabel,
    renderValue,
}: {
    metadata: Record<string, unknown>;
    resolveFieldLabel: (key: string) => string;
    renderValue: (v: unknown, fieldKey?: string) => React.ReactNode;
}) {
    const hasDiff =
        "before" in metadata && "after" in metadata &&
        typeof metadata.before === "object" && metadata.before !== null &&
        typeof metadata.after === "object" && metadata.after !== null;

    if (!hasDiff) return null;

    const before = metadata.before as Record<string, unknown>;
    const after = metadata.after as Record<string, unknown>;
    const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    const parseJsonLike = (value: unknown): unknown => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        if (
            !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
            !(trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
            return value;
        }
        try {
            return JSON.parse(trimmed) as unknown;
        } catch {
            return value;
        }
    };

    const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    const rows: Array<{ key: string; oldVal: unknown; newVal: unknown }> = [];
    for (const f of fields) {
        const oldRaw = before[f];
        const newRaw = after[f];
        const oldParsed = parseJsonLike(oldRaw);
        const newParsed = parseJsonLike(newRaw);

        const oldIsObj = isObjectRecord(oldParsed);
        const newIsObj = isObjectRecord(newParsed);

        if (oldIsObj || newIsObj) {
            const oldObj = oldIsObj ? oldParsed : {};
            const newObj = newIsObj ? newParsed : {};
            const subKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
            for (const subKey of subKeys) {
                rows.push({
                    key: `${f}.${subKey}`,
                    oldVal: oldObj[subKey],
                    newVal: newObj[subKey],
                });
            }
            continue;
        }

        rows.push({ key: f, oldVal: oldRaw, newVal: newRaw });
    }

    const rowBase: React.CSSProperties = {
        display: "grid",
        padding: "12px 14px",
        borderBottom: "1px solid var(--scheme-neutral-920)",
        alignItems: "center",
        gap: 12,
        gridTemplateColumns: "160px 1fr 1fr",
    };

    const fieldLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--scheme-neutral-500)",
        letterSpacing: "0.03em",
    };

    return (
        <Box sx={{ p: 2, backgroundColor: "var(--scheme-neutral-1045)" }}>
            <div style={{ ...rowBase, background: "rgba(148,163,184,.03)", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
                <span style={fieldLabel}>Field</span>
                <span style={fieldLabel}>Old value</span>
                <span style={fieldLabel}>New value</span>
            </div>
            {rows.map(({ key, oldVal, newVal }) => {
                const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                return (
                    <div key={key} style={{ ...rowBase, background: changed ? "rgba(251,191,36,.04)" : undefined }}>
                        <span style={fieldLabel}>{resolveFieldLabel(key)}</span>
                        <span style={{ fontSize: 12, color: "var(--scheme-neutral-400)" }}>{renderValue(oldVal, key)}</span>
                        <span style={{ fontSize: 12, color: changed ? "#fbbf24" : "var(--scheme-neutral-200)", fontWeight: changed ? 600 : 400 }}>
                            {renderValue(newVal, key)}
                        </span>
                    </div>
                );
            })}
        </Box>
    );
}
