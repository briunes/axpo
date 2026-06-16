"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAuditLogs } from "../components/hooks/useAuditLogs";
import { SystemLogsModule } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";

export default function LogsPage() {
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const auditLogsActions = useAuditLogs(session);
    useRegisterRefresh(() => auditLogsActions.refresh());
    const onActionButtons = useActionButtons();

    const handleNotify = (text: string, tone: "success" | "error") => {
        tone === "success" ? showSuccess(text) : showError(text);
    };

    if (!session) return null;

    return (
        <SystemLogsModule
            session={session}
            auditLogsActions={auditLogsActions}
            onNotify={handleNotify}
            onActionButtons={onActionButtons || undefined}
        />
    );
}
