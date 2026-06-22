"use client";

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAuditLogs, type AuditLogItem } from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import { useRequestCachePolicy } from "./useRequestCachePolicy";
import { normalizeQueryKeyParams } from "./queryKeys";

export interface AuditLogsActions {
  logs: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  loading: boolean;
  errorText: string | null;
  refresh: () => Promise<void>;
  // filters
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterEventType: string;
  setFilterEventType: (v: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  filterActorSearch: string;
  setFilterActorSearch: (v: string) => void;
  filterTargetType: string;
  setFilterTargetType: (v: string) => void;
  filteredLogs: AuditLogItem[];
  handleExportCsv: () => void;
}

export function useAuditLogs(session: SessionState | null): AuditLogsActions {
  const cachePolicy = useRequestCachePolicy("logs");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterActorSearch, setFilterActorSearch] = useState("");
  const [filterTargetType, setFilterTargetType] = useState("");

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams = {
    page,
    limit: pageSize,
    eventType: filterEventType || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    search: searchQuery || undefined,
    actorSearch: filterActorSearch || undefined,
    targetType: filterTargetType || undefined,
  };
  const queryKeyParams = normalizeQueryKeyParams({
    page,
    limit: pageSize,
    eventType: filterEventType,
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    search: searchQuery,
    actorSearch: filterActorSearch,
    targetType: filterTargetType,
  });

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["audit-logs", session?.token ?? "", queryKeyParams],
    queryFn: () => listAuditLogs(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const logs = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;
  const loading = isFetching;
  const errorText = error instanceof Error ? error.message : null;

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  // ────────────────────────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => {
    return logs;
  }, [logs]);

  const handleSetSearchQuery = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleSetFilterEventType = (value: string) => {
    setFilterEventType(value);
    setPage(1);
  };

  const handleSetFilterDateFrom = (value: string) => {
    setFilterDateFrom(value);
    setPage(1);
  };

  const handleSetFilterDateTo = (value: string) => {
    setFilterDateTo(value);
    setPage(1);
  };

  const handleSetPageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const handleExportCsv = () => {
    const rows = [
      ["ID", "Event Type", "Actor", "Target Type", "Target ID", "Timestamp"],
      ...filteredLogs.map((l) => [
        l.id,
        l.eventType,
        l.actorEmail ?? "",
        l.targetType ?? "",
        l.targetId ?? "",
        l.createdAt,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize: handleSetPageSize,
    loading,
    errorText,
    refresh,
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    filterEventType,
    setFilterEventType: handleSetFilterEventType,
    filterDateFrom,
    setFilterDateFrom: handleSetFilterDateFrom,
    filterDateTo,
    setFilterDateTo: handleSetFilterDateTo,
    filterActorSearch,
    setFilterActorSearch: (v: string) => {
      setFilterActorSearch(v);
      setPage(1);
    },
    filterTargetType,
    setFilterTargetType: (v: string) => {
      setFilterTargetType(v);
      setPage(1);
    },
    filteredLogs,
    handleExportCsv,
  };
}
