"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  createAgency,
  listAgencies,
  updateAgency,
  updateAgencyStatus,
  deleteAgency,
  type AgencyItem,
  type ListAgenciesParams,
  type ListAgenciesResponse,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import { useRequestCachePolicy } from "./useRequestCachePolicy";
import { normalizeQueryKeyParams } from "./queryKeys";

export interface AgenciesActions {
  agencies: AgencyItem[];
  loading: boolean;
  busyAction: string | null;
  errorText: string | null;
  successText: string | null;
  clearFeedback: () => void;
  refresh: () => Promise<void>;
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
  tlvFilter: string;
  setTlvFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  // create
  newAgencyName: string;
  setNewAgencyName: (v: string) => void;
  handleCreateAgency: (e: React.FormEvent) => Promise<void>;
  // edit
  selectedAgencyId: string | null;
  editAgencyName: string;
  setEditAgencyName: (v: string) => void;
  openAgencyEditor: (agency: AgencyItem) => void;
  closeAgencyEditor: () => void;
  handleUpdateAgency: (e: React.FormEvent) => Promise<void>;
  handleToggleAgencyStatus: (agency: AgencyItem) => Promise<void>;
  handleDeleteAgency: (agency: AgencyItem) => Promise<void>;
  handleBulkDeleteAgencies: (ids: string[]) => Promise<void>;
}

interface UseAgenciesOptions {
  queryEnabled?: boolean;
  minimal?: boolean;
  usePersistedState?: boolean;
  initialData?: ListAgenciesResponse;
  initialDataParams?: ListAgenciesParams;
}

interface AgenciesFilterPersistentState {
  tlvFilter: string;
  statusFilter: string;
}

export function useAgencies(
  session: SessionState | null,
  initialPageSize = 25,
  options?: UseAgenciesOptions,
): AgenciesActions {
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("agencies");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const minimal = options?.minimal ?? false;
  const usePersistedState = options?.usePersistedState ?? !minimal;

  // Load persisted state from localStorage
  const getPersistedState = () => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_dt_state_agencies");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const persistedState = getPersistedState();

  const getPersistedFilters = (): AgenciesFilterPersistentState | null => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_agencies_filters");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<AgenciesFilterPersistentState>;
      return {
        tlvFilter: parsed.tlvFilter ?? "",
        statusFilter: parsed.statusFilter ?? "",
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
    persistedState?.sortColumn || "createdAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    persistedState?.sortDirection || "desc",
  );
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  // search - load from persisted state if available
  const [search, setSearch] = useState(persistedState?.search || "");
  const [tlvFilter, setTlvFilter] = useState(persistedFilters?.tlvFilter || "");
  const [statusFilter, setStatusFilter] = useState(
    persistedFilters?.statusFilter || "",
  );
  const [showArchived, setShowArchived] = useState(false);

  const [newAgencyName, setNewAgencyName] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [editAgencyName, setEditAgencyName] = useState("");
  const queryEnabled = options?.queryEnabled ?? true;

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  useEffect(() => {
    if (!usePersistedState) return;
    if (typeof window === "undefined") return;
    try {
      const nextState: AgenciesFilterPersistentState = {
        tlvFilter,
        statusFilter,
      };
      localStorage.setItem("axpo_agencies_filters", JSON.stringify(nextState));
    } catch {
      // ignore persistence failures
    }
  }, [usePersistedState, tlvFilter, statusFilter]);

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListAgenciesParams = {
    page,
    pageSize,
    search: search || undefined,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived || undefined,
    minimal: minimal || undefined,
    isTlv:
      tlvFilter === "tlv"
        ? true
        : tlvFilter === "standard"
          ? false
          : undefined,
    status:
      statusFilter === "active" || statusFilter === "inactive"
        ? statusFilter
        : undefined,
  };
  const queryKeyParams = normalizeQueryKeyParams({
    page,
    pageSize,
    search,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived,
    minimal,
    isTlv: queryParams.isTlv,
    status: queryParams.status,
  });
  const initialDataKeyParams = options?.initialDataParams
    ? normalizeQueryKeyParams({
        page: options.initialDataParams.page ?? 1,
        pageSize: options.initialDataParams.pageSize ?? initialPageSize,
        search: options.initialDataParams.search ?? "",
        orderBy: options.initialDataParams.orderBy ?? "createdAt",
        sortDir: options.initialDataParams.sortDir ?? "desc",
        includeDeleted: options.initialDataParams.includeDeleted ?? false,
        minimal: options.initialDataParams.minimal ?? false,
        isTlv: options.initialDataParams.isTlv,
        status: options.initialDataParams.status,
      })
    : null;
  const canUseInitialData =
    !!options?.initialData &&
    !!initialDataKeyParams &&
    JSON.stringify(queryKeyParams) === JSON.stringify(initialDataKeyParams);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["agencies", session?.token ?? "", queryKeyParams],
    queryFn: () => listAgencies(session!.token, queryParams),
    enabled: !!session && queryEnabled,
    initialData: canUseInitialData ? options.initialData : undefined,
    initialDataUpdatedAt: canUseInitialData ? Date.now() : undefined,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const agencies = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["agencies", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
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

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newAgencyName.trim()) {
      setErrorText("Agency name is required.");
      return;
    }
    await runAction("create-agency", async () => {
      await createAgency(session.token, { name: newAgencyName.trim() });
      setNewAgencyName("");
      await invalidate();
      setSuccessText("Agency created.");
    });
  };

  const openAgencyEditor = (agency: AgencyItem) => {
    setSelectedAgencyId(agency.id);
    setEditAgencyName(agency.name);
  };

  const closeAgencyEditor = () => setSelectedAgencyId(null);

  const handleUpdateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedAgencyId) return;
    if (!editAgencyName.trim()) {
      setErrorText("Agency name is required.");
      return;
    }
    await runAction("update-agency", async () => {
      await updateAgency(session.token, selectedAgencyId, {
        name: editAgencyName.trim(),
      });
      await invalidate();
      setSuccessText("Agency updated.");
      setSelectedAgencyId(null);
    });
  };

  const handleToggleAgencyStatus = async (agency: AgencyItem) => {
    await runAction(`toggle-agency-${agency.id}`, async () => {
      if (!session) return;
      await updateAgencyStatus(session.token, agency.id, !agency.isActive);
      await invalidate();
      setSuccessText(
        `Agency ${agency.isActive ? "deactivated" : "activated"}.`,
      );
    });
  };

  const handleDeleteAgency = async (agency: AgencyItem): Promise<void> => {
    if (!session) return;
    await runAction(`delete-agency-${agency.id}`, async () => {
      await deleteAgency(session.token, agency.id);
      await invalidate();
      setSuccessText("Agency deleted.");
    });
  };

  const handleBulkDeleteAgencies = async (ids: string[]): Promise<void> => {
    await runAction("bulk-delete-agencies", async () => {
      if (!session) return;
      await Promise.all(ids.map((id) => deleteAgency(session.token, id)));
      await invalidate();
      setSuccessText(
        `${ids.length} agenc${ids.length !== 1 ? "ies" : "y"} deleted.`,
      );
    });
  };

  return {
    agencies,
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
    tlvFilter,
    setTlvFilter,
    statusFilter,
    setStatusFilter,
    showArchived,
    setShowArchived,
    newAgencyName,
    setNewAgencyName,
    handleCreateAgency,
    selectedAgencyId,
    editAgencyName,
    setEditAgencyName,
    openAgencyEditor,
    closeAgencyEditor,
    handleUpdateAgency,
    handleToggleAgencyStatus,
    handleDeleteAgency,
    handleBulkDeleteAgencies,
  };
}
