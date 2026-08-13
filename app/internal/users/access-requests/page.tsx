"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { loadSession } from "../../lib/authSession";
import { usePermissions } from "../../lib/permissionsContext";
import { useI18n } from "../../../../src/lib/i18n-context";
import { formatDisplayDateTime } from "../../lib/formatPreferences";
import { useUserPreferences } from "../../components/providers/UserPreferencesProvider";
import { useTopBarBreadcrumbs } from "../../components/InternalWorkspace";
import { ConfirmDialog, useAlerts } from "../../components/shared";
import {
  DataTable,
  FormSelect,
  SaveTableViewDialog,
  StatusBadge,
  TableFilterButton,
  TableFiltersDialog,
  TableViewSearchControls,
  useTableViews,
  type ColumnDef,
} from "../../components/ui";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
type AccessRequestsView = {
  status: string;
  sortColumn: string;
  sortDir: "asc" | "desc";
};

interface AccessRequestItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  comments?: string | null;
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  notificationSentAt?: string | null;
  applicantNotificationSentAt?: string | null;
  agency: { id: string; name: string };
  kamUser: { id: string; fullName: string };
  reviewedByUser?: { id: string; fullName: string } | null;
}

const STORAGE_KEY = "axpo_access_request_saved_views";
const DEFAULT_SORT_COLUMN = "createdAt";
const DEFAULT_SORT_DIR: "desc" = "desc";

