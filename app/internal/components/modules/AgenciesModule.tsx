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
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useEffect, useMemo, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { AgenciesActions } from "../hooks/useAgencies";
import { ConfirmDialog } from "../shared";
import {
  DataTable,
  FormSelect,
  SaveTableViewDialog,
  StatusBadge,
  TableFilterButton,
  TableFiltersDialog,
  TableViewSearchControls,
  useTableViews,
} from "../ui";
import type { ColumnDef } from "../ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AgenciesModuleProps {
  session: SessionState;
  actions: AgenciesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

type AgenciesViewState = {
  tlvFilter: string;
  statusFilter: string;
  showArchived: boolean;
  sortColumn: string;
  sortDir: "asc" | "desc";
};

const AGENCY_VIEWS_STORAGE_KEY = "axpo_agency_saved_views";
const AGENCY_DEFAULT_SORT_COLUMN = "createdAt";
const AGENCY_DEFAULT_SORT_DIR: "asc" | "desc" = "desc";

export function AgenciesModule({ session, actions, onNotify, onActionButtons }: AgenciesModuleProps) {
  const { t } = useI18n();
  const router = useRouter();
  const {
    agencies, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    tlvFilter, setTlvFilter,
    statusFilter, setStatusFilter,
    showArchived, setShowArchived,
    handleToggleAgencyStatus,
    handleDeleteAgency,
    handleBulkDeleteAgencies,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<AgencyItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AgencyItem | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const bulkDeleteIncludesArchived = Boolean(
    confirmBulkDeleteIds?.some((id) => agencies.find((agency) => agency.id === id)?.isDeleted),
  );
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [draftTlvFilter, setDraftTlvFilter] = useState(tlvFilter);
  const [draftStatusFilter, setDraftStatusFilter] = useState(statusFilter);
  const [draftSortColumn, setDraftSortColumn] = useState(sortColumn);
  const [draftSortDir, setDraftSortDir] = useState<"asc" | "desc">(sortDir);

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
      copyable: true,
      copyText: (a) => [a.name, a.city, a.province].filter(Boolean).join(', '),
      renderCell: (a) => (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>{a.name}</Typography>
          {(a.city || a.province) && (
            <Typography variant="body2" color="text.secondary">
              {[a.city, a.province].filter(Boolean).join(", ")}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: "isTlv",
      label: "Type",
      width: "110",
      renderCell: (a) => (
        <StatusBadge
          label={a.isTlv ? "TLV" : "Standard"}
          tone={a.isTlv ? "accent" : "neutral"}
        />
      ),
    },
    {
      key: "address",
      label: t("columns", "address"),
      copyable: true,
      copyText: (a) => [a.street, a.postalCode, a.city, a.country].filter(Boolean).join(', '),
      renderCell: (a) => {
        const hasAddress = a.street || a.city || a.postalCode;
        return (
          <Box>
            {hasAddress ? (
              <>
                {a.street && <Typography variant="body2">{a.street}</Typography>}
                <Typography variant="body2" color="text.secondary">
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
      width: "150",
      renderCell: (a) => {
        const commercialUsers = a.users?.filter(u => u.role === "COMMERCIAL") || [];
        return (
          <Box>
            {commercialUsers.length > 0 ? (
              <Tooltip
                title={
                  <Box>
                    {commercialUsers.map(u => (
                      <Typography key={u.id} variant="body2">
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
      width: "120",
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
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {new Date(a.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {a.createdByUser ? `${a.createdByUser.fullName}` : "System"}
          </Typography>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (a) => (
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {new Date(a.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            {a.updatedByUser ? `${a.updatedByUser.fullName}` : "System"}
          </Typography>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      width: "140",
      renderCell: (a) => {
        const primaryLabel = t("actions", "edit");
        const primaryOnClick = () => router.push(`/internal/agencies/${a.id}/edit`);

        const secondaryItems: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }> = [];
        secondaryItems.push({
          label: a.isActive ? t("actions", "deactivate") : t("actions", "activate"),
          onClick: () => setConfirmToggle(a),
          icon: a.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />,
          danger: a.isActive,
        });
        secondaryItems.push({
          label: t("actions", "delete"),
          onClick: () => setConfirmDelete(a),
          icon: <DeleteOutlineIcon fontSize="small" />,
          danger: true,
        });

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={primaryOnClick}
                startIcon={<EditIcon fontSize="small" />}
                title={primaryLabel}
                aria-label={primaryLabel}
                sx={{ minWidth: '80px !important' }}
              >
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

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftTlvFilter(tlvFilter);
    setDraftStatusFilter(statusFilter);
    setDraftSortColumn(sortColumn);
    setDraftSortDir(sortDir);
  }, [filtersOpen, sortColumn, sortDir, statusFilter, tlvFilter]);

  const currentView = useMemo<AgenciesViewState>(() => ({
    tlvFilter,
    statusFilter,
    showArchived,
    sortColumn,
    sortDir,
  }), [showArchived, sortColumn, sortDir, statusFilter, tlvFilter]);

  const applyView = useCallback((view: AgenciesViewState) => {
    setTlvFilter(view.tlvFilter ?? "");
    setStatusFilter(view.statusFilter ?? "");
    setShowArchived(Boolean(view.showArchived));
    setSort(view.sortColumn || AGENCY_DEFAULT_SORT_COLUMN, view.sortDir || AGENCY_DEFAULT_SORT_DIR);
    setPage(1);
  }, [setPage, setShowArchived, setSort, setStatusFilter, setTlvFilter]);

  const builtInViews = useMemo<Array<{ id: string; name: string; view: AgenciesViewState }>>(() => [
    {
      id: "recent",
      name: "Recent",
      view: { tlvFilter: "", statusFilter: "", showArchived: false, sortColumn: AGENCY_DEFAULT_SORT_COLUMN, sortDir: AGENCY_DEFAULT_SORT_DIR },
    },
    {
      id: "active",
      name: t("status", "active"),
      view: { tlvFilter: "", statusFilter: "active", showArchived: false, sortColumn: AGENCY_DEFAULT_SORT_COLUMN, sortDir: AGENCY_DEFAULT_SORT_DIR },
    },
    {
      id: "tlv",
      name: "TLV",
      view: { tlvFilter: "tlv", statusFilter: "", showArchived: false, sortColumn: AGENCY_DEFAULT_SORT_COLUMN, sortDir: AGENCY_DEFAULT_SORT_DIR },
    },
  ], [t]);

  const { savedViews, viewPresets, activeViewPresetId, saveCurrentView, deleteSavedView } =
    useTableViews<AgenciesViewState>({ storageKey: AGENCY_VIEWS_STORAGE_KEY, currentView, presets: builtInViews });

  const activeAdvancedFilterCount = useMemo(() => [
    !activeViewPresetId && tlvFilter,
    !activeViewPresetId && statusFilter,
    !activeViewPresetId && showArchived,
    !activeViewPresetId && (sortColumn !== AGENCY_DEFAULT_SORT_COLUMN || sortDir !== AGENCY_DEFAULT_SORT_DIR),
  ].filter(Boolean).length, [activeViewPresetId, showArchived, sortColumn, sortDir, statusFilter, tlvFilter]);

  const applyAdvancedFilters = useCallback(() => {
    setTlvFilter(draftTlvFilter);
    setStatusFilter(draftStatusFilter);
    setSort(draftSortColumn || AGENCY_DEFAULT_SORT_COLUMN, draftSortDir);
    setPage(1);
    setFiltersOpen(false);
  }, [draftSortColumn, draftSortDir, draftStatusFilter, draftTlvFilter, setPage, setSort, setStatusFilter, setTlvFilter]);

  const clearAdvancedFilters = useCallback(() => {
    setDraftTlvFilter("");
    setDraftStatusFilter("");
    setDraftSortColumn(AGENCY_DEFAULT_SORT_COLUMN);
    setDraftSortDir(AGENCY_DEFAULT_SORT_DIR);
    applyView({ tlvFilter: "", statusFilter: "", showArchived, sortColumn: AGENCY_DEFAULT_SORT_COLUMN, sortDir: AGENCY_DEFAULT_SORT_DIR });
    setFiltersOpen(false);
  }, [applyView, showArchived]);

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
          {isAdmin(session.user.role) && (
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
          <Tooltip title={t("actions", "newAgency")} arrow>
            <span className="topbar-action-wrap">
              <Link href="/internal/agencies/new" style={{ textDecoration: "none" }}>
                <Button
                  className="topbar-action topbar-action--compact"
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  aria-label={t("actions", "newAgency")}
                >
                  <span className="topbar-action-label">{t("actions", "newAgency")}</span>
                </Button>
              </Link>
            </span>
          </Tooltip>
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
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <DataTable<AgencyItem>
        tableId="agencies"
        columns={columns}
        rows={agencies}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onClearFilters={() => {
          setSearch("");
          setTlvFilter("");
          setStatusFilter("");
          setPage(1);
        }}
        hasActiveFilters={Boolean(search || activeAdvancedFilterCount)}
        showFilterSubmitActions={false}
        showFilterLabel={false}
        headerRight={(
          <TableFilterButton
            title={t("simulationsModule", "filtersTitle")}
            activeFilterCount={activeAdvancedFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        )}
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
        renderCustomSearch={({ draft, setDraft, commitSearch, searchPlaceholder }) => (
          <TableViewSearchControls
            activeViewPresetId={activeViewPresetId}
            viewPresets={viewPresets}
            savedViews={savedViews}
            onApplyView={applyView}
            onDeleteSavedView={deleteSavedView}
            labels={{
              customView: t("simulationsModule", "customView"),
              savedViewsGroup: t("simulationsModule", "savedViewsGroup"),
              viewPreset: t("simulationsModule", "viewPresetLabel"),
              clear: t("actions", "clear"),
            }}
            draft={draft}
            setDraft={setDraft}
            commitSearch={commitSearch}
            searchPlaceholder={searchPlaceholder}
            onLiveSearchChange={(value) => { setSearch(value); setPage(1); }}
            onClearSearch={() => { setSearch(""); setPage(1); }}
          />
        )}
        mobileCard={{
          title: "name",
          status: "status",
          actions: (a) => (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 0.75 }}>
              <Button
                variant="outlined"
                size="small"
                component={Link}
                href={`/internal/agencies/${a.id}/edit`}
                startIcon={<EditIcon fontSize="small" />}
                sx={{ minWidth: 0 }}
              >
                {t("actions", "edit")}
              </Button>
              <Button
                variant="outlined"
                color={a.isActive ? "error" : "success"}
                size="small"
                onClick={() => setConfirmToggle(a)}
                startIcon={a.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                sx={{ minWidth: 0 }}
              >
                {a.isActive ? t("actions", "deactivate") : t("actions", "activate")}
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setConfirmDelete(a)}
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                sx={{ minWidth: 0 }}
              >
                {t("actions", "delete")}
              </Button>
            </Box>
          ),
        }}
      />

      <TableFiltersDialog
        open={filtersOpen}
        title={t("simulationsModule", "filtersTitle")}
        saveViewLabel={t("simulationsModule", "saveView")}
        clearLabel={t("simulationsModule", "clearFilters")}
        applyLabel={t("simulationsModule", "applyFilters")}
        onClose={() => setFiltersOpen(false)}
        onOpenSaveView={() => setSaveViewOpen(true)}
        onClear={clearAdvancedFilters}
        onApply={applyAdvancedFilters}
      >
        <FormSelect
          label="Type"
          options={[
            { value: "", label: "All agency types" },
            { value: "tlv", label: "TLV" },
            { value: "standard", label: "Standard" },
          ]}
          value={draftTlvFilter}
          onChange={(val) => setDraftTlvFilter((val as string) ?? "")}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("columns", "status")}
          options={[
            { value: "", label: t("search", "allStatuses") },
            { value: "active", label: t("status", "active") },
            { value: "inactive", label: t("status", "inactive") },
          ]}
          value={draftStatusFilter}
          onChange={(val) => setDraftStatusFilter((val as string) ?? "")}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("simulationsModule", "sortBy")}
          options={[
            { value: "createdAt", label: t("columns", "created") },
            { value: "updatedAt", label: t("columns", "updated") },
            { value: "name", label: t("columns", "name") },
          ]}
          value={draftSortColumn}
          onChange={(val) => setDraftSortColumn((val as string) || AGENCY_DEFAULT_SORT_COLUMN)}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("simulationsModule", "sortDirection")}
          options={[
            { value: "desc", label: t("simulationsModule", "directionDescending") },
            { value: "asc", label: t("simulationsModule", "directionAscending") },
          ]}
          value={draftSortDir}
          onChange={(val) => setDraftSortDir(val === "asc" ? "asc" : "desc")}
          textFieldProps={{ size: "small" }}
        />
      </TableFiltersDialog>

      <SaveTableViewDialog
        open={saveViewOpen}
        title={t("simulationsModule", "saveViewTitle")}
        description={t("simulationsModule", "saveViewDescription")}
        nameLabel={t("simulationsModule", "viewName")}
        cancelLabel={t("simulationsModule", "cancel")}
        saveLabel={t("simulationsModule", "save")}
        onClose={() => setSaveViewOpen(false)}
        onSave={saveCurrentView}
      />

      {/* ── Confirm bulk delete ──────────────────────────────────── */}
      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("agenciesModule", "bulkDeleteTitle")}
          message={t(
            "agenciesModule",
            bulkDeleteIncludesArchived ? "bulkDeletePermanentConfirm" : "bulkDeleteConfirm",
            { count: confirmBulkDeleteIds.length },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={bulkDeleteIncludesArchived ? 5 : undefined}
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
          message={t(
            "agenciesModule",
            confirmDelete.isDeleted ? "deletePermanentConfirm" : "deleteConfirm",
            { name: confirmDelete.name },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={confirmDelete.isDeleted ? 5 : undefined}
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
