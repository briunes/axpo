"use client";

import { useState } from "react";
import { loadSession } from "../../lib/authSession";
import { SimulationIssuesPanel } from "../../components/modules/SimulationIssuesPanel";
import { useAlerts } from "../../components/shared";

export default function SimulationIssuesPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();

  if (!session) return null;

  return (
    <SimulationIssuesPanel
      session={session}
      onNotify={(text, tone) => tone === "success" ? showSuccess(text) : showError(text)}
    />
  );
}
