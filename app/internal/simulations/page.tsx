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
import type { UserItem } from "../lib/internalApi";

export default function SimulationsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const { preferences } = useUserPreferences();
  const simulationsActions = useSimulations(session, preferences.itemsPerPage);
  useRegisterRefresh(() => simulationsActions.refresh());

  const isCommercial = session?.user.role === "COMMERCIAL";

  // TanStack Query auto-fetches on mount; initialPageSize=1000 for filter dropdowns
  const clientsActions = useClients(session, 1000);
  // Commercial users cannot access /users — skip the query entirely and derive from session
  const usersActions = useUsers(session, 1000, { queryEnabled: !isCommercial });

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
      actions={simulationsActions}
      agencies={[]}
      clients={clientsActions.clients}
      users={users}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
