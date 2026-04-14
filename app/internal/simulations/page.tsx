"use client";

import { useRef, useState } from "react";
import { loadSession } from "../lib/authSession";
import { useSimulations } from "../components/hooks/useSimulations";
import { useClients } from "../components/hooks/useClients";
import { SimulationsModule } from "../components/modules";
import { useAlerts } from "../components/shared";

export default function SimulationsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const simulationsActions = useSimulations(session);
  const clientsActions = useClients(session);
  const fetchedRef = useRef(false);

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
      onNotify={handleNotify}
    />
  );
}
