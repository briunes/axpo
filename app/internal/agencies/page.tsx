"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSession } from "../lib/authSession";
import { useAgencies } from "../components/hooks/useAgencies";
import { AgenciesModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";
import { getAgenciesInit } from "../lib/internalApi";

const readJsonStorage = <T,>(key: string): Partial<T> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
};

export default function AgenciesPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  const initParams = useMemo(() => {
    const tableState = readJsonStorage<{
      sortColumn: string;
      sortDirection: "asc" | "desc";
      search: string;
    }>("axpo_dt_state_agencies");
    const filterState = readJsonStorage<{
      tlvFilter: string;
      statusFilter: string;
    }>("axpo_agencies_filters");

    const status: "active" | "inactive" | undefined =
      filterState.statusFilter === "active" ||
      filterState.statusFilter === "inactive"
        ? filterState.statusFilter
        : undefined;

    return {
      page: 1,
      pageSize: preferences.itemsPerPage,
      search: tableState.search || undefined,
      orderBy: tableState.sortColumn || "createdAt",
      sortDir: tableState.sortDirection || "desc",
      isTlv:
        filterState.tlvFilter === "tlv"
          ? true
          : filterState.tlvFilter === "standard"
            ? false
            : undefined,
      status,
    };
  }, [preferences.itemsPerPage]);

  const agenciesInit = useQuery({
    queryKey: ["agencies-init", session?.token ?? "", initParams],
    queryFn: () => getAgenciesInit(session!.token, initParams),
    enabled: !!session,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const useFallbackQueries = agenciesInit.isError;
  const hasInitData = !!agenciesInit.data;

  // TanStack Query auto-fetches on mount
  const agenciesActions = useAgencies(session, preferences.itemsPerPage, {
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: agenciesInit.data?.agencies,
    initialDataParams: initParams,
  });
  const displayedAgenciesActions = {
    ...agenciesActions,
    loading: agenciesInit.isLoading || agenciesActions.loading,
  };
  useRegisterRefresh(() => agenciesActions.refresh());

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <AgenciesModule
      session={session}
      actions={displayedAgenciesActions}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
