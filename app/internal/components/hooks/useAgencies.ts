"use client";

import { useCallback, useState } from "react";
import {
  createAgency,
  listAgencies,
  updateAgency,
  updateAgencyStatus,
  type AgencyItem,
  type ListAgenciesParams,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";

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
}

export function useAgencies(session: SessionState | null): AgenciesActions {
  const [agencies, setAgencies] = useState<AgencyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  // sort
  const [sortColumn, setSortColumn] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  // search
  const [search, setSearch] = useState("");

  const [newAgencyName, setNewAgencyName] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [editAgencyName, setEditAgencyName] = useState("");

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
    async (overrides?: ListAgenciesParams) => {
      if (!session) return;
      setLoading(true);
      try {
        const params: ListAgenciesParams = {
          page,
          pageSize,
          search: search || undefined,
          orderBy: sortColumn,
          sortDir,
          ...overrides,
        };
        const result = await listAgencies(session.token, params);
        setAgencies(result.items);
        setTotal(result.total);
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : "Could not load agencies.",
        );
      } finally {
        setLoading(false);
      }
    },
    [session, page, pageSize, search, sortColumn, sortDir],
  );

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newAgencyName.trim()) {
      setErrorText("Agency name is required.");
      return;
    }
    await runAction("create-agency", async () => {
      await createAgency(session.token, { name: newAgencyName.trim() });
      setNewAgencyName("");
      await refresh();
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
      await refresh();
      setSuccessText("Agency updated.");
      setSelectedAgencyId(null);
    });
  };

  const handleToggleAgencyStatus = async (agency: AgencyItem) => {
    await runAction(`toggle-agency-${agency.id}`, async () => {
      if (!session) return;
      await updateAgencyStatus(session.token, agency.id, !agency.isActive);
      await refresh();
      setSuccessText(
        `Agency ${agency.isActive ? "deactivated" : "activated"}.`,
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
  };
}