export default function AccessRequestsPage() {
  const router = useRouter();
  const [session] = useState(loadSession());
  const { canDo } = usePermissions();
  const { t } = useI18n();
  const { preferences } = useUserPreferences();
  const { showSuccess, showError } = useAlerts();
  useTopBarBreadcrumbs(useMemo(() => [{ label: t("accessRequests", "title") }], [t]));

  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<AccessRequestItem | null>(null);
  const [confirmReject, setConfirmReject] = useState<AccessRequestItem | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(preferences.itemsPerPage);
  const [total, setTotal] = useState(0);
  const [sortColumn, setSortColumn] = useState(DEFAULT_SORT_COLUMN);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(DEFAULT_SORT_DIR);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftSortColumn, setDraftSortColumn] = useState(sortColumn);
  const [draftSortDir, setDraftSortDir] = useState<"asc" | "desc">(sortDir);

  const canView = session ? canDo(session.user.role, "users.view") : false;
  const canApprove = session ? canDo(session.user.role, "users.create") : false;
  const canReject = session ? canDo(session.user.role, "users.edit") : false;

  useEffect(() => {
    if (session && !canView) router.replace("/internal/users");
  }, [canView, router, session]);

  const currentView = useMemo<AccessRequestsView>(() => ({ status, sortColumn, sortDir }), [sortColumn, sortDir, status]);
  const builtInViews = useMemo(() => [
    { id: "pending", name: t("accessRequests", "viewPending"), view: { status: "PENDING", sortColumn: "createdAt", sortDir: "desc" as const } },
    { id: "all", name: t("accessRequests", "viewAll"), view: { status: "", sortColumn: "createdAt", sortDir: "desc" as const } },
    { id: "approved", name: t("accessRequests", "viewApproved"), view: { status: "APPROVED", sortColumn: "reviewedAt", sortDir: "desc" as const } },
    { id: "rejected", name: t("accessRequests", "viewRejected"), view: { status: "REJECTED", sortColumn: "reviewedAt", sortDir: "desc" as const } },
  ], [t]);
  const { savedViews, viewPresets, activeViewPresetId, saveCurrentView, deleteSavedView } = useTableViews<AccessRequestsView>({
    storageKey: STORAGE_KEY,
    currentView,
    presets: builtInViews,
  });

  const applyView = useCallback((view: AccessRequestsView) => {
    setStatus(view.status ?? "");
    setSortColumn(view.sortColumn || DEFAULT_SORT_COLUMN);
    setSortDir(view.sortDir || DEFAULT_SORT_DIR);
    setPage(1);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftStatus(status);
    setDraftSortColumn(sortColumn);
    setDraftSortDir(sortDir);
  }, [filtersOpen, sortColumn, sortDir, status]);

  const activeFilterCount = useMemo(() => [
    !activeViewPresetId && status,
    !activeViewPresetId && (sortColumn !== DEFAULT_SORT_COLUMN || sortDir !== DEFAULT_SORT_DIR),
  ].filter(Boolean).length, [activeViewPresetId, sortColumn, sortDir, status]);

  const loadRequests = useCallback(async () => {
    if (!session || !canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), orderBy: sortColumn, sortDir });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetch(`/api/v1/internal/access-requests?${params}`, {
        headers: { Authorization: `Bearer ${session.token}` }, cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || t("accessRequests", "loadError"));
      setItems(body.data.items);
      setTotal(body.data.total);
    } catch (error) {
      showError(error instanceof Error ? error.message : t("accessRequests", "loadError"));
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, search, session, showError, sortColumn, sortDir, status, t]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const runAction = async (request: AccessRequestItem, action: "approve" | "reject") => {
    if (!session) return;
    setBusyId(request.id);
    try {
      const response = await fetch(`/api/v1/internal/access-requests/${request.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({}) : undefined,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || t("accessRequests", "actionError"));
      showSuccess(t("accessRequests", action === "approve" ? "approvedSuccess" : "rejectedSuccess"));
      setConfirmApprove(null);
      setConfirmReject(null);
      await loadRequests();
    } catch (error) {
      showError(error instanceof Error ? error.message : t("accessRequests", "actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<ColumnDef<AccessRequestItem>[]>(() => [
    {
      key: "fullName", label: t("columns", "name"), sortable: true, copyable: true,
      copyText: (row) => row.fullName,
      renderCell: (row) => <Typography sx={{ fontWeight: 500 }} noWrap>{row.fullName}</Typography>,
    },
    {
      key: "email", label: t("requestAccess", "email"), sortable: true, copyable: true,
      copyText: (row) => row.email,
      renderCell: (row) => <Typography variant="body2" noWrap>{row.email}</Typography>,
    },
    {
      key: "agency", label: t("columns", "agency"),
      renderCell: (row) => <Typography variant="body2" noWrap>{row.agency.name}</Typography>,
    },
    {
      key: "kam", label: "KAM",
      renderCell: (row) => <Typography variant="body2" noWrap>{row.kamUser.fullName}</Typography>,
    },
    {
      key: "status", label: t("columns", "status"), sortable: true, width: "120",
      renderCell: (row) => <StatusBadge label={t("accessRequests", row.status.toLowerCase())} tone={row.status === "APPROVED" ? "success" : row.status === "REJECTED" ? "danger" : "warning"} />,
    },
    {
      key: "createdAt", label: t("accessRequests", "requestedAt"), sortable: true, width: "185",
      renderCell: (row) => <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>{formatDisplayDateTime(row.createdAt, preferences)}</Typography>,
    },
    {
      key: "actions", label: t("columns", "actions"), width: "235",
      renderCell: (row) => row.status === "PENDING" ? <Stack direction="row" spacing={0.75} justifyContent="flex-end">
        {canApprove && <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => setConfirmApprove(row)}>{t("accessRequests", "approve")}</Button>}
        {canReject && <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setConfirmReject(row)}>{t("accessRequests", "reject")}</Button>}
      </Stack> : <Typography variant="body2" color="text.secondary">—</Typography>,
    },
  ], [canApprove, canReject, preferences, t]);

  if (!session || !canView) return null;

  return <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
    <DataTable
      tableId="access-requests" columns={columns} rows={items} loading={loading}
      searchValue={search} onSearch={(value) => { setSearch(value); setPage(1); }}
      searchPlaceholder={t("accessRequests", "searchPlaceholder")}
      onClearFilters={() => { setSearch(""); applyView({ status: "", sortColumn: DEFAULT_SORT_COLUMN, sortDir: DEFAULT_SORT_DIR }); }}
      hasActiveFilters={Boolean(search || activeFilterCount)} showFilterSubmitActions={false} showFilterLabel={false}
      headerRight={<TableFilterButton title={t("simulationsModule", "filtersTitle")} activeFilterCount={activeFilterCount} onClick={() => setFiltersOpen(true)} />}
      renderCustomSearch={({ draft, setDraft, commitSearch, searchPlaceholder }) => <TableViewSearchControls
        activeViewPresetId={activeViewPresetId} viewPresets={viewPresets} savedViews={savedViews}
        onApplyView={applyView} onDeleteSavedView={deleteSavedView}
        labels={{ customView: t("simulationsModule", "customView"), savedViewsGroup: t("simulationsModule", "savedViewsGroup"), viewPreset: t("simulationsModule", "viewPresetLabel"), clear: t("actions", "clear") }}
        draft={draft} setDraft={setDraft} commitSearch={commitSearch} searchPlaceholder={searchPlaceholder}
        onLiveSearchChange={(value) => { setSearch(value); setPage(1); }} onClearSearch={() => { setSearch(""); setPage(1); }}
      />}
      sortState={{ column: sortColumn, direction: sortDir }}
      onSort={(column) => { setSortDir(column === sortColumn && sortDir === "asc" ? "desc" : "asc"); setSortColumn(column); setPage(1); }}
      pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
      emptyMessage={t("accessRequests", "empty")} rowHasDetails={() => true}
      rowDetailContent={(row) => <Box sx={{ p: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
        <Box><Typography variant="caption" color="text.secondary">{t("accessRequests", "contact")}</Typography><Typography variant="body2">{row.phone}<br />{row.email}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">{t("accessRequests", "emailDelivery")}</Typography><Typography variant="body2">KAM: {row.notificationSentAt ? t("accessRequests", "sent") : t("accessRequests", "notSent")}<br />{t("accessRequests", "applicant")}: {row.applicantNotificationSentAt ? t("accessRequests", "sent") : t("accessRequests", "notSent")}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">{t("accessRequests", "comments")}</Typography><Typography variant="body2">{row.comments || row.reviewNotes || "—"}</Typography></Box>
      </Box>}
      mobileCard={{ title: "fullName", status: "status", fields: ["email", "agency", "kam", "createdAt"], actions: (row) => row.status === "PENDING" ? <Stack direction="row" spacing={1}>{canApprove && <Button size="small" variant="contained" color="success" onClick={() => setConfirmApprove(row)}>{t("accessRequests", "approve")}</Button>}{canReject && <Button size="small" variant="outlined" color="error" onClick={() => setConfirmReject(row)}>{t("accessRequests", "reject")}</Button>}</Stack> : null }}
      t={t}
    />

    <TableFiltersDialog open={filtersOpen} title={t("simulationsModule", "filtersTitle")} saveViewLabel={t("simulationsModule", "saveView")} clearLabel={t("simulationsModule", "clearFilters")} applyLabel={t("simulationsModule", "applyFilters")} onClose={() => setFiltersOpen(false)} onOpenSaveView={() => setSaveViewOpen(true)} onClear={() => { setDraftStatus(""); setDraftSortColumn(DEFAULT_SORT_COLUMN); setDraftSortDir(DEFAULT_SORT_DIR); applyView({ status: "", sortColumn: DEFAULT_SORT_COLUMN, sortDir: DEFAULT_SORT_DIR }); setFiltersOpen(false); }} onApply={() => { applyView({ status: draftStatus, sortColumn: draftSortColumn, sortDir: draftSortDir }); setFiltersOpen(false); }}>
      <FormSelect label={t("columns", "status")} value={draftStatus} onChange={(value) => setDraftStatus(String(value ?? ""))} options={[{ value: "", label: t("accessRequests", "allStatuses") }, { value: "PENDING", label: t("accessRequests", "pending") }, { value: "APPROVED", label: t("accessRequests", "approved") }, { value: "REJECTED", label: t("accessRequests", "rejected") }]} />
      <FormSelect label={t("simulationsModule", "sortBy")} value={draftSortColumn} onChange={(value) => setDraftSortColumn(String(value || DEFAULT_SORT_COLUMN))} options={[{ value: "createdAt", label: t("accessRequests", "requestedAt") }, { value: "reviewedAt", label: t("accessRequests", "reviewedAt") }, { value: "fullName", label: t("accessRequests", "applicant") }, { value: "status", label: t("columns", "status") }]} />
      <FormSelect label={t("simulationsModule", "sortDirection")} value={draftSortDir} onChange={(value) => setDraftSortDir(value === "asc" ? "asc" : "desc")} options={[{ value: "desc", label: t("simulationsModule", "directionDescending") }, { value: "asc", label: t("simulationsModule", "directionAscending") }]} />
    </TableFiltersDialog>
    <SaveTableViewDialog open={saveViewOpen} title={t("simulationsModule", "saveViewTitle")} description={t("simulationsModule", "saveViewDescription")} nameLabel={t("simulationsModule", "viewName")} cancelLabel={t("simulationsModule", "cancel")} saveLabel={t("simulationsModule", "save")} onClose={() => setSaveViewOpen(false)} onSave={saveCurrentView} />
    {confirmApprove && <ConfirmDialog title={t("accessRequests", "approveTitle")} message={t("accessRequests", "approveConfirm", { name: confirmApprove.fullName })} confirmLabel={t("accessRequests", "approve")} busy={busyId === confirmApprove.id} onConfirm={() => runAction(confirmApprove, "approve")} onCancel={() => setConfirmApprove(null)} />}
    {confirmReject && <ConfirmDialog title={t("accessRequests", "rejectTitle")} message={t("accessRequests", "rejectConfirm", { name: confirmReject.fullName })} confirmLabel={t("accessRequests", "reject")} busy={busyId === confirmReject.id} onConfirm={() => runAction(confirmReject, "reject")} onCancel={() => setConfirmReject(null)} />}
  </Stack>;
}
