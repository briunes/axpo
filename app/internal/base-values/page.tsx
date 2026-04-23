"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useBaseValues } from "../components/hooks/useBaseValues";
import { BaseValuesModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons } from "../components/InternalWorkspace";

export default function BaseValuesPage() {
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const baseValuesActions = useBaseValues(session);
  const onActionButtons = useActionButtons();

  const handleNotify = (text: string, tone: "success" | "error") => {
    tone === "success" ? showSuccess(text) : showError(text);
  };

  if (!session) return null;

  return (
    <BaseValuesModule
      session={session}
      actions={baseValuesActions}
      onNotify={handleNotify}
      onActionButtons={onActionButtons || undefined}
    />
  );
}
