"use client";

import { useEffect } from "react";
import {
    installVersionedFetch,
    storeInitialAppVersion,
} from "../lib/appVersionClient";
import { broadcastAppVersion, type VersionResponse } from "./WhatsNewModal";

/**
 * Installs the version-aware fetch wrapper and establishes the initial version.
 * Subsequent API requests send that version in X-Axpo-App-Version.
 */
export function VersionChecker() {
    useEffect(() => {
        installVersionedFetch();

        fetch("/api/v1/public/version", {
            cache: "no-store",
            headers: { pragma: "no-cache", "cache-control": "no-cache" },
        })
            .then((res) => res.json())
            .then((data: VersionResponse) => {
                storeInitialAppVersion(data.version);
                broadcastAppVersion(data);
            })
            .catch(() => {
                // Version bootstrapping is best-effort.
            });
    }, []);

    return null;
}
