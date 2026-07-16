"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getSimulation, openSimulationInvoice, type SimulationItem, simulationStatusTone } from "../../../lib/internalApi";
import { CrudPageLayout, FormSkeleton, useAlerts } from "../../../components/shared";
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
import { useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

function SimulationMeta({ sim, token }: { sim: SimulationItem; token: string }) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const { showSuccess, showError } = useAlerts();
    const [isPinVisible, setIsPinVisible] = useState(false);
    const [isOpeningInvoice, setIsOpeningInvoice] = useState(false);

    const fmtDate = (iso: string) =>
        formatDisplayDate(new Date(iso), preferences.dateFormat, preferences.timezone);

    const handleCopyShareLink = async () => {
        if (!sim.publicToken) return;

        const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://simuladorpublicoaxpo.b-cdn.net";
        const shareUrl = `${baseUrl}/?token=${sim.publicToken}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            showSuccess(t("simulationDetail", "shareLinkCopied"));
        } catch {
            showError(t("simulationDetail", "shareLinkCopyFailed"));
        }
    };

    const handleOpenInvoice = async () => {
        if (isOpeningInvoice) return;
        setIsOpeningInvoice(true);
        try {
            await openSimulationInvoice(token, sim.id);
        } catch (err) {
            showError(err instanceof Error ? err.message : t("simulationDetail", "openInvoiceFailed"));
        } finally {
            setIsOpeningInvoice(false);
        }
    };

    const metaItems: Array<{
        key: string;
        label: React.ReactNode;
        value: React.ReactNode;
        mono?: boolean;
        prominent?: boolean;
    }> = [];

    if (sim.referenceNumber) {
        metaItems.push({
            key: "reference",
            label: t("simulationDetail", "metaReference"),
            value: sim.referenceNumber,
            mono: true,
            prominent: true,
        });
    }

    if (sim.client) {
        metaItems.push({
            key: "client",
            label: t("simulationDetail", "metaClient"),
            value: sim.client.name,
        });
    }

    metaItems.push({
        key: "status",
        label: t("columns", "status"),
        value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge
                  label={sim.status === "DRAFT" || !sim.status ? t("baseValuesModule", "statusDraft") : sim.status}
                  tone={simulationStatusTone(sim.status)}
                />
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
        ),
    });

    metaItems.push({
        key: "pin",
        label: "PIN",
        value: sim.pinSnapshot ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: "monospace" }}>
                    {isPinVisible ? sim.pinSnapshot : "••••"}
                </span>
                <Tooltip title={isPinVisible ? "Hide PIN" : "Show PIN"}>
                    <IconButton
                        size="small"
                        onClick={() => setIsPinVisible((current) => !current)}
                        aria-label={isPinVisible ? "Hide PIN" : "Show PIN"}
                        sx={{ color: "var(--scheme-neutral-300)", p: 0.25 }}
                    >
                        {isPinVisible ? <VisibilityOffIcon sx={{ fontSize: 15 }} /> : <VisibilityIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                </Tooltip>
            </span>
        ) : (
            <Tooltip title="No decryptable display PIN is available for this simulation. The stored PIN hash cannot be shown.">
                <span style={{ color: "var(--scheme-neutral-500)" }}>Unavailable</span>
            </Tooltip>
        ),
        prominent: true,
    });

    if (sim.cupsNumber) {
        metaItems.push({
            key: "cups",
            label: t("simulationDetail", "metaCups"),
            value: sim.cupsNumber,
            mono: true,
        });
    }

    if (sim.expiresAt) {
        metaItems.push({
            key: "expires",
            label: t("simulationDetail", "metaExpires"),
            value: fmtDate(sim.expiresAt),
        });
    }

    if (sim.invoiceFileName || sim.invoiceFilePath) {
        metaItems.push({
            key: "invoice",
            label: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <PictureAsPdfOutlinedIcon sx={{ fontSize: 14 }} />
                    {t("simulationDetail", "invoiceFile")}
                </span>
            ),
            value: (
                <button
                    type="button"
                    onClick={handleOpenInvoice}
                    disabled={isOpeningInvoice}
                    style={{
                        minWidth: 0,
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        color: "var(--scheme-primary-500)",
                        cursor: isOpeningInvoice ? "progress" : "pointer",
                        opacity: isOpeningInvoice ? 0.7 : 1,
                        font: "inherit",
                        fontWeight: 700,
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={sim.invoiceFileName || "View invoice"}
                >
                    {sim.invoiceFileName || "View"}
                    {sim.invoiceFileSize ? (
                        <span style={{ marginLeft: 4, fontSize: 10, color: "var(--scheme-neutral-600)", fontWeight: 500 }}>
                            ({Math.round(sim.invoiceFileSize / 1024)} KB)
                        </span>
                    ) : null}
                </button>
            ),
        });
    }

    if (sim.createdAt) {
        metaItems.push({
            key: "created",
            label: t("simulationDetail", "metaCreated"),
            value: fmtDate(sim.createdAt),
        });
    }

    if (sim.sharedVia === "EMAIL" && sim.publicToken) {
        metaItems.push({
            key: "share-link",
            label: "Link",
            value: (
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={handleCopyShareLink}
                    sx={{ minWidth: "auto", px: 1.25, py: 0.25, textTransform: "none" }}
                >
                    Copy share link
                </Button>
            ),
        });
    }

    return (
        <div className="simulation-meta-card" style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 12,
            padding: "6px 14px",
        }}>
            <div className="simulation-meta-grid" style={{
                display: "flex",
                flexWrap: "wrap",
                columnGap: 20,
                rowGap: 4,
                alignItems: "center",
                minWidth: 0,
            }}>
                {metaItems.map((item) => (
                    <span
                        className="simulation-meta-item"
                        key={item.key}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 0,
                            maxWidth: item.key === "client" || item.key === "invoice" ? 260 : undefined,
                        }}
                    >
                        <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", textTransform: "uppercase", lineHeight: 1, flexShrink: 0 }}>
                            {item.label}
                        </span>
                        <span style={{
                            minWidth: 0,
                            maxWidth: "100%",
                            overflow: item.key === "status" ? "visible" : "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: item.key === "status" ? "normal" : "nowrap",
                            fontSize: item.prominent ? 12 : 11,
                            fontWeight: item.prominent ? 700 : 600,
                            color: "var(--scheme-neutral-100)",
                            fontFamily: item.mono ? "monospace" : undefined,
                            background: item.prominent ? "var(--scheme-neutral-1000)" : "transparent",
                            borderRadius: item.prominent ? 6 : undefined,
                            padding: item.prominent ? "4px 8px" : undefined,
                        }}>
                            {item.value}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function SimulationViewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const isBoneyardFixture = id === "boneyard-fixture";
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [simulation, setSimulation] = useState<SimulationItem | null>(null);
    const [lastResults, setLastResults] = useState<SimulationResults | null>(null);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [selectedOfferProductKey, setSelectedOfferProductKey] = useState<string>("");
    const simulationBreadcrumbLabel =
        simulation?.referenceNumber || simulation?.client?.name || simulation?.id || id;
    const breadcrumbs = useMemo(
        () => simulation ? [
            { label: simulationBreadcrumbLabel, href: `/internal/simulations/${simulation.id}` },
            { label: t("simulationDetail", "title") },
        ] : null,
        [simulation, simulationBreadcrumbLabel, t],
    );
    useTopBarBreadcrumbs(breadcrumbs);

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || isBoneyardFixture || fetchedRef.current) return;
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
    }, [session, id, isBoneyardFixture]);

    if (!session || !simulation) {
        return (
            <CrudPageLayout title={t("simulationDetail", "title")} backHref="/internal/simulations" hideHeader>
                <FormSkeleton variant="simulation-edit" />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("simulationDetail", "title")}
            backHref="/internal/simulations"
            hideHeader
        >
            <div className="simulation-view-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                    <SimulationMeta sim={simulation} token={session.token} />
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
