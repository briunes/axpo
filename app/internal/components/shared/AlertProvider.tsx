"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Alert, IconButton, Slide, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export type AlertSeverity = "success" | "error" | "warning" | "info";

interface AlertItem {
    id: string;
    message: string;
    severity: AlertSeverity;
}

interface AlertContextValue {
    showAlert: (message: string, severity?: AlertSeverity) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showWarning: (message: string) => void;
    showInfo: (message: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const MAX_ALERTS = 4;

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);

    const showAlert = useCallback((message: string, severity: AlertSeverity = "info") => {
        const id = `${Date.now()}-${Math.random()}`;
        setAlerts((prev) => {
            const next = [...prev, { id, message, severity }];
            return next.length > MAX_ALERTS ? next.slice(next.length - MAX_ALERTS) : next;
        });

        // Auto-dismiss after 5s
        setTimeout(() => {
            setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, 5000);
    }, []);

    const dismiss = useCallback((id: string) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, []);

    const showSuccess = useCallback((msg: string) => showAlert(msg, "success"), [showAlert]);
    const showError = useCallback((msg: string) => showAlert(msg, "error"), [showAlert]);
    const showWarning = useCallback((msg: string) => showAlert(msg, "warning"), [showAlert]);
    const showInfo = useCallback((msg: string) => showAlert(msg, "info"), [showAlert]);

    return (
        <AlertContext.Provider value={{ showAlert, showSuccess, showError, showWarning, showInfo }}>
            {children}

            {/* Fixed overlay stack */}
            <Stack
                spacing={1}
                sx={{
                    position: "fixed",
                    top: 24,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2000,
                    width: 480,
                    maxWidth: "calc(100vw - 48px)",
                    pointerEvents: "none",
                }}
            >
                {alerts.map((alert) => (
                    <Slide key={alert.id} direction="down" in mountOnEnter unmountOnExit>
                        <Alert
                            severity={alert.severity}
                            sx={{ pointerEvents: "auto", boxShadow: 3 }}
                            action={
                                <IconButton
                                    size="small"
                                    color="inherit"
                                    onClick={() => dismiss(alert.id)}
                                    aria-label="close"
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >
                            {alert.message}
                        </Alert>
                    </Slide>
                ))}
            </Stack>
        </AlertContext.Provider>
    );
}

export function useAlerts(): AlertContextValue {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error("useAlerts must be used inside AlertProvider");
    return ctx;
}
