"use client";

import {
  Box,
  Button,
  Stack,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ButtonGroup,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Link from "next/link";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, RotatePinResult } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import type { UsersActions } from "../hooks/useUsers";
import { ConfirmDialog, PinResultDialog } from "../shared";
import { DataTable, StatusBadge, FormSelect, FormInput } from "../ui";
import type { ColumnDef } from "../ui";
import { RefreshIcon } from "../ui/icons";
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import FiberPinIcon from '@mui/icons-material/FiberPin';
import { useI18n } from "../../../../src/lib/i18n-context";

interface UsersModuleProps {
  session: SessionState;
  actions: UsersActions;
  agencies: AgencyItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

type UserItem = UsersActions["users"] extends (infer T)[] ? T : never;

export function UsersModule({ session, actions, agencies, onNotify, onActionButtons }: UsersModuleProps) {
  const { t } = useI18n();
  const {
    users, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    roleFilter, setRoleFilter,
    agencyFilter, setAgencyFilter,
    showArchived, setShowArchived,
    selectedUserId, editUserName, setEditUserName, editUserEmail, setEditUserEmail,
    editUserPassword, setEditUserPassword, editUserCurrentPassword, setEditUserCurrentPassword,
    openUserEditor, closeUserEditor, handleUpdateUser,
    handleToggleUserStatus, handleRotateUserPin,
    handleDeleteUser, handleBulkDeleteUsers,
  } = actions;

  const [lastPinResult, setLastPinResult] = useState<RotatePinResult | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState<UserItem | null>(null);
  const [confirmPinRotateUser, setConfirmPinRotateUser] = useState<UserItem | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserItem | null>(null);
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

  // Single effect handles both the initial fetch and pagination/sort/search changes.
  // Using a params-key ref makes it safe under React 18 Strict Mode double-mounting:
  // on the second mount the key is already set so the duplicate call is skipped.
  const paramsRef = useRef("");
  useEffect(() => {
    const key = `${page}|${pageSize}|${sortColumn}|${sortDir}|${search}|${roleFilter}|${agencyFilter}|${showArchived}`;
    if (paramsRef.current === key) return;
    paramsRef.current = key;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortColumn, sortDir, search, roleFilter, agencyFilter, showArchived]);

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

  const { canDo } = usePermissions();
  const role = session.user.role;

  const canCreateUsers = canDo(role, "users.create");
  const isAdminUser = isAdmin(role);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    console.log('UsersModule setting buttons, onActionButtons:', onActionButtons);
    onActionButtons?.(
      <>
        <Button variant="outlined" size="small" onClick={() => refresh()} disabled={loading} loading={loading}><SyncIcon fontSize="small" /> {t("actions", "refresh")}</Button>
        {isAdminUser && (
          <Button
            variant={showArchived ? "contained" : "outlined"}
            size="small"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
          </Button>
        )}
        {canCreateUsers && (
          <Link href="/internal/users/new" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="small">{t("actions", "newUser")}</Button>
          </Link>
        )}
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, refresh, loading, canCreateUsers, isAdminUser, showArchived, setShowArchived, t]);

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
          {new Date(u.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
          {new Date(u.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
      renderCell: (u) => {
        const canEdit = canDo(role, "users.edit");
        const canToggle = canDo(role, "users.deactivate");
        const canRotatePin = canDo(role, "users.edit");
        const canDelete = canDo(role, "users.edit");

        const primaryLabel = t("actions", "edit");
        const primaryOnClick = () => window.location.href = `/internal/users/${u.id}/edit`;

        const secondaryItems: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> = [];
        if (canToggle) {
          secondaryItems.push({
            label: u.isActive ? t("actions", "deactivate") : t("actions", "activate"),
            onClick: () => setConfirmToggleUser(u),
            danger: u.isActive,
          });
        }
        if (canRotatePin) {
          secondaryItems.push({
            label: t("actions", "rotatePin"),
            onClick: () => setConfirmPinRotateUser(u),
          });
        }
        if (canDelete) {
          secondaryItems.push({
            label: t("actions", "delete"),
            onClick: () => setConfirmDeleteUser(u),
            danger: true,
          });
        }

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            {canEdit ? (
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
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <Stack spacing={3}>
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
        t={t}
        massActions={[
          {
            label: t("actions", "delete"),
            color: "error",
            icon: <DeleteOutlineIcon fontSize="small" />,
            onClick: (ids) => setConfirmBulkDeleteIds(ids),
          },
        ]}
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
            <Box sx={{ width: 280 }}>
              <FormSelect
                label=""
                options={[
                  { value: "", label: t("search", "allRoles") },
                  { value: "ADMIN", label: "ADMIN" },
                  { value: "AGENT", label: "AGENT" },
                  { value: "COMMERCIAL", label: "COMMERCIAL" },
                ]}
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val as string);
                  setPage(1);
                }}
                placeholder={t("columns", "role")}
                textFieldProps={{ size: "small" }}
              />
            </Box>
            {isAdmin(role) && (
              <Box sx={{ width: 280 }}>
                <FormSelect
                  label=""
                  options={[
                    { value: "", label: t("search", "allAgencies") },
                    ...agencies.map((agency) => ({
                      value: agency.id,
                      label: agency.name,
                    })),
                  ]}
                  value={agencyFilter}
                  onChange={(val) => {
                    setAgencyFilter(val as string);
                    setPage(1);
                  }}
                  placeholder={t("columns", "agency")}
                  textFieldProps={{ size: "small" }}
                />
              </Box>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={commitSearch}
              aria-label="Search"
              sx={{
                minWidth: 'auto',
              }}
            >
              <SearchIcon />
              {t("common", "search")}
            </Button>
          </>
        )}
      />

      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("usersModule", "bulkDeleteTitle")}
          message={t("usersModule", "bulkDeleteConfirm", { count: confirmBulkDeleteIds.length })}
          confirmLabel={t("actions", "delete")}
          busy={busyAction === "bulk-delete-users"}
          onConfirm={async () => {
            await handleBulkDeleteUsers(confirmBulkDeleteIds);
            setConfirmBulkDeleteIds(null);
          }}
          onCancel={() => setConfirmBulkDeleteIds(null)}
        />
      )}

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

      {confirmDeleteUser && (
        <ConfirmDialog
          title={t("usersModule", "deleteTitle")}
          message={t("usersModule", "deleteConfirm", { name: confirmDeleteUser.fullName })}
          confirmLabel={t("actions", "delete")}
          busy={busyAction === `delete-user-${confirmDeleteUser.id}`}
          onConfirm={async () => {
            await handleDeleteUser(confirmDeleteUser);
            setConfirmDeleteUser(null);
          }}
          onCancel={() => setConfirmDeleteUser(null)}
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
