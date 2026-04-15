"use client";

import {
  Box,
  Button,
  Stack,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, RotatePinResult } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { UsersActions } from "../hooks/useUsers";
import { ConfirmDialog, PinResultDialog } from "../shared";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import { RefreshIcon } from "../ui/icons";
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import FiberPinIcon from '@mui/icons-material/FiberPin';
import { useI18n } from "../../../../src/lib/i18n-context";

interface UsersModuleProps {
  session: SessionState;
  actions: UsersActions;
  agencies: AgencyItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
}

type UserItem = UsersActions["users"] extends (infer T)[] ? T : never;

export function UsersModule({ session, actions, agencies, onNotify }: UsersModuleProps) {
  const { t } = useI18n();
  const {
    users, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    selectedUserId, editUserName, setEditUserName, editUserEmail, setEditUserEmail,
    editUserPassword, setEditUserPassword, editUserCurrentPassword, setEditUserCurrentPassword,
    openUserEditor, closeUserEditor, handleUpdateUser,
    handleToggleUserStatus, handleRotateUserPin,
  } = actions;

  const [lastPinResult, setLastPinResult] = useState<RotatePinResult | null>(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState<UserItem | null>(null);
  const [confirmPinRotateUser, setConfirmPinRotateUser] = useState<UserItem | null>(null);

  // Single effect handles both the initial fetch and pagination/sort/search changes.
  // Using a params-key ref makes it safe under React 18 Strict Mode double-mounting:
  // on the second mount the key is already set so the duplicate call is skipped.
  const paramsRef = useRef("");
  useEffect(() => {
    const key = `${page}|${pageSize}|${sortColumn}|${sortDir}|${search}`;
    if (paramsRef.current === key) return;
    paramsRef.current = key;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortColumn, sortDir, search]);

  // Bubble success up
  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  // Bubble errors up only when the edit drawer is closed (toggle / rotate-PIN errors).
  // When the drawer is open, errorText is displayed inline inside it.
  useEffect(() => {
    if (errorText && !selectedUserId) {
      onNotify?.(errorText, "error");
      clearFeedback();
    }
  }, [errorText]);

  const canCreateUsers = isAdmin(session.user.role) || session.user.role === "AGENT";
  const editingOwnUser = selectedUserId === session.user.id;

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "name",
      label: t("columns", "name"),
      sortable: true,
      renderCell: (u) => (
        <Box >
          <Typography variant="body1">
            {u.fullName}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {u.email}
          </Typography>
        </Box>
      ),
    },
    {
      key: "role",
      label: t("columns", "role"),
      renderCell: (u) => (
        <StatusBadge
          label={u.role}
          tone={u.role === "ADMIN" ? "brand" : u.role === "AGENT" ? "accent" : "neutral"}
        />
      ),
    },
    {
      key: "agency",
      label: t("columns", "agency"),
      renderCell: (u) => (
        <span className="dt-cell-secondary">
          {agencies.find((a) => a.id === u.agencyId)?.name ?? u.agencyId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "status",
      label: t("columns", "status"),
      renderCell: (u) => (
        <StatusBadge label={u.isActive ? t("status", "active") : t("status", "inactive")} tone={u.isActive ? "success" : "neutral"} />
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      width: "220",
      sortable: true,
      renderCell: (u) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {u.createdByUser?.fullName ?? "—"}
          </span>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (u) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(u.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {u.updatedByUser?.fullName ?? "—"}
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      width: "140",
      renderCell: (u) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title={t("usersModule", "editUser_tooltip")} placement="top">
            <IconButton
              component={Link}
              href={`/internal/users/${u.id}/edit`}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={u.isActive ? t("usersModule", "deactivateUser_tooltip") : t("usersModule", "activateUser_tooltip")} placement="top">
            <IconButton
              size="small"
              onClick={() => setConfirmToggleUser(u)}
              sx={{ color: u.isActive ? 'error.main' : 'success.main', '&:hover': { bgcolor: u.isActive ? 'error.50' : 'success.50' } }}
            >
              {u.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("usersModule", "rotatePin_tooltip")} placement="top">
            <IconButton
              size="small"
              onClick={() => setConfirmPinRotateUser(u)}
              sx={{ color: 'info.main', '&:hover': { bgcolor: 'info.50' } }}
            >
              <FiberPinIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <div className="section-header">
        <div>
          <h2 className="section-title">{t("nav", "users")}</h2>
          <p className="section-subtitle">{t("usersModule", "subtitle")}</p>
        </div>
        <div className="section-actions">
          <Button variant="outlined" size="small" onClick={() => refresh()} disabled={loading} loading={loading}><SyncIcon fontSize="small" /> {t("actions", "refresh")}</Button>
          {canCreateUsers && (
            <Link href="/internal/users/new" style={{ textDecoration: "none" }}>
              <Button variant="contained" size="small">{t("actions", "newUser")}</Button>
            </Link>
          )}
        </div>
      </div>

      {lastPinResult && (
        <PinResultDialog
          pin={lastPinResult.newPin}
          onClose={() => setLastPinResult(null)}
        />
      )}

      <DataTable<UserItem>
        columns={columns}
        rows={users}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t("search", "users")}
        emptyMessage={t("search", "emptyUsers")}
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

      <Drawer
        anchor="right"
        open={!!selectedUserId}
        onClose={() => { closeUserEditor(); clearFeedback(); }}
        PaperProps={{
          sx: { width: 600, p: 3 }
        }}
      >
        <Typography variant="h3" sx={{ mb: 3 }}>{t("usersModule", "editUser")}</Typography>

        {errorText && <Box sx={{ mb: 2, p: 1.5, bgcolor: "error.light", color: "error.contrastText", borderRadius: 1 }}><Typography variant="body2">{errorText}</Typography></Box>}

        <Stack spacing={2}>
          <div className="sp-form-group">
            <label className="sp-form-label">{t("usersModule", "fullName")}</label>
            <input className="sp-form-input" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">{t("auth", "email")}</label>
            <input className="sp-form-input" type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} />
          </div>
          {editingOwnUser && (
            <div className="sp-form-group">
              <label className="sp-form-label">{t("usersModule", "currentPassword")}</label>
              <input className="sp-form-input" type="password" value={editUserCurrentPassword} onChange={(e) => setEditUserCurrentPassword(e.target.value)} />
              <span className="sp-form-hint">{t("usersModule", "currentPasswordHint")}</span>
            </div>
          )}
          <div className="sp-form-group">
            <label className="sp-form-label">{t("usersModule", "newPassword")}</label>
            <input className="sp-form-input" type="password" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} />
            <span className="sp-form-hint">{t("usersModule", "newPasswordHint")}</span>
          </div>
        </Stack>

        <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <button className="sp-btn-secondary" onClick={() => { closeUserEditor(); clearFeedback(); }}>{t("actions", "cancel")}</button>
          <button
            className="sp-btn-primary"
            disabled={busyAction === "update-user"}
            onClick={(e) => handleUpdateUser(e as unknown as React.FormEvent)}
          >
            {busyAction === "update-user" ? t("actions", "saving") : t("actions", "saveChanges")}
          </button>
        </Box>
      </Drawer>

      {confirmToggleUser && (
        <ConfirmDialog
          title={t("usersModule", "toggleTitle")}
          message={t("usersModule", "toggleConfirm", { action: confirmToggleUser.isActive ? t("actions", "deactivate").toLowerCase() : t("actions", "activate").toLowerCase(), name: confirmToggleUser.fullName })}
          confirmLabel={t("actions", "confirm")}
          busy={busyAction === `toggle-user-${confirmToggleUser.id}`}
          onConfirm={async () => {
            await handleToggleUserStatus(confirmToggleUser);
            setConfirmToggleUser(null);
          }}
          onCancel={() => setConfirmToggleUser(null)}
        />
      )}

      {confirmPinRotateUser && (
        <ConfirmDialog
          title={t("usersModule", "rotateTitle")}
          message={t("usersModule", "rotateConfirm", { name: confirmPinRotateUser.fullName })}
          confirmLabel={t("actions", "rotatePin")}
          busy={busyAction === `rotate-user-${confirmPinRotateUser.id}`}
          onConfirm={async () => {
            const result = await handleRotateUserPin(confirmPinRotateUser);
            if (result) setLastPinResult(result);
            setConfirmPinRotateUser(null);
          }}
          onCancel={() => setConfirmPinRotateUser(null)}
        />
      )}
    </Stack>
  );
}
