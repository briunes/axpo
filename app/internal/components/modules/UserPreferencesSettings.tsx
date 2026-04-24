"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";

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

                        <div className="config-field">
                            <label className="config-field-label">{t("systemSettings", "fieldDateFormat")}</label>
                            <span className="config-field-description">
                                {t("systemSettings", "fieldDateFormatDesc")}
                            </span>
                            <select
                                value={config.defaultDateFormat}
                                onChange={(e) => handleChange("defaultDateFormat", e.target.value)}
                            >
                                <option value="DD/MM/YYYY">DD/MM/YYYY (17/04/2026)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (04/17/2026)</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-04-17)</option>
                            </select>
                        </div>

                        <div className="config-field">
                            <label className="config-field-label">{t("systemSettings", "fieldTimeFormat")}</label>
                            <span className="config-field-description">
                                {t("systemSettings", "fieldTimeFormatDesc")}
                            </span>
                            <select
                                value={config.defaultTimeFormat}
                                onChange={(e) => handleChange("defaultTimeFormat", e.target.value)}
                            >
                                <option value="24h">24-hour (14:30)</option>
                                <option value="12h">12-hour (2:30 PM)</option>
                            </select>
                        </div>

                        <div className="config-field">
                            <label className="config-field-label">{t("systemSettings", "fieldTimezone")}</label>
                            <span className="config-field-description">
                                {t("systemSettings", "fieldTimezoneDesc")}
                            </span>
                            <select
                                value={config.defaultTimezone}
                                onChange={(e) => handleChange("defaultTimezone", e.target.value)}
                            >
                                <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                                <option value="Europe/London">Europe/London (GMT/BST)</option>
                                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                                <option value="America/New_York">America/New York (EST/EDT)</option>
                                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                                <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                                <option value="UTC">UTC</option>
                            </select>
                        </div>

                        <div className="config-field">
                            <label className="config-field-label">{t("systemSettings", "fieldNumberFormat")}</label>
                            <span className="config-field-description">
                                {t("systemSettings", "fieldNumberFormatDesc")}
                            </span>
                            <select
                                value={config.defaultNumberFormat}
                                onChange={(e) => handleChange("defaultNumberFormat", e.target.value)}
                            >
                                <option value="eu">European (1.234,56)</option>
                                <option value="us">US/UK (1,234.56)</option>
                            </select>
                        </div>

                        <div className="config-field">
                            <label className="config-field-label">{t("systemSettings", "fieldItemsPerPage")}</label>
                            <span className="config-field-description">
                                {t("systemSettings", "fieldItemsPerPageDesc")}
                            </span>
                            <select
                                value={config.defaultItemsPerPage}
                                onChange={(e) => handleChange("defaultItemsPerPage", parseInt(e.target.value, 10))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="config-actions">
                        <button
                            className="config-btn config-btn-primary"
                            onClick={handleSave}
                            disabled={!isDirty}
                        >
                            {t("systemSettings", "btnSave")}
                        </button>
                        <button
                            className="config-btn config-btn-secondary"
                            onClick={handleReset}
                            disabled={!isDirty}
                        >
                            {t("systemSettings", "btnReset")}
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
