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
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useLayoutEffect } from "react";
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
import AddIcon from '@mui/icons-material/Add';
import ArchiveIcon from '@mui/icons-material/Archive';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
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
  const router = useRouter();
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
  const bulkDeleteIncludesArchived = Boolean(
    confirmBulkDeleteIds?.some((id) => users.find((user) => user.id === id)?.isDeleted),
  );
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

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
  const canManageUserSessions = canDo(role, "users.sessions.manage");

  // Render action buttons for topbar
  useLayoutEffect(() => {
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
        {isAdminUser && (
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
        {canManageUserSessions && (
          <Tooltip title={t("userSessions", "openSessionsPage")} arrow>
            <span className="topbar-action-wrap">
              <Link href="/internal/users/sessions" style={{ textDecoration: "none" }}>
                <Button
                  className="topbar-action topbar-action--compact"
                  variant="outlined"
                  size="small"
                  startIcon={<ManageAccountsIcon fontSize="small" />}
                  aria-label={t("userSessions", "openSessionsPage")}
                >
                  <span className="topbar-action-label">{t("userSessions", "openSessionsPage")}</span>
                </Button>
              </Link>
            </span>
          </Tooltip>
        )}
        {canCreateUsers && (
          <Tooltip title={t("actions", "newUser")} arrow>
            <span className="topbar-action-wrap">
              <Link href="/internal/users/new" style={{ textDecoration: "none" }}>
                <Button
                  className="topbar-action topbar-action--compact"
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  aria-label={t("actions", "newUser")}
                >
                  <span className="topbar-action-label">{t("actions", "newUser")}</span>
                </Button>
              </Link>
            </span>
          </Tooltip>
        )}
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, refresh, loading, canCreateUsers, isAdminUser, canManageUserSessions, showArchived, setShowArchived, t]);

  const editingOwnUser = selectedUserId === session.user.id;

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "fullName",
      label: t("columns", "name"),
      sortable: true,
      copyable: true,
      copyText: (u) => [u.fullName, u.email].filter(Boolean).join(', '),
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
      sortable: true,
      renderCell: (u) => (
        <StatusBadge
          label={u.role === "SYS_ADMIN" ? t("userFormPage", "roleSysAdmin") : u.role === "ADMIN" ? t("userFormPage", "roleAdmin") : u.role === "AGENT" ? t("userFormPage", "roleAgent") : t("userFormPage", "roleCommercial")}
          tone={u.role === "SYS_ADMIN" ? "warning" : u.role === "ADMIN" ? "brand" : u.role === "AGENT" ? "accent" : "neutral"}
        />
      ),
    },
    {
      key: "agency",
      label: t("columns", "agency"),
      copyable: true,
      copyText: (u) => agencies.find((a) => a.id === u.agencyId)?.name ?? '',
      renderCell: (u) => (
        <Typography component="span" variant="body2" className="dt-cell-secondary">
          {agencies.find((a) => a.id === u.agencyId)?.name ?? u.agencyId.slice(0, 8)}
        </Typography>
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
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {new Date(u.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {u.createdByUser?.fullName ?? "—"}
          </Typography>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (u) => (
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {new Date(u.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {u.updatedByUser?.fullName ?? "—"}
          </Typography>
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
        const canDelete =
          (!u.isDeleted && canDo(role, "users.edit")) ||
          (u.isDeleted && isAdmin(role));

        const primaryLabel = t("actions", "edit");
        const primaryOnClick = () => router.push(`/internal/users/${u.id}/edit`);

        const secondaryItems: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }> = [];
        if (canToggle) {
          secondaryItems.push({
            label: u.isActive ? t("actions", "deactivate") : t("actions", "activate"),
            onClick: () => setConfirmToggleUser(u),
            icon: u.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />,
            danger: u.isActive,
          });
        }
        if (canRotatePin) {
          secondaryItems.push({
            label: t("actions", "rotatePin"),
            onClick: () => setConfirmPinRotateUser(u),
            icon: <FiberPinIcon fontSize="small" />,
          });
        }
        if (canDelete) {
          secondaryItems.push({
            label: t("actions", "delete"),
            onClick: () => setConfirmDeleteUser(u),
            icon: <DeleteOutlineIcon fontSize="small" />,
            danger: true,
          });
        }

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            {canEdit ? (
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

  return (
    <Stack spacing={3} sx={{ height: '100%', minHeight: 0 }}>
      {lastPinResult && (
        <PinResultDialog
          pin={lastPinResult.newPin}
          onClose={() => setLastPinResult(null)}
        />
      )}

      <DataTable<UserItem>
        tableId="users"
        columns={columns}
        rows={users}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onApplyFilters={(draft) => { setSearch(draft); setPage(1); }}
        onClearFilters={() => {
          setSearch("");
          setRoleFilter("");
          setAgencyFilter("");
          setPage(1);
        }}
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
            <Box sx={{ width: { xs: "100%", sm: 280 } }}>
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
            <Box sx={{ width: { xs: "100%", sm: 280 } }}>
              <FormSelect
                label=""
                options={[
                  { value: "", label: t("search", "allRoles") },
                  { value: "SYS_ADMIN", label: t("userFormPage", "roleSysAdmin") },
                  { value: "ADMIN", label: t("userFormPage", "roleAdmin") },
                  { value: "AGENT", label: t("userFormPage", "roleAgent") },
                  { value: "COMMERCIAL", label: t("userFormPage", "roleCommercial") },
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
              <Box sx={{ width: { xs: "100%", sm: 280 } }}>
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
          </>
        )}
        mobileCard={{
          title: "fullName",
          status: "status",
          actions: (u) => {
            const canEdit = canDo(role, "users.edit");
            const canToggle = canDo(role, "users.deactivate");
            const canRotatePin = canDo(role, "users.edit");
            const canDelete =
              (!u.isDeleted && canDo(role, "users.edit")) ||
              (u.isDeleted && isAdmin(role));
            const actionCount = [canEdit, canToggle, canRotatePin, canDelete].filter(Boolean).length;

            if (actionCount === 0) return null;

            return (
              <Box sx={{ display: "grid", gridTemplateColumns: actionCount > 2 ? "repeat(2, 1fr)" : `repeat(${actionCount}, 1fr)`, gap: 0.75 }}>
                {canEdit && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => router.push(`/internal/users/${u.id}/edit`)}
                    startIcon={<EditIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {t("actions", "edit")}
                  </Button>
                )}
                {canToggle && (
                  <Button
                    variant="outlined"
                    color={u.isActive ? "error" : "success"}
                    size="small"
                    onClick={() => setConfirmToggleUser(u)}
                    startIcon={u.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {u.isActive ? t("actions", "deactivate") : t("actions", "activate")}
                  </Button>
                )}
                {canRotatePin && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setConfirmPinRotateUser(u)}
                    startIcon={<FiberPinIcon fontSize="small" />}
                    sx={{ minWidth: 0 }}
                  >
                    {t("actions", "rotatePin")}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setConfirmDeleteUser(u)}
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
      />

      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("usersModule", "bulkDeleteTitle")}
          message={t(
            "usersModule",
            bulkDeleteIncludesArchived ? "bulkDeletePermanentConfirm" : "bulkDeleteConfirm",
            { count: confirmBulkDeleteIds.length },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={bulkDeleteIncludesArchived ? 5 : undefined}
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
          message={t(
            "usersModule",
            confirmDeleteUser.isDeleted ? "deletePermanentConfirm" : "deleteConfirm",
            { name: confirmDeleteUser.fullName },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={confirmDeleteUser.isDeleted ? 5 : undefined}
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
            sx={{color: item.danger ? "error.main" : "text.primary",
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
