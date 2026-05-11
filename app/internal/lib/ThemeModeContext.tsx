"use client";

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

interface ThemeModeContextValue {
    mode: ThemeMode;
    toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
    mode: "light",
    toggleMode: () => { },
});

export function useThemeMode() {
    return useContext(ThemeModeContext);
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
    // Always start with "light" to match SSR — avoids MUI emotion class hydration mismatch.
    // The useEffect below will sync to the user's stored preference after mount.
    const [mode, setMode] = useState<ThemeMode>("light");

    // Read stored preference on mount (client-only)
    useEffect(() => {
        const attrMode = document.documentElement.getAttribute("data-theme") as ThemeMode | null;
        if (attrMode === "dark" || attrMode === "light") {
            setMode(attrMode);
            return;
        }
        const stored = localStorage.getItem("theme-mode") as ThemeMode | null;
        if (stored === "dark" || stored === "light") {
            setMode(stored);
        }
    }, []);

    // Apply data-theme attribute on <html> and persist preference
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", mode);
        localStorage.setItem("theme-mode", mode);
    }, [mode]);

    const toggleMode = () => setMode((m) => (m === "light" ? "dark" : "light"));

    const value = useMemo(() => ({ mode, toggleMode }), [mode]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <ThemeModeContext.Provider value={value}>
            {children}
        </ThemeModeContext.Provider>
    );
}
