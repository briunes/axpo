"use client";

import { useRef, useState } from "react";
import { loadSession } from "../lib/authSession";
import { useClients } from "../components/hooks/useClients";
import { ClientsModule } from "../components/modules";
import { useAlerts } from "../components/shared";

export default function ClientsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const clientsActions = useClients(session);
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
    />
  );
}
