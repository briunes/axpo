"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAgencies } from "../components/hooks/useAgencies";
import { AgenciesModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";

export default function AgenciesPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  // TanStack Query auto-fetches on mount
  const agenciesActions = useAgencies(session, preferences.itemsPerPage);
  useRegisterRefresh(() => agenciesActions.refresh());

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <AgenciesModule
      session={session}
      actions={agenciesActions}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
