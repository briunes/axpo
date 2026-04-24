"use client";

import { useState, useEffect } from "react";
import { Box, Button, Checkbox, FormControlLabel, FormGroup, Stack, Typography, Divider } from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AgencyTariff {
    id?: string;
    tariffType: string;
    isEnabled: boolean;
}

interface AgencyTariffConfigProps {
    agencyId: string;
    token: string;
    onNotify?: (message: string, tone: "success" | "error") => void;
}

const ELECTRICITY_TARIFFS = ["ELEC:2.0TD", "ELEC:3.0TD", "ELEC:6.1TD"];
const GAS_TARIFFS = [
    "GAS:RL01",
    "GAS:RL02",
    "GAS:RL03",
    "GAS:RL04",
    "GAS:RL05",
    "GAS:RL06",
    "GAS:RLPS1",
    "GAS:RLPS2",
    "GAS:RLPS3",
    "GAS:RLPS4",
    "GAS:RLPS5",
    "GAS:RLPS6",
];

export function AgencyTariffConfig({ agencyId, token, onNotify }: AgencyTariffConfigProps) {
    const { t } = useI18n();
    const [tariffs, setTariffs] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        loadTariffs();
    }, [agencyId]);

    const loadTariffs = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/internal/agencies/${agencyId}/tariffs`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load tariffs");
            }

            const data: AgencyTariff[] = await response.json();

            // Initialize all tariffs as enabled by default
            const tariffMap: Record<string, boolean> = {};
            [...ELECTRICITY_TARIFFS, ...GAS_TARIFFS].forEach((tariffType) => {
                const existing = data.find((t) => t.tariffType === tariffType);
                tariffMap[tariffType] = existing ? existing.isEnabled : true;
            });

            setTariffs(tariffMap);
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : "Failed to load tariff configuration",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (tariffType: string) => {
        setTariffs((prev) => ({
            ...prev,
            [tariffType]: !prev[tariffType],
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const tariffList = Object.entries(tariffs).map(([tariffType, isEnabled]) => ({
                tariffType,
                isEnabled,
            }));

            const response = await fetch(`/api/v1/internal/agencies/${agencyId}/tariffs`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tariffList),
            });

            if (!response.ok) {
                throw new Error("Failed to save tariff configuration");
            }

            onNotify?.(t("agencyTariffs", "saveSuccess"), "success");
            setIsDirty(false);
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("agencyTariffs", "saveError"),
                "error"
            );
        } finally {
            setSaving(false);
        }
    };

    const formatTariffName = (tariffType: string) => {
        const [type, code] = tariffType.split(":");
        if (type === "ELEC") {
            return `${t("agencyTariffs", "electricity")}: ${code}`;
        } else if (type === "GAS") {
            return `${t("agencyTariffs", "gas")}: ${code}`;
        }
        return tariffType;
    };

    if (loading) {
        return <Typography>{t("agencyTariffs", "loading")}</Typography>;
    }

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t("agencyTariffs", "title")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("agencyTariffs", "description")}
                </Typography>
            </Box>

            <Stack spacing={3}>
                {/* Electricity Tariffs Card */}
                <Box
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 3,
                        backgroundColor: "background.paper",
                    }}
                >
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                        ⚡ {t("agencyTariffs", "electricity")}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: 2,
                        }}
                    >
                        {ELECTRICITY_TARIFFS.map((tariffType) => (
                            <FormControlLabel
                                key={tariffType}
                                control={
                                    <Checkbox
                                        checked={tariffs[tariffType] ?? true}
                                        onChange={() => handleToggle(tariffType)}
                                        color="primary"
                                    />
                                }
                                label={tariffType.replace("ELEC:", "")}
                            />
                        ))}
                    </Box>
                </Box>

                {/* Gas Tariffs Card */}
                <Box
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 3,
                        backgroundColor: "background.paper",
                    }}
                >
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                        🔥 {t("agencyTariffs", "gas")}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                            gap: 2,
                        }}
                    >
                        {GAS_TARIFFS.map((tariffType) => (
                            <FormControlLabel
                                key={tariffType}
                                control={
                                    <Checkbox
                                        checked={tariffs[tariffType] ?? true}
                                        onChange={() => handleToggle(tariffType)}
                                        color="primary"
                                    />
                                }
                                label={tariffType.replace("GAS:", "")}
                            />
                        ))}
                    </Box>
                </Box>

                {/* Save Button */}
                <Box sx={{ display: "flex", justifyContent: "flex-start", pt: 1 }}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        size="large"
                    >
                        {saving ? t("actions", "saving") : t("agencyTariffs", "save")}
                    </Button>
                </Box>
            </Stack>
        </Box>
    );
}
