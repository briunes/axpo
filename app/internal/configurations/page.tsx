"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { ConfigurationsModule } from "../components/modules";
import { useAlerts } from "../components/shared";

export default function ConfigurationsPage() {
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();

    const handleNotify = (text: string, tone: "success" | "error") => {
        tone === "success" ? showSuccess(text) : showError(text);
    };

    if (!session) return null;

    return <ConfigurationsModule session={session} onNotify={handleNotify} />;
}
