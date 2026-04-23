"use client";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { BaseValueSetItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { BaseValuesActions } from "../hooks/useBaseValues";
import { ConfirmDialog } from "../shared";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import Link from "next/link";
import { useI18n } from "../../../../src/lib/i18n-context";

interface BaseValuesModuleProps {
  session: SessionState;
  actions: BaseValuesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

// ─── Main module ─────────────────────────────────────────────────────────────

export function BaseValuesModule({ session, actions, onNotify, onActionButtons }: BaseValuesModuleProps) {
  const { t } = useI18n();
  const {
    baseValueSets, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    showArchived, setShowArchived,
    handleActivateBaseValueSet, handleArchiveBaseValueSet, handleToggleProduction, handleUploadFile,
  } = actions;

  const [confirmAction, setConfirmAction] = useState<{ id: string; type: "activate" | "archive" | "restore" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refresh();
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    refresh();
  }, [page, pageSize, sortColumn, sortDir, search, showArchived]);

  useEffect(() => {
    if (successText) { onNotify?.(successText, "success"); clearFeedback(); }
  }, [successText]);

  useEffect(() => {
    if (errorText) { onNotify?.(errorText, "error"); clearFeedback(); }
  }, [errorText]);

  const confirmTarget = baseValueSets.find((s) => s.id === confirmAction?.id);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsm") && !file.name.endsWith(".xlsx")) {
      onNotify?.("Please select an Excel file (.xlsm or .xlsx)", "error");
      return;
    }

    await handleUploadFile(file, false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const columns: ColumnDef<BaseValueSetItem>[] = [
    {
      key: "name",
      label: t("baseValuesModule", "colName"),
      sortable: true,
      renderCell: (s) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: s.isDeleted ? 0.5 : 1 }}>
          <Typography variant="body1">{s.name}</Typography>
          {s.isActive && (
            <Chip label="ACTIVE" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
          )}
        </Box>
      ),
    },
    {
      key: "scope",
      label: t("baseValuesModule", "colScope"),
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary">
          {s.scopeType === "AGENCY" ? t("baseValuesModule", "scopeAgency") : t("baseValuesModule", "scopeGlobal")}
        </Typography>
      ),
    },
    {
      key: "version",
      label: t("baseValuesModule", "colVersion"),
      renderCell: (s) => <Typography variant="body2" color="text.secondary">v{s.version}</Typography>,
    },
    {
      key: "items",
      label: t("baseValuesModule", "colItems"),
      renderCell: (s) => <Typography variant="body2">{s._count?.items ?? "—"}</Typography>,
    },
    {
      key: "createdBy",
      label: "Created By",
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary">
          {s.createdByUser?.fullName || "—"}
        </Typography>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(s.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Typography>
      ),
    },
    {
      key: "status",
      label: t("baseValuesModule", "colStatus"),
      renderCell: (s) => (
        <StatusBadge
          label={s.isDeleted ? t("baseValuesModule", "statusArchived") : s.isActive ? t("baseValuesModule", "statusActive") : t("baseValuesModule", "statusDraft")}
          tone={s.isDeleted ? "neutral" : s.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "production",
      label: t("baseValuesModule", "colProduction"),
      width: "100",
      renderCell: (s) => (
        <Tooltip
          title={s.isProduction ? t("baseValuesModule", "production_tooltip_on") : t("baseValuesModule", "production_tooltip_off")}
          arrow
          placement="top"
        >
          <IconButton
            onClick={() => !s.isProduction && handleToggleProduction(s)}
            size="small"
            disabled={s.isDeleted}
            sx={{
              color: s.isProduction ? "warning.main" : "text.disabled",
              cursor: s.isProduction ? "default" : "pointer",
            }}
          >
            {s.isProduction ? <StarIcon fontSize="small" /> : <StarOutlineIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      ),
    },
    {
      key: "actions",
      label: t("baseValuesModule", "colActions"),
      width: "160",
      renderCell: (s) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Tooltip title={t("baseValuesModule", "editSet_tooltip")} placement="top">
            <IconButton
              component={Link}
              href={`/internal/base-values/${s.id}/edit`}
              size="small"
              sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!s.isActive && !s.isDeleted && (
            <Tooltip title={t("baseValuesModule", "activate_tooltip")} placement="top">
              <IconButton
                onClick={() => setConfirmAction({ id: s.id, type: "activate" })}
                size="small"
                sx={{ color: "success.main" }}
              >
                <CheckCircleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!s.isDeleted && (
            <Tooltip title={t("baseValuesModule", "archive_tooltip")} placement="top">
              <IconButton
                onClick={() => setConfirmAction({ id: s.id, type: "archive" })}
                size="small"
                sx={{ color: "text.secondary", "&:hover": { color: "warning.main" } }}
              >
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {s.isDeleted && (
            <Tooltip title={t("baseValuesModule", "restore_tooltip")} placement="top">
              <IconButton
                onClick={() => setConfirmAction({ id: s.id, type: "restore" })}
                size="small"
                sx={{ color: "success.main" }}
              >
                <UnarchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  const canManage = isAdmin(session.user.role);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        <Button
          variant="outlined"
          size="small"
          onClick={() => { setShowArchived(!showArchived); setPage(1); }}
        >
          {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => refresh()}
          disabled={loading}
        >
          <SyncIcon fontSize="small" />&nbsp;{t("actions", "refresh")}
        </Button>
        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsm,.xlsx"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={busyAction === "upload-base-value-file"}
            >
              <UploadFileIcon fontSize="small" />&nbsp;
              {busyAction === "upload-base-value-file" ? "Uploading..." : "Upload Excel"}
            </Button>
            {/* <Link href="/internal/base-values/new" style={{ textDecoration: "none" }}>
              <Button variant="contained" size="small">{t("baseValuesModule", "newSet")}</Button>
            </Link> */}
          </>
        )}
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, showArchived, loading, canManage, refresh, t, busyAction, handleFileSelect, fileInputRef]);

  return (
    <Stack spacing={3}>
      <DataTable<BaseValueSetItem>
        columns={columns}
        rows={baseValueSets}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t("search", "baseValues")}
        emptyMessage={t("search", "emptyBaseValues")}
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

      {confirmAction && confirmTarget && (
        <ConfirmDialog
          title={
            confirmAction.type === "activate" ? t("baseValuesModule", "activateTitle")
              : confirmAction.type === "archive" ? t("baseValuesModule", "archiveTitle")
                : t("baseValuesModule", "restoreTitle")
          }
          message={
            confirmAction.type === "activate"
              ? t("baseValuesModule", "activateConfirm", { name: confirmTarget.name })
              : confirmAction.type === "archive"
                ? t("baseValuesModule", "archiveConfirm", { name: confirmTarget.name })
                : t("baseValuesModule", "restoreConfirm", { name: confirmTarget.name })
          }
          confirmLabel={
            confirmAction.type === "activate" ? t("actions", "activate")
              : confirmAction.type === "archive" ? t("actions", "archive")
                : t("actions", "restore")
          }
          busy={
            busyAction === `activate-base-value-${confirmAction.id}` ||
            busyAction === `archive-base-value-${confirmAction.id}`
          }
          onConfirm={async () => {
            if (confirmAction.type === "activate") await handleActivateBaseValueSet(confirmTarget);
            else await handleArchiveBaseValueSet(confirmTarget);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </Stack>
  );
}
