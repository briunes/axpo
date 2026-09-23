"use client";

import { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Chip, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { getSystemConfig, updateSystemConfig, type SystemConfig } from "../../lib/configApi";
import { useI18n } from "@/lib/i18n-context";
import { LoadingState } from "../shared/LoadingState";

type Recipient = NonNullable<SystemConfig["incidentRecipientOptions"]>[number];

export function SimulationIncidentSettings({ onNotify }: {
    onNotify: (message: string, tone: "success" | "error") => void;
}) {
    const { t } = useI18n();
    const [options, setOptions] = useState<Recipient[]>([]);
    const [search, setSearch] = useState({ ADMIN: "", SYS_ADMIN: "" });
    const [enabled, setEnabled] = useState(true);
    const [ids, setIds] = useState<string[]>([]);
    const [saved, setSaved] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [saving, setSaving] = useState(false);
    const serialized = JSON.stringify({ enabled, ids: [...ids].sort() });

    useEffect(() => {
        let cancelled = false;
        getSystemConfig({ view: "admin" }).then((config) => {
            if (cancelled) return;
            const recipients = config.incidentRecipientOptions ?? [];
            const selected = (config.incidentRecipientIds ?? []).filter(id => recipients.some(user => user.id === id));
            const reportingEnabled = config.simulationIssuesEnabled !== false;
            setOptions(recipients);
            setIds(selected);
            setEnabled(reportingEnabled);
            setSaved(JSON.stringify({ enabled: reportingEnabled, ids: [...selected].sort() }));
        }).catch(() => { if (!cancelled) setError(true); })
          .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await updateSystemConfig({ simulationIssuesEnabled: enabled, incidentRecipientIds: ids });
            setSaved(serialized);
            onNotify(t("systemSettings", "incidentSettingsSaved"), "success");
        } catch {
            onNotify(t("systemSettings", "incidentSettingsError"), "error");
        } finally { setSaving(false); }
    };

    if (loading) return <LoadingState />;
    if (error) return <Alert severity="error">{t("systemSettings", "incidentSettingsError")}</Alert>;
    return <Box className="settings-panel">
        <Stack spacing={3}>
            <Box>
                <FormControlLabel control={<Switch checked={enabled} disabled={saving} onChange={(_, checked) => setEnabled(checked)} />}
                    label={t("systemSettings", "fieldSimulationIssuesEnabled")} />
                <Typography variant="body2" color="text.secondary">{t("systemSettings", "fieldSimulationIssuesEnabledDesc")}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">{t("systemSettings", "incidentRecipientsHelp")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                {(["ADMIN", "SYS_ADMIN"] as const).map(role => {
                    const selected = options.filter(user => user.role === role && ids.includes(user.id));
                    const available = options.filter(user => user.role === role && !ids.includes(user.id));
                    return <Stack key={role} component="section" aria-labelledby={`incident-recipients-${role}`} spacing={2}
                        sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
                        <Typography id={`incident-recipients-${role}`} variant="subtitle1" fontWeight={600}>
                            {t("systemSettings", role === "ADMIN" ? "incidentAdmins" : "incidentSysAdmins")}
                        </Typography>
                        <Autocomplete<Recipient> options={available} disabled={saving} value={null}
                            inputValue={search[role]}
                            onInputChange={(_, value) => setSearch(current => ({ ...current, [role]: value }))}
                            onChange={(_, user) => {
                                if (!user) return;
                                setIds(current => current.includes(user.id) ? current : [...current, user.id]);
                                setSearch(current => ({ ...current, [role]: "" }));
                            }}
                            getOptionLabel={user => `${user.fullName} (${user.email})`}
                            getOptionKey={user => user.id}
                            noOptionsText={t("systemSettings", "incidentNoAvailableUsers")}
                            renderInput={params => <TextField {...params}
                                label={t("systemSettings", "incidentAddRecipient")} />} />
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {selected.map(user => <Chip key={user.id} label={`${user.fullName} (${user.email})`}
                                disabled={saving}
                                onDelete={() => setIds(current => current.filter(id => id !== user.id))}
                                sx={{ maxWidth: "100%", height: "auto", "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.75 } }} />)}
                            {selected.length === 0 && <Typography variant="body2" color="text.secondary">
                                {t("systemSettings", "incidentNoSelectedUsers")}
                            </Typography>}
                        </Box>
                    </Stack>;
                })}
            </Box>
            {ids.length === 0 && <Alert severity="info">{t("systemSettings", "incidentRecipientsEmpty")}</Alert>}
            <Button variant="contained" onClick={save} disabled={saving || saved === serialized} sx={{ alignSelf: "flex-end" }}>
                {t("systemSettings", "btnSave")}
            </Button>
        </Stack>
    </Box>;
}
