"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getSimulation, type SimulationItem, simulationStatusTone } from "../../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SimulationViewDisplay } from "../../../components/modules/SimulationViewDisplay";
import type { SimulationResults } from "@/domain/types";
import { Button, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import HistoryIcon from "@mui/icons-material/History";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { DownloadHistoryDialog } from "../components/DownloadHistoryDialog";
import { useUserPreferences } from "../../../components/providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../../lib/formatPreferences";

function SimulationMeta({ sim }: { sim: SimulationItem }) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const { showSuccess, showError } = useAlerts();
    const [isPinVisible, setIsPinVisible] = useState(false);

    const fmtDate = (iso: string) =>
        formatDisplayDate(new Date(iso), preferences.dateFormat);

    const handleCopyShareLink = async () => {
        if (!sim.publicToken) return;
        
        const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://tuenergia.axpoiberia.es";
        const shareUrl = `${baseUrl}/simulador/?token=${sim.publicToken}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            showSuccess("Share link copied to clipboard");
        } catch {
            showError("Failed to copy share link");
        }
    };

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            padding: "10px",
            background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
            border: "1px solid var(--scheme-neutral-900)",
            borderRadius: 10,
        }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1 }}>

                {/* Reference Number */}
                {sim.referenceNumber && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaReference")}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--scheme-neutral-100)", fontFamily: "monospace", letterSpacing: "0.1em", background: "var(--scheme-neutral-900)", padding: "1px 7px", borderRadius: 4 }}>
                            {sim.referenceNumber}
                        </span>
                    </span>
                )}

                {/* Client */}
                {sim.client && (
                    <>
                        {sim.referenceNumber && (
                            <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                        )}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaClient")}</span>
                            <span style={{ fontSize: 11, color: "var(--scheme-neutral-100)", fontWeight: 600 }}>{sim.client.name}</span>
                        </span>
                        <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                    </>
                )}

                {/* Status + chips */}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <StatusBadge label={sim.status || "DRAFT"} tone={simulationStatusTone(sim.status)} />
                    {sim.status === "SHARED" && sim.clientOpenedAt && (
                        <StatusBadge label={t("simulationsModule", "clientViewed") || "Viewed"} tone="accent" />
                    )}
                    {sim.status === "SHARED" && sim.sharedVia && (
                        <StatusBadge
                            icon={sim.sharedVia === "EMAIL" ? <MailOutlineIcon /> : <PictureAsPdfOutlinedIcon />}
                            label={t("simulationsModule", sim.sharedVia === "EMAIL" ? "sharedViaEmail" : "sharedViaPdf") || (sim.sharedVia === "EMAIL" ? "Via Email" : "Via PDF")}
                            tone="neutral"
                        />
                    )}
                </span>

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
                            <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)" }}>{fmtDate(sim.expiresAt)}</span>
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
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                <PictureAsPdfOutlinedIcon sx={{ fontSize: 14 }} />
                                {t("simulationDetail", "invoiceFile")}
                            </span>
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
                            <span style={{ fontSize: 11, color: "var(--scheme-neutral-200)" }}>{fmtDate(sim.createdAt)}</span>
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
                                {isPinVisible ? sim.pinSnapshot : "••••"}
                            </span>
                            <Tooltip title={isPinVisible ? "Hide PIN" : "Show PIN"}>
                                <IconButton
                                    size="small"
                                    onClick={() => setIsPinVisible((current) => !current)}
                                    aria-label={isPinVisible ? "Hide PIN" : "Show PIN"}
                                    sx={{ color: "var(--scheme-neutral-300)", p: 0.5 }}
                                >
                                    {isPinVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                        </span>
                    </>
                )}

                {/* Share link */}
                {sim.sharedVia === "EMAIL" && sim.publicToken && (
                    <>
                        <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ContentCopyIcon fontSize="small" />}
                            onClick={handleCopyShareLink}
                            sx={{ minWidth: "auto", px: 1.25, py: 0.25, textTransform: "none" }}
                        >
                            Copy share link
                        </Button>
                    </>
                )}
            </div>
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
                setSelectedOfferProductKey(payload?.selectedOffer?.productKey ?? "");
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
                {!!lastResults && false && (
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
