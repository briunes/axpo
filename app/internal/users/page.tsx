"use client";

import { useEffect, useRef, useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAgencies } from "../components/hooks/useAgencies";
import { useUsers } from "../components/hooks/useUsers";
import { UsersModule } from "../components/modules";
import { useAlerts } from "../components/shared";

export default function UsersPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();

  const usersActions = useUsers(session);
  const agenciesActions = useAgencies(session);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!session || fetchedRef.current) return;
    fetchedRef.current = true;
    agenciesActions.refresh();
  }, [session]);

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
    />
  );
}
