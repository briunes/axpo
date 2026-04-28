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
  Menu,
  MenuItem,
  ButtonGroup,
  IconButton,
  Stack,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import ArchiveIcon from "@mui/icons-material/Archive";
import { useEffect, useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, ClientItem, SimulationItem, UserItem } from "../../lib/internalApi";
import { isAdmin, simulationStatusTone } from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import type { SimulationsActions } from "../hooks/useSimulations";
import { ConfirmDialog } from "../shared";
import { DataTable, SlidePanel, StatusBadge, FormInput, FormSelect } from "../ui";
import type { ColumnDef } from "../ui";

interface SimulationsModuleProps {
  session: SessionState;
  actions: SimulationsActions;
  agencies: AgencyItem[];
  clients: ClientItem[];
  users: UserItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

export function SimulationsModule({ session, actions, agencies, clients, users, onNotify, onActionButtons }: SimulationsModuleProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { canDo } = usePermissions();
  const {
    simulations, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize, sortColumn, sortDir, setSort,
    showArchived, setShowArchived,
    filterSearch, setFilterSearch,
    filterOwnerUserId, setFilterOwnerUserId,
    filterClientId, setFilterClientId,
    filterCups, setFilterCups,
    filterStatus, setFilterStatus,
    applyFilters, filtersAppliedAt,
    selectedSimulationId, editPayloadJson, setEditPayloadJson,
    openSimulationEditor, closeSimulationEditor, handleUpdateSimulation,
    handleShare, handleClone, handleRotatePin, handleOcrPrefill, handlePdfDownload, handleArchive,
    handleBulkDelete, handleBulkArchive,
  } = actions;

  const [shareSim, setShareSim] = useState<SimulationItem | null>(null);
  const [confirmArchiveSim, setConfirmArchiveSim] = useState<SimulationItem | null>(null);
  const [confirmDeleteSim, setConfirmDeleteSim] = useState<SimulationItem | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const [confirmBulkArchiveIds, setConfirmBulkArchiveIds] = useState<string[] | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

  // Refresh when pagination, sort, archived toggle, or filters are applied
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortColumn, sortDir, showArchived, filtersAppliedAt]);

  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        <Button variant="outlined" size="small" onClick={() => refresh()} disabled={loading}>
          <SyncIcon fontSize="small" /> {t("actions", "refresh")}
        </Button>
        {isAdmin(session.user.role) && (
          <Button
            variant={showArchived ? "contained" : "outlined"}
            size="small"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
          </Button>
        )}
        {canDo(session.user.role, "simulations.create") && (
          <Button variant="contained" size="small" onClick={() => router.push("/internal/simulations/new")}>
            {t("actions", "newSimulation")}
          </Button>
        )}
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, showArchived, loading, session.user.role, t, refresh, router, setShowArchived]);

  // Filter out archived unless showArchived is true (only client-side filter for isDeleted)
  const displayData = showArchived ? simulations : simulations.filter(s => !s.isDeleted);

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
      renderCell: (s) => {
        const payload = s.payloadJson as { electricity?: { clientData?: { cups?: string } }; gas?: { clientData?: { cups?: string } } } | null;
        const cupsElec = payload?.electricity?.clientData?.cups;
        const cupsGas = payload?.gas?.clientData?.cups;
        const cups = s.cupsNumber || cupsElec || cupsGas;

        return (
          <span className="dt-cell-mono" style={{ opacity: s.isDeleted ? 0.5 : 1, fontSize: 12, whiteSpace: "nowrap" }}>
            {cups ? (
              <span style={{ display: 'block' }}>
                {cupsElec && <div>{cupsElec}</div>}
                {cupsGas && cupsElec && <div style={{ fontSize: 11, opacity: 0.7 }}>{cupsGas}</div>}
                {!cupsElec && cupsGas && <div>{cupsGas}</div>}
              </span>
            ) : (
              <span style={{ color: "var(--scheme-neutral-600)" }}>—</span>
            )}
          </span>
        );
      },
    },
    {
      key: "status",
      label: t("columns", "status"),
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
      renderCell: (s) => (
        <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>
          {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
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
      renderCell: (s) => {
        const isShared = s.status === "SHARED";
        const canArchive = !s.isDeleted && canDo(session.user.role, "simulations.archive");
        const canDelete = !s.isDeleted && canDo(session.user.role, "simulations.delete");
        const canShare = canDo(session.user.role, "simulations.share");
        const canDuplicate = canDo(session.user.role, "simulations.duplicate");
        const canCreate = canDo(session.user.role, "simulations.create");

        const primaryLabel = isShared ? t("actions", "view") : t("actions", "simulate");
        const primaryVariant = isShared ? "outlined" : "outlined";
        const primaryOnClick = () => router.push(
          isShared ? `/internal/simulations/${s.id}/view` : `/internal/simulations/${s.id}`
        );

        const secondaryItems: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> = [];
        if (canDuplicate) {
          secondaryItems.push({ label: t("actions", "duplicate"), onClick: () => handleClone(s), disabled: busyAction === `clone-${s.id}` });
        }
        if (canArchive) {
          secondaryItems.push({ label: t("actions", "archive"), onClick: () => setConfirmArchiveSim(s), danger: true });
        }
        if (canDelete) {
          secondaryItems.push({ label: t("actions", "delete"), onClick: () => setConfirmDeleteSim(s), danger: true });
        }

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            <ButtonGroup variant={primaryVariant} size="small">
              <Button onClick={primaryOnClick}>
                {primaryLabel}
              </Button>
              {hasDropdown && (
                <Button
                  size="small"
                  onClick={(e) => setDropdownState({ anchorEl: e.currentTarget, items: secondaryItems })}
                  aria-label="More actions"
                  sx={{ px: 0.5, minWidth: 32 }}
                >
                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                </Button>
              )}
            </ButtonGroup>
          </div>
        );
      },
    },
  ];

  return (
    <Stack spacing={3}>
      <DataTable<SimulationItem>
        columns={columns}
        rows={displayData}
        loading={loading}
        searchValue={filterSearch}
        onSearch={(v) => { setFilterSearch(v); }}
        searchPlaceholder={t("search", "simulations")}
        emptyMessage={t("search", "emptySimulations")}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
        }}
        t={t}
        renderCustomSearch={({ draft, setDraft, commitSearch, searchPlaceholder }) => (
          <>
            <Box sx={{ width: 280 }}>
              <FormInput
                label=""
                placeholder={searchPlaceholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setFilterSearch(draft); applyFilters(); } }}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: draft ? (
                      <IconButton
                        size="small"
                        onClick={() => { setDraft(""); setFilterSearch(""); applyFilters(); }}
                        aria-label="Clear"
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null,
                  },
                }}
              />
            </Box>
            <Box sx={{ width: 280 }}>
              <FormSelect
                label=""
                options={[
                  { value: "", label: t("search", "allOwners") },
                  ...users
                    .filter(u => u.isActive)
                    .map(user => ({
                      value: user.id,
                      label: user.fullName || user.email,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                ]}
                value={filterOwnerUserId}
                onChange={(val) => {
                  setFilterOwnerUserId(val as string);
                }}
                placeholder="Owner"
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                textFieldProps={{ size: "small" }}
              />
            </Box>
            <Box sx={{ width: 280 }}>
              <FormSelect
                label=""
                options={[
                  { value: "", label: t("search", "allClients") },
                  ...clients
                    .filter(c => !c.isDeleted)
                    .map(client => ({
                      value: client.id,
                      label: client.name,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                ]}
                value={filterClientId}
                onChange={(val) => {
                  setFilterClientId(val as string);
                }}
                placeholder="Client"
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                textFieldProps={{ size: "small" }}
              />
            </Box>
            <Box sx={{ width: 280 }}>
              <FormInput
                label=""
                placeholder="CUPS"
                value={filterCups}
                onChange={(e) => { setFilterCups(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: filterCups ? (
                      <IconButton
                        size="small"
                        onClick={() => { setFilterCups(""); applyFilters(); }}
                        aria-label="Clear"
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null,
                  },
                }}
              />
            </Box>
            <Box sx={{ width: 280 }}>
              <FormSelect
                label=""
                options={[
                  { value: "", label: t("search", "allStatuses") },
                  { value: "DRAFT", label: "DRAFT" },
                  { value: "SHARED", label: "SHARED" },
                  { value: "EXPIRED", label: "EXPIRED" },
                ]}
                value={filterStatus}
                onChange={(val) => {
                  setFilterStatus(val as string);
                }}
                placeholder="Status"
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                textFieldProps={{ size: "small" }}
              />
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => { setFilterSearch(draft); applyFilters(); }}
              aria-label="Search"
            >
              <SearchIcon />
              {t('common', 'search')}
            </Button>
          </>
        )}
        massActions={[
          {
            label: t("actions", "delete"),
            color: "error",
            icon: <DeleteIcon />,
            onClick: (ids) => setConfirmBulkDeleteIds(ids),
          },
          {
            label: t("actions", "archive"),
            color: "warning",
            icon: <ArchiveIcon />,
            onClick: (ids) => setConfirmBulkArchiveIds(ids),
          },
        ]}
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
                      Expires: {new Date(shareSim.expiresAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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

      {confirmDeleteSim && (
        <ConfirmDialog
          title={t("simulationsModule", "deleteTitle")}
          message={t("simulationsModule", "deleteConfirm", { id: confirmDeleteSim.id.slice(0, 8) + "…" })}
          confirmLabel={t("actions", "delete")}
          busy={busyAction === `delete-${confirmDeleteSim.id}`}
          onConfirm={async () => {
            await handleArchive(confirmDeleteSim);
            setConfirmDeleteSim(null);
          }}
          onCancel={() => setConfirmDeleteSim(null)}
        />
      )}

      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("simulationsModule", "bulkDeleteTitle")}
          message={t("simulationsModule", "bulkDeleteConfirm", { count: confirmBulkDeleteIds.length })}
          confirmLabel={t("simulationsModule", "bulkDeleteConfirmLabel")}
          busy={busyAction === "bulk-delete"}
          onConfirm={async () => {
            await handleBulkDelete(confirmBulkDeleteIds);
            setConfirmBulkDeleteIds(null);
          }}
          onCancel={() => setConfirmBulkDeleteIds(null)}
        />
      )}

      {confirmBulkArchiveIds && (
        <ConfirmDialog
          title={t("simulationsModule", "bulkArchiveTitle")}
          message={t("simulationsModule", "bulkArchiveConfirm", { count: confirmBulkArchiveIds.length })}
          confirmLabel={t("simulationsModule", "bulkArchiveConfirmLabel")}
          busy={busyAction === "bulk-archive"}
          onConfirm={async () => {
            await handleBulkArchive(confirmBulkArchiveIds);
            setConfirmBulkArchiveIds(null);
          }}
          onCancel={() => setConfirmBulkArchiveIds(null)}
        />
      )}

      {/* ── Actions dropdown menu ── */}
      <Menu
        open={!!dropdownState.anchorEl}
        anchorEl={dropdownState.anchorEl}
        onClose={closeDropdown}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 150,
              borderRadius: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            },
          },
        }}
      >
        {dropdownState.items.map((item, i) => (
          <MenuItem
            key={i}
            onClick={() => { item.onClick(); closeDropdown(); }}
            disabled={item.disabled}
            sx={{
              fontSize: 13,
              color: item.danger ? "error.main" : "text.primary",
              py: 0.75,
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
