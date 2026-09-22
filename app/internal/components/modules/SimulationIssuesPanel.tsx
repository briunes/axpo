"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Tooltip, Typography } from "@mui/material";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useActionButtons } from "../InternalWorkspace";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { SessionState } from "../../lib/authSession";
import { exportSimulationIssues, importSimulationIssues, listSimulationIssues, type IncidentImportResult, type SimulationIssueItem } from "../../lib/internalApi";
import { DataTable, DateInput, TableFilterButton, TableFiltersDialog, type ColumnDef } from "../ui";
import { useI18n } from "@/lib/i18n-context";
import { FormSelect } from "../ui/FormSelect";
import { useLogTableToolbar } from "./logTableToolbar";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";

const STATUSES = ["NEW", "IN_REVIEW", "ESCALATED", "RESOLVED", "DISMISSED"] as const;
type IssuesView = { status: string; dateFrom: string; dateTo: string };
const ISSUES_VIEWS_STORAGE_KEY = "axpo_simulation_issue_views";

export function SimulationIssuesPanel({ session, onNotify }: { session: SessionState; onNotify?: (text: string, tone: "success" | "error") => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const onActionButtons = useActionButtons();
  const fileInput = useRef<HTMLInputElement>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<IncidentImportResult | null>(null);
  const isSysAdmin = session.user.role === "SYS_ADMIN";
  useEffect(() => {
    onActionButtons?.(isSysAdmin ? <Tooltip title={t("simulationIssues", "importIncidents")} arrow>
      <span className="topbar-action-wrap"><Button className="topbar-action topbar-action--compact" variant="outlined" size="small" disabled={transferBusy}
        startIcon={<FileUploadOutlinedIcon fontSize="small" />} onClick={() => fileInput.current?.click()} aria-label={t("simulationIssues", "importIncidents")}>
        <span className="topbar-action-label">{t("simulationIssues", "importIncidents")}</span>
      </Button></span>
    </Tooltip> : null);
    return () => onActionButtons?.(null);
  }, [isSysAdmin, onActionButtons, t, transferBusy]);
  const cachePolicy = useRequestCachePolicy("logs");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState("");
  const [reporter, setReporter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const labels = useMemo(() => ({
    NEW: t("simulationIssues", "statusNew"), IN_REVIEW: t("simulationIssues", "statusInReview"),
    ESCALATED: t("simulationIssues", "statusEscalated"),
    RESOLVED: t("simulationIssues", "statusResolved"), DISMISSED: t("simulationIssues", "statusDismissed"),
  }), [t]);
  const { data, isFetching, error } = useQuery({
    queryKey: ["simulation-issues", session.token, status, reporter, dateFrom, dateTo, page, pageSize],
    queryFn: () => listSimulationIssues(session.token, { status, reporter, dateFrom, dateTo, page, pageSize }),
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });
  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  useEffect(() => {
    if (error) onNotify?.(error instanceof Error ? error.message : t("simulationIssues", "loadError"), "error");
  }, [error, onNotify, t]);

  const currentView = useMemo<IssuesView>(() => ({ status, dateFrom, dateTo }), [dateFrom, dateTo, status]);
  const applyView = useCallback((view: IssuesView) => {
    setStatus(view.status ?? ""); setDateFrom(view.dateFrom ?? ""); setDateTo(view.dateTo ?? ""); setPage(1);
  }, []);
  const presets = useMemo(() => [
    { id: "all", name: t("simulationIssues", "all"), view: { status: "", dateFrom: "", dateTo: "" } },
    { id: "new", name: labels.NEW, view: { status: "NEW", dateFrom: "", dateTo: "" } },
    { id: "in-review", name: labels.IN_REVIEW, view: { status: "IN_REVIEW", dateFrom: "", dateTo: "" } },
    { id: "escalated", name: labels.ESCALATED, view: { status: "ESCALATED", dateFrom: "", dateTo: "" } },
    { id: "resolved", name: labels.RESOLVED, view: { status: "RESOLVED", dateFrom: "", dateTo: "" } },
  ], [labels, t]);
  const { activeViewPresetId, openSaveViewDialog, saveViewDialog, searchProps } = useLogTableToolbar<IssuesView>({
    storageKey: ISSUES_VIEWS_STORAGE_KEY, currentView, presets, applyView,
    searchValue: reporter, onSearchChange: (value) => { setReporter(value); setPage(1); },
    searchPlaceholder: t("simulationIssues", "reporterSearch"), t,
  });
  const clearFilters = () => {
    setStatus(""); setDateFrom(""); setDateTo(""); setReporter("");
    setDraftStatus(""); setDraftDateFrom(""); setDraftDateTo(""); setPage(1); setFiltersOpen(false);
  };
  const applyFilters = () => {
    setStatus(draftStatus); setDateFrom(draftDateFrom); setDateTo(draftDateTo); setPage(1); setFiltersOpen(false);
  };
  const openFilters = () => {
    setDraftStatus(status); setDraftDateFrom(dateFrom); setDraftDateTo(dateTo); setFiltersOpen(true);
  };
  const activeFilterCount = activeViewPresetId ? 0 : [status, dateFrom || dateTo].filter(Boolean).length;

  const exportIncidents = async (ids: string[]) => {
    if (transferBusy || !ids.length) return;
    setTransferBusy(true); setTransferError("");
    try { await exportSimulationIssues(session.token, ids); }
    catch (error) { setTransferError(error instanceof Error ? error.message : t("common", "actionFailed")); }
    finally { setTransferBusy(false); }
  };
  const previewImport = async (file: File) => {
    setTransferBusy(true); setTransferError("");
    try { const preview = await importSimulationIssues(session.token, file, true); setImportFile(file); setImportPreview(preview); }
    catch (error) { setTransferError(error instanceof Error ? error.message : t("common", "actionFailed")); }
    finally { setTransferBusy(false); }
  };
  const confirmImport = async () => {
    if (!importFile) return;
    setTransferBusy(true); setTransferError("");
    try {
      const result = await importSimulationIssues(session.token, importFile, false);
      await queryClient.invalidateQueries({ queryKey: ["simulation-issues"] });
      setImportFile(null); setImportPreview(null);
      onNotify?.(t("simulationIssues", "importComplete", { imported: result.imported, skipped: result.skipped }), "success");
    } catch (error) { setTransferError(error instanceof Error ? error.message : t("common", "actionFailed")); }
    finally { setTransferBusy(false); }
  };

  const columns = useMemo<ColumnDef<SimulationIssueItem>[]>(() => [
    { key: "createdAt", label: t("logs", "timestamp"), sortable: true, minWidth: 160, flex: 0.8, renderCell: (row) => <Typography variant="body2" color="text.secondary" noWrap>{new Date(row.createdAt).toLocaleString()}</Typography> },
    { key: "simulationReference", label: t("simulationDetail", "title"), minWidth: 140, flex: 0.7, renderCell: (row) => row.simulationId ? <Link component={NextLink} href={`/internal/simulations/${row.simulationId}`} target="_blank" rel="noopener noreferrer" underline="hover" color="primary.main" sx={{ fontSize: "0.875rem", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.simulationReference || row.simulationId}</Link> : <Typography variant="body2" color="text.secondary" noWrap>{t("simulationIssues", "deletedSimulation")}</Typography> },
    { key: "reportedByUser", label: t("logs", "user"), minWidth: 220, flex: 1.1, renderCell: (row) => <Stack minWidth={0}><Typography variant="body2" noWrap>{row.reportedByUser.fullName}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.reportedByUser.email}</Typography></Stack> },
    { key: "description", label: t("simulationIssues", "description"), minWidth: 260, flex: 2, renderCell: (row) => <Typography variant="body2" noWrap title={row.description}>{row.description}</Typography> },
    { key: "appStatus", label: t("simulationIssues", "appStatus"), minWidth: 170, flex: 0.8, renderCell: (row) => row.appStatus ? <Chip size="small" label={labels[row.appStatus]} color={row.appStatus === "RESOLVED" ? "success" : row.appStatus === "IN_REVIEW" ? "warning" : "default"} /> : <Typography variant="body2">—</Typography> },
    { key: "status", label: t("simulationIssues", "status"), minWidth: 120, flex: 0.65, renderCell: (row) => <Chip size="small" label={labels[row.status]} color={row.status === "NEW" ? "error" : row.status === "ESCALATED" ? "info" : row.status === "IN_REVIEW" ? "warning" : row.status === "RESOLVED" ? "success" : "default"} sx={{ fontWeight: 600 }} /> },
  ], [labels, t]);

  return <>
    {transferError && !importPreview && <Alert severity="error" sx={{ mb: 2 }}>{transferError}</Alert>}
    {isSysAdmin && <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void previewImport(file); }} />}
    <DataTable tableId="simulation-issues" columns={columns} rows={items} loading={isFetching} error={error instanceof Error ? error.message : undefined}
    {...searchProps} emptyMessage={t("simulationIssues", "empty")} t={t}
    onClearFilters={clearFilters} hasActiveFilters={Boolean(reporter || activeFilterCount)}
    headerRight={<TableFilterButton title={t("simulationsModule", "filtersTitle")} activeFilterCount={activeFilterCount} onClick={openFilters} />}
    massActions={isSysAdmin ? [{ label: t("simulationIssues", "exportIncidents"), icon: <FileDownloadOutlinedIcon fontSize="small" />, onClick: exportIncidents, disabled: transferBusy }] : undefined}
    pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
    onRowClick={(row) => router.push(`/internal/simulations/issues/${row.id}`)}
  />
    <TableFiltersDialog open={filtersOpen} title={t("simulationsModule", "filtersTitle")}
      saveViewLabel={t("simulationsModule", "saveView")} clearLabel={t("simulationsModule", "clearFilters")}
      applyLabel={t("simulationsModule", "applyFilters")} onClose={() => setFiltersOpen(false)}
      onOpenSaveView={openSaveViewDialog} onClear={clearFilters} onApply={applyFilters}>
      <FormSelect label={t("simulationIssues", "status")} options={[
        { value: "", label: t("simulationIssues", "all") }, ...STATUSES.map((value) => ({ value, label: labels[value] })),
      ]} value={draftStatus} onChange={(value) => setDraftStatus(String(value ?? ""))} textFieldProps={{ size: "small" }} />
      <DateInput label={t("simulationIssues", "from")} labelPosition="top" value={draftDateFrom} onChange={setDraftDateFrom} />
      <DateInput label={t("simulationIssues", "to")} labelPosition="top" value={draftDateTo} onChange={setDraftDateTo} />
    </TableFiltersDialog>
    {isSysAdmin && <Dialog open={Boolean(importPreview)} onClose={() => { if (!transferBusy) { setImportFile(null); setImportPreview(null); } }} fullWidth maxWidth="sm">
      <DialogTitle>{t("simulationIssues", "importIncidents")}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        {transferError && <Alert severity="error">{transferError}</Alert>}
        <Typography>{t("simulationIssues", "transferHelp")}</Typography>
        <Typography>{t("simulationIssues", "importSummary", { count: importPreview?.toImport ?? 0, skipped: importPreview?.skipped ?? 0 })}</Typography>
        {Boolean(importPreview?.missingUsers.length) && <Alert severity="warning">{t("simulationIssues", "missingImportUsers")}<Typography variant="body2">{importPreview?.missingUsers.join(", ")}</Typography></Alert>}
        {Boolean(importPreview?.missingSimulations.length) && <Alert severity="warning">{t("simulationIssues", "missingImportSimulations")}<Typography variant="body2">{importPreview?.missingSimulations.join(", ")}</Typography></Alert>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={transferBusy} onClick={() => { setImportFile(null); setImportPreview(null); }}>{t("actions", "cancel")}</Button><Button variant="contained" disabled={transferBusy || !importPreview?.toImport} onClick={confirmImport}>{t("simulationIssues", "importIncidents")}</Button></DialogActions>
    </Dialog>}
    {saveViewDialog}
  </>;
}
