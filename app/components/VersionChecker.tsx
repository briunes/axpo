"use client";

import { useEffect } from "react";

const VERSION_STORAGE_KEY = "axpo_app_version";

async function clearAllCaches(): Promise<void> {
    // Clear localStorage (preserving nothing — a fresh start is needed)
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear all cookies for this domain
    document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    });

    // Clear Cache API (service worker caches)
    if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // Unregister service workers
    if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
    }
}

export function VersionChecker() {
    useEffect(() => {
        let cancelled = false;

        async function checkVersion() {
            try {
                const res = await fetch("/api/v1/public/version", {
                    cache: "no-store",
                    headers: { pragma: "no-cache", "cache-control": "no-cache" },
                });

                if (!res.ok || cancelled) return;

                const { version } = (await res.json()) as { version: string };
                const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

                if (storedVersion === null) {
                    // First visit — just store the version
                    localStorage.setItem(VERSION_STORAGE_KEY, version);
                    return;
                }

                if (storedVersion !== version) {
                    console.info(
                        `[VersionChecker] New version detected (${storedVersion} → ${version}). Clearing cache and reloading.`
                    );
                    await clearAllCaches();
                    // Store new version before hard reload so we don't loop
                    localStorage.setItem(VERSION_STORAGE_KEY, version);
                    window.location.reload();
                }
            } catch {
                // Silently ignore — don't break the app if version check fails
            }
        }

        checkVersion();

        return () => {
            cancelled = true;
        };
    }, []);

    return null;
}
