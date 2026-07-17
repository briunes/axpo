"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSession } from "../lib/authSession";
import { useAgencies } from "../components/hooks/useAgencies";
import { useUsers } from "../components/hooks/useUsers";
import { UsersModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";
import { getUsersInit } from "../lib/internalApi";

const readJsonStorage = <T,>(key: string): Partial<T> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
};

export default function UsersPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  const initParams = useMemo(() => {
    const tableState = readJsonStorage<{
      sortColumn: string;
      sortDirection: "asc" | "desc";
      search: string;
    }>("axpo_dt_state_users");
    const filterState = readJsonStorage<{
      roleFilter: string;
      agencyFilter: string;
      showArchived: boolean;
    }>("axpo_users_filters");

    return {
      users: {
        page: 1,
        pageSize: preferences.itemsPerPage,
        search: tableState.search || undefined,
        role: filterState.roleFilter || undefined,
        agencyId: filterState.agencyFilter || undefined,
        orderBy: tableState.sortColumn || "createdAt",
        sortDir: tableState.sortDirection || "desc",
        includeDeleted: filterState.showArchived || undefined,
      },
      agencies: {
        page: 1,
        pageSize: 1000,
        minimal: true,
      },
    };
  }, [preferences.itemsPerPage]);

  const usersInit = useQuery({
    queryKey: ["users-init", session?.token ?? "", initParams],
    queryFn: () => getUsersInit(session!.token, initParams),
    enabled: !!session,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const useFallbackQueries = usersInit.isError;
  const hasInitData = !!usersInit.data;

  const usersActions = useUsers(session, preferences.itemsPerPage, {
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: usersInit.data?.users,
    initialDataParams: initParams.users,
  });
  const displayedUsersActions = {
    ...usersActions,
    loading: usersInit.isLoading || usersActions.loading,
  };
  useRegisterRefresh(() => usersActions.refresh());
  // Fetch all agencies for the dropdowns — TQ auto-fetches on mount
  const agenciesActions = useAgencies(session, 1000, {
    minimal: true,
    queryEnabled: hasInitData || useFallbackQueries,
    initialData: usersInit.data?.agencies,
    initialDataParams: initParams.agencies,
  });

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <UsersModule
      session={session}
      actions={displayedUsersActions}
      agencies={agenciesActions.agencies}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
