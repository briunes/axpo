"use client";

import { useCallback, useState } from "react";
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
  const [baseValueSets, setBaseValueSets] = useState<BaseValueSetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
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
    async (overrides?: ListBaseValueSetsParams) => {
      if (!session) return;
      setLoading(true);
      try {
        const params: ListBaseValueSetsParams = {
          page,
          pageSize,
          search: search || undefined,
          orderBy: sortColumn,
          sortDir,
          showArchived,
          ...overrides,
        };
        const result = await listBaseValueSets(session.token, params);
        setBaseValueSets(result.items);
        setTotal(result.total);
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : "Could not load base value sets.",
        );
      } finally {
        setLoading(false);
      }
    },
    [session, page, pageSize, search, sortColumn, sortDir, showArchived],
  );

  const handleActivateBaseValueSet = async (setItem: BaseValueSetItem) => {
    await runAction(`activate-base-value-${setItem.id}`, async () => {
      if (!session) return;
      await activateBaseValueSet(session.token, setItem.id);
      await refresh();
      setSuccessText("Base value set activated.");
    });
  };

  const handleArchiveBaseValueSet = async (setItem: BaseValueSetItem) => {
    await runAction(`archive-base-value-${setItem.id}`, async () => {
      if (!session) return;
      await updateBaseValueSet(session.token, setItem.id, {
        isDeleted: !setItem.isDeleted,
      });
      await refresh();
      setSuccessText(
        `Base value set ${setItem.isDeleted ? "restored" : "archived"}.`,
      );
    });
  };

  const handleUploadFile = async (file: File, replace: boolean = false) => {
    await runAction("upload-base-value-file", async () => {
      if (!session) return;
      const result = await uploadBaseValueFile(session.token, file, replace);
      await refresh();
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
      await refresh();
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
