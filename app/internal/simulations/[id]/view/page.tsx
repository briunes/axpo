"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getSimulation, type SimulationItem } from "../../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { SimulationViewDisplay } from "../../../components/modules/SimulationViewDisplay";
import type { SimulationResults } from "@/domain/types";
import { Button } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import { DownloadHistoryDialog } from "../components/DownloadHistoryDialog";

const STATUS_COLOUR: Record<string, string> = {
    DRAFT: "#888",
    SHARED: "#4ade80",
    EXPIRED: "#f87171",
};

function SimulationMeta({ sim }: { sim: SimulationItem }) {
    const { t } = useI18n();
    const statusColor = STATUS_COLOUR[sim.status] ?? "#888";

    return (
        <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 24,
            padding: "16px 20px",
            background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
            border: "1px solid var(--scheme-neutral-900)",
            borderRadius: 10,
        }}>
            {/* ID */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>ID</span>
                <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)", fontFamily: "monospace" }}>{sim.id.slice(0, 14)}…</span>
            </span>

            <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>

            {/* Status */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaStatus")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{sim.status}</span>
            </span>

            {/* Client */}
            {sim.client && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaClient")}</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-100)", fontWeight: 600 }}>{sim.client.name}</span>
                    </span>
                </>
            )}

            {/* CUPS */}
            {sim.cupsNumber && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaCups")}</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)", fontFamily: "monospace" }}>{sim.cupsNumber}</span>
                    </span>
                </>
            )}

            {/* Expires */}
            {sim.expiresAt && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaExpires")}</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)" }}>
                            {new Date(sim.expiresAt).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </span>
                </>
            )}

            {/* Invoice File */}
            {(sim.invoiceFileName || sim.invoiceFilePath) && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <a
                        href={`/api/v1/internal/simulations/${sim.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            textDecoration: "none",
                            color: "var(--scheme-primary-500)",
                            cursor: "pointer",
                        }}
                        title={sim.invoiceFileName || "View invoice"}
                    >
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>📄 {t("simulationDetail", "invoiceFile")}</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{sim.invoiceFileName || "View"}</span>
                        {sim.invoiceFileSize && (
                            <span style={{ fontSize: 10, color: "var(--scheme-neutral-600)" }}>({Math.round(sim.invoiceFileSize / 1024)} KB)</span>
                        )}
                    </a>
                </>
            )}

            {/* Created */}
            {sim.createdAt && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaCreated")}</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)" }}>
                            {new Date(sim.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </span>
                </>
            )}

            {/* PIN */}
            {sim.pinSnapshot && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>PIN</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--scheme-neutral-100)", fontFamily: "monospace", letterSpacing: "0.14em", background: "var(--scheme-neutral-900)", padding: "1px 7px", borderRadius: 4 }}>
                            {sim.pinSnapshot}
                        </span>
                    </span>
                </>
            )}
        </div>
    );
}

export default function SimulationViewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [simulation, setSimulation] = useState<SimulationItem | null>(null);
    const [lastResults, setLastResults] = useState<SimulationResults | null>(null);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [selectedOfferProductKey, setSelectedOfferProductKey] = useState<string>("");

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;
        getSimulation(session.token, id)
            .then(({ simulation: sim, versions }) => {
                setSimulation(sim);
                const payload = sim.payloadJson as { results?: SimulationResults; selectedOffer?: { productKey: string } } | null;
                if (payload?.results) setLastResults(payload.results);
                const productKey =
                    payload?.selectedOffer?.productKey ??
                    (versions as Array<{ payloadJson?: { selectedOffer?: { productKey: string } } | null }>)
                        .find((v) => v.payloadJson?.selectedOffer?.productKey)
                        ?.payloadJson?.selectedOffer?.productKey;
                if (productKey) setSelectedOfferProductKey(productKey);
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("simulationDetail", "notFound"));
                router.push("/internal/simulations");
            });
    }, [session, id]);

    if (!session || !simulation) {
        return (
            <CrudPageLayout title={t("simulationDetail", "title")} backHref="/internal/simulations">
                <LoadingState message={t("simulationDetail", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("simulationDetail", "title")}
            backHref="/internal/simulations"
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                    <SimulationMeta sim={simulation} />
                </div>
                {!!lastResults && (
                    <Button
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={() => setShowHistoryDialog(true)}
                        sx={{ ml: 1, mt: 0 }}
                    >
                        {t("downloadHistory", "buttonLabel") || "Download History"}
                    </Button>
                )}
            </div>
            <SimulationViewDisplay simulation={simulation} />

            <DownloadHistoryDialog
                open={showHistoryDialog}
                onClose={() => setShowHistoryDialog(false)}
                simulation={simulation}
                token={session.token}
                initialProductKey={selectedOfferProductKey}
                onSuccess={(msg) => {
                    showSuccess(msg);
                    setShowHistoryDialog(false);
                }}
                onError={showError}
            />
        </CrudPageLayout>
    );
}
