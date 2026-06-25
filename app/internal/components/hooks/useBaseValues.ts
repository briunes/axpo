"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  activateBaseValueSet,
  listBaseValueSets,
  updateBaseValueSet,
  uploadBaseValueFile,
  toggleBaseValueSetProduction,
  type BaseValueScopeType,
  type BaseValueSetItem,
  type ListBaseValueSetsParams,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import { useRequestCachePolicy } from "./useRequestCachePolicy";
import { normalizeQueryKeyParams } from "./queryKeys";

export interface BaseValuesActions {
  baseValueSets: BaseValueSetItem[];
  loading: boolean;
  busyAction: string | null;
  errorText: string | null;
  successText: string | null;
  clearFeedback: () => void;
  refresh: (overrides?: ListBaseValueSetsParams) => Promise<void>;
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
  // showArchived
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  scopeFilter: "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">;
  setScopeFilter: (v: "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">) => void;
  statusFilter: "" | "ACTIVE" | "DRAFT" | "ARCHIVED";
  setStatusFilter: (v: "" | "ACTIVE" | "DRAFT" | "ARCHIVED") => void;
  productionFilter: "" | "production" | "standard";
  setProductionFilter: (v: "" | "production" | "standard") => void;
  // actions
  handleActivateBaseValueSet: (setItem: BaseValueSetItem) => Promise<void>;
  handleArchiveBaseValueSet: (setItem: BaseValueSetItem) => Promise<void>;
  handleToggleProduction: (setItem: BaseValueSetItem) => Promise<void>;
  handleUploadFile: (
    file: File,
    replace?: boolean,
    scopeType?: Extract<BaseValueScopeType, "GLOBAL" | "TLV">,
  ) => Promise<void>;
}

interface BaseValuesFilterPersistentState {
  scopeFilter: "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">;
  statusFilter: "" | "ACTIVE" | "DRAFT" | "ARCHIVED";
  productionFilter: "" | "production" | "standard";
  showArchived: boolean;
}

export function useBaseValues(session: SessionState | null): BaseValuesActions {
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("baseValues");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Load persisted state from localStorage
  const getPersistedState = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_dt_state_base-values");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const persistedState = getPersistedState();

  const getPersistedFilters = (): BaseValuesFilterPersistentState | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_base_values_filters");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<BaseValuesFilterPersistentState>;
      return {
        scopeFilter:
          parsed.scopeFilter === "GLOBAL" || parsed.scopeFilter === "TLV"
            ? parsed.scopeFilter
            : "",
        statusFilter:
          parsed.statusFilter === "ACTIVE" ||
          parsed.statusFilter === "DRAFT" ||
          parsed.statusFilter === "ARCHIVED"
            ? parsed.statusFilter
            : "",
        productionFilter:
          parsed.productionFilter === "production" ||
          parsed.productionFilter === "standard"
            ? parsed.productionFilter
            : "",
        showArchived: parsed.showArchived ?? false,
      };
    } catch {
      return null;
    }
  };
  const persistedFilters = getPersistedFilters();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState(
    persistedState?.sortColumn || "updatedAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    persistedState?.sortDirection || "desc",
  );
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  const [search, setSearch] = useState(persistedState?.search || "");
  const [showArchived, setShowArchived] = useState(
    persistedFilters?.showArchived || false,
  );
  const [scopeFilter, setScopeFilter] = useState<
    "" | Extract<BaseValueScopeType, "GLOBAL" | "TLV">
  >(persistedFilters?.scopeFilter || "");
  const [statusFilter, setStatusFilter] = useState<
    "" | "ACTIVE" | "DRAFT" | "ARCHIVED"
  >(persistedFilters?.statusFilter || "");
  const [productionFilter, setProductionFilter] = useState<
    "" | "production" | "standard"
  >(persistedFilters?.productionFilter || "");

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const nextState: BaseValuesFilterPersistentState = {
        scopeFilter,
        statusFilter,
        productionFilter,
        showArchived,
      };
      localStorage.setItem("axpo_base_values_filters", JSON.stringify(nextState));
    } catch {
      // ignore persistence failures
    }
  }, [scopeFilter, statusFilter, productionFilter, showArchived]);

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListBaseValueSetsParams = {
    page,
    pageSize,
    search: search || undefined,
    orderBy: sortColumn,
    sortDir,
    showArchived,
    scopeType: scopeFilter || undefined,
    status: statusFilter || undefined,
    production: productionFilter || undefined,
  };
  const queryKeyParams = normalizeQueryKeyParams({
    page,
    pageSize,
    search,
    orderBy: sortColumn,
    sortDir,
    showArchived,
    scopeType: scopeFilter,
    status: statusFilter,
    production: productionFilter,
  });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["base-values", session?.token ?? "", queryKeyParams],
    queryFn: () => listBaseValueSets(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const baseValueSets = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["base-values", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(
    async (_overrides?: ListBaseValueSetsParams) => {
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

  const handleActivateBaseValueSet = async (setItem: BaseValueSetItem) => {
    await runAction(`activate-base-value-${setItem.id}`, async () => {
      if (!session) return;
      await activateBaseValueSet(session.token, setItem.id);
      await invalidate();
      setSuccessText("Base value set activated.");
    });
  };

  const handleArchiveBaseValueSet = async (setItem: BaseValueSetItem) => {
    await runAction(`archive-base-value-${setItem.id}`, async () => {
      if (!session) return;
      await updateBaseValueSet(session.token, setItem.id, {
        isDeleted: !setItem.isDeleted,
      });
      await invalidate();
      setSuccessText(
        `Base value set ${setItem.isDeleted ? "restored" : "archived"}.`,
      );
    });
  };

  const handleUploadFile = async (
    file: File,
    replace: boolean = false,
    scopeType?: Extract<BaseValueScopeType, "GLOBAL" | "TLV">,
  ) => {
    await runAction("upload-base-value-file", async () => {
      if (!session) return;
      const result = await uploadBaseValueFile(
        session.token,
        file,
        replace,
        scopeType,
      );
      await invalidate();
      setSuccessText(result.message);
    });
  };

  const handleToggleProduction = async (setItem: BaseValueSetItem) => {
    await runAction(`toggle-production-${setItem.id}`, async () => {
      if (!session) return;
      await toggleBaseValueSetProduction(
        session.token,
        setItem.id,
        !setItem.isProduction,
      );
      await invalidate();
      setSuccessText(
        `Base value set set as ${setItem.scopeType} production. Other ${setItem.scopeType} sets marked as draft.`,
      );
    });
  };

  return {
    baseValueSets,
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
    scopeFilter,
    setScopeFilter,
    statusFilter,
    setStatusFilter,
    productionFilter,
    setProductionFilter,
    handleActivateBaseValueSet,
    handleArchiveBaseValueSet,
    handleToggleProduction,
    handleUploadFile,
  };
}
