"use client";

import { useEffect, useRef, useState } from "react";
import { loadSession } from "../lib/authSession";
import { useSimulations } from "../components/hooks/useSimulations";
import { useClients } from "../components/hooks/useClients";
import { useUsers } from "../components/hooks/useUsers";
import { SimulationsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";

export default function SimulationsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();
  const simulationsActions = useSimulations(session, preferences.itemsPerPage);
  const clientsActions = useClients(session);
  const usersActions = useUsers(session);
  const fetchedRef = useRef(false);

  // Fetch all data on mount
  useEffect(() => {
    if (!fetchedRef.current && session) {
      fetchedRef.current = true;
      // Fetch all records for filter dropdowns with large page size
      clientsActions.refresh({ pageSize: 1000 });
      usersActions.refresh({ pageSize: 1000 });
    }
  }, [session, clientsActions, usersActions]);

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
