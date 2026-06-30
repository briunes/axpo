"use client";

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import {
  getSimulation,
  openSimulationInvoice,
  updateClient,
  simulationStatusTone,
  type SimulationItem,
  type ClientItem,
} from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import {
  CrudPageLayout,
  FormSkeleton,
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
import { useActionButtons, useTopBarBreadcrumbs } from "../../components/InternalWorkspace";
import { formatDisplayDate } from "../../lib/formatPreferences";
import type { SimulationPayload, SimulationResults } from "@/domain/types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Divider,
  IconButton,
  Tooltip,
  Typography,
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
  canViewClients,
  token,
}: {
  sim: SimulationItem;
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
        <Box component={'span'} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: '100%' }}>
          {t("simulationDetail", "invoiceFile")}
          <PictureAsPdfOutlinedIcon fontSize="small" />
        </Box>
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
      className="simulation-meta-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
        padding: "6px 14px",
      }}
    >
      <div
        className="simulation-meta-grid"
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 20,
          rowGap: 4,
          alignItems: "center",
        }}
      >
        {metaItems.map((item) => (
          <Typography
            component="span"
            variant="caption"
            className="simulation-meta-item"
            key={item.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <Typography
              component="span"
              variant="caption"
              sx={{
                fontWeight: 500
              }}
            >
              {item.label}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              style={{
                minWidth: 0,
                maxWidth: "100%",
                overflow: item.key === "status" ? "visible" : "hidden",
                textOverflow: "ellipsis",
                whiteSpace: item.key === "status" ? "normal" : "nowrap",
                color: "var(--scheme-neutral-100)",
                fontFamily: item.mono ? "monospace" : undefined,
                background: item.prominent ? "var(--scheme-neutral-1000)" : "transparent",
                borderRadius: item.prominent ? 6 : undefined,
                padding: item.prominent ? "2px 7px" : undefined,
              }}

            >
              {item.value}
            </Typography>
          </Typography>
        ))}
      </div>
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
  const onActionButtons = useActionButtons();

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
  const simulationBreadcrumbLabel =
    simulation?.referenceNumber || simulation?.client?.name || simulation?.id || id;
  const breadcrumbs = useMemo(
    () => simulation ? [{ label: simulationBreadcrumbLabel, href: `/internal/simulations/${simulation.id}` }] : null,
    [simulation, simulationBreadcrumbLabel],
  );
  useTopBarBreadcrumbs(breadcrumbs);
  const didAutoOpenShareRef = useRef(false);
  const formRef = useRef<SimulationFormHandle>(null);

  const handleBaseValueSetChange = useCallback((
    id: string,
    meta?: { userInitiated: boolean },
  ) => {
    setSelectedBaseValueSetId(id);
    if (meta?.userInitiated) {
      formRef.current?.calculate(id);
    }
  }, []);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!session || fetchedRef.current) return;
    fetchedRef.current = true;
    getSimulation(session.token, id)
      .then(({ simulation: sim }) => {
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

        if (sim.client) {
          setClients([sim.client as ClientItem]);
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

  const handleShare = useCallback(() => {
    if (!session || !simulation) return;
    setShowShareDialog(true);
  }, [session, simulation]);

  const showDraftResultActions = !!lastResults && simulation?.status === "DRAFT";
  const canChooseBaseValues =
    !!session &&
    (session.user.role === "ADMIN" || session.user.role === "SYS_ADMIN");
  const canOpenAuditLogs =
    !!session &&
    (session.user.role === "AGENT" ||
      canDo(session.user.role, "section.audit-logs"));

  useLayoutEffect(() => {
    if (!showDraftResultActions || !session) {
      onActionButtons?.(null);
      return;
    }

    onActionButtons?.(
      <>
        {canChooseBaseValues && (
          <span className="topbar-action-wrap simulation-topbar-base-values">
            <BaseValueSetSelector
              token={session.token}
              isAdmin
              usedBaseValueSetId={usedBaseValueSetId}
              forAgencyId={session.user.agencyId}
              compact
              onChange={handleBaseValueSetChange}
              onChangeItem={(item) =>
                setSelectedBvsIsProduction(item.isProduction)
              }
            />
          </span>
        )}
        <Tooltip title={t("downloadHistory", "buttonLabel") || "Download History"} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon fontSize="small" />}
              onClick={() => setShowHistoryDialog(true)}
              aria-label={t("downloadHistory", "buttonLabel") || "Download History"}
            >
              <span className="topbar-action-label">
                {t("downloadHistory", "buttonLabel") || "Download History"}
              </span>
            </Button>
          </span>
        </Tooltip>
        {selectedOfferProductKey && (
          <Tooltip title={t("actions", "share") || "Share"} arrow>
            <span className="topbar-action-wrap">
              <Button
                className="topbar-action topbar-action--compact"
                variant="outlined"
                size="small"
                startIcon={<ShareIcon fontSize="small" />}
                onClick={handleShare}
                aria-label={t("actions", "share") || "Share"}
              >
                <span className="topbar-action-label">
                  {t("actions", "share") || "Share"}
                </span>
              </Button>
            </span>
          </Tooltip>
        )}
        {canOpenAuditLogs && (
          <Tooltip title={t("auditLogsModal", "title")} arrow>
            <span className="topbar-action-wrap">
              <Button
                className="topbar-action topbar-action--compact"
                variant="outlined"
                size="small"
                startIcon={<HistoryIcon fontSize="small" />}
                onClick={() => setShowAuditLogsModal(true)}
                aria-label={t("auditLogsModal", "title")}
              >
                <span className="topbar-action-label">
                  {t("auditLogsModal", "title")}
                </span>
              </Button>
            </span>
          </Tooltip>
        )}
      </>,
    );

    return () => onActionButtons?.(null);
  }, [
    canChooseBaseValues,
    canOpenAuditLogs,
    handleBaseValueSetChange,
    handleShare,
    onActionButtons,
    selectedOfferProductKey,
    session,
    showDraftResultActions,
    t,
    usedBaseValueSetId,
  ]);

  useEffect(() => {
    if (!session || !simulation || didAutoOpenShareRef.current) return;
    if (searchParams.get("share") !== "1") return;
    if (simulation.status !== "DRAFT") return;

    didAutoOpenShareRef.current = true;

    setShowShareDialog(true);
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

  if (!session || !simulation || false) {
    return (
      <CrudPageLayout
        title={t("simulationDetail", "title")}
        backHref="/internal/simulations"
        hideHeader
      >
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
      <div className="simulation-detail-page">
      <SimulationMeta
        sim={simulation}
        token={session.token}
        canViewClients={
          session ? canDo(session.user.role, "section.clients") : false
        }
      />

      {simulation.status === "SHARED" && (
        <div
          className="simulation-readonly-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            marginBottom: 12,
            background: "rgba(74, 222, 128, 0.07)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            borderRadius: 8,
            color: "#4ade80",
          }}
        >
          <LockIcon sx={{ fontSize: 16 }} />
          <Typography component="span" variant="body2">
            {t("simulationDetail", "readOnlySharedMessage")}
          </Typography>
        </div>
      )}

      <SimulationForm
        ref={formRef}
        simulation={simulation}
        token={session.token}
        clients={clients}
        onClientFieldsChanged={handleClientFieldsChanged}
        onSuccess={(results, bvsId, payload) => {
          setLastResults(results);
          if (bvsId) setUsedBaseValueSetId(bvsId);
          if (payload) {
            setSimulation((current) =>
              current
                ? { ...current, payloadJson: payload as unknown as Record<string, unknown> }
                : current,
            );
          }
        }}
        onNotify={(text, tone) =>
          tone === "success" ? showSuccess(text) : showError(text)
        }
        onOfferSelected={(productKey, selectedOffer) => {
          setSelectedOfferProductKey(productKey ?? "");
          setSimulation((current) => {
            if (!current) return current;
            const payload = (current.payloadJson ?? {}) as SimulationPayload;
            return {
              ...current,
              payloadJson: {
                ...payload,
                selectedOffer,
              } as unknown as Record<string, unknown>,
            };
          });
          if (productKey && selectedOffer && simulation.status === "DRAFT") {
            setShowShareDialog(true);
          }
        }}
        readOnly={simulation.status === "SHARED"}
        baseValueSetId={selectedBaseValueSetId}
      />
      </div>

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
