"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { useAlerts } from "../components/shared";
import { EmailLogsModule } from "../components/modules";

export default function EmailLogsPage() {
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();

    const handleNotify = (text: string, tone: "success" | "error") => {
        tone === "success" ? showSuccess(text) : showError(text);
    };

    if (!session) return null;

    return (
        <EmailLogsModule
            session={session}
            onNotify={handleNotify}
        />
    );
}
