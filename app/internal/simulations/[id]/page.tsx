"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSimulation, listClients, updateClient, simulationStatusTone, type SimulationItem, type ClientItem } from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import { CrudPageLayout, LoadingState, useAlerts } from "../../components/shared";
import { SimulationForm, type SimulationFormHandle } from "../../components/modules/SimulationForm";
import { BaseValueSetSelector } from "../../components/ui/BaseValueSetSelector";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useUserPreferences } from "../../components/providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import type { SimulationResults } from "@/domain/types";
import { Dialog, DialogTitle, DialogContent, Button, Box, Divider, IconButton } from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import LockIcon from "@mui/icons-material/Lock";
import { ShareSimulationView } from "./components/ShareSimulationView";
import { DownloadHistoryDialog } from "./components/DownloadHistoryDialog";
import LaunchIcon from '@mui/icons-material/Launch';

function SimulationMeta({ sim, actions, canViewClients }: { sim: SimulationItem; actions?: React.ReactNode; canViewClients?: boolean }) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();

    const fmtDate = (iso: string) =>
        formatDisplayDate(new Date(iso), preferences.dateFormat);

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

                {/* Client */}
                {sim.client && (
                    <>
                        <span style={{ color: "var(--scheme-neutral-800)", fontSize: 14, userSelect: "none" }}>·</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("simulationDetail", "metaClient")}</span>
                            {canViewClients ? (
                                <Box component={'a'}
                                    href={`/internal/clients/${sim.client.id}/edit`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ fontSize: 11, color: "primary.main", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 1 }}
                                >
                                    {sim.client.name}
                                    <LaunchIcon fontSize="small" />
                                </Box>
                            ) : (
                                <span style={{ fontSize: 11, color: "var(--scheme-neutral-100)", fontWeight: 600 }}>{sim.client.name}</span>
                            )}
                        </span>
                    </>
                )}

                {/* Status */}
                <StatusBadge label={sim.status || "DRAFT"} tone={simulationStatusTone(sim.status)} />

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
                                {fmtDate(sim.expiresAt)}
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
                                {fmtDate(sim.createdAt)}
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
            {actions && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
                    {actions}
                </div>
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
    const { canDo } = usePermissions();

    const [simulation, setSimulation] = useState<SimulationItem | null>(null);
    const [clients, setClients] = useState<ClientItem[]>([]);
    const [lastResults, setLastResults] = useState<SimulationResults | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [selectedOfferProductKey, setSelectedOfferProductKey] = useState<string>("");
    const [selectedBaseValueSetId, setSelectedBaseValueSetId] = useState<string | undefined>(undefined);
    const [usedBaseValueSetId, setUsedBaseValueSetId] = useState<string | null>(null);
    const [selectedBvsIsProduction, setSelectedBvsIsProduction] = useState<boolean | null>(null);
    const formRef = useRef<SimulationFormHandle>(null);

    // Auto-recalculate when the admin switches the base value set
    const isFirstBvsChange = useRef(true);
    useEffect(() => {
        if (isFirstBvsChange.current) {
            isFirstBvsChange.current = false;
            return;
        }
        if (selectedBaseValueSetId) {
            formRef.current?.calculate();
        }
    }, [selectedBaseValueSetId]);

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;
        getSimulation(session.token, id)
            .then(({ simulation: sim, versions }) => {
                setSimulation(sim);
                const payload = sim.payloadJson as { results?: SimulationResults; selectedOffer?: { productKey: string }; baseValueSetId?: string } | null;
                if (payload?.results) setLastResults(payload.results);
                if (payload?.baseValueSetId) setUsedBaseValueSetId(payload.baseValueSetId);

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

        listClients(session.token, { pageSize: 500 })
            .then((res) => setClients(res.items))
            .catch(() => { /* non-critical */ });
    }, [session, id]);

    const handleShare = async () => {
        if (!session || !simulation) return;
        // Re-fetch the simulation so ShareSimulationView always receives a fresh
        // payloadJson (containing the latest results + selectedOffer) without
        // requiring a full page refresh after a calculation or offer selection.
        try {
            const { simulation: freshSim } = await getSimulation(session.token, simulation.id);
            setSimulation(freshSim);
        } catch {
            // Non-critical — fall back to the existing (possibly stale) data.
        }
        setShowShareDialog(true);
    };

    const handleClientFieldsChanged = async (clientId: string, data: { name?: string; contactName?: string }) => {
        if (!session) return;
        try {
            await updateClient(session.token, clientId, data);
        } catch {
            // non-critical — silent failure; changes are already saved in the simulation payload
        }
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
            <SimulationMeta
                sim={simulation}
                canViewClients={session ? canDo(session.user.role, "section.clients") : false}
                actions={!!lastResults && simulation.status === 'DRAFT' ? (
                    <>
                        {session && (
                            <BaseValueSetSelector
                                token={session.token}
                                isAdmin={session.user.role === "ADMIN"}
                                usedBaseValueSetId={usedBaseValueSetId}
                                onChange={(id) => setSelectedBaseValueSetId(id)}
                                onChangeItem={(item) => setSelectedBvsIsProduction(item.isProduction)}
                            />
                        )}
                        <Button
                            variant="outlined"
                            startIcon={<HistoryIcon />}
                            onClick={() => setShowHistoryDialog(true)}
                        >
                            {t("downloadHistory", "buttonLabel") || "Download History"}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ShareIcon />}
                            onClick={handleShare}
                        >
                            {t("actions", "share") || "Share"}
                        </Button>
                    </>
                ) : undefined}
            />

            {simulation.status === "SHARED" && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    marginBottom: 16,
                    background: "rgba(74, 222, 128, 0.07)",
                    border: "1px solid rgba(74, 222, 128, 0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#4ade80",
                }}>
                    <LockIcon sx={{ fontSize: 16 }} />
                    <span>This simulation has been shared and is now read-only. No changes can be made.</span>
                </div>
            )}

            <SimulationForm
                ref={formRef}
                simulation={simulation}
                token={session.token}
                clients={clients}
                onClientFieldsChanged={handleClientFieldsChanged}
                onSuccess={(results, bvsId) => {
                    setLastResults(results);
                    if (bvsId) setUsedBaseValueSetId(bvsId);
                }}
                onNotify={(text, tone) => tone === "success" ? showSuccess(text) : showError(text)}
                onOfferSelected={(productKey) => setSelectedOfferProductKey(productKey)}
                readOnly={simulation.status === "SHARED"}
                baseValueSetId={selectedBaseValueSetId}
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
                            isTestingMode={selectedBvsIsProduction === false}
                            loggedUserEmail={session.user.email}
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
