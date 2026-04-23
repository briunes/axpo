"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listClients,
  updateClient,
  softDeleteClient,
  type ClientItem,
  type ListClientsParams,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

export interface ClientsActions {
  clients: ClientItem[];
  loading: boolean;
  busyAction: string | null;
  errorText: string | null;
  successText: string | null;
  clearFeedback: () => void;
  refresh: (overrides?: ListClientsParams) => Promise<void>;
  // pagination
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  // sort
  sortColumn: string;
  sortDir: "asc" | "desc";
  setSort: (column: string, dir: "asc" | "desc") => void;
  // search
  search: string;
  setSearch: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  // actions
  handleToggleClientStatus: (client: ClientItem) => Promise<void>;
  handleSoftDeleteClient: (client: ClientItem) => Promise<void>;
}

export function useClients(
  session: SessionState | null,
  initialPageSize = 25,
): ClientsActions {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);
  // sync pageSize when user preferences load
  useEffect(() => {
    setPageSize(initialPageSize);
    setPage(1);
  }, [initialPageSize]);
  // sort
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  // search
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    try {
      setBusyAction(id);
      clearFeedback();
      await fn();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const refresh = useCallback(
    async (overrides?: ListClientsParams) => {
      if (!session) return;
      setLoading(true);
      try {
        const params: ListClientsParams = {
          page,
          pageSize,
          search: search || undefined,
          orderBy: sortColumn,
          sortDir,
          includeDeleted: showArchived || undefined,
          ...overrides,
        };
        const result = await listClients(session.token, params);
        setClients(result.items);
        setTotal(result.total);
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : "Could not load clients.",
        );
      } finally {
        setLoading(false);
      }
    },
    [session, page, pageSize, search, sortColumn, sortDir, showArchived],
  );

  const handleToggleClientStatus = async (client: ClientItem) => {
    await runAction(`toggle-client-${client.id}`, async () => {
      if (!session) return;
      await updateClient(session.token, client.id, {
        isActive: !client.isActive,
      });
      await refresh();
      setSuccessText(
        `Client ${client.isActive ? "deactivated" : "activated"}.`,
      );
    });
  };

  const handleSoftDeleteClient = async (client: ClientItem) => {
    await runAction(`delete-client-${client.id}`, async () => {
      if (!session) return;
      await softDeleteClient(session.token, client.id);
      await refresh();
      setSuccessText("Client deleted.");
    });
  };

  return {
    clients,
    loading,
    busyAction,
    errorText,
    successText,
    clearFeedback,
    refresh,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    sortColumn,
    sortDir,
    setSort,
    search,
    setSearch,
    showArchived,
    setShowArchived,
    handleToggleClientStatus,
    handleSoftDeleteClient,
  };
}
