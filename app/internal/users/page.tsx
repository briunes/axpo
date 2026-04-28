"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAgencies } from "../components/hooks/useAgencies";
import { useUsers } from "../components/hooks/useUsers";
import { UsersModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useUserPreferences } from "../components/providers/UserPreferencesProvider";

export default function UsersPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();

  const usersActions = useUsers(session, preferences.itemsPerPage);
  useRegisterRefresh(() => usersActions.refresh());
  // Fetch all agencies for the dropdowns — TQ auto-fetches on mount
  const agenciesActions = useAgencies(session, 1000);

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <UsersModule
      session={session}
      actions={usersActions}
      agencies={agenciesActions.agencies}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
