"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAnalytics } from "../components/hooks/useAnalytics";
import { AnalyticsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";

export default function AnalyticsPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const analyticsActions = useAnalytics(session);
  useRegisterRefresh(() => analyticsActions.refresh());
  const onActionButtons = useActionButtons();

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <AnalyticsModule
      session={session}
      actions={analyticsActions}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
