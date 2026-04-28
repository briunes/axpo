"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useSimulations } from "../components/hooks/useSimulations";
import { useClients } from "../components/hooks/useClients";
import { useUsers } from "../components/hooks/useUsers";
import { SimulationsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";

export default function SimulationsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();
  const simulationsActions = useSimulations(session, preferences.itemsPerPage);
  useRegisterRefresh(() => simulationsActions.refresh());
  // TanStack Query auto-fetches on mount; initialPageSize=1000 for filter dropdowns
  const clientsActions = useClients(session, 1000);
  const usersActions = useUsers(session, 1000);

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <SimulationsModule
      session={session}
      actions={simulationsActions}
      agencies={[]}
      clients={clientsActions.clients}
      users={usersActions.users}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
