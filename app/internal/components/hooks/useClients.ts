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
import { useRequestCachePolicy } from "./useRequestCachePolicy";
import { normalizeQueryKeyParams } from "./queryKeys";

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

interface UseClientsOptions {
  usePersistedState?: boolean;
  minimal?: boolean;
}

interface ClientsFilterPersistentState {
  agencyId: string;
}

export function useClients(
  session: SessionState | null,
  initialPageSize = 25,
  options?: UseClientsOptions,
): ClientsActions {
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("clients");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const usePersistedState = options?.usePersistedState ?? true;
  const minimal = options?.minimal ?? false;

  // Load persisted state from localStorage
  const getPersistedState = () => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_dt_state_clients");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const persistedState = getPersistedState();

  const getPersistedFilters = (): ClientsFilterPersistentState | null => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_clients_filters");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ClientsFilterPersistentState>;
      return {
        agencyId: parsed.agencyId ?? "",
      };
    } catch {
      return null;
    }
  };
  const persistedFilters = getPersistedFilters();

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  // sync pageSize when user preferences load
  useEffect(() => {
    setPageSize(initialPageSize);
    setPage(1);
  }, [initialPageSize]);
  // sort - load from persisted state if available
  const [sortColumn, setSortColumn] = useState(
    persistedState?.sortColumn || "name",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    persistedState?.sortDirection || "asc",
  );
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  // search - load from persisted state if available
  const [search, setSearch] = useState(persistedState?.search || "");
  const [showArchived, setShowArchived] = useState(false);
  const [agencyId, setAgencyId] = useState(persistedFilters?.agencyId || "");

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  // Persist clients agency filter across navigation
  useEffect(() => {
    if (!usePersistedState) return;
    if (typeof window === "undefined") return;
    try {
      const nextState: ClientsFilterPersistentState = {
        agencyId,
      };
      localStorage.setItem("axpo_clients_filters", JSON.stringify(nextState));
    } catch {
      // ignore persistence failures
    }
  }, [usePersistedState, agencyId]);

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListClientsParams = {
    page,
    pageSize,
    search: search || undefined,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived || undefined,
    agencyId: agencyId || undefined,
    minimal: minimal || undefined,
  };

  const queryKeyParams = normalizeQueryKeyParams({
    page,
    pageSize,
    search,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived,
    agencyId,
    minimal,
  });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["clients", session?.token ?? "", queryKeyParams],
    queryFn: () => listClients(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
    ...cachePolicy,
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
