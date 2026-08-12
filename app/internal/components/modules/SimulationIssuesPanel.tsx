"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, FormControl, InputLabel, Link, MenuItem, Select, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import DownloadIcon from "@mui/icons-material/Download";
import type { SessionState } from "../../lib/authSession";
import { downloadSimulationIssueFile, listSimulationIssues, updateSimulationIssueStatus, type SimulationIssueItem } from "../../lib/internalApi";
import { DataTable, DateInput, TableFilterButton, TableFiltersDialog, type ColumnDef } from "../ui";
import { useI18n } from "@/lib/i18n-context";
import { FormSelect } from "../ui/FormSelect";
import { useLogTableToolbar } from "./logTableToolbar";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";

const STATUSES = ["NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
type IssuesView = { status: string; dateFrom: string; dateTo: string };
const ISSUES_VIEWS_STORAGE_KEY = "axpo_simulation_issue_views";

export function SimulationIssuesPanel({ session, onNotify }: { session: SessionState; onNotify?: (text: string, tone: "success" | "error") => void }) {
  const { t } = useI18n();
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
    RESOLVED: t("simulationIssues", "statusResolved"), DISMISSED: t("simulationIssues", "statusDismissed"),
  }), [t]);
  const { data, isFetching, error, refetch } = useQuery({
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

  const columns = useMemo<ColumnDef<SimulationIssueItem>[]>(() => [
    { key: "createdAt", label: t("logs", "timestamp"), sortable: true, minWidth: 160, flex: 0.8, renderCell: (row) => <Typography variant="body2" color="text.secondary" noWrap>{new Date(row.createdAt).toLocaleString()}</Typography> },
    { key: "simulationReference", label: t("simulationDetail", "title"), minWidth: 140, flex: 0.7, renderCell: (row) => row.simulationId ? <Link component={NextLink} href={`/internal/simulations/${row.simulationId}`} target="_blank" rel="noopener noreferrer" underline="hover" color="primary.main" sx={{ fontSize: "0.875rem", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.simulationReference || row.simulationId}</Link> : <Typography variant="body2" color="text.secondary" noWrap>{t("simulationIssues", "deletedSimulation")}</Typography> },
    { key: "reportedByUser", label: t("logs", "user"), minWidth: 220, flex: 1.1, renderCell: (row) => <Stack minWidth={0}><Typography variant="body2" noWrap>{row.reportedByUser.fullName}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.reportedByUser.email}</Typography></Stack> },
    { key: "description", label: t("simulationIssues", "description"), minWidth: 260, flex: 2, renderCell: (row) => <Typography variant="body2" noWrap title={row.description}>{row.description}</Typography> },
    { key: "status", label: t("simulationIssues", "status"), minWidth: 120, flex: 0.65, renderCell: (row) => <Chip size="small" label={labels[row.status]} color={row.status === "NEW" ? "error" : row.status === "IN_REVIEW" ? "warning" : row.status === "RESOLVED" ? "success" : "default"} sx={{ fontWeight: 600 }} /> },
  ], [labels, t]);

  return <><DataTable tableId="simulation-issues" columns={columns} rows={items} loading={isFetching} error={error instanceof Error ? error.message : undefined}
    {...searchProps} emptyMessage={t("simulationIssues", "empty")} t={t}
    onClearFilters={clearFilters} hasActiveFilters={Boolean(reporter || activeFilterCount)}
    headerRight={<TableFilterButton title={t("simulationsModule", "filtersTitle")} activeFilterCount={activeFilterCount} onClick={openFilters} />}
    pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
    rowHasDetails={() => true}
    rowDetailContent={(row) => <Box sx={{ display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", md: "row" }, gap: 2, px: 2, py: 1.5, width: "100%" }}>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ minWidth: 0 }}>
        <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadSimulationIssueFile(session.token, row.id, "snapshot", row.snapshotFileName)}>{t("simulationIssues", "simulationExcel")}</Button>
        {row.attachments.map((file) => <Button key={file.id} variant="outlined" size="small" startIcon={<DownloadIcon />} sx={{ maxWidth: 360 }} onClick={() => downloadSimulationIssueFile(session.token, row.id, file.id, file.fileName)}><Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.fileName}</Box></Button>)}
      </Stack>
      <Stack spacing={0.5} sx={{ width: { xs: "100%", md: 230 }, flexShrink: 0 }}>
        <FormControl size="small" fullWidth><InputLabel>{t("simulationIssues", "changeStatus")}</InputLabel><Select value={row.status} label={t("simulationIssues", "changeStatus")} onChange={async (event) => {
          try { await updateSimulationIssueStatus(session.token, row.id, event.target.value); await refetch(); }
          catch (cause) { onNotify?.(cause instanceof Error ? cause.message : t("common", "actionFailed"), "error"); }
        }}>{STATUSES.map((value) => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}</Select></FormControl>
        {row.handledByUser && <Typography variant="caption" color="text.secondary">{t("simulationIssues", "lastChangedBy", { name: row.handledByUser.fullName })}{row.statusChangedAt ? ` · ${new Date(row.statusChangedAt).toLocaleString()}` : ""}</Typography>}
      </Stack>
    </Box>}
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
    {saveViewDialog}
  </>;
}
