"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSimulation, shareSimulation, type SimulationItem } from "../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../components/shared";
import { SimulationForm } from "../../components/modules/SimulationForm";
import type { SimulationResults } from "@/domain/types";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, Divider, IconButton } from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import { ShareSimulationView } from "./components/ShareSimulationView";
import { DownloadHistoryDialog } from "./components/DownloadHistoryDialog";

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
            {sim.id && (
                <>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>ID</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)", fontFamily: "monospace" }}>{sim.id.slice(0, 14)}…</span>
                    </span>

                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                </>
            )}

            {/* Status */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaStatus")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{sim.status || "DRAFT"}</span>
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
                            {new Date(sim.expiresAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                    </span>
                </>
            )}

            {/* Created */}
            {sim.createdAt && (
                <>
                    <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaCreated")}</span>
                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)" }}>
                            {new Date(sim.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
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

export default function SimulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [simulation, setSimulation] = useState<SimulationItem | null>(null);
    const [lastResults, setLastResults] = useState<SimulationResults | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
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

                // Find the most-recent selectedOffer across all returned versions.
                // The latest version may have had its selectedOffer wiped by a
                // recalculation, so fall back to scanning the full version list.
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

    const handleShare = async () => {
        if (!session || !simulation) return;
        setShowShareDialog(true);
    };

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <SimulationMeta sim={simulation} />
                </div>
                {!!lastResults && (
                    <>
                        <Button
                            variant="outlined"
                            startIcon={<HistoryIcon />}
                            onClick={() => setShowHistoryDialog(true)}
                            sx={{ ml: 1, mt: 0 }}
                        >
                            {t("downloadHistory", "buttonLabel") || "Download History"}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ShareIcon />}
                            onClick={handleShare}
                            sx={{ ml: 1, mt: 0 }}
                        >
                            {t("actions", "share") || "Share"}
                        </Button>
                    </>
                )}
            </div>

            <SimulationForm
                simulation={simulation}
                token={session.token}
                onSuccess={(results) => setLastResults(results)}
                onNotify={(text, tone) => tone === "success" ? showSuccess(text) : showError(text)}
                onOfferSelected={(productKey) => setSelectedOfferProductKey(productKey)}
            />

            {/* Share Dialog */}
            <Dialog
                open={showShareDialog}
                onClose={() => setShowShareDialog(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {t("simulationDetail", "shareTitle") || "Share with Client"}
                    <IconButton
                        edge="end"
                        color="inherit"
                        onClick={() => setShowShareDialog(false)}
                        aria-label="close"
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ p: 0 }}>
                    {simulation && (
                        <ShareSimulationView
                            simulation={simulation}
                            token={session.token}
                            onSuccess={(msg) => {
                                showSuccess(msg);
                                setShowShareDialog(false);
                            }}
                            onError={showError}
                            onStatusChange={() => {
                                // Refresh the page to show updated status
                                window.location.reload();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Download History Dialog */}
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
