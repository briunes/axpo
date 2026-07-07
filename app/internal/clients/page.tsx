"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSession } from "../lib/authSession";
import { useClients } from "../components/hooks/useClients";
import { ClientsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";
import { getClientsInit } from "../lib/internalApi";

const readJsonStorage = <T,>(key: string): Partial<T> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
};

export default function ClientsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  const initParams = useMemo(() => {
    const tableState = readJsonStorage<{
      sortColumn: string;
      sortDirection: "asc" | "desc";
      search: string;
    }>("axpo_dt_state_clients");
    const filterState = readJsonStorage<{ agencyId: string }>(
      "axpo_clients_filters",
    );

    return {
      clients: {
        page: 1,
        pageSize: preferences.itemsPerPage,
        search: tableState.search || undefined,
        orderBy: tableState.sortColumn || "name",
        sortDir: tableState.sortDirection || "asc",
        agencyId: filterState.agencyId || undefined,
      },
      agencies: {
        page: 1,
        pageSize: 1000,
        minimal: true,
      },
    };
  }, [preferences.itemsPerPage]);

  const clientsInit = useQuery({
    queryKey: ["clients-init", session?.token ?? "", initParams],
    queryFn: () => getClientsInit(session!.token, initParams),
    enabled: !!session,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const useFallbackQueries = clientsInit.isError;
  const hasInitData = !!clientsInit.data;

  const clientsActions = useClients(session, preferences.itemsPerPage, {
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: clientsInit.data?.clients,
    initialDataParams: initParams.clients,
  });
  const displayedClientsActions = {
    ...clientsActions,
    loading: clientsInit.isLoading || clientsActions.loading,
  };
  useRegisterRefresh(() => clientsActions.refresh());

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <ClientsModule
      session={session}
      actions={displayedClientsActions}
      agencies={clientsInit.data?.agencies.items}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
