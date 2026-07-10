"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { BaseValueScopeType, BaseValueSetItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { downloadBaseValueFile } from "../../lib/internalApi";
import { getSystemConfig } from "../../lib/configApi";
import type { BaseValuesActions } from "../hooks/useBaseValues";
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
import { useI18n } from "../../../../src/lib/i18n-context";
import {
  DEFAULT_MAX_UPLOAD_FILE_SIZE_MB,
  formatUploadSizeLimit,
  uploadSizeMbToBytes,
} from "../../../../src/infrastructure/uploads/uploadLimits";

interface BaseValuesModuleProps {
  session: SessionState;
  actions: BaseValuesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

type BaseValuesViewState = {
  scopeFilter: "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">;
  statusFilter: "" | "ACTIVE" | "DRAFT" | "ARCHIVED";
  productionFilter: "" | "production" | "standard";
  showArchived: boolean;
  sortColumn: string;
  sortDir: "asc" | "desc";
};

const BASE_VALUE_VIEWS_STORAGE_KEY = "axpo_base_value_saved_views";
const BASE_VALUE_DEFAULT_SORT_COLUMN = "updatedAt";
const BASE_VALUE_DEFAULT_SORT_DIR: "asc" | "desc" = "desc";

// ─── Main module ─────────────────────────────────────────────────────────────

export function BaseValuesModule({ session, actions, onNotify, onActionButtons }: BaseValuesModuleProps) {
  const { t } = useI18n();
  const {
    baseValueSets, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    showArchived, setShowArchived,
    scopeFilter, setScopeFilter,
    statusFilter, setStatusFilter,
    productionFilter, setProductionFilter,
    handleActivateBaseValueSet, handleArchiveBaseValueSet, handleBulkArchiveBaseValueSets, handleToggleProduction, handleUploadFile,
  } = actions;

  const [confirmAction, setConfirmAction] = useState<{ id: string; type: "activate" | "archive" | "restore" } | null>(null);
  const [confirmBulkArchiveIds, setConfirmBulkArchiveIds] = useState<string[] | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadScopeType, setUploadScopeType] =
    useState<Extract<BaseValueScopeType, "GLOBAL" | "TLV">>("GLOBAL");
  const [maxUploadFileSizeMb, setMaxUploadFileSizeMb] = useState(DEFAULT_MAX_UPLOAD_FILE_SIZE_MB);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [draftScopeFilter, setDraftScopeFilter] = useState(scopeFilter);
  const [draftStatusFilter, setDraftStatusFilter] = useState(statusFilter);
  const [draftProductionFilter, setDraftProductionFilter] = useState(productionFilter);
  const [draftSortColumn, setDraftSortColumn] = useState(sortColumn);
  const [draftSortDir, setDraftSortDir] = useState<"asc" | "desc">(sortDir);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSizeLimitLabel = formatUploadSizeLimit(maxUploadFileSizeMb);
  const maxUploadSizeBytes = uploadSizeMbToBytes(maxUploadFileSizeMb);

  useEffect(() => {
    if (successText) { onNotify?.(successText, "success"); clearFeedback(); }
  }, [successText]);

  useEffect(() => {
    if (errorText) { onNotify?.(errorText, "error"); clearFeedback(); }
  }, [errorText]);

