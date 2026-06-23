"use client";

import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  ButtonGroup,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useEffect, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { ClientItem, AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { ClientsActions } from "../hooks/useClients";
import { useAgencies } from "../hooks/useAgencies";
import { usePermissions } from "../../lib/permissionsContext";
import { ConfirmDialog } from "../shared";
import { DataTable, StatusBadge, FormSelect, FormInput } from "../ui";
import type { ColumnDef } from "../ui";
import Link from "next/link";
import { useI18n } from "../../../../src/lib/i18n-context";

interface ClientsModuleProps {
  session: SessionState;
  actions: ClientsActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

export function ClientsModule({ session, actions, onNotify, onActionButtons }: ClientsModuleProps) {
  const { t } = useI18n();
  const { canDo } = usePermissions();
  const role = session.user.role;
  const {
    clients, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    showArchived, setShowArchived,
    agencyId, setAgencyId,
    handleToggleClientStatus, handleSoftDeleteClient, handleBulkDeleteClients,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<ClientItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClientItem | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const { agencies } = useAgencies(session, 1000, { queryEnabled: isAdmin(role), minimal: true });
  const bulkDeleteIncludesArchived = Boolean(
    confirmBulkDeleteIds?.some((id) => clients.find((client) => client.id === id)?.isDeleted),
  );
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

  useEffect(() => {
    if (successText) { onNotify?.(successText, "success"); clearFeedback(); }
  }, [successText]);

  useEffect(() => {
    if (errorText) { onNotify?.(errorText, "error"); clearFeedback(); }
  }, [errorText]);

  const columns: ColumnDef<ClientItem>[] = [
    {
      key: "name",
      label: t("columns", "company"),
      sortable: true,
      copyable: true,
      copyText: (c) => [c.name, c.cif ? `CIF: ${c.cif}` : ''].filter(Boolean).join(', '),
      renderCell: (c) => (
        <Stack spacing={0}>
          <Typography variant="body1" fontWeight={500}>{c.name}</Typography>
          {c.cif && (
            <Typography variant="caption" color="text.secondary">
              CIF: {c.cif}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      key: "contactName",
      label: t("columns", "contact"),
      copyable: true,
      copyText: (c) => [c.contactName, c.contactPhone].filter(Boolean).join(', '),
      renderCell: (c) => (
        <Stack spacing={0}>
          {c.contactName ? (
            <Typography variant="body2">{c.contactName}</Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          )}
          {c.contactPhone && (
            <Typography variant="caption" color="text.secondary">{c.contactPhone}</Typography>
          )}
        </Stack>
      ),
    },
    {
      key: "status",
      label: t("columns", "status"),
      renderCell: (c) => (
        <StatusBadge label={c.isActive ? t("status", "active") : t("status", "inactive")} tone={c.isActive ? "success" : "neutral"} />
      ),
    },
    {
      key: "agency",
      label: t("columns", "agency"),
      copyable: true,
      copyText: (c) => c.agency?.name ?? '',
      renderCell: (c) => (
        <Typography variant="body2">
          {c.agency?.name ?? <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>—</span>}
        </Typography>
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      width: "220",
      sortable: true,
      renderCell: (c) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(c.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {c.createdByUser ? `${c.createdByUser.fullName}` : "System"}
          </span>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (c) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(c.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {c.updatedByUser ? `${c.updatedByUser.fullName}` : "System"}
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      renderCell: (c) => {
        const primaryLabel = t("actions", "edit");
        const primaryOnClick = () => window.location.href = `/internal/clients/${c.id}/edit`;

        const secondaryItems: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }> = [];
        if (canDo(role, "clients.edit")) {
          secondaryItems.push({
            label: c.isActive ? t("actions", "deactivate") : t("actions", "activate"),
            onClick: () => setConfirmToggle(c),
            icon: c.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />,
            danger: c.isActive,
          });
        }
        const canDelete =
          (!c.isDeleted && canDo(role, "clients.delete")) ||
          (c.isDeleted && isAdmin(role));
        if (canDelete) {
          secondaryItems.push({
            label: t("actions", "delete"),
            onClick: () => setConfirmDelete(c),
            icon: <DeleteOutlineIcon fontSize="small" />,
            danger: true,
          });
        }

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            {canDo(role, "clients.edit") ? (
              <ButtonGroup variant="outlined" size="small">
                <Button
                  onClick={primaryOnClick}
                  startIcon={<EditIcon fontSize="small" />}
                  title={primaryLabel}
                  aria-label={primaryLabel}
                  sx={{
                    minWidth: "88px !important",
                    "@media (max-width: 1400px)": {
                      minWidth: "36px !important",
                      px: 0.75,
                      "& .MuiButton-startIcon": { mr: 0, ml: 0 },
                    },
                  }}
                >
                  <Box component="span" sx={{ "@media (max-width: 1400px)": { display: "none" } }}>
                    {primaryLabel}
                  </Box>
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
            ) : null}
          </div>
        );
      },
    },
  ];

  const canManage = canDo(role, "clients.view");

  // Render action buttons for topbar
  useLayoutEffect(() => {
    if (canManage) {
      onActionButtons?.(
        <>
          <Tooltip title={t("actions", "refresh")} arrow>
            <span className="topbar-action-wrap">
              <Button
                className="topbar-action topbar-action--compact"
                variant="outlined"
                size="small"
                onClick={() => refresh()}
                disabled={loading}
                loading={loading}
                startIcon={<SyncIcon fontSize="small" />}
                aria-label={t("actions", "refresh")}
              >
                <span className="topbar-action-label">{t("actions", "refresh")}</span>
              </Button>
            </span>
          </Tooltip>
          {isAdmin(role) && (
            <Tooltip title={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")} arrow>
              <span className="topbar-action-wrap">
                <Button
                  className="topbar-action topbar-action--compact"
                  variant={showArchived ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setShowArchived(!showArchived)}
                  startIcon={<ArchiveIcon fontSize="small" />}
                  aria-label={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
                >
                  <span className="topbar-action-label">
                    {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
                  </span>
                </Button>
              </span>
            </Tooltip>
          )}
          {canDo(role, "clients.create") && (
            <Tooltip title={t("actions", "newClient")} arrow>
              <span className="topbar-action-wrap">
                <Link href="/internal/clients/new" style={{ textDecoration: "none" }}>
                  <Button
                    className="topbar-action topbar-action--compact"
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    aria-label={t("actions", "newClient")}
                  >
                    <span className="topbar-action-label">{t("actions", "newClient")}</span>
                  </Button>
                </Link>
              </span>
            </Tooltip>
          )}
        </>
      );
    }
    return () => onActionButtons?.(null);
  }, [onActionButtons, canManage, refresh, loading, showArchived, setShowArchived, t, session.user.role]);

  if (!canManage) {
    return (
      <Stack spacing={2}>
        <p className="section-subtitle">{t("clientsModule", "noPermission")}</p>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ height: '100%', minHeight: 0 }}>
      <DataTable<ClientItem>
        tableId="clients"
        columns={columns}
        rows={clients}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onApplyFilters={(draft) => { setSearch(draft); setPage(1); }}
        onClearFilters={() => {
          setSearch("");
          setAgencyId("");
          setPage(1);
        }}
        searchPlaceholder={t("search", "clients")}
        emptyMessage={t("search", "emptyClients")}
        renderCustomSearch={({ draft, setDraft, commitSearch, searchPlaceholder }) => (
          <>
            <Box sx={{ width: 280 }}>
              <FormInput
                label=""
                placeholder={searchPlaceholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: draft ? (
                      <IconButton
                        size="small"
                        onClick={() => { setDraft(""); setSearch(""); setPage(1); }}
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
            {isAdmin(role) && agencies.length > 0 && (
              <Box sx={{ width: 240 }}>
                <FormSelect
                  label=""
                  options={[
                    { value: "", label: t("search", "allAgencies") ?? "All agencies" },
                    ...agencies.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  value={agencyId}
                  onChange={(val) => { setAgencyId(val as string); setPage(1); }}
                  placeholder={t("columns", "agency")}
                  textFieldProps={{ size: "small" }}
                />
              </Box>
            )}
          </>
        )}
        mobileCard={{
          title: "name",
          status: "status",
          actions: (c) => {
            const canEdit = canDo(role, "clients.edit");
            const canDelete =
              (!c.isDeleted && canDo(role, "clients.delete")) ||
              (c.isDeleted && isAdmin(role));
            const actionCount = [canEdit, canEdit, canDelete].filter(Boolean).length;

            if (actionCount === 0) return null;

            return (
              <Box sx={{ display: "grid", gridTemplateColumns: actionCount > 2 ? "repeat(2, 1fr)" : `repeat(${actionCount}, 1fr)`, gap: 0.75 }}>
                {canEdit && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => window.location.href = `/internal/clients/${c.id}/edit`}
                    startIcon={<EditIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {t("actions", "edit")}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outlined"
                    color={c.isActive ? "error" : "success"}
                    size="small"
                    onClick={() => setConfirmToggle(c)}
                    startIcon={c.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {c.isActive ? t("actions", "deactivate") : t("actions", "activate")}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setConfirmDelete(c)}
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {t("actions", "delete")}
                  </Button>
                )}
              </Box>
            );
          },
        }}
        sortState={{ column: sortColumn, direction: sortDir }}
        onSort={(col) => {
          const newDir = col === sortColumn && sortDir === "asc" ? "desc" : "asc";
          setSort(col, newDir);
          setPage(1);
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
        }}
        t={t}
        massActions={canDo(role, "clients.delete") ? [
          {
            label: t("actions", "delete"),
            color: "error",
            icon: <DeleteOutlineIcon fontSize="small" />,
            onClick: (ids) => setConfirmBulkDeleteIds(ids),
          },
        ] : []}
      />

      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("clientsModule", "bulkDeleteTitle")}
          message={t(
            "clientsModule",
            bulkDeleteIncludesArchived ? "bulkDeletePermanentConfirm" : "bulkDeleteConfirm",
            { count: confirmBulkDeleteIds.length },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={bulkDeleteIncludesArchived ? 5 : undefined}
          busy={busyAction === "bulk-delete-clients"}
          onConfirm={async () => {
            await handleBulkDeleteClients(confirmBulkDeleteIds);
            setConfirmBulkDeleteIds(null);
          }}
          onCancel={() => setConfirmBulkDeleteIds(null)}
        />
      )}

      {confirmToggle && (
        <ConfirmDialog
          title={`${confirmToggle.isActive ? t("actions", "deactivate") : t("actions", "activate")} ${t("nav", "clients").toLowerCase().replace(/s$/, "")}`}
          message={t("clientsModule", "toggleConfirm", { action: confirmToggle.isActive ? t("actions", "deactivate").toLowerCase() : t("actions", "activate").toLowerCase(), name: confirmToggle.name })}
          confirmLabel={t("actions", "confirm")}
          busy={busyAction === `toggle-client-${confirmToggle.id}`}
          onConfirm={async () => {
            await handleToggleClientStatus(confirmToggle);
            setConfirmToggle(null);
          }}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("clientsModule", "deleteTitle")}
          message={t(
            "clientsModule",
            confirmDelete.isDeleted ? "deletePermanentConfirm" : "deleteConfirm",
            { name: confirmDelete.name },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={confirmDelete.isDeleted ? 5 : undefined}
          busy={busyAction === `delete-client-${confirmDelete.id}`}
          onConfirm={async () => {
            await handleSoftDeleteClient(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Actions dropdown menu */}
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
              gap: 1,
            }}
          >
            {item.icon && (
              <Box component="span" sx={{ display: "inline-flex", width: 18, color: "inherit" }}>
                {item.icon}
              </Box>
            )}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
