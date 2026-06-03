"use client";

import { useEffect } from "react";

const VERSION_STORAGE_KEY = "axpo_app_version";

/**
 * VersionChecker — bootstraps the stored version on first page load.
 *
 * The heavy lifting (detecting a version mismatch and reloading) is now done
 * inside `parseApiResponse` in internalApi.ts: every API call piggy-backs the
 * `appVersion` field returned by the server, so we no longer need a separate
 * polling request here.
 *
 * This component only handles the edge-case where a user opens the app for the
 * very first time (no stored version) by fetching the version once and storing
 * it, so subsequent API calls have a baseline to compare against.
 */
export function VersionChecker() {
    useEffect(() => {
        // Only fetch if we have no stored version yet (first ever visit).
        if (localStorage.getItem(VERSION_STORAGE_KEY) !== null) return;

        fetch("/api/v1/public/version", {
            cache: "no-store",
            headers: { pragma: "no-cache", "cache-control": "no-cache" },
        })
            .then((res) => res.json())
            .then(({ version }: { version: string }) => {
                if (version && localStorage.getItem(VERSION_STORAGE_KEY) === null) {
                    localStorage.setItem(VERSION_STORAGE_KEY, version);
                }
            })
            .catch(() => {
                // Silently ignore — version bootstrapping is best-effort
            });
    }, []);

    return null;
}

