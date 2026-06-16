"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack, Divider, Switch, FormControlLabel, Typography } from "@mui/material";
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
    magicLinkEnabled: boolean;
    magicLinkEmailTemplateId: string;
    magicLinkTokenValidityMinutes: number;
    otpEnabled: boolean;
    otpEmailTemplateId: string;
    otpCodeValidityMinutes: number;
}

const DEFAULT_CONFIG: EmailsConfig = {
    userCreationEmailTemplateId: "",
    passwordResetEmailTemplateId: "",
    setupTokenValidityHours: 72,
    magicLinkEnabled: false,
    magicLinkEmailTemplateId: "",
    magicLinkTokenValidityMinutes: 15,
    otpEnabled: false,
    otpEmailTemplateId: "",
    otpCodeValidityMinutes: 10,
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
                getSystemConfig({ view: "admin" }),
                getEmailTemplates({ type: ["user-welcome", "password-reset", "magic-link", "otp"] }),
            ]);
            setConfig({
                userCreationEmailTemplateId: (data as any).userCreationEmailTemplateId || "",
                passwordResetEmailTemplateId: (data as any).passwordResetEmailTemplateId || "",
                setupTokenValidityHours: (data as any).setupTokenValidityHours || 72,
                magicLinkEnabled: (data as any).magicLinkEnabled ?? false,
                magicLinkEmailTemplateId: (data as any).magicLinkEmailTemplateId || "",
                magicLinkTokenValidityMinutes: (data as any).magicLinkTokenValidityMinutes || 15,
                otpEnabled: (data as any).otpEnabled ?? false,
                otpEmailTemplateId: (data as any).otpEmailTemplateId || "",
                otpCodeValidityMinutes: (data as any).otpCodeValidityMinutes || 10,
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
                magicLinkEnabled: config.magicLinkEnabled,
                magicLinkEmailTemplateId: config.magicLinkEmailTemplateId || undefined,
                magicLinkTokenValidityMinutes: config.magicLinkTokenValidityMinutes,
                otpEnabled: config.otpEnabled,
                otpEmailTemplateId: config.otpEmailTemplateId || undefined,
                otpCodeValidityMinutes: config.otpCodeValidityMinutes,
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

                    <div className="settings-panel" style={{ marginTop: 24 }}>
                        <h3 className="settings-panel-title">{t("systemSettings", "titleMagicLink")}</h3>
                        <p style={{ color: "var(--text-secondary, #888)", fontSize: 13, marginBottom: 16 }}>
                            {t("systemSettings", "titleMagicLinkDesc")}
                        </p>

                        <Stack spacing={3}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.magicLinkEnabled}
                                        onChange={(e) => handleChange("magicLinkEnabled", e.target.checked)}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" fontWeight={500}>
                                            {t("systemSettings", "fieldMagicLinkEnabled")}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("systemSettings", "fieldMagicLinkEnabledDesc")}
                                        </Typography>
                                    </Box>
                                }
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldMagicLinkTemplate")}
                                helperText={t("systemSettings", "fieldMagicLinkTemplateDesc")}
                                value={config.magicLinkEmailTemplateId}
                                onChange={(value) => handleChange("magicLinkEmailTemplateId", value)}
                                options={[
                                    { value: "", label: t("systemSettings", "noTemplateSelected") },
                                    ...emailTemplates
                                        .filter((template) => template.type === "magic-link")
                                        .map((template) => ({
                                            value: template.id,
                                            label: `${template.name}${!template.active ? " (Inactive)" : ""}`
                                        }))
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldMagicLinkValidity")}
                                helperText={t("systemSettings", "fieldMagicLinkValidityDesc")}
                                value={config.magicLinkTokenValidityMinutes}
                                onChange={(value) => handleChange("magicLinkTokenValidityMinutes", parseInt(String(value), 10))}
                                options={[
                                    { value: 5, label: "5 minutes" },
                                    { value: 10, label: "10 minutes" },
                                    { value: 15, label: "15 minutes" },
                                    { value: 30, label: "30 minutes" },
                                    { value: 60, label: "1 hour" },
                                ]}
                            />
                        </Stack>
                    </div>

                    <div className="settings-panel" style={{ marginTop: 24 }}>
                        <h3 className="settings-panel-title">{t("systemSettings", "titleOtp")}</h3>
                        <p style={{ color: "var(--text-secondary, #888)", fontSize: 13, marginBottom: 16 }}>
                            {t("systemSettings", "titleOtpDesc")}
                        </p>

                        <Stack spacing={3}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.otpEnabled}
                                        onChange={(e) => handleChange("otpEnabled", e.target.checked)}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" fontWeight={500}>
                                            {t("systemSettings", "fieldOtpEnabled")}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("systemSettings", "fieldOtpEnabledDesc")}
                                        </Typography>
                                    </Box>
                                }
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldOtpTemplate")}
                                helperText={t("systemSettings", "fieldOtpTemplateDesc")}
                                value={config.otpEmailTemplateId}
                                onChange={(value) => handleChange("otpEmailTemplateId", value)}
                                options={[
                                    { value: "", label: t("systemSettings", "noTemplateSelected") },
                                    ...emailTemplates
                                        .filter((template) => template.type === "otp")
                                        .map((template) => ({
                                            value: template.id,
                                            label: `${template.name}${!template.active ? " (Inactive)" : ""}`
                                        }))
                                ]}
                            />

                            <FormSelect
                                label={t("systemSettings", "fieldOtpValidity")}
                                helperText={t("systemSettings", "fieldOtpValidityDesc")}
                                value={config.otpCodeValidityMinutes}
                                onChange={(value) => handleChange("otpCodeValidityMinutes", parseInt(String(value), 10))}
                                options={[
                                    { value: 5, label: "5 minutes" },
                                    { value: 10, label: "10 minutes" },
                                    { value: 15, label: "15 minutes" },
                                    { value: 30, label: "30 minutes" },
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
