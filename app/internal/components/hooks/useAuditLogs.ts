"use client";

import { useCallback, useMemo, useState } from "react";
import { listAuditLogs, type AuditLogItem } from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

export interface AuditLogsActions {
  logs: AuditLogItem[];
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
  filteredLogs: AuditLogItem[];
  handleExportCsv: () => void;
}

export function useAuditLogs(session: SessionState | null): AuditLogsActions {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setErrorText(null);
    try {
      const data = await listAuditLogs(session.token, {
        eventType: filterEventType || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });
      setLogs(data);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Could not load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  }, [session, filterEventType, filterDateFrom, filterDateTo]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Event type filter
      if (filterEventType && log.eventType !== filterEventType) return false;

      // Date range filter (compare date portion only)
      if (filterDateFrom) {
        const from = new Date(`${filterDateFrom}T00:00:00`);
        if (new Date(log.createdAt) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(`${filterDateTo}T23:59:59`);
        if (new Date(log.createdAt) > to) return false;
      }

      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const named = log as AuditLogItem & { actorName?: string | null };
        return (
          log.eventType.toLowerCase().includes(q) ||
          log.actorEmail?.toLowerCase().includes(q) ||
          named.actorName?.toLowerCase().includes(q) ||
          log.targetType?.toLowerCase().includes(q) ||
          log.targetId?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [logs, filterEventType, filterDateFrom, filterDateTo, searchQuery]);

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
    loading,
    errorText,
    refresh,
    searchQuery,
    setSearchQuery,
    filterEventType,
    setFilterEventType,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    filteredLogs,
    handleExportCsv,
  };
}
