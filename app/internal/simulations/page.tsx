"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSession } from "../lib/authSession";
import { useSimulations } from "../components/hooks/useSimulations";
import { useClients } from "../components/hooks/useClients";
import { useUsers } from "../components/hooks/useUsers";
import { SimulationsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";
import { getSimulationsInit, type UserItem } from "../lib/internalApi";

const readJsonStorage = <T,>(key: string): Partial<T> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
};

export default function SimulationsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  const isCommercial = session?.user.role === "COMMERCIAL";
  const initParams = useMemo(() => {
    const tableState = readJsonStorage<{
      sortColumn: string;
      sortDirection: "asc" | "desc";
      search: string;
    }>("axpo_dt_state_simulations");
    const filterState = readJsonStorage<{
      ownerUserId: string;
      clientId: string;
      cups: string;
      status: string;
      type: string;
      createdFrom: string;
      createdTo: string;
      expiresFrom: string;
      expiresTo: string;
    }>("axpo_simulations_filters");
    const ownerUserId = isCommercial
      ? (session?.user.id ?? "")
      : (filterState.ownerUserId ?? "");

    return {
      simulations: {
        page: 1,
        pageSize: preferences.itemsPerPage,
        orderBy: tableState.sortColumn || "updatedAt",
        sortDir: tableState.sortDirection || "desc",
        search: tableState.search || undefined,
        ownerUserId: ownerUserId || undefined,
        clientId: filterState.clientId || undefined,
        cups: filterState.cups || undefined,
        status: filterState.status || undefined,
        type: filterState.type || undefined,
        createdFrom: filterState.createdFrom || undefined,
        createdTo: filterState.createdTo || undefined,
        expiresFrom: filterState.expiresFrom || undefined,
        expiresTo: filterState.expiresTo || undefined,
      },
      clients: {
        page: 1,
        pageSize: 1000,
        orderBy: "name",
        sortDir: "asc" as const,
        minimal: true,
      },
      users: {
        page: 1,
        pageSize: 1000,
        orderBy: "createdAt",
        sortDir: "desc" as const,
        minimal: true,
        contextual: true,
      },
    };
  }, [isCommercial, preferences.itemsPerPage, session?.user.id]);

  const simulationsInit = useQuery({
    queryKey: ["simulations-init", session?.token ?? "", initParams],
    queryFn: () => getSimulationsInit(session!.token, initParams),
    enabled: !!session,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const useFallbackQueries = simulationsInit.isError;
  const hasInitData = !!simulationsInit.data;

  const simulationsActions = useSimulations(session, preferences.itemsPerPage, {
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: simulationsInit.data?.simulations,
    initialDataParams: initParams.simulations,
  });
  const displayedSimulationsActions = {
    ...simulationsActions,
    loading: simulationsInit.isLoading || simulationsActions.loading,
  };
  useRegisterRefresh(() => simulationsActions.refresh());

  // TanStack Query auto-fetches on mount; initialPageSize=1000 for filter dropdowns
  const clientsActions = useClients(session, 1000, {
    usePersistedState: false,
    minimal: true,
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: simulationsInit.data?.clients,
    initialDataParams: initParams.clients,
  });
  // Commercial users cannot access /users — skip the query entirely and derive from session
  const usersActions = useUsers(session, 1000, {
    queryEnabled: !isCommercial && (hasInitData || useFallbackQueries),
    usePersistedState: false,
    minimal: true,
    contextual: true,
    initialData: simulationsInit.data?.users,
    initialDataParams: initParams.users,
  });

  const sessionUser: UserItem | null = session
    ? {
      id: session.user.id,
      agencyId: session.user.agencyId,
      role: session.user.role,
      fullName: session.user.fullName,
      email: session.user.email,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    }
    : null;

  const users: UserItem[] = isCommercial
    ? sessionUser ? [sessionUser] : []
    : usersActions.users;

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <SimulationsModule
      session={session}
      actions={displayedSimulationsActions}
      agencies={[]}
      clients={clientsActions.clients}
      users={users}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
