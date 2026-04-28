"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { FormSelect } from "../ui";

export interface UserPreferencesSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface PreferencesConfig {
    defaultDateFormat: string;
    defaultTimeFormat: string;
    defaultTimezone: string;
    defaultNumberFormat: string;
    defaultItemsPerPage: number;
}

const DEFAULT_CONFIG: PreferencesConfig = {
    defaultDateFormat: "DD/MM/YYYY",
    defaultTimeFormat: "24h",
    defaultTimezone: "Europe/Madrid",
    defaultNumberFormat: "eu",
    defaultItemsPerPage: 10,
};

export function UserPreferencesSettings({ session, onNotify }: UserPreferencesSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<PreferencesConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemConfig();
            setConfig({
                defaultDateFormat: (data as any).defaultDateFormat || "DD/MM/YYYY",
                defaultTimeFormat: (data as any).defaultTimeFormat || "24h",
                defaultTimezone: (data as any).defaultTimezone || "Europe/Madrid",
                defaultNumberFormat: (data as any).defaultNumberFormat || "eu",
                defaultItemsPerPage: (data as any).defaultItemsPerPage || 10,
            });
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof PreferencesConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            await updateSystemConfig({
                defaultDateFormat: config.defaultDateFormat,
                defaultTimeFormat: config.defaultTimeFormat,
                defaultTimezone: config.defaultTimezone,
                defaultNumberFormat: config.defaultNumberFormat,
                defaultItemsPerPage: config.defaultItemsPerPage,
            });
            onNotify(t("systemSettings", "savedSuccess"), "success");
            setIsDirty(false);
        } catch (error) {
            onNotify(t("systemSettings", "savedError"), "error");
        }
    };

    const handleReset = () => {
        loadConfig();
        setIsDirty(false);
    };

    return (
        <>
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <div className="settings-panel">
                        <h3 className="settings-panel-title">{t("systemSettings", "titlePreferences")}</h3>
                        <p style={{ color: "var(--axpo-text-secondary)", marginBottom: "24px" }}>
                            {t("systemSettings", "preferencesDescription")}
                        </p>

                        <Stack spacing={3}>
                            <FormSelect
                                label={t("systemSettings", "fieldDateFormat")}
                                helperText={t("systemSettings", "fieldDateFormatDesc")}
                                value={config.defaultDateFormat}
                                onChange={(value) => handleChange("defaultDateFormat", value)}
                                options={[
                                    { value: "DD/MM/YYYY", label: `DD/MM/YYYY (${new Date().toLocaleDateString("en-GB")})` },
                                    { value: "MM/DD/YYYY", label: `MM/DD/YYYY (${new Date().toLocaleDateString("en-US")})` },
                                    { value: "YYYY-MM-DD", label: `YYYY-MM-DD (${new Date().toISOString().split("T")[0]})` }
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldTimeFormat")}
                                helperText={t("systemSettings", "fieldTimeFormatDesc")}
                                value={config.defaultTimeFormat}
                                onChange={(value) => handleChange("defaultTimeFormat", value)}
                                options={[
                                    { value: "24h", label: `24-hour (${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})` },
                                    { value: "12h", label: `12-hour (${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })})` }
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldTimezone")}
                                helperText={t("systemSettings", "fieldTimezoneDesc")}
                                value={config.defaultTimezone}
                                onChange={(value) => handleChange("defaultTimezone", value)}
                                options={[
                                    { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
                                    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                                    { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
                                    { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
                                    { value: "America/New_York", label: "America/New York (EST/EDT)" },
                                    { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
                                    { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
                                    { value: "UTC", label: "UTC" }
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldNumberFormat")}
                                helperText={t("systemSettings", "fieldNumberFormatDesc")}
                                value={config.defaultNumberFormat}
                                onChange={(value) => handleChange("defaultNumberFormat", value)}
                                options={[
                                    { value: "eu", label: "European (1.234,56)" },
                                    { value: "us", label: "US/UK (1,234.56)" }
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldItemsPerPage")}
                                helperText={t("systemSettings", "fieldItemsPerPageDesc")}
                                value={config.defaultItemsPerPage}
                                onChange={(value) => handleChange("defaultItemsPerPage", parseInt(String(value), 10))}
                                options={[
                                    { value: 10, label: "10" },
                                    { value: 25, label: "25" },
                                    { value: 50, label: "50" },
                                    { value: 100, label: "100" }
                                ]}
                            />
                        </Stack>
                    </div>

                    <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={!isDirty}
                        >
                            {t("systemSettings", "btnSave")}
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={handleReset}
                            disabled={!isDirty}
                        >
                            {t("systemSettings", "btnReset")}
                        </Button>
                    </Box>
                </>
            )}
        </>
    );
}
