"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, getEmailTemplates, type EmailTemplate } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";

export interface AutomatedEmailsSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface EmailsConfig {
    userCreationEmailTemplateId: string;
    passwordResetEmailTemplateId: string;
    setupTokenValidityHours: number;
}

const DEFAULT_CONFIG: EmailsConfig = {
    userCreationEmailTemplateId: "",
    passwordResetEmailTemplateId: "",
    setupTokenValidityHours: 72,
};

export function AutomatedEmailsSettings({ session, onNotify }: AutomatedEmailsSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<EmailsConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

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
                userCreationEmailTemplateId: (data as any).userCreationEmailTemplateId || "",
                passwordResetEmailTemplateId: (data as any).passwordResetEmailTemplateId || "",
                setupTokenValidityHours: (data as any).setupTokenValidityHours || 72,
            });
            setEmailTemplates(templates);
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof EmailsConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            await updateSystemConfig({
                userCreationEmailTemplateId: config.userCreationEmailTemplateId || undefined,
                passwordResetEmailTemplateId: config.passwordResetEmailTemplateId || undefined,
                setupTokenValidityHours: config.setupTokenValidityHours,
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
