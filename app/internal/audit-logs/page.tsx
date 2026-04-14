"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAuditLogs } from "../components/hooks/useAuditLogs";
import { AuditLogsModule } from "../components/modules";
import { useAlerts } from "../components/shared";

export default function AuditLogsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const auditLogsActions = useAuditLogs(session);

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <AuditLogsModule
      session={session}
      actions={auditLogsActions}
      onNotify={handleNotify}
    />
  );
}
