"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { loadSession } from "../../lib/authSession";

export interface UserPreferences {
    dateFormat: string;
    timeFormat: string;
    timezone: string;
    numberFormat: string;
    itemsPerPage: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    timezone: "Europe/Madrid",
    numberFormat: "eu",
    itemsPerPage: 10,
};

const PREFS_CACHE_KEY = "axpo_user_preferences";

function loadCachedPreferences(): UserPreferences {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    try {
        const raw = localStorage.getItem(PREFS_CACHE_KEY);
        if (!raw) return DEFAULT_PREFERENCES;
        const parsed = JSON.parse(raw) as Partial<UserPreferences>;
        return {
            dateFormat: parsed.dateFormat ?? DEFAULT_PREFERENCES.dateFormat,
            timeFormat: parsed.timeFormat ?? DEFAULT_PREFERENCES.timeFormat,
            timezone: parsed.timezone ?? DEFAULT_PREFERENCES.timezone,
            numberFormat: parsed.numberFormat ?? DEFAULT_PREFERENCES.numberFormat,
            itemsPerPage: parsed.itemsPerPage ?? DEFAULT_PREFERENCES.itemsPerPage,
        };
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

interface UserPreferencesContextValue {
    preferences: UserPreferences;
    loading: boolean;
    refresh: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
    preferences: DEFAULT_PREFERENCES,
    loading: false,
    refresh: async () => { },
});

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] =
        useState<UserPreferences>(loadCachedPreferences);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        const session = loadSession();
        if (!session) return;

        setLoading(true);
        try {
            const res = await fetch(
                `/api/v1/internal/users/${session.user.id}/preferences`,
                { headers: { Authorization: `Bearer ${session.token}` } },
            );
            if (!res.ok) return;
            const data = await res.json();
            const updated: UserPreferences = {
                dateFormat: data.dateFormat ?? DEFAULT_PREFERENCES.dateFormat,
                timeFormat: data.timeFormat ?? DEFAULT_PREFERENCES.timeFormat,
                timezone: data.timezone ?? DEFAULT_PREFERENCES.timezone,
                numberFormat: data.numberFormat ?? DEFAULT_PREFERENCES.numberFormat,
                itemsPerPage: data.itemsPerPage ?? DEFAULT_PREFERENCES.itemsPerPage,
            };
            setPreferences(updated);
            try { localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
        } catch {
            // silently fall back to defaults
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <UserPreferencesContext.Provider value={{ preferences, loading, refresh }}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function useUserPreferences(): UserPreferencesContextValue {
    return useContext(UserPreferencesContext);
}
