"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
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
  agencyId: string;
  setAgencyId: (v: string) => void;
  // actions
  handleToggleClientStatus: (client: ClientItem) => Promise<void>;
  handleSoftDeleteClient: (client: ClientItem) => Promise<void>;
  handleBulkDeleteClients: (ids: string[]) => Promise<void>;
}

export function useClients(
  session: SessionState | null,
  initialPageSize = 25,
): ClientsActions {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
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
  const [agencyId, setAgencyId] = useState("");

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListClientsParams = {
    page,
    pageSize,
    search: search || undefined,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived || undefined,
    agencyId: agencyId || undefined,
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["clients", session?.token ?? "", queryParams],
    queryFn: () => listClients(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["clients", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(
    async (_overrides?: ListClientsParams) => {
      await refetch();
    },
    [refetch],
  );
  // ────────────────────────────────────────────────────────────────────────

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

  const handleToggleClientStatus = async (client: ClientItem) => {
    await runAction(`toggle-client-${client.id}`, async () => {
      if (!session) return;
      await updateClient(session.token, client.id, {
        isActive: !client.isActive,
      });
      await invalidate();
      setSuccessText(
        `Client ${client.isActive ? "deactivated" : "activated"}.`,
      );
    });
  };

  const handleSoftDeleteClient = async (client: ClientItem) => {
    await runAction(`delete-client-${client.id}`, async () => {
      if (!session) return;
      await softDeleteClient(session.token, client.id);
      await invalidate();
      setSuccessText("Client deleted.");
    });
  };

  const handleBulkDeleteClients = async (ids: string[]) => {
    await runAction("bulk-delete-clients", async () => {
      if (!session) return;
      await Promise.all(ids.map((id) => softDeleteClient(session.token, id)));
      await invalidate();
      setSuccessText(
        `${ids.length} client${ids.length !== 1 ? "s" : ""} deleted.`,
      );
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
    agencyId,
    setAgencyId,
    handleToggleClientStatus,
    handleSoftDeleteClient,
    handleBulkDeleteClients,
  };
}

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
  agencyId: string;
  setAgencyId: (v: string) => void;
  // actions
  handleToggleClientStatus: (client: ClientItem) => Promise<void>;
  handleSoftDeleteClient: (client: ClientItem) => Promise<void>;
  handleBulkDeleteClients: (ids: string[]) => Promise<void>;
}
