"use client";

import { useState, useEffect } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

interface UserPreferences {
    dateFormat: string;
    timeFormat: string;
    timezone: string;
    numberFormat: string;
    itemsPerPage: number;
    _overrides?: {
        dateFormat: boolean;
        timeFormat: boolean;
        timezone: boolean;
        numberFormat: boolean;
        itemsPerPage: boolean;
    };
}

interface UserPreferencesFormProps {
    userId: string;
    token: string;
    onNotify?: (message: string, tone: "success" | "error") => void;
}

export function UserPreferencesForm({ userId, token, onNotify }: UserPreferencesFormProps) {
    const { t } = useI18n();
    const [preferences, setPreferences] = useState<UserPreferences>({
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        timezone: "Europe/Madrid",
        numberFormat: "eu",
        itemsPerPage: 10,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, [userId]);

    const loadPreferences = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/internal/users/${userId}/preferences`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load preferences");
            }

            const data = await response.json();
            setPreferences(data);
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : "Failed to load preferences",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof UserPreferences, value: any) => {
        setPreferences((prev) => ({
            ...prev,
            [field]: value,
        }));
        setIsDirty(true);
    };

    const handleReset = (field: keyof UserPreferences) => {
        handleChange(field, null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/v1/internal/users/${userId}/preferences`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    dateFormat: preferences.dateFormat,
                    timeFormat: preferences.timeFormat,
                    timezone: preferences.timezone,
                    numberFormat: preferences.numberFormat,
                    itemsPerPage: preferences.itemsPerPage,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save preferences");
            }

            onNotify?.(t("userPreferences", "saveSuccess"), "success");
            setIsDirty(false);
            loadPreferences(); // Reload to get updated override flags
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("userPreferences", "saveError"),
                "error"
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Typography>{t("userPreferences", "loading")}</Typography>;
    }

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t("userPreferences", "title")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("userPreferences", "description")}
                </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Date Format */}
                <FormControl fullWidth>
                    <InputLabel>{t("systemSettings", "fieldDateFormat")}</InputLabel>
                    <Select
                        value={preferences.dateFormat}
                        label={t("systemSettings", "fieldDateFormat")}
                        onChange={(e) => handleChange("dateFormat", e.target.value)}
                    >
                        <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (17/04/2026)</MenuItem>
                        <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (04/17/2026)</MenuItem>
                        <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (2026-04-17)</MenuItem>
                    </Select>

                </FormControl>

                {/* Time Format */}
                <FormControl fullWidth>
                    <InputLabel>{t("systemSettings", "fieldTimeFormat")}</InputLabel>
                    <Select
                        value={preferences.timeFormat}
                        label={t("systemSettings", "fieldTimeFormat")}
                        onChange={(e) => handleChange("timeFormat", e.target.value)}
                    >
                        <MenuItem value="24h">24-hour (14:30)</MenuItem>
                        <MenuItem value="12h">12-hour (2:30 PM)</MenuItem>
                    </Select>

                </FormControl>

                {/* Timezone */}
                <FormControl fullWidth>
                    <InputLabel>{t("systemSettings", "fieldTimezone")}</InputLabel>
                    <Select
                        value={preferences.timezone}
                        label={t("systemSettings", "fieldTimezone")}
                        onChange={(e) => handleChange("timezone", e.target.value)}
                    >
                        <MenuItem value="Europe/Madrid">Europe/Madrid (CET/CEST)</MenuItem>
                        <MenuItem value="Europe/London">Europe/London (GMT/BST)</MenuItem>
                        <MenuItem value="Europe/Paris">Europe/Paris (CET/CEST)</MenuItem>
                        <MenuItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</MenuItem>
                        <MenuItem value="America/New_York">America/New York (EST/EDT)</MenuItem>
                        <MenuItem value="America/Chicago">America/Chicago (CST/CDT)</MenuItem>
                        <MenuItem value="America/Los_Angeles">America/Los Angeles (PST/PDT)</MenuItem>
                        <MenuItem value="UTC">UTC</MenuItem>
                    </Select>

                </FormControl>

                {/* Number Format */}
                <FormControl fullWidth>
                    <InputLabel>{t("systemSettings", "fieldNumberFormat")}</InputLabel>
                    <Select
                        value={preferences.numberFormat}
                        label={t("systemSettings", "fieldNumberFormat")}
                        onChange={(e) => handleChange("numberFormat", e.target.value)}
                    >
                        <MenuItem value="eu">European (1.234,56)</MenuItem>
                        <MenuItem value="us">US/UK (1,234.56)</MenuItem>
                    </Select>

                </FormControl>

                {/* Items Per Page */}
                <FormControl fullWidth>
                    <InputLabel>{t("systemSettings", "fieldItemsPerPage")}</InputLabel>
                    <Select
                        value={preferences.itemsPerPage}
                        label={t("systemSettings", "fieldItemsPerPage")}
                        onChange={(e) => handleChange("itemsPerPage", Number(e.target.value))}
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </FormControl>

                {/* Save Button */}
                <Box sx={{ display: "flex", justifyContent: "flex-start", pt: 1 }}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        size="large"
                    >
                        {saving ? t("actions", "saving") : t("actions", "saveChanges")}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
