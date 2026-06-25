"use client";

import { useState, useEffect } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";

export interface CronSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface CronConfig {
    enabled: boolean;
    schedule: string;
    timezone: string;
    scheduleDescription?: string;
}

const COMMON_SCHEDULES = [
    { value: "0 2 * * *", labelKey: "scheduleDaily2" },
    { value: "0 3 * * *", labelKey: "scheduleDaily3" },
    { value: "0 4 * * *", labelKey: "scheduleDaily4" },
    { value: "0 0 * * *", labelKey: "scheduleMidnight" },
    { value: "0 */6 * * *", labelKey: "scheduleEvery6Hours" },
    { value: "0 */12 * * *", labelKey: "scheduleEvery12Hours" },
    { value: "0 0 * * 0", labelKey: "scheduleWeeklySunday" },
    { value: "custom", labelKey: "scheduleCustom" },
];

const COMMON_TIMEZONES = [
    { value: "UTC", label: "UTC" },
    { value: "Europe/Madrid", label: "Europe/Madrid" },
    { value: "Europe/London", label: "Europe/London" },
    { value: "Europe/Paris", label: "Europe/Paris" },
    { value: "America/New_York", label: "America/New York" },
    { value: "America/Los_Angeles", label: "America/Los Angeles" },
    { value: "America/Mexico_City", label: "America/Mexico City" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo" },
    { value: "Asia/Shanghai", label: "Asia/Shanghai" },
];

export function CronSettings({ session, onNotify }: CronSettingsProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<CronConfig>({
        enabled: true,
        schedule: "0 2 * * *",
        timezone: "UTC",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState("0 2 * * *");
    const [customSchedule, setCustomSchedule] = useState("");
    const [showCustom, setShowCustom] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/v1/internal/system/cron-config", {
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) throw new Error(t("cronSettings", "loadError"));

            const data = await response.json();
            setConfig(data);

            // Check if schedule matches a common one
            const isCommon = COMMON_SCHEDULES.some(s => s.value === data.schedule && s.value !== "custom");
            if (isCommon) {
                setSelectedSchedule(data.schedule);
                setShowCustom(false);
            } else {
                setSelectedSchedule("custom");
                setCustomSchedule(data.schedule);
                setShowCustom(true);
            }
        } catch (error) {
            console.error("Error loading cron config:", error);
            onNotify(t("cronSettings", "loadError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleScheduleChange = (value: string) => {
        setSelectedSchedule(value);
        if (value === "custom") {
            setShowCustom(true);
            setConfig({ ...config, schedule: customSchedule || "0 2 * * *" });
        } else {
            setShowCustom(false);
            setConfig({ ...config, schedule: value });
        }
        setIsDirty(true);
    };

    const handleCustomScheduleChange = (value: string) => {
        setCustomSchedule(value);
        setConfig({ ...config, schedule: value });
        setIsDirty(true);
    };

    const handleToggleEnabled = (enabled: boolean) => {
        setConfig({ ...config, enabled });
        setIsDirty(true);
    };

    const handleTimezoneChange = (timezone: string) => {
        setConfig({ ...config, timezone });
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const response = await fetch("/api/v1/internal/system/cron-config", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${session.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    enabled: config.enabled,
                    schedule: config.schedule,
                    timezone: config.timezone,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || t("cronSettings", "updateError"));
            }

            const data = await response.json();
            setConfig(data.config);
            setIsDirty(false);
            onNotify(t("cronSettings", "saveSuccess"), "success");
        } catch (error) {
            console.error("Error saving cron config:", error);
            onNotify(error instanceof Error ? error.message : t("cronSettings", "saveError"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        loadConfig();
        setIsDirty(false);
    };

    if (isLoading) {
        return (
            <div className="settings-panel">
                <div style={{ padding: "40px", textAlign: "center", color: "var(--axpo-text-muted)" }}>
                    {t("cronSettings", "loading")}
                </div>
            </div>
        );
    }

    return (
        <div className="settings-panel">
            <h3 className="settings-panel-title">{t("cronSettings", "title")}</h3>
            <p className="settings-panel-description">
                {t("cronSettings", "description")}
            </p>

            <div className="config-field">
                <label className="config-field-inline">
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleToggleEnabled(e.target.checked)}
                    />
                    <span>{t("cronSettings", "enableExpiration")}</span>
                </label>
                <span className="config-field-description" style={{ marginLeft: "32px" }}>
                    {t("cronSettings", "enableExpirationDesc")}
                </span>
            </div>

            {config.enabled && (
                <>
                    <div className="config-field">
                        <label className="config-field-label">{t("cronSettings", "schedule")}</label>
                        <span className="config-field-description">
                            {t("cronSettings", "scheduleDesc")}
                        </span>
                        <select
                            value={selectedSchedule}
                            onChange={(e) => handleScheduleChange(e.target.value)}
                        >
                            {COMMON_SCHEDULES.map((schedule) => (
                                <option key={schedule.value} value={schedule.value}>
                                    {t("cronSettings", schedule.labelKey)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {showCustom && (
                        <div className="config-field">
                            <label className="config-field-label">{t("cronSettings", "customExpression")}</label>
                            <span className="config-field-description">
                                {t("cronSettings", "customExpressionDesc")}
                            </span>
                            <input
                                type="text"
                                placeholder="0 2 * * *"
                                value={customSchedule}
                                onChange={(e) => handleCustomScheduleChange(e.target.value)}
                                style={{ fontFamily: "monospace" }}
                            />
                            <div style={{ marginTop: "8px", color: "var(--axpo-text-muted)" }}>
                                <a
                                    href="https://crontab.guru/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: "var(--axpo-primary)" }}
                                >
                                    → {t("cronSettings", "crontabGuru")}
                                </a>
                            </div>
                        </div>
                    )}

                    <div className="config-field">
                        <label className="config-field-label">{t("cronSettings", "timezone")}</label>
                        <span className="config-field-description">
                            {t("cronSettings", "timezoneDesc")}
                        </span>
                        <select
                            value={config.timezone}
                            onChange={(e) => handleTimezoneChange(e.target.value)}
                        >
                            {COMMON_TIMEZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {config.scheduleDescription && (
                        <div className="config-field">
                            <div style={{
                                padding: "12px 16px",
                                backgroundColor: "var(--axpo-bg-subtle)",
                                borderRadius: "6px",
                                border: "1px solid var(--axpo-border)",
                            }}>
                                <div style={{color: "var(--axpo-text-muted)", marginBottom: "4px" }}>
                                    {t("cronSettings", "currentSchedule")}
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 600 }}>
                                    {config.scheduleDescription} ({config.timezone})
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="config-actions" style={{ marginTop: "24px" }}>
                <button
                    className="config-btn config-btn-primary"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                >
                    {isSaving ? t("cronSettings", "saving") : t("cronSettings", "saveChanges")}
                </button>
                <button
                    className="config-btn config-btn-secondary"
                    onClick={handleReset}
                    disabled={!isDirty || isSaving}
                >
                    {t("cronSettings", "reset")}
                </button>
            </div>
        </div>
    );
}
