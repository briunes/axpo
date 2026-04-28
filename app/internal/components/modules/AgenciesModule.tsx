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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { AgenciesActions } from "../hooks/useAgencies";
import { ConfirmDialog } from "../shared";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import Link from "next/link";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AgenciesModuleProps {
  session: SessionState;
  actions: AgenciesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

export function AgenciesModule({ session, actions, onNotify, onActionButtons }: AgenciesModuleProps) {
  const { t } = useI18n();
  const {
    agencies, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    showArchived, setShowArchived,
    handleToggleAgencyStatus,
    handleDeleteAgency,
    handleBulkDeleteAgencies,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<AgencyItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AgencyItem | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refresh();
  }, []);

  // Re-fetch when pagination/sort/search change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    refresh();
  }, [page, pageSize, sortColumn, sortDir, search, showArchived]);

  // Bubble success up
  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  // Bubble errors
  useEffect(() => {
    if (errorText) {
      onNotify?.(errorText, "error");
      clearFeedback();
    }
  }, [errorText]);

  const expandingBtn = {
    minWidth: 0,
    width: 32,
    px: 0,
    overflow: "hidden",
    transition: "width 0.22s ease, padding 0.22s ease",
    "& .btn-label": {
      opacity: 0,
      width: 0,
      overflow: "hidden",
      whiteSpace: "nowrap",
      transition: "opacity 0.18s ease, width 0.22s ease",
    },
  };

  const columns: ColumnDef<AgencyItem>[] = [
    {
      key: "name",
      label: t("columns", "name"),
      sortable: true,
      renderCell: (a) => (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>{a.name}</Typography>
          {(a.city || a.province) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
              {[a.city, a.province].filter(Boolean).join(", ")}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: "address",
      label: t("columns", "address"),
      renderCell: (a) => {
        const hasAddress = a.street || a.city || a.postalCode;
        return (
          <Box>
            {hasAddress ? (
              <>
                {a.street && <Typography variant="body2" sx={{ fontSize: 13 }}>{a.street}</Typography>}
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                  {[a.postalCode, a.city].filter(Boolean).join(" ")}
                  {a.country && `, ${a.country}`}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                —
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "commercialUsers",
      label: t("columns", "commercialUsers"),
      renderCell: (a) => {
        const commercialUsers = a.users?.filter(u => u.role === "COMMERCIAL") || [];
        return (
          <Box>
            {commercialUsers.length > 0 ? (
              <Tooltip
                title={
                  <Box>
                    {commercialUsers.map(u => (
                      <Typography key={u.id} variant="body2" sx={{ fontSize: 12 }}>
                        {u.fullName} ({u.email})
                      </Typography>
                    ))}
                  </Box>
                }
                placement="top"
              >
                <Typography variant="body2" sx={{ cursor: "help" }}>
                  {commercialUsers.length} user{commercialUsers.length !== 1 ? "s" : ""}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {t("status", "noUsers")}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "status",
      label: t("columns", "status"),
      renderCell: (a) => (
        <StatusBadge
          label={a.isActive ? t("status", "active") : t("status", "inactive")}
          tone={a.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      width: "220",
      sortable: true,
      renderCell: (a) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(a.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {a.createdByUser ? `${a.createdByUser.fullName}` : "System"}
          </span>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (a) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(a.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {a.updatedByUser ? `${a.updatedByUser.fullName}` : "System"}
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      renderCell: (a) => {
        const primaryLabel = t("actions", "edit");
        const primaryOnClick = () => window.location.href = `/internal/agencies/${a.id}/edit`;

        const secondaryItems: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> = [];
        secondaryItems.push({
          label: a.isActive ? t("actions", "deactivate") : t("actions", "activate"),
          onClick: () => setConfirmToggle(a),
          danger: a.isActive,
        });
        secondaryItems.push({
          label: t("actions", "delete"),
          onClick: () => setConfirmDelete(a),
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

  const canManage = isAdmin(session.user.role);

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
          <Link href="/internal/agencies/new" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="small">{t("actions", "newAgency")}</Button>
          </Link>
        </>
      );
    }
    return () => onActionButtons?.(null);
  }, [onActionButtons, canManage, refresh, loading, showArchived, setShowArchived, t, session.user.role]);

  if (!canManage) {
    return (
      <Stack spacing={2}>
        <p className="section-subtitle">{t("agenciesModule", "noPermission")}</p>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <DataTable<AgencyItem>
        columns={columns}
        rows={agencies}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t("search", "agencies")}
        emptyMessage={t("search", "emptyAgencies")}
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
      />

      {/* ── Confirm bulk delete ──────────────────────────────────── */}
      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("agenciesModule", "bulkDeleteTitle")}
          message={t("agenciesModule", "bulkDeleteConfirm", { count: confirmBulkDeleteIds.length })}
          confirmLabel={t("actions", "delete")}
          busy={busyAction === "bulk-delete-agencies"}
          onConfirm={async () => {
            await handleBulkDeleteAgencies(confirmBulkDeleteIds);
            setConfirmBulkDeleteIds(null);
          }}
          onCancel={() => setConfirmBulkDeleteIds(null)}
        />
      )}

      {/* ── Confirm toggle ────────────────────────────────────────── */}
      {confirmToggle && (
        <ConfirmDialog
          title={`${confirmToggle.isActive ? t("actions", "deactivate") : t("actions", "activate")} ${t("agenciesModule", "toggleTitle")}`}
          message={t("agenciesModule", "toggleConfirm", { action: confirmToggle.isActive ? t("actions", "deactivate").toLowerCase() : t("actions", "activate").toLowerCase(), name: confirmToggle.name })}
          confirmLabel={t("actions", "confirm")}
          busy={busyAction === `toggle-agency-${confirmToggle.id}`}
          onConfirm={async () => {
            await handleToggleAgencyStatus(confirmToggle);
            setConfirmToggle(null);
          }}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("agenciesModule", "deleteTitle")}
          message={t("agenciesModule", "deleteConfirm", { name: confirmDelete.name })}
          confirmLabel={t("actions", "delete")}
          busy={busyAction === `delete-agency-${confirmDelete.id}`}
          onConfirm={async () => {
            await handleDeleteAgency(confirmDelete);
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
