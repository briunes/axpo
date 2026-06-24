"use client";

import { useState, useEffect } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";

export interface SystemSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface SystemConfig {
    // Simulation Settings
    simulationExpirationDays: number;
    defaultShareText: string;
    enablePixelTracking: boolean;

    // User Settings
    requirePinForSimulations: boolean;
    pinLength: number;

    // Client Settings
    autoCreateClientOnSimulation: boolean;

    // Module Visibility
    enableAnalytics: boolean;
    enableAuditLogs: boolean;

    // Dashboard Settings
    defaultDashboardView: "admin" | "master" | "commercial";

    // Reports Settings
    realtimeReportRefresh: boolean;
}

const DEFAULT_CONFIG: SystemConfig = {
    simulationExpirationDays: 30,
    defaultShareText: "View your energy simulation results. Click the link below to access your personalized quote. Your PIN is: {PIN}",
    enablePixelTracking: true,
    requirePinForSimulations: true,
    pinLength: 4,
    autoCreateClientOnSimulation: true,
    enableAnalytics: true,
    enableAuditLogs: true,
    defaultDashboardView: "commercial",
    realtimeReportRefresh: true,
};

export function SystemSettings({ session, onNotify }: SystemSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        // TODO: Load config from API
        // For now using defaults
    }, []);

    const handleChange = (field: keyof SystemConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            // TODO: Save to API
            // await saveSystemConfig(config);
            onNotify(t("legacySystemSettings", "saveSuccess"), "success");
            setIsDirty(false);
        } catch (error) {
            onNotify(t("legacySystemSettings", "saveError"), "error");
        }
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setIsDirty(false);
    };

    return (
        <div className="config-panel">
            <div className="config-section">
                <h3 className="config-section-title">{t("legacySystemSettings", "simulationTitle")}</h3>
                <p className="config-section-description">
                    {t("legacySystemSettings", "simulationDesc")}
                </p>

                <div className="config-field">
                    <label className="config-field-label">{t("systemSettings", "fieldExpirationDays")}</label>
                    <span className="config-field-description">
                        {t("systemSettings", "fieldExpirationDesc")}
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="365"
                        value={config.simulationExpirationDays}
                        onChange={(e) => handleChange("simulationExpirationDays", parseInt(e.target.value, 10))}
                    />
                </div>

                <div className="config-field">
                    <label className="config-field-label">{t("legacySystemSettings", "defaultShareText")}</label>
                    <span className="config-field-description">
                        {t("legacySystemSettings", "defaultShareTextDesc", { pin: "{PIN}" })}
                    </span>
                    <textarea
                        value={config.defaultShareText}
                        onChange={(e) => handleChange("defaultShareText", e.target.value)}
                        placeholder={t("legacySystemSettings", "defaultShareTextPlaceholder")}
                    />
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enablePixelTracking}
                            onChange={(e) => handleChange("enablePixelTracking", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "enablePixelTracking")}</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        {t("legacySystemSettings", "enablePixelTrackingDesc")}
                    </span>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">{t("legacySystemSettings", "userAuthTitle")}</h3>
                <p className="config-section-description">
                    {t("legacySystemSettings", "userAuthDesc")}
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.requirePinForSimulations}
                            onChange={(e) => handleChange("requirePinForSimulations", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "requirePin")}</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        {t("legacySystemSettings", "requirePinDesc")}
                    </span>
                </div>

                <div className="config-field">
                    <label className="config-field-label">{t("legacySystemSettings", "pinLength")}</label>
                    <span className="config-field-description">
                        {t("legacySystemSettings", "pinLengthDesc")}
                    </span>
                    <input
                        type="number"
                        min="4"
                        max="8"
                        value={config.pinLength}
                        onChange={(e) => handleChange("pinLength", parseInt(e.target.value, 10))}
                    />
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">{t("legacySystemSettings", "clientManagementTitle")}</h3>
                <p className="config-section-description">
                    {t("legacySystemSettings", "clientManagementDesc")}
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.autoCreateClientOnSimulation}
                            onChange={(e) => handleChange("autoCreateClientOnSimulation", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "autoCreateClient")}</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        {t("systemSettings", "fieldAutoCreateDesc")}
                    </span>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">{t("legacySystemSettings", "moduleVisibilityTitle")}</h3>
                <p className="config-section-description">
                    {t("legacySystemSettings", "moduleVisibilityDesc")}
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enableAnalytics}
                            onChange={(e) => handleChange("enableAnalytics", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "enableAnalytics")}</span>
                    </label>
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enableAuditLogs}
                            onChange={(e) => handleChange("enableAuditLogs", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "enableAuditLogs")}</span>
                    </label>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">{t("legacySystemSettings", "dashboardReportsTitle")}</h3>
                <p className="config-section-description">
                    {t("legacySystemSettings", "dashboardReportsDesc")}
                </p>

                <div className="config-field">
                    <label className="config-field-label">{t("legacySystemSettings", "defaultDashboardView")}</label>
                    <span className="config-field-description">
                        {t("legacySystemSettings", "defaultDashboardViewDesc")}
                    </span>
                    <select
                        value={config.defaultDashboardView}
                        onChange={(e) => handleChange("defaultDashboardView", e.target.value)}
                    >
                        <option value="admin">{t("legacySystemSettings", "adminView")}</option>
                        <option value="master">{t("legacySystemSettings", "masterView")}</option>
                        <option value="commercial">{t("legacySystemSettings", "commercialView")}</option>
                    </select>
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.realtimeReportRefresh}
                            onChange={(e) => handleChange("realtimeReportRefresh", e.target.checked)}
                        />
                        <span>{t("legacySystemSettings", "realtimeRefresh")}</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        {t("legacySystemSettings", "realtimeRefreshDesc")}
                    </span>
                </div>
            </div>

            <div className="config-actions">
                <button
                    className="config-btn config-btn-primary"
                    onClick={handleSave}
                    disabled={!isDirty}
                >
                    {t("actions", "saveChanges")}
                </button>
                <button
                    className="config-btn config-btn-secondary"
                    onClick={handleReset}
                    disabled={!isDirty}
                >
                    {t("legacySystemSettings", "resetDefaults")}
                </button>
            </div>
        </div>
    );
}
