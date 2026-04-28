"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig, testSmtpConnection, type SmtpTestResult } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { FormInput } from "../ui";

export interface SmtpSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface SmtpConfig {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFromEmail: string;
    smtpFromName: string;
}

const DEFAULT_CONFIG: SmtpConfig = {
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "Axpo Simulator",
};

export function SmtpSettings({ session, onNotify }: SmtpSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<SmtpConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isTestingSmtp, setIsTestingSmtp] = useState(false);
    const [smtpTestResult, setSmtpTestResult] = useState<SmtpTestResult | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemConfig();
            setConfig({
                smtpHost: (data as any).smtpHost || "",
                smtpPort: (data as any).smtpPort || 587,
                smtpSecure: (data as any).smtpSecure || false,
                smtpUser: (data as any).smtpUser || "",
                smtpPassword: (data as any).smtpPassword || "",
                smtpFromEmail: (data as any).smtpFromEmail || "",
                smtpFromName: (data as any).smtpFromName || "Axpo Simulator",
            });
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof SmtpConfig, value: any) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            await updateSystemConfig({
                smtpHost: config.smtpHost,
                smtpPort: config.smtpPort,
                smtpSecure: config.smtpSecure,
                smtpUser: config.smtpUser,
                smtpPassword: config.smtpPassword,
                smtpFromEmail: config.smtpFromEmail,
                smtpFromName: config.smtpFromName,
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
        <>
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <div className="settings-panel">
                        <h3 className="settings-panel-title">{t("systemSettings", "titleSmtp")}</h3>

                        <Stack spacing={3}>
                            <FormInput
                                label={t("systemSettings", "fieldSmtpHost")}
                                helperText={t("systemSettings", "fieldSmtpHostDesc")}
                                type="text"
                                placeholder="smtp.example.com"
                                value={config.smtpHost}
                                onChange={(e) => handleChange("smtpHost", e.target.value)}
                            />

                            <FormInput
                                label={t("systemSettings", "fieldSmtpPort")}
                                helperText={t("systemSettings", "fieldSmtpPortDesc")}
                                type="number"
                                slotProps={{
                                    htmlInput: { min: 1, max: 65535 }
                                }}
                                value={config.smtpPort}
                                onChange={(e) => handleChange("smtpPort", parseInt(e.target.value, 10))}
                            />

                            <Box>
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
                            </Box>

                            <FormInput
                                label={t("systemSettings", "fieldSmtpUser")}
                                helperText={t("systemSettings", "fieldSmtpUserDesc")}
                                type="text"
                                placeholder="user@example.com"
                                value={config.smtpUser}
                                onChange={(e) => handleChange("smtpUser", e.target.value)}
                            />

                            <FormInput
                                label={t("systemSettings", "fieldSmtpPassword")}
                                helperText={t("systemSettings", "fieldSmtpPasswordDesc")}
                                type="password"
                                placeholder="••••••••"
                                value={config.smtpPassword}
                                onChange={(e) => handleChange("smtpPassword", e.target.value)}
                            />

                            <FormInput
                                label={t("systemSettings", "fieldFromEmail")}
                                helperText={t("systemSettings", "fieldFromEmailDesc")}
                                type="email"
                                placeholder="noreply@example.com"
                                value={config.smtpFromEmail}
                                onChange={(e) => handleChange("smtpFromEmail", e.target.value)}
                            />

                            <FormInput
                                label={t("systemSettings", "fieldFromName")}
                                helperText={t("systemSettings", "fieldFromNameDesc")}
                                type="text"
                                placeholder="Axpo Simulator"
                                value={config.smtpFromName}
                                onChange={(e) => handleChange("smtpFromName", e.target.value)}
                            />

                            <Box sx={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--axpo-border)" }}>
                                <label className="config-field-label">{t("systemSettings", "smtpTestTitle")}</label>
                                <span className="config-field-description">
                                    {t("systemSettings", "smtpTestDesc")}
                                </span>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, marginTop: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={handleTestSmtp}
                                        disabled={isTestingSmtp || !config.smtpHost}
                                    >
                                        {isTestingSmtp ? t("systemSettings", "smtpTesting") : t("systemSettings", "btnTestConnection")}
                                    </Button>
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
                                </Box>
                            </Box>
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
