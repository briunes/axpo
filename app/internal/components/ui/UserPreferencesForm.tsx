"use client";

import { useState, useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { FormSelect } from "./FormSelect";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useUserPreferences } from "../providers/UserPreferencesProvider";

interface UserPreferences {
    language: string | null;
    dateFormat: string;
    timeFormat: string;
    timezone: string;
    numberFormat: string;
    itemsPerPage: number;
    _overrides?: {
        language: boolean;
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
    const { t, setLocale } = useI18n();
    const { refresh: refreshProviderPrefs } = useUserPreferences();
    const [preferences, setPreferences] = useState<UserPreferences>({
        language: null,
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
                    language: preferences.language,
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
            // Apply language change immediately and directly
            if (preferences.language === "en" || preferences.language === "es") {
                setLocale(preferences.language as "en" | "es");
            }
            await refreshProviderPrefs();
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

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",          // mobile: 1 column
                        sm: "1fr 1fr",      // tablet: 2 columns
                        md: "1fr 1fr 1fr",  // desktop: 3 columns
                    },
                    gap: 3,
                }}
            >
                {/* Language */}
                <FormSelect
                    label={t("userPreferences", "fieldLanguage")}
                    value={preferences.language ?? ""}
                    onChange={(value) => handleChange("language", value || null)}
                    options={[
                        { value: "", label: `— ${t("userPreferences", "languageSystemDefault")} —` },
                        { value: "en", label: "🇬🇧 English" },
                        { value: "es", label: "🇪🇸 Español" },
                    ]}
                />

                {/* Date Format */}
                <FormSelect
                    label={t("systemSettings", "fieldDateFormat")}
                    value={preferences.dateFormat}
                    onChange={(value) => handleChange("dateFormat", value)}
                    options={[
                        { value: "DD/MM/YYYY", label: "DD/MM/YYYY (17/04/2026)" },
                        { value: "MM/DD/YYYY", label: "MM/DD/YYYY (04/17/2026)" },
                        { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-04-17)" },
                    ]}
                />

                {/* Time Format */}
                <FormSelect
                    label={t("systemSettings", "fieldTimeFormat")}
                    value={preferences.timeFormat}
                    onChange={(value) => handleChange("timeFormat", value)}
                    options={[
                        { value: "24h", label: "24-hour (14:30)" },
                        { value: "12h", label: "12-hour (2:30 PM)" },
                    ]}
                />

                {/* Timezone */}
                <FormSelect
                    label={t("systemSettings", "fieldTimezone")}
                    value={preferences.timezone}
                    onChange={(value) => handleChange("timezone", value)}
                    options={[
                        { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
                        { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                        { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
                        { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
                        { value: "America/New_York", label: "America/New York (EST/EDT)" },
                        { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
                        { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
                        { value: "UTC", label: "UTC" },
                    ]}
                />

                {/* Number Format */}
                <FormSelect
                    label={t("systemSettings", "fieldNumberFormat")}
                    value={preferences.numberFormat}
                    onChange={(value) => handleChange("numberFormat", value)}
                    options={[
                        { value: "eu", label: "European (1.234,56)" },
                        { value: "us", label: "US/UK (1,234.56)" },
                    ]}
                />

                {/* Items Per Page */}
                <FormSelect
                    label={t("systemSettings", "fieldItemsPerPage")}
                    value={preferences.itemsPerPage}
                    onChange={(value) => handleChange("itemsPerPage", Number(value))}
                    options={[
                        { value: 10, label: "10" },
                        { value: 25, label: "25" },
                        { value: 50, label: "50" },
                        { value: 100, label: "100" },
                    ]}
                />
            </Box>

            {/* Save Button */}
            <Box sx={{ display: "flex", justifyContent: "flex-start", pt: 3 }}>
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
    );
}
