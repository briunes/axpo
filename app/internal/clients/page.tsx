"use client";

import { useRef, useState } from "react";
import { loadSession } from "../lib/authSession";
import { useClients } from "../components/hooks/useClients";
import { ClientsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";

export default function ClientsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();
  const clientsActions = useClients(session, preferences.itemsPerPage);
  useRegisterRefresh(() => clientsActions.refresh());
  const fetchedRef = useRef(false);

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <ClientsModule
      session={session}
      actions={clientsActions}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
