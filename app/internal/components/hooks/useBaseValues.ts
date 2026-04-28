"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  activateBaseValueSet,
  listBaseValueSets,
  updateBaseValueSet,
  uploadBaseValueFile,
  toggleBaseValueSetProduction,
  type BaseValueSetItem,
  type ListBaseValueSetsParams,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

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
  // actions
  handleActivateBaseValueSet: (setItem: BaseValueSetItem) => Promise<void>;
  handleArchiveBaseValueSet: (setItem: BaseValueSetItem) => Promise<void>;
  handleToggleProduction: (setItem: BaseValueSetItem) => Promise<void>;
  handleUploadFile: (file: File, replace?: boolean) => Promise<void>;
}

export function useBaseValues(session: SessionState | null): BaseValuesActions {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListBaseValueSetsParams = {
    page,
    pageSize,
    search: search || undefined,
    orderBy: sortColumn,
    sortDir,
    showArchived,
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["base-values", session?.token ?? "", queryParams],
    queryFn: () => listBaseValueSets(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });

  const baseValueSets = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["base-values", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(async (_overrides?: ListBaseValueSetsParams) => {
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

  const handleUploadFile = async (file: File, replace: boolean = false) => {
    await runAction("upload-base-value-file", async () => {
      if (!session) return;
      const result = await uploadBaseValueFile(session.token, file, replace);
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
        "Base value set set as production. Others marked as draft.",
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
    handleActivateBaseValueSet,
    handleArchiveBaseValueSet,
    handleToggleProduction,
    handleUploadFile,
  };
}