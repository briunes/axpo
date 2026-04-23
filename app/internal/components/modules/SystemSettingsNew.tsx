"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, getEmailTemplates, testSmtpConnection, type EmailTemplate, type SmtpTestResult } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { CronSettings } from "./CronSettings";

export interface SystemSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type SettingsTab = "simulation" | "clients" | "calculation" | "preferences" | "smtp" | "emails" | "cron";

interface SystemConfig {
    simulationExpirationDays: number;
    autoCreateClientOnSimulation: boolean;
    ivaRate: number;
    electricityTaxRate: number;
    defaultDateFormat: string;
    defaultTimeFormat: string;
    defaultTimezone: string;
    defaultNumberFormat: string;
    defaultItemsPerPage: number;
    setupTokenValidityHours: number;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFromEmail: string;
    smtpFromName: string;
    userCreationEmailTemplateId: string;
    passwordResetEmailTemplateId: string;
}

const DEFAULT_CONFIG: SystemConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    ivaRate: 0.21,
    electricityTaxRate: 0.051127,
    defaultDateFormat: "DD/MM/YYYY",
    defaultTimeFormat: "24h",
    defaultTimezone: "Europe/Madrid",
    defaultNumberFormat: "eu",
    defaultItemsPerPage: 10,
    setupTokenValidityHours: 72,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "Axpo Simulator",
    userCreationEmailTemplateId: "",
    passwordResetEmailTemplateId: "",
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
        calculation: t("systemSettings", "tabCalculation"),
        preferences: t("systemSettings", "tabPreferences"),
        smtp: t("systemSettings", "tabSmtp"),
        emails: t("systemSettings", "tabAutomatedEmails"),
        cron: "Cron Jobs",
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const [data, templates] = await Promise.all([
                getSystemConfig(),
                getEmailTemplates({ type: ["user-welcome", "password-reset"] }),
            ]);
            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                autoCreateClientOnSimulation: data.autoCreateClientOnSim,
                ivaRate: (data as any).ivaRate || 0.21,
                electricityTaxRate: (data as any).electricityTaxRate || 0.051127,
                defaultDateFormat: (data as any).defaultDateFormat || "DD/MM/YYYY",
                defaultTimeFormat: (data as any).defaultTimeFormat || "24h",
                defaultTimezone: (data as any).defaultTimezone || "Europe/Madrid",
                defaultNumberFormat: (data as any).defaultNumberFormat || "eu",
                defaultItemsPerPage: (data as any).defaultItemsPerPage || 10,
                setupTokenValidityHours: (data as any).setupTokenValidityHours || 72,
                smtpHost: (data as any).smtpHost || "",
                smtpPort: (data as any).smtpPort || 587,
                smtpSecure: (data as any).smtpSecure || false,
                smtpUser: (data as any).smtpUser || "",
                smtpPassword: (data as any).smtpPassword || "",
                smtpFromEmail: (data as any).smtpFromEmail || "",
                smtpFromName: (data as any).smtpFromName || "Axpo Simulator",
                userCreationEmailTemplateId: (data as any).userCreationEmailTemplateId || "",
                passwordResetEmailTemplateId: (data as any).passwordResetEmailTemplateId || "",
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
                ivaRate: config.ivaRate,
                electricityTaxRate: config.electricityTaxRate,
                defaultDateFormat: config.defaultDateFormat,
                defaultTimeFormat: config.defaultTimeFormat,
                defaultTimezone: config.defaultTimezone,
                defaultNumberFormat: config.defaultNumberFormat,
                defaultItemsPerPage: config.defaultItemsPerPage,
                setupTokenValidityHours: config.setupTokenValidityHours,
                smtpHost: config.smtpHost,
                smtpPort: config.smtpPort,
                smtpSecure: config.smtpSecure,
                smtpUser: config.smtpUser,
                smtpPassword: config.smtpPassword,
                smtpFromEmail: config.smtpFromEmail,
                smtpFromName: config.smtpFromName,
                userCreationEmailTemplateId: config.userCreationEmailTemplateId || undefined,
                passwordResetEmailTemplateId: config.passwordResetEmailTemplateId || undefined,
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

                        {activeTab === "calculation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleCalculation")}</h3>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldIvaRate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldIvaRateDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={config.ivaRate}
                                        onChange={(e) => handleChange("ivaRate", parseFloat(e.target.value))}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldElectricityTaxRate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldElectricityTaxRateDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.000001"
                                        value={config.electricityTaxRate}
                                        onChange={(e) => handleChange("electricityTaxRate", parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "preferences" && (
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
                                        {emailTemplates
                                            .filter((template) => template.type === "user-welcome")
                                            .map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name} {!template.active && "(Inactive)"}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldPasswordResetTemplate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldPasswordResetTemplateDesc")}
                                    </span>
                                    <select
                                        value={config.passwordResetEmailTemplateId}
                                        onChange={(e) => handleChange("passwordResetEmailTemplateId", e.target.value)}
                                    >
                                        <option value="">{t("systemSettings", "noTemplateSelected")}</option>
                                        {emailTemplates
                                            .filter((template) => template.type === "password-reset")
                                            .map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name} {!template.active && "(Inactive)"}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldSetupTokenValidity")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldSetupTokenValidityDesc")}
                                    </span>
                                    <select
                                        value={config.setupTokenValidityHours}
                                        onChange={(e) => handleChange("setupTokenValidityHours", parseInt(e.target.value, 10))}
                                    >
                                        <option value={4}>4 hours</option>
                                        <option value={12}>12 hours</option>
                                        <option value={24}>24 hours (1 day)</option>
                                        <option value={48}>48 hours (2 days)</option>
                                        <option value={72}>72 hours (3 days)</option>
                                        <option value={168}>168 hours (7 days)</option>
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

                        {activeTab === "cron" && (
                            <CronSettings onNotify={onNotify} />
                        )}

                        {activeTab !== "cron" && (
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
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
