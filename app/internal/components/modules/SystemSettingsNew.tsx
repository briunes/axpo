"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, getEmailTemplates, testSmtpConnection, type EmailTemplate, type SmtpTestResult } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";

export interface SystemSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type SettingsTab = "simulation" | "clients" | "smtp" | "emails";

interface SystemConfig {
    simulationExpirationDays: number;
    autoCreateClientOnSimulation: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFromEmail: string;
    smtpFromName: string;
    userCreationEmailTemplateId: string;
}

const DEFAULT_CONFIG: SystemConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "Axpo Simulator",
    userCreationEmailTemplateId: "",
};

export function SystemSettingsNew({ session, onNotify }: SystemSettingsProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<SettingsTab>("simulation");
    const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [isTestingSmtp, setIsTestingSmtp] = useState(false);
    const [smtpTestResult, setSmtpTestResult] = useState<SmtpTestResult | null>(null);

    const SETTINGS_TABS: Record<SettingsTab, string> = {
        simulation: t("systemSettings", "tabSimulation"),
        clients: t("systemSettings", "tabClients"),
        smtp: t("systemSettings", "tabSmtp"),
        emails: t("systemSettings", "tabAutomatedEmails"),
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const [data, templates] = await Promise.all([
                getSystemConfig(),
                getEmailTemplates({ type: "user-welcome" }),
            ]);
            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                autoCreateClientOnSimulation: data.autoCreateClientOnSim,
                smtpHost: (data as any).smtpHost || "",
                smtpPort: (data as any).smtpPort || 587,
                smtpSecure: (data as any).smtpSecure || false,
                smtpUser: (data as any).smtpUser || "",
                smtpPassword: (data as any).smtpPassword || "",
                smtpFromEmail: (data as any).smtpFromEmail || "",
                smtpFromName: (data as any).smtpFromName || "Axpo Simulator",
                userCreationEmailTemplateId: (data as any).userCreationEmailTemplateId || "",
            });
            setEmailTemplates(templates);
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof SystemConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            await updateSystemConfig({
                simulationExpirationDays: config.simulationExpirationDays,
                autoCreateClientOnSim: config.autoCreateClientOnSimulation,
                smtpHost: config.smtpHost,
                smtpPort: config.smtpPort,
                smtpSecure: config.smtpSecure,
                smtpUser: config.smtpUser,
                smtpPassword: config.smtpPassword,
                smtpFromEmail: config.smtpFromEmail,
                smtpFromName: config.smtpFromName,
                userCreationEmailTemplateId: config.userCreationEmailTemplateId || undefined,
            });
            onNotify(t("systemSettings", "savedSuccess"), "success");
            setIsDirty(false);
        } catch (error) {
            onNotify(t("systemSettings", "savedError"), "error");
        }
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setIsDirty(false);
    };

    const handleTestSmtp = async () => {
        setIsTestingSmtp(true);
        setSmtpTestResult(null);
        try {
            const result = await testSmtpConnection();
            setSmtpTestResult(result);
            if (result.success) {
                onNotify(t("systemSettings", "smtpTestSuccess"), "success");
            } else {
                onNotify(result.message || t("systemSettings", "smtpTestError"), "error");
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : t("systemSettings", "smtpTestError");
            setSmtpTestResult({ success: false, message: errorMsg });
            onNotify(errorMsg, "error");
        } finally {
            setIsTestingSmtp(false);
        }
    };

    return (
        <div className="system-settings-container">
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <div className="system-settings-tabs">
                        {(Object.keys(SETTINGS_TABS) as SettingsTab[]).map((tab) => (
                            <button
                                key={tab}
                                className={`settings-subtab${activeTab === tab ? " active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {SETTINGS_TABS[tab]}
                            </button>
                        ))}
                    </div>

                    <div className="system-settings-content">
                        {activeTab === "simulation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleSimulation")}</h3>

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
                            </div>
                        )}

                        {activeTab === "clients" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleClients")}</h3>

                                <div className="config-field">
                                    <label className="config-field-inline">
                                        <input
                                            type="checkbox"
                                            checked={config.autoCreateClientOnSimulation}
                                            onChange={(e) => handleChange("autoCreateClientOnSimulation", e.target.checked)}
                                        />
                                        <span>{t("systemSettings", "fieldAutoCreate")}</span>
                                    </label>
                                    <span className="config-field-description" style={{ marginLeft: "32px" }}>
                                        {t("systemSettings", "fieldAutoCreateDesc")}
                                    </span>
                                </div>
                            </div>
                        )}

                        {activeTab === "emails" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleAutomatedEmails")}</h3>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldUserCreationTemplate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldUserCreationTemplateDesc")}
                                    </span>
                                    <select
                                        value={config.userCreationEmailTemplateId}
                                        onChange={(e) => handleChange("userCreationEmailTemplateId", e.target.value)}
                                    >
                                        <option value="">{t("systemSettings", "noTemplateSelected")}</option>
                                        {emailTemplates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name} {!template.active && "(Inactive)"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === "smtp" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleSmtp")}</h3>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldSmtpHost")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldSmtpHostDesc")}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="smtp.example.com"
                                        value={config.smtpHost}
                                        onChange={(e) => handleChange("smtpHost", e.target.value)}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldSmtpPort")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldSmtpPortDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="65535"
                                        value={config.smtpPort}
                                        onChange={(e) => handleChange("smtpPort", parseInt(e.target.value, 10))}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-inline">
                                        <input
                                            type="checkbox"
                                            checked={config.smtpSecure}
                                            onChange={(e) => handleChange("smtpSecure", e.target.checked)}
                                        />
                                        <span>{t("systemSettings", "fieldSmtpSecure")}</span>
                                    </label>
                                    <span className="config-field-description" style={{ marginLeft: "32px" }}>
                                        {t("systemSettings", "fieldSmtpSecureDesc")}
                                    </span>
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldSmtpUser")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldSmtpUserDesc")}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="user@example.com"
                                        value={config.smtpUser}
                                        onChange={(e) => handleChange("smtpUser", e.target.value)}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldSmtpPassword")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldSmtpPasswordDesc")}
                                    </span>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={config.smtpPassword}
                                        onChange={(e) => handleChange("smtpPassword", e.target.value)}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldFromEmail")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldFromEmailDesc")}
                                    </span>
                                    <input
                                        type="email"
                                        placeholder="noreply@example.com"
                                        value={config.smtpFromEmail}
                                        onChange={(e) => handleChange("smtpFromEmail", e.target.value)}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldFromName")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldFromNameDesc")}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Axpo Simulator"
                                        value={config.smtpFromName}
                                        onChange={(e) => handleChange("smtpFromName", e.target.value)}
                                    />
                                </div>

                                <div className="config-field" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--axpo-border)" }}>
                                    <label className="config-field-label">{t("systemSettings", "smtpTestTitle")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "smtpTestDesc")}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                                        <button
                                            type="button"
                                            className="config-btn config-btn-secondary"
                                            onClick={handleTestSmtp}
                                            disabled={isTestingSmtp || !config.smtpHost}
                                        >
                                            {isTestingSmtp ? t("systemSettings", "smtpTesting") : t("systemSettings", "btnTestConnection")}
                                        </button>
                                        {smtpTestResult && (
                                            <span style={{
                                                color: smtpTestResult.success ? "var(--axpo-success, #10b981)" : "var(--axpo-error, #ef4444)",
                                                fontSize: "14px",
                                                fontWeight: 500
                                            }}>
                                                {smtpTestResult.success ? "✓ " : "✗ "}
                                                {smtpTestResult.message}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

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
                    </div>
                </>
            )}
        </div>
    );
}