  useEffect(() => {
    let cancelled = false;
    getSystemConfig({ view: "runtime" })
      .then((systemConfig) => {
        if (!cancelled) {
          setMaxUploadFileSizeMb(systemConfig.maxUploadFileSizeMb ?? DEFAULT_MAX_UPLOAD_FILE_SIZE_MB);
        }
      })
      .catch(() => {
        if (!cancelled) setMaxUploadFileSizeMb(DEFAULT_MAX_UPLOAD_FILE_SIZE_MB);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmTarget = baseValueSets.find((s) => s.id === confirmAction?.id);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsm") && !file.name.endsWith(".xlsx")) {
      onNotify?.("Please select an Excel file (.xlsm or .xlsx)", "error");
      event.target.value = "";
      return;
    }

    if (file.size > maxUploadSizeBytes) {
      onNotify?.(t("baseValuesModule", "fileTooLarge", { max: uploadSizeLimitLabel }), "error");
      event.target.value = "";
      return;
    }

    setPendingUploadFile(file);
    setUploadScopeType("GLOBAL");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile) return;
    await handleUploadFile(pendingUploadFile, false, uploadScopeType);
    setPendingUploadFile(null);
  };

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftScopeFilter(scopeFilter);
    setDraftStatusFilter(statusFilter);
    setDraftProductionFilter(productionFilter);
    setDraftSortColumn(sortColumn);
    setDraftSortDir(sortDir);
  }, [filtersOpen, productionFilter, scopeFilter, sortColumn, sortDir, statusFilter]);

  const currentView = useMemo<BaseValuesViewState>(() => ({
    scopeFilter,
    statusFilter,
    productionFilter,
    showArchived,
    sortColumn,
    sortDir,
  }), [productionFilter, scopeFilter, showArchived, sortColumn, sortDir, statusFilter]);

  const applyView = useCallback((view: BaseValuesViewState) => {
    setScopeFilter(view.scopeFilter ?? "");
    setStatusFilter(view.statusFilter ?? "");
    setProductionFilter(view.productionFilter ?? "");
    setShowArchived(Boolean(view.showArchived));
    setSort(view.sortColumn || BASE_VALUE_DEFAULT_SORT_COLUMN, view.sortDir || BASE_VALUE_DEFAULT_SORT_DIR);
    setPage(1);
  }, [setPage, setProductionFilter, setScopeFilter, setShowArchived, setSort, setStatusFilter]);

  const builtInViews = useMemo<Array<{ id: string; name: string; view: BaseValuesViewState }>>(() => [
    {
      id: "recent",
      name: "Recent",
      view: { scopeFilter: "", statusFilter: "", productionFilter: "", showArchived: false, sortColumn: BASE_VALUE_DEFAULT_SORT_COLUMN, sortDir: BASE_VALUE_DEFAULT_SORT_DIR },
    },
    {
      id: "active",
      name: t("baseValuesModule", "statusActive"),
      view: { scopeFilter: "", statusFilter: "ACTIVE", productionFilter: "", showArchived: false, sortColumn: BASE_VALUE_DEFAULT_SORT_COLUMN, sortDir: BASE_VALUE_DEFAULT_SORT_DIR },
    },
    {
      id: "production",
      name: t("baseValuesModule", "productionFilterOn"),
      view: { scopeFilter: "", statusFilter: "", productionFilter: "production", showArchived: false, sortColumn: BASE_VALUE_DEFAULT_SORT_COLUMN, sortDir: BASE_VALUE_DEFAULT_SORT_DIR },
    },
    {
      id: "archived",
      name: t("actions", "showArchived"),
      view: { scopeFilter: "", statusFilter: "ARCHIVED", productionFilter: "", showArchived: true, sortColumn: BASE_VALUE_DEFAULT_SORT_COLUMN, sortDir: BASE_VALUE_DEFAULT_SORT_DIR },
    },
  ], [t]);

  const { savedViews, viewPresets, activeViewPresetId, saveCurrentView, deleteSavedView } =
    useTableViews<BaseValuesViewState>({ storageKey: BASE_VALUE_VIEWS_STORAGE_KEY, currentView, presets: builtInViews });

  const activeAdvancedFilterCount = useMemo(() => [
    !activeViewPresetId && scopeFilter,
    !activeViewPresetId && statusFilter,
    !activeViewPresetId && productionFilter,
    !activeViewPresetId && showArchived,
    !activeViewPresetId && (sortColumn !== BASE_VALUE_DEFAULT_SORT_COLUMN || sortDir !== BASE_VALUE_DEFAULT_SORT_DIR),
  ].filter(Boolean).length, [activeViewPresetId, productionFilter, scopeFilter, showArchived, sortColumn, sortDir, statusFilter]);

  const hasActiveFilters = Boolean(search || activeAdvancedFilterCount);

  const applyAdvancedFilters = useCallback(() => {
    setScopeFilter(draftScopeFilter);
    setStatusFilter(draftStatusFilter);
    setProductionFilter(draftProductionFilter);
    setSort(draftSortColumn || BASE_VALUE_DEFAULT_SORT_COLUMN, draftSortDir);
    setPage(1);
    setFiltersOpen(false);
  }, [draftProductionFilter, draftScopeFilter, draftSortColumn, draftSortDir, draftStatusFilter, setPage, setProductionFilter, setScopeFilter, setSort, setStatusFilter]);

  const clearAdvancedFilters = useCallback(() => {
    setDraftScopeFilter("");
    setDraftStatusFilter("");
    setDraftProductionFilter("");
    setDraftSortColumn(BASE_VALUE_DEFAULT_SORT_COLUMN);
    setDraftSortDir(BASE_VALUE_DEFAULT_SORT_DIR);
    applyView({ scopeFilter: "", statusFilter: "", productionFilter: "", showArchived, sortColumn: BASE_VALUE_DEFAULT_SORT_COLUMN, sortDir: BASE_VALUE_DEFAULT_SORT_DIR });
    setFiltersOpen(false);
  }, [applyView, showArchived]);
  const canArchiveSet = (setItem: BaseValueSetItem) =>
    !setItem.isDeleted && !setItem.isActive && !setItem.isProduction;

  const columns: ColumnDef<BaseValueSetItem>[] = [
    {
      key: "name",
      label: t("baseValuesModule", "colName"),
      sortable: true,
      width: "360",
      renderCell: (s) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: s.isDeleted ? 0.5 : 1 }}>
          <Typography variant="body1" noWrap title={s.name}>{s.name}</Typography>
          
        </Box>
      ),
    },
    {
      key: "scope",
      label: t("baseValuesModule", "colScope"),
      width: "110",
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary">
          {s.scopeType === "AGENCY"
            ? t("baseValuesModule", "scopeAgency")
            : s.scopeType === "TLV"
              ? "TLV"
              : t("baseValuesModule", "scopeGlobal")}
        </Typography>
      ),
    },
    {
      key: "version",
      label: t("baseValuesModule", "colVersion"),
      sortable: true,
      width: "100",
      renderCell: (s) => <Typography variant="body2" color="text.secondary">v{s.version}</Typography>,
    },
    {
      key: "items",
      label: t("baseValuesModule", "colItems"),
      width: "110",
      renderCell: (s) => <Typography variant="body2">{s._count?.items ?? "—"}</Typography>,
    },
    {
      key: "createdBy",
      label: "Created By",
      width: "230",
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary" noWrap title={s.createdByUser?.fullName || "—"}>
          {s.createdByUser?.fullName || "—"}
        </Typography>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      width: "190",
      renderCell: (s) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {new Date(s.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Typography>
      ),
    },
    {
      key: "status",
      label: t("baseValuesModule", "colStatus"),
      width: "130",
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
      width: "130",
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
      width: "150",
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
          {s.sourceFileName && (
            <Tooltip title={t("baseValuesModule", "download_tooltip")} placement="top">
              <IconButton
                onClick={() => downloadBaseValueFile(session.token, s.id)}
                size="small"
                sx={{ color: "text.secondary", "&:hover": { color: "info.main" } }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
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
          {canArchiveSet(s) && (
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
        <Tooltip title={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              onClick={() => { setShowArchived(!showArchived); setPage(1); }}
              startIcon={<ArchiveIcon fontSize="small" />}
              aria-label={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
            >
              <span className="topbar-action-label">
                {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
              </span>
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={t("actions", "refresh")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              onClick={() => refresh()}
              disabled={loading}
              startIcon={<SyncIcon fontSize="small" />}
              aria-label={t("actions", "refresh")}
            >
              <span className="topbar-action-label">{t("actions", "refresh")}</span>
            </Button>
          </span>
        </Tooltip>
        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsm,.xlsx"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <Tooltip title={busyAction === "upload-base-value-file" ? "Uploading..." : "Upload Excel"} arrow>
              <span className="topbar-action-wrap">
                <Button
                  className="topbar-action topbar-action--compact"
                  variant="outlined"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busyAction === "upload-base-value-file"}
                  startIcon={<UploadFileIcon fontSize="small" />}
                  aria-label={busyAction === "upload-base-value-file" ? "Uploading..." : "Upload Excel"}
                >
                  <span className="topbar-action-label">
                    {busyAction === "upload-base-value-file" ? "Uploading..." : "Upload Excel"}
                  </span>
                </Button>
              </span>
            </Tooltip>
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
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <DataTable<BaseValueSetItem>
        tableId="base-values"
        columns={columns}
        rows={baseValueSets}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onClearFilters={() => {
          setSearch("");
          setScopeFilter("");
          setStatusFilter("");
          setProductionFilter("");
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        showFilterSubmitActions={false}
        showFilterLabel={false}
        headerRight={(
          <TableFilterButton
            title={t("simulationsModule", "filtersTitle")}
            activeFilterCount={activeAdvancedFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        )}
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
        massActions={canManage ? [
          {
            label: t("baseValuesModule", "bulkArchiveLabel"),
            color: "error",
            icon: <ArchiveIcon fontSize="small" />,
            onClick: (ids) => {
              const selectedSets = baseValueSets.filter((setItem) =>
                ids.includes(setItem.id),
              );
              if (selectedSets.some((setItem) => !canArchiveSet(setItem))) {
                onNotify?.(t("baseValuesModule", "archiveNotAllowed"), "error");
                return;
              }
              setConfirmBulkArchiveIds(ids);
            },
          },
        ] : undefined}
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
          fields: ["scope", "agency", "createdBy", "createdAt", "production"],
          actions: (s) => {
            const actions = [
              <Button
                key="edit"
                variant="outlined"
                size="small"
                component={Link}
                href={`/internal/base-values/${s.id}/edit`}
                startIcon={<EditIcon fontSize="small" />}
                sx={{ minWidth: 0 }}
              >
                {t("actions", "edit")}
              </Button>,
              s.sourceFileName ? (
                <Button
                  key="download"
                  variant="outlined"
                  size="small"
                  onClick={() => downloadBaseValueFile(session.token, s.id)}
                  startIcon={<DownloadIcon fontSize="small" />}
                  sx={{ minWidth: 0 }}
                >
                  {t("baseValuesModule", "downloadExcel")}
                </Button>
              ) : null,
              !s.isActive && !s.isDeleted ? (
                <Button
                  key="activate"
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => setConfirmAction({ id: s.id, type: "activate" })}
                  startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                  sx={{ minWidth: 0 }}
                >
                  {t("actions", "activate")}
                </Button>
              ) : null,
              canArchiveSet(s) ? (
                <Button
                  key="archive"
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => setConfirmAction({ id: s.id, type: "archive" })}
                  startIcon={<ArchiveIcon fontSize="small" />}
                  sx={{ minWidth: 0 }}
                >
                  {t("actions", "archive")}
                </Button>
              ) : null,
              s.isDeleted ? (
                <Button
                  key="restore"
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => setConfirmAction({ id: s.id, type: "restore" })}
                  startIcon={<UnarchiveIcon fontSize="small" />}
                  sx={{ minWidth: 0 }}
                >
                  {t("actions", "restore")}
                </Button>
              ) : null,
            ].filter(Boolean);

            return (
              <Box sx={{ display: "grid", gridTemplateColumns: actions.length > 2 ? "repeat(2, 1fr)" : `repeat(${actions.length}, 1fr)`, gap: 0.75 }}>
                {actions}
              </Box>
            );
          },
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
          label={t("baseValuesModule", "colScope")}
          options={[
            { value: "", label: t("baseValuesModule", "allScopes") },
            { value: "GLOBAL", label: t("baseValuesModule", "scopeGlobal") },
            { value: "TLV", label: "TLV" },
          ]}
          value={draftScopeFilter}
          onChange={(val) => setDraftScopeFilter(val as "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">)}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("baseValuesModule", "colStatus")}
          options={[
            { value: "", label: t("search", "allStatuses") },
            { value: "ACTIVE", label: t("baseValuesModule", "statusActive") },
            { value: "DRAFT", label: t("baseValuesModule", "statusDraft") },
            { value: "ARCHIVED", label: t("baseValuesModule", "statusArchived") },
          ]}
          value={draftStatusFilter}
          onChange={(val) => setDraftStatusFilter(val as "" | "ACTIVE" | "DRAFT" | "ARCHIVED")}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("baseValuesModule", "colProduction")}
          options={[
            { value: "", label: t("baseValuesModule", "allProductionStates") },
            { value: "production", label: t("baseValuesModule", "productionFilterOn") },
            { value: "standard", label: t("baseValuesModule", "productionFilterOff") },
          ]}
          value={draftProductionFilter}
          onChange={(val) => setDraftProductionFilter(val as "" | "production" | "standard")}
          textFieldProps={{ size: "small" }}
        />
        <FormSelect
          label={t("simulationsModule", "sortBy")}
          options={[
            { value: "updatedAt", label: t("columns", "updated") },
            { value: "createdAt", label: t("columns", "created") },
            { value: "name", label: t("baseValuesModule", "colName") },
            { value: "version", label: t("baseValuesModule", "colVersion") },
          ]}
          value={draftSortColumn}
          onChange={(val) => setDraftSortColumn((val as string) || BASE_VALUE_DEFAULT_SORT_COLUMN)}
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

      {confirmBulkArchiveIds && (
        <ConfirmDialog
          title={t("baseValuesModule", "bulkArchiveTitle")}
          message={t("baseValuesModule", "bulkArchiveConfirm", {
            count: confirmBulkArchiveIds.length,
          })}
          confirmLabel={t("baseValuesModule", "bulkArchiveLabel")}
          busy={busyAction === "bulk-archive-base-values"}
          onConfirm={async () => {
            await handleBulkArchiveBaseValueSets(confirmBulkArchiveIds);
            setConfirmBulkArchiveIds(null);
          }}
          onCancel={() => setConfirmBulkArchiveIds(null)}
        />
      )}

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

      <Dialog
        open={Boolean(pendingUploadFile)}
        onClose={() => {
          if (busyAction !== "upload-base-value-file") setPendingUploadFile(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: "primary.main",
                color: "primary.contrastText",
              }}
            >
              <UploadFileIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6">{t("baseValuesModule", "uploadTitle")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("baseValuesModule", "uploadSubtitle", { max: uploadSizeLimitLabel })}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "action.hover",
              }}
            >
              <InsertDriveFileOutlinedIcon color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {pendingUploadFile?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pendingUploadFile
                    ? `${(pendingUploadFile.size / 1024 / 1024).toFixed(2)} MB`
                    : ""}
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t("baseValuesModule", "uploadVersionScope")}
              </Typography>
              <ToggleButtonGroup
                value={uploadScopeType}
                exclusive
                fullWidth
                onChange={(_, value: Extract<BaseValueScopeType, "GLOBAL" | "TLV"> | null) => {
                  if (value) setUploadScopeType(value);
                }}
                size="small"
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 1,
                    fontWeight: 600,
                  },
                }}
              >
                <ToggleButton value="GLOBAL">Global</ToggleButton>
                <ToggleButton value="TLV">TLV</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Alert severity="info" variant="outlined">
              {t("baseValuesModule", "uploadNeverReplace")}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
          <Button
            onClick={() => setPendingUploadFile(null)}
            disabled={busyAction === "upload-base-value-file"}
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon fontSize="small" />}
            onClick={handleConfirmUpload}
            disabled={busyAction === "upload-base-value-file"}
          >
            {busyAction === "upload-base-value-file"
              ? "Uploading..."
              : t("baseValuesModule", "uploadAs", { scope: uploadScopeType })}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
