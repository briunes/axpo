"use client";

import { useState, useEffect } from "react";
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
            onNotify("System settings saved successfully", "success");
            setIsDirty(false);
        } catch (error) {
            onNotify("Failed to save system settings", "error");
        }
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setIsDirty(false);
    };

    return (
        <div className="config-panel">
            <div className="config-section">
                <h3 className="config-section-title">Simulation Settings</h3>
                <p className="config-section-description">
                    Configure simulation behavior, expiration, and sharing settings
                </p>

                <div className="config-field">
                    <label className="config-field-label">Simulation Expiration (Days)</label>
                    <span className="config-field-description">
                        Number of days before a simulation expires and becomes read-only
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
                    <label className="config-field-label">Default Share Text Template</label>
                    <span className="config-field-description">
                        Text template used when sharing simulations. Use {`{PIN}`} for dynamic PIN insertion.
                    </span>
                    <textarea
                        value={config.defaultShareText}
                        onChange={(e) => handleChange("defaultShareText", e.target.value)}
                        placeholder="Enter share text template..."
                    />
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enablePixelTracking}
                            onChange={(e) => handleChange("enablePixelTracking", e.target.checked)}
                        />
                        <span>Enable Pixel Tracking</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        Track when clients view their simulations (newsletter-style tracking)
                    </span>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">User & Authentication Settings</h3>
                <p className="config-section-description">
                    Configure user authentication, PIN requirements, and access control
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.requirePinForSimulations}
                            onChange={(e) => handleChange("requirePinForSimulations", e.target.checked)}
                        />
                        <span>Require PIN for Simulation Access</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        Clients must enter a PIN to view their simulation
                    </span>
                </div>

                <div className="config-field">
                    <label className="config-field-label">PIN Length</label>
                    <span className="config-field-description">
                        Number of digits in the generated PIN (recommended: 4-6)
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
                <h3 className="config-section-title">Client Management Settings</h3>
                <p className="config-section-description">
                    Configure automatic client creation and profile management
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.autoCreateClientOnSimulation}
                            onChange={(e) => handleChange("autoCreateClientOnSimulation", e.target.checked)}
                        />
                        <span>Auto-create Client on New Simulation</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        Automatically create a new client record when creating a simulation without selecting an existing client
                    </span>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">Module Visibility</h3>
                <p className="config-section-description">
                    Enable or disable specific modules across the application
                </p>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enableAnalytics}
                            onChange={(e) => handleChange("enableAnalytics", e.target.checked)}
                        />
                        <span>Enable Analytics Module</span>
                    </label>
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.enableAuditLogs}
                            onChange={(e) => handleChange("enableAuditLogs", e.target.checked)}
                        />
                        <span>Enable Audit Logs Module</span>
                    </label>
                </div>
            </div>

            <div className="config-section">
                <h3 className="config-section-title">Dashboard & Reports</h3>
                <p className="config-section-description">
                    Configure default dashboard views and reporting behavior
                </p>

                <div className="config-field">
                    <label className="config-field-label">Default Dashboard View</label>
                    <span className="config-field-description">
                        Default view for users when they access the dashboard
                    </span>
                    <select
                        value={config.defaultDashboardView}
                        onChange={(e) => handleChange("defaultDashboardView", e.target.value)}
                    >
                        <option value="admin">Admin View</option>
                        <option value="master">Master View</option>
                        <option value="commercial">Commercial View</option>
                    </select>
                </div>

                <div className="config-field">
                    <label className="config-field-inline">
                        <input
                            type="checkbox"
                            checked={config.realtimeReportRefresh}
                            onChange={(e) => handleChange("realtimeReportRefresh", e.target.checked)}
                        />
                        <span>Enable Real-time Report Refresh</span>
                    </label>
                    <span className="config-field-description" style={{ marginLeft: "30px" }}>
                        Automatically refresh reports as filters change
                    </span>
                </div>
            </div>

            <div className="config-actions">
                <button
                    className="config-btn config-btn-primary"
                    onClick={handleSave}
                    disabled={!isDirty}
                >
                    Save Changes
                </button>
                <button
                    className="config-btn config-btn-secondary"
                    onClick={handleReset}
                    disabled={!isDirty}
                >
                    Reset to Defaults
                </button>
            </div>
        </div>
    );
}
