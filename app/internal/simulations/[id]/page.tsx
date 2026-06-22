"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import {
  getSimulation,
  openSimulationInvoice,
  getClient,
  updateClient,
  simulationStatusTone,
  type SimulationItem,
  type ClientItem,
} from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import {
  CrudPageLayout,
  LoadingState,
  useAlerts,
} from "../../components/shared";
import {
  SimulationForm,
  type SimulationFormHandle,
} from "../../components/modules/SimulationForm";
import { BaseValueSetSelector } from "../../components/ui/BaseValueSetSelector";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AuditLogsModal } from "../../components/ui/AuditLogsModal";
import { useUserPreferences } from "../../components/providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import type { SimulationResults } from "@/domain/types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import LockIcon from "@mui/icons-material/Lock";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { ShareSimulationView } from "./components/ShareSimulationView";
import { DownloadHistoryDialog } from "./components/DownloadHistoryDialog";
import LaunchIcon from "@mui/icons-material/Launch";

function SimulationMeta({
  sim,
  actions,
  canViewClients,
  token,
}: {
  sim: SimulationItem;
  actions?: React.ReactNode;
  canViewClients?: boolean;
  token: string;
}) {
  const { t } = useI18n();
  const { preferences } = useUserPreferences();
  const { showError } = useAlerts();
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isOpeningInvoice, setIsOpeningInvoice] = useState(false);

  const fmtDate = (iso: string) =>
    formatDisplayDate(new Date(iso), preferences.dateFormat);

  const handleOpenInvoice = async () => {
    if (isOpeningInvoice) return;
    setIsOpeningInvoice(true);
    try {
      await openSimulationInvoice(token, sim.id);
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Failed to open invoice",
      );
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
      value: canViewClients ? (
        <Box
          component={"a"}
          href={`/internal/clients/${sim.client.id}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "primary.main",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {sim.client.name}
          </span>
          <LaunchIcon sx={{ fontSize: 16, flexShrink: 0 }} />
        </Box>
      ) : (
        sim.client.name
      ),
    });
  }

  metaItems.push({
    key: "status",
    label: t("columns", "status"),
    value: (
      <StatusBadge
        label={sim.status || "DRAFT"}
        tone={simulationStatusTone(sim.status)}
      />
    ),
  });

  metaItems.push({
    key: "pin",
    label: "PIN",
    value: sim.pinSnapshot ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontFamily: "monospace",
            }}
          >
            {isPinVisible ? sim.pinSnapshot : "••••"}
          </span>
          <Tooltip title={isPinVisible ? "Hide PIN" : "Show PIN"}>
            <IconButton
              size="small"
              onClick={() => setIsPinVisible((current) => !current)}
              aria-label={isPinVisible ? "Hide PIN" : "Show PIN"}
              sx={{ color: "var(--scheme-neutral-300)", p: 0.25 }}
            >
              {isPinVisible ? (
                <VisibilityOffIcon sx={{ fontSize: 15 }} />
              ) : (
                <VisibilityIcon sx={{ fontSize: 15 }} />
              )}
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
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                color: "var(--scheme-neutral-600)",
                fontWeight: 500,
              }}
            >
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginBottom: 24,
        padding: "14px 16px",
        background: "var(--scheme-neutral-1050, rgba(255,255,255,0.02))",
        border: "1px solid var(--scheme-neutral-900)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 22,
          rowGap: 10,
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {metaItems.map((item) => (
          <span
            key={item.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              maxWidth: item.key === "client" || item.key === "invoice" ? 260 : undefined,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--scheme-neutral-500)",
                textTransform: "uppercase",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {item.label}
            </span>
            <span
              style={{
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
              }}
            >
              {item.value}
            </span>
          </span>
        ))}
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            borderTop: "1px solid var(--scheme-neutral-900)",
            paddingTop: 12,
            minWidth: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export default function SimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const { t } = useI18n();
  const { canDo } = usePermissions();

  const [simulation, setSimulation] = useState<SimulationItem | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [lastResults, setLastResults] = useState<SimulationResults | null>(
    null,
  );
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [selectedOfferProductKey, setSelectedOfferProductKey] =
    useState<string>("");
  const [selectedBaseValueSetId, setSelectedBaseValueSetId] = useState<
    string | undefined
  >(undefined);
  const [usedBaseValueSetId, setUsedBaseValueSetId] = useState<string | null>(
    null,
  );
  const [selectedBvsIsProduction, setSelectedBvsIsProduction] = useState<
    boolean | null
  >(null);
  const didAutoOpenShareRef = useRef(false);
  const formRef = useRef<SimulationFormHandle>(null);

  const handleBaseValueSetChange = (
    id: string,
    meta?: { userInitiated: boolean },
  ) => {
    setSelectedBaseValueSetId(id);
    if (meta?.userInitiated) {
      formRef.current?.calculate();
    }
  };

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!session || fetchedRef.current) return;
    fetchedRef.current = true;
    getSimulation(session.token, id)
      .then(async ({ simulation: sim, versions }) => {
        setSimulation(sim);
        const payload = sim.payloadJson as {
          results?: SimulationResults;
          selectedOffer?: { productKey: string };
          baseValueSetId?: string;
        } | null;
        if (payload?.results) setLastResults(payload.results);
        const baseValueSetId =
          payload?.results?.baseValueSetId ?? payload?.baseValueSetId;
        if (baseValueSetId) setUsedBaseValueSetId(baseValueSetId);

        setSelectedOfferProductKey(payload?.selectedOffer?.productKey ?? "");

        if (sim.clientId) {
          getClient(session.token, sim.clientId)
            .then((client) => setClients([client]))
            .catch(() => {
              /* non-critical */
            });
        }
      })
      .catch((err) => {
        showError(
          err instanceof Error
            ? err.message
            : t("simulationDetail", "notFound"),
        );
        router.push("/internal/simulations");
      });
  }, [session, id]);

  const handleShare = async () => {
    if (!session || !simulation) return;
    // Re-fetch the simulation so ShareSimulationView always receives a fresh
    // payloadJson (containing the latest results + selectedOffer) without
    // requiring a full page refresh after a calculation or offer selection.
    try {
      const { simulation: freshSim } = await getSimulation(
        session.token,
        simulation.id,
      );
      setSimulation(freshSim);
    } catch {
      // Non-critical — fall back to the existing (possibly stale) data.
    }
    setShowShareDialog(true);
  };

  useEffect(() => {
    if (!session || !simulation || didAutoOpenShareRef.current) return;
    if (searchParams.get("share") !== "1") return;
    if (simulation.status !== "DRAFT") return;

    didAutoOpenShareRef.current = true;

    (async () => {
      try {
        const { simulation: freshSim } = await getSimulation(
          session.token,
          simulation.id,
        );
        setSimulation(freshSim);
      } catch {
        // Non-critical — fall back to existing simulation state.
      }
      setShowShareDialog(true);
    })();
  }, [searchParams, session, simulation]);

  const handleClientFieldsChanged = async (
    clientId: string,
    data: { name?: string; contactName?: string },
  ) => {
    if (!session) return;
    try {
      await updateClient(session.token, clientId, data);
    } catch {
      // non-critical — silent failure; changes are already saved in the simulation payload
    }
  };

  if (!session || !simulation) {
    return (
      <CrudPageLayout
        title={t("simulationDetail", "title")}
        backHref="/internal/simulations"
      >
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
        token={session.token}
        canViewClients={
          session ? canDo(session.user.role, "section.clients") : false
        }
        actions={
          !!lastResults && simulation.status === "DRAFT" ? (
            <>
              {session &&
                (session.user.role === "ADMIN" ||
                  session.user.role === "SYS_ADMIN") && (
                <BaseValueSetSelector
                  token={session.token}
                  isAdmin
                  usedBaseValueSetId={usedBaseValueSetId}
                  forAgencyId={session.user.agencyId}
                  onChange={handleBaseValueSetChange}
                  onChangeItem={(item) =>
                    setSelectedBvsIsProduction(item.isProduction)
                  }
                />
              )}
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setShowHistoryDialog(true)}
              >
                {t("downloadHistory", "buttonLabel") || "Download History"}
              </Button>
              {selectedOfferProductKey && (
                <Button
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={handleShare}
                >
                  {t("actions", "share") || "Share"}
                </Button>
              )}
              {(session.user.role === "AGENT" ||
                canDo(session.user.role, "section.audit-logs")) && (
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setShowAuditLogsModal(true)}
                >
                  {t("auditLogsModal", "title")}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {simulation.status === "SHARED" && (
        <div
          style={{
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
          }}
        >
          <LockIcon sx={{ fontSize: 16 }} />
          <span>
            This simulation has been shared and is now read-only. No changes can
            be made.
          </span>
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
        onNotify={(text, tone) =>
          tone === "success" ? showSuccess(text) : showError(text)
        }
        onOfferSelected={(productKey) =>
          setSelectedOfferProductKey(productKey ?? "")
        }
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
        <DialogTitle
          sx={{
            pb: 1.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
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

      {/* Audit Logs Modal */}
      {session &&
        (session.user.role === "AGENT" ||
          canDo(session.user.role, "section.audit-logs")) && (
        <AuditLogsModal
          open={showAuditLogsModal}
          onClose={() => setShowAuditLogsModal(false)}
          targetType="SIMULATION"
          targetId={simulation.id}
          token={session.token}
          title={`${t("auditLogsModal", "title")} - ${simulation.referenceNumber || simulation.id}`}
        />
      )}
    </CrudPageLayout>
  );
}
