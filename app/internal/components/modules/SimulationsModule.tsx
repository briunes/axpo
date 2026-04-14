"use client";

import {
  Column,
  Text,
} from "@once-ui-system/core";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Button,
  Typography,
  TextField,
  Box,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, ClientItem, SimulationItem } from "../../lib/internalApi";
import { isAdmin, simulationStatusTone } from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import type { SimulationsActions } from "../hooks/useSimulations";
import { ConfirmDialog } from "../shared";
import { DataTable, SlidePanel, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";

interface SimulationsModuleProps {
  session: SessionState;
  actions: SimulationsActions;
  agencies: AgencyItem[];
  clients: ClientItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
}

export function SimulationsModule({ session, actions, agencies, clients, onNotify }: SimulationsModuleProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { canDo } = usePermissions();
  const {
    simulations, loading, busyAction, errorText, successText, clearFeedback, refresh,
    selectedSimulationId, editPayloadJson, setEditPayloadJson,
    openSimulationEditor, closeSimulationEditor, handleUpdateSimulation,
    handleShare, handleClone, handleRotatePin, handleOcrPrefill, handlePdfDownload, handleArchive,
  } = actions;

  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [shareSim, setShareSim] = useState<SimulationItem | null>(null);
  const [confirmArchiveSim, setConfirmArchiveSim] = useState<SimulationItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  const filtered = simulations.filter((s) => {
    if (!showArchived && s.isDeleted) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q) ||
      (s.ownerUser?.fullName ?? "").toLowerCase().includes(q) ||
      (s.ownerUser?.email ?? "").toLowerCase().includes(q) ||
      (s.cupsNumber ?? "").toLowerCase().includes(q)
    );
  });

  const handleShareAction = async (sim: SimulationItem) => {
    if (sim.publicToken) { setShareSim(sim); return; }
    const updated = await handleShare(sim);
    if (updated) setShareSim(updated);
  };

  const getPublicUrl = (sim: SimulationItem) => {
    if (!sim.publicToken) return null;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/sim/${sim.publicToken}`;
    }
    return `https://example.com/sim/${sim.publicToken}`;
  };

  const handleCopyUrl = async (sim: SimulationItem) => {
    const url = getPublicUrl(sim);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const columns: ColumnDef<SimulationItem>[] = [
    {
      key: "id",
      label: t("columns", "id"),
      width: "100",
      renderCell: (s) => (
        <span className="dt-cell-mono" style={{ opacity: s.isDeleted ? 0.5 : 1 }}>
          {s.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "owner",
      label: t("columns", "owner"),
      width: "150",
      renderCell: (s) => (
        <span className="dt-cell-primary" style={{ opacity: s.isDeleted ? 0.5 : 1 }}>
          {s.ownerUser?.fullName ?? "—"}
        </span>
      ),
    },
    {
      key: "client",
      label: t("columns", "client"),
      width: "200",
      renderCell: (s) => {
        const payload = s.payloadJson as { type?: string; schemaVersion?: string } | null;
        let commodityIcon: React.ReactNode;

        if (payload?.type === "ELECTRICITY") {
          commodityIcon = <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />;
        } else if (payload?.type === "GAS") {
          commodityIcon = <LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} />;
        } else if (payload?.type === "BOTH") {
          commodityIcon = (
            <>
              <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
              <LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} />
            </>
          );
        } else {
          commodityIcon = <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />;
        }

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: s.isDeleted ? 0.5 : 1 }}>
            {commodityIcon}
            <span className="dt-cell-primary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.client?.name || <span style={{ color: "var(--scheme-neutral-500)", fontStyle: "italic" }}>{t("status", "noClient")}</span>}
            </span>
          </div>
        );
      },
    },
    {
      key: "cups",
      label: t("columns", "cups"),
      width: "130",
      renderCell: (s) => (
        <span className="dt-cell-mono" style={{ opacity: s.isDeleted ? 0.5 : 1, fontSize: 12, whiteSpace: "nowrap" }}>
          {s.cupsNumber || <span style={{ color: "var(--scheme-neutral-600)" }}>—</span>}
        </span>
      ),
    },
    {
      key: "status",
      label: t("columns", "status"),
      width: "110",
      renderCell: (s) => <StatusBadge label={s.status} tone={simulationStatusTone(s.status)} />,
    },
    {
      key: "pin",
      label: "PIN",
      width: "70",
      renderCell: (s) => (
        <span className="dt-cell-mono" style={{ fontSize: 13, letterSpacing: "0.12em", opacity: s.isDeleted ? 0.4 : 1 }}>
          {s.pinSnapshot ?? <span style={{ color: "var(--scheme-neutral-600)" }}>—</span>}
        </span>
      ),
    },
    {
      key: "expiresAt",
      label: t("columns", "expires"),
      width: "120",
      renderCell: (s) => (
        <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>
          {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      width: "220",
      renderCell: (s) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)" }}>
            {s.ownerUser?.fullName || "—"}
          </span>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      renderCell: (s) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)" }}>
            {s.ownerUser?.fullName || "—"}
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      width: "360",
      renderCell: (s) => {
        const isShared = s.status === "SHARED";
        const canArchive = !s.isDeleted && canDo(session.user.role, "simulations.archive");
        const canShare = canDo(session.user.role, "simulations.share");
        const canDuplicate = canDo(session.user.role, "simulations.duplicate");
        const canCreate = canDo(session.user.role, "simulations.create");

        return (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {!isShared && canCreate && (
              <button
                className="dt-action-btn dt-action-btn--primary"
                onClick={() => router.push(`/internal/simulations/${s.id}`)}
              >
                {t("actions", "simulate")}
              </button>
            )}
            <button className="dt-action-btn" onClick={() => router.push(`/internal/simulations/${s.id}/view`)}>{t("actions", "view")}</button>
            {!isShared && canShare && (
              <button
                className="dt-action-btn"
                onClick={() => router.push(`/internal/simulations/${s.id}/share`)}
              >
                {t("actions", "share")}
              </button>
            )}
            {canDuplicate && (
              <button
                className="dt-action-btn"
                onClick={() => handleClone(s)}
                disabled={busyAction === `clone-${s.id}`}
              >
                {t("actions", "duplicate")}
              </button>
            )}
            {canArchive && (
              <button
                className="dt-action-btn dt-action-btn--danger"
                onClick={() => setConfirmArchiveSim(s)}
              >
                {t("actions", "archive")}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Column gap="24">
      <div className="section-header">
        <div>
          <h2 className="section-title">{t("nav", "simulations")}</h2>
          <p className="section-subtitle">{t("simulationsModule", "subtitle")}</p>
        </div>
        <div className="section-actions">
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
          </Button>
          <Button variant="outlined" size="small" onClick={() => refresh()} disabled={loading}>
            <SyncIcon fontSize="small" /> {t("actions", "refresh")}
          </Button>
          {canDo(session.user.role, "simulations.create") && (
            <Button variant="contained" size="small" onClick={() => router.push("/internal/simulations/new")}>
              {t("actions", "newSimulation")}
            </Button>
          )}
        </div>
      </div>

      <DataTable<SimulationItem>
        columns={columns}
        rows={filtered}
        loading={loading && !simulations.length}
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder={t("search", "simulations")}
        emptyMessage={t("search", "emptySimulations")}
        headerRight={<span className="dt-meta-pill">{simulations.length} total</span>}
      />

      {/* ── Edit payload panel ── */}
      <SlidePanel
        open={!!selectedSimulationId}
        onClose={closeSimulationEditor}
        title={t("simulationsModule", "editPayloadTitle")}
        subtitle={selectedSimulationId ? `ID: ${selectedSimulationId.slice(0, 12)}…` : undefined}
        width={600}
        footer={
          <>
            <button className="sp-btn-secondary" onClick={() => { closeSimulationEditor(); clearFeedback(); }}>{t("actions", "cancel")}</button>
            <button
              className="sp-btn-primary"
              disabled={busyAction === "update-simulation"}
              onClick={(e) => handleUpdateSimulation(e as unknown as React.FormEvent)}
            >
              {busyAction === "update-simulation" ? t("actions", "saving") : t("actions", "saveChanges")}
            </button>
          </>
        }
      >
        {errorText && <div className="sp-panel-error">{errorText}</div>}
        <div className="sp-form-group" style={{ flex: 1 }}>
          <label className="sp-form-label">{t("simulationsModule", "payloadJson")}</label>
          <textarea
            className="sp-form-textarea"
            style={{ minHeight: 360, fontFamily: "monospace", fontSize: 13 }}
            value={editPayloadJson}
            onChange={(e) => setEditPayloadJson(e.target.value)}
          />
        </div>
      </SlidePanel>

      {/* ── Share popup ── */}
      <Dialog
        open={!!shareSim}
        onClose={() => setShareSim(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>{t("simulationsModule", "shareTitle")}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3, pb: 3 }}>
          {shareSim && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Status
                </Typography>
                <StatusBadge label={shareSim.status} tone={simulationStatusTone(shareSim.status)} />
              </Box>
              {shareSim.publicToken ? (
                <>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t("simulationsModule", "publicUrl")}
                    </Typography>
                    <TextField
                      fullWidth
                      value={getPublicUrl(shareSim) ?? ""}
                      slotProps={{
                        input: {
                          readOnly: true,
                          style: { fontFamily: "monospace", fontSize: 13 },
                        },
                      }}
                      size="small"
                    />
                  </Box>
                  {shareSim.expiresAt && (
                    <Typography variant="caption" color="text.secondary">
                      Expires: {new Date(shareSim.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography color="text.secondary">
                  {t("simulationsModule", "notShared")}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShareSim(null)} variant="outlined">
            {t("actions", "done")}
          </Button>
          {shareSim?.publicToken && (
            <Button
              onClick={() => handleCopyUrl(shareSim)}
              variant="contained"
              autoFocus
            >
              {copiedUrl ? t("actions", "copied") : t("actions", "copyUrl")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {confirmArchiveSim && (
        <ConfirmDialog
          title={t("simulationsModule", "archiveTitle")}
          message={t("simulationsModule", "archiveConfirm", { id: confirmArchiveSim.id.slice(0, 8) + "…" })}
          confirmLabel={t("actions", "archive")}
          busy={busyAction === `delete-\${confirmArchiveSim.id}`}
          onConfirm={async () => {
            await handleArchive(confirmArchiveSim);
            setConfirmArchiveSim(null);
          }}
          onCancel={() => setConfirmArchiveSim(null)}
        />
      )}
    </Column>
  );
}
