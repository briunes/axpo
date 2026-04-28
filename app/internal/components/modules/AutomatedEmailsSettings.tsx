"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, getEmailTemplates, type EmailTemplate } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { FormSelect } from "../ui";

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

                        <Stack spacing={3}>
                            <FormSelect
                                label={t("systemSettings", "fieldUserCreationTemplate")}
                                helperText={t("systemSettings", "fieldUserCreationTemplateDesc")}
                                value={config.userCreationEmailTemplateId}
                                onChange={(value) => handleChange("userCreationEmailTemplateId", value)}
                                options={[
                                    { value: "", label: t("systemSettings", "noTemplateSelected") },
                                    ...emailTemplates
                                        .filter((template) => template.type === "user-welcome")
                                        .map((template) => ({
                                            value: template.id,
                                            label: `${template.name}${!template.active ? " (Inactive)" : ""}`
                                        }))
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldPasswordResetTemplate")}
                                helperText={t("systemSettings", "fieldPasswordResetTemplateDesc")}
                                value={config.passwordResetEmailTemplateId}
                                onChange={(value) => handleChange("passwordResetEmailTemplateId", value)}
                                options={[
                                    { value: "", label: t("systemSettings", "noTemplateSelected") },
                                    ...emailTemplates
                                        .filter((template) => template.type === "password-reset")
                                        .map((template) => ({
                                            value: template.id,
                                            label: `${template.name}${!template.active ? " (Inactive)" : ""}`
                                        }))
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldSetupTokenValidity")}
                                helperText={t("systemSettings", "fieldSetupTokenValidityDesc")}
                                value={config.setupTokenValidityHours}
                                onChange={(value) => handleChange("setupTokenValidityHours", parseInt(String(value), 10))}
                                options={[
                                    { value: 4, label: "4 hours" },
                                    { value: 12, label: "12 hours" },
                                    { value: 24, label: "24 hours (1 day)" },
                                    { value: 48, label: "48 hours (2 days)" },
                                    { value: 72, label: "72 hours (3 days)" },
                                    { value: 168, label: "168 hours (7 days)" }
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
