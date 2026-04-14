"use client";

import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useEffect, useRef, useState } from "react";
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
}

export function ClientsModule({ session, actions, onNotify }: ClientsModuleProps) {
  const { t } = useI18n();
  const {
    clients, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    handleToggleClientStatus, handleSoftDeleteClient,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<ClientItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClientItem | null>(null);

  // Single params-key ref to avoid double-fetch in React 18 Strict Mode
  const paramsRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${page}|${pageSize}|${sortColumn}|${sortDir}|${search}`;
    if (paramsRef.current === key) return;
    paramsRef.current = key;
    refresh();
  }, [page, pageSize, sortColumn, sortDir, search]);

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
          {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            System
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
          {new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            System
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      width: "160",
      renderCell: (c) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Tooltip title={t("clientsModule", "editClient_tooltip")} placement="top">
            <IconButton
              component={Link}
              href={`/internal/clients/${c.id}/edit`}
              size="small"
              sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={c.isActive ? t("clientsModule", "deactivateClient_tooltip") : t("clientsModule", "activateClient_tooltip")} placement="top">
            <IconButton
              onClick={() => setConfirmToggle(c)}
              size="small"
              sx={{ color: c.isActive ? "error.main" : "success.main" }}
            >
              {c.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("clientsModule", "deleteClient_tooltip")} placement="top">
            <IconButton
              onClick={() => setConfirmDelete(c)}
              size="small"
              sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const canManage = isAdmin(session.user.role) || isAgent(session.user.role);

  if (!canManage) {
    return (
      <Stack spacing={2}>
        <h2 className="section-title">{t("nav", "clients")}</h2>
        <p className="section-subtitle">{t("clientsModule", "noPermission")}</p>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <div className="section-header">
        <div>
          <h2 className="section-title">{t("nav", "clients")}</h2>
          <p className="section-subtitle">{t("clientsModule", "subtitle")}</p>
        </div>
        <div className="section-actions">
          <Button
            variant="outlined"
            size="small"
            onClick={() => refresh()}
            disabled={loading}
            loading={loading}
          >
            <SyncIcon fontSize="small" />&nbsp;{t("actions", "refresh")}
          </Button>
          <Link href="/internal/clients/new" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="small">{t("actions", "newClient")}</Button>
          </Link>
        </div>
      </div>

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
        headerRight={<span className="dt-meta-pill">{total} total</span>}
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
          confirmLabel={t("common", "delete")}
          busy={busyAction === `delete-client-${confirmDelete.id}`}
          onConfirm={async () => {
            await handleSoftDeleteClient(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Stack>
  );
}
