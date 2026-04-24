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
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { ClientItem } from "../../lib/internalApi";
import { isAdmin, isAgent } from "../../lib/internalApi";
import type { ClientsActions } from "../hooks/useClients";
import { ConfirmDialog } from "../shared";
import { DataTable, StatusBadge } from "../ui";
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
  const {
    clients, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    showArchived, setShowArchived,
    handleToggleClientStatus, handleSoftDeleteClient,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<ClientItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClientItem | null>(null);
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

  // Single params-key ref to avoid double-fetch in React 18 Strict Mode
  const paramsRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${page}|${pageSize}|${sortColumn}|${sortDir}|${search}|${showArchived}`;
    if (paramsRef.current === key) return;
    paramsRef.current = key;
    refresh();
  }, [page, pageSize, sortColumn, sortDir, search, showArchived]);

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

        const secondaryItems: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> = [];
        secondaryItems.push({
          label: c.isActive ? t("actions", "deactivate") : t("actions", "activate"),
          onClick: () => setConfirmToggle(c),
          danger: c.isActive,
        });
        secondaryItems.push({
          label: t("actions", "delete"),
          onClick: () => setConfirmDelete(c),
          danger: true,
        });

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            <ButtonGroup variant="outlined" size="small">
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

  const canManage = isAdmin(session.user.role) || isAgent(session.user.role);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    if (canManage) {
      onActionButtons?.(
        <>
          <Button
            variant="outlined"
            size="small"
            onClick={() => refresh()}
            disabled={loading}
            loading={loading}
          >
            <SyncIcon fontSize="small" />&nbsp;{t("actions", "refresh")}
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
          <Link href="/internal/clients/new" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="small">{t("actions", "newClient")}</Button>
          </Link>
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
    <Stack spacing={3}>
      <DataTable<ClientItem>
        columns={columns}
        rows={clients}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t("search", "clients")}
        emptyMessage={t("search", "emptyClients")}
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
      />

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
          message={t("clientsModule", "deleteConfirm", { name: confirmDelete.name })}
          confirmLabel={t("actions", "delete")}
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
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
