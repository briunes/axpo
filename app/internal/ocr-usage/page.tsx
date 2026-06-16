"use client";

import { useState } from "react";
import { loadSession } from "../lib/authSession";
import { OcrUsageDashboard } from "../components/modules";
import { useAlerts } from "../components/shared";
import { useRegisterRefresh } from "../components/InternalWorkspace";

export default function OcrUsagePage() {
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();

    // The dashboard refreshes itself on date-range changes, but a manual
    // refresh from the top bar is also wired in case the operator wants to
    // force a re-fetch (e.g. after a new OCR call lands).
    const [refreshKey, setRefreshKey] = useState(0);
    useRegisterRefresh(() => setRefreshKey((k) => k + 1));

    const handleNotify = (text: string, tone: "success" | "error") => {
        if (tone === "success") showSuccess(text);
        else showError(text);
    };

    if (!session) return null;

    return (
        <OcrUsageDashboard
            key={refreshKey}
            session={session}
            onNotify={handleNotify}
        />
    );
}
