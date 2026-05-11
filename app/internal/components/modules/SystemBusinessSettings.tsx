"use client";

import { useState, useEffect } from "react";
import { Box, Tabs, Tab, Button, Stack, IconButton, Tooltip, Select, MenuItem, TextField, Typography, Chip, FormControl, InputLabel, FormHelperText } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { CronSettings } from "./CronSettings";
import { FormInput, FormSelect } from "../ui";

export interface SystemBusinessSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type BusinessTab = "simulation" | "clients" | "calculation" | "pdf-defaults" | "cron";

interface BusinessConfig {
    simulationExpirationDays: number;
    autoCreateClientOnSimulation: boolean;
    ivaRate: number;
    electricityTaxRate: number;
    hydrocarbonTaxRate: number;
    ivaRateOptions: number[];
    electricityTaxRateOptions: number[];
    hydrocarbonTaxRateOptions: number[];
    defaultPdfTemplateGasId: string | null;
    defaultPdfTemplateElectricityId: string | null;
}

const DEFAULT_CONFIG: BusinessConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    ivaRate: 0.21,
    electricityTaxRate: 0.051127,
    hydrocarbonTaxRate: 0.00234,
    ivaRateOptions: [0.21],
    electricityTaxRateOptions: [0.051127],
    hydrocarbonTaxRateOptions: [0.00234],
    defaultPdfTemplateGasId: null,
    defaultPdfTemplateElectricityId: null,
};

export function SystemBusinessSettings({ session, onNotify }: SystemBusinessSettingsProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<BusinessTab>("simulation");
    const [config, setConfig] = useState<BusinessConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfTemplates, setPdfTemplates] = useState<any[]>([]);

    const BUSINESS_TABS: Record<BusinessTab, string> = {
        simulation: t("systemSettings", "tabSimulation"),
        clients: t("systemSettings", "tabClients"),
        calculation: t("systemSettings", "tabCalculation"),
        "pdf-defaults": t("systemSettings", "tabPdfDefaults"),
        cron: "Cron Jobs",
    };

    useEffect(() => {
        loadConfig();
        loadPdfTemplates();
    }, []);

    const loadPdfTemplates = async () => {
        try {
            const response = await fetch("/api/v1/internal/config/pdf-templates");
            if (response.ok) {
                const data = await response.json();
                setPdfTemplates(data);
            }
        } catch (error) {
            console.error("Failed to load PDF templates:", error);
        }
    };

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemConfig();
            const ivaRateVal = (data as any).ivaRate || 0.21;
            const elecTaxVal = (data as any).electricityTaxRate || 0.051127;
            const hydroVal = (data as any).hydrocarbonTaxRate || 0.00234;
            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                autoCreateClientOnSimulation: data.autoCreateClientOnSim,
                ivaRate: ivaRateVal,
                electricityTaxRate: elecTaxVal,
                hydrocarbonTaxRate: hydroVal,
                ivaRateOptions: (data as any).ivaRateOptions ?? [ivaRateVal],
                electricityTaxRateOptions: (data as any).electricityTaxRateOptions ?? [elecTaxVal],
                hydrocarbonTaxRateOptions: (data as any).hydrocarbonTaxRateOptions ?? [hydroVal],
                defaultPdfTemplateGasId: (data as any).defaultPdfTemplateGasId || null,
                defaultPdfTemplateElectricityId: (data as any).defaultPdfTemplateElectricityId || null,
            });
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof BusinessConfig, value: any) => {
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
                hydrocarbonTaxRate: config.hydrocarbonTaxRate,
                ivaRateOptions: config.ivaRateOptions,
                electricityTaxRateOptions: config.electricityTaxRateOptions,
                hydrocarbonTaxRateOptions: config.hydrocarbonTaxRateOptions,
                defaultPdfTemplateGasId: config.defaultPdfTemplateGasId ?? undefined,
                defaultPdfTemplateElectricityId: config.defaultPdfTemplateElectricityId ?? undefined,
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

    const tabIndex = (Object.keys(BUSINESS_TABS) as BusinessTab[]).indexOf(activeTab);

    // ── Tax Rate List Field ──────────────────────────────────────────────────
    function TaxRateListField({
        label,
        helperText,
        options,
        activeValue,
        step,
        onOptionsChange,
        onActiveChange,
    }: {
        label: string;
        helperText: string;
        options: number[];
        activeValue: number;
        step?: number;
        onOptionsChange: (opts: number[]) => void;
        onActiveChange: (val: number) => void;
    }) {
        const [newValue, setNewValue] = useState("");

        const addOption = () => {
            const v = parseFloat(newValue);
            if (isNaN(v)) return;
            if (options.includes(v)) return;
            const updated = [...options, v].sort((a, b) => a - b);
            onOptionsChange(updated);
            setNewValue("");
        };

        const removeOption = (opt: number) => {
            const updated = options.filter((o) => o !== opt);
            onOptionsChange(updated);
            if (opt === activeValue && updated.length > 0) onActiveChange(updated[0]);
        };

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {/* Active value selector */}
                <FormControl size="small" fullWidth>
                    <InputLabel>{label}</InputLabel>
                    <Select
                        label={label}
                        value={activeValue}
                        onChange={(e) => onActiveChange(Number(e.target.value))}
                    >
                        {options.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                                <Typography variant="body2" fontFamily="monospace">{opt}</Typography>
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>{helperText}</FormHelperText>
                </FormControl>

                {/* Options list */}
                <Box sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1.5,
                    overflow: "hidden",
                }}>
                    {options.map((opt) => (
                        <Box
                            key={opt}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                px: 2,
                                py: 0.75,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                                bgcolor: opt === activeValue ? "action.selected" : "transparent",
                                "&:last-child": { borderBottom: "none" },
                            }}
                        >
                            <Typography variant="body2" fontFamily="monospace" sx={{ flex: 1 }}>
                                {opt}
                            </Typography>
                            {opt === activeValue && (
                                <Chip
                                    label={t("systemSettings", "taxRateActive")}
                                    size="small"
                                    color="primary"
                                    sx={{ mr: 1, height: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}
                                />
                            )}
                            <Tooltip title={t("systemSettings", "taxRateRemoveTooltip")}>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => removeOption(opt)}
                                        disabled={options.length <= 1}
                                        color="default"
                                        sx={{ "&:hover": { color: "error.main" } }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    ))}
                </Box>

                {/* Add new option */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <TextField
                        size="small"
                        type="number"
                        inputProps={{ step: step ?? 0.000001 }}
                        placeholder={t("systemSettings", "taxRateAddPlaceholder")}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addOption()}
                        sx={{ flex: 1 }}
                    />
                    <Button
                        variant="outlined"
                        onClick={addOption}
                        disabled={newValue === "" || isNaN(parseFloat(newValue))}
                        sx={{ textTransform: "none", whiteSpace: "nowrap", height: 40 }}
                    >
                        {t("systemSettings", "taxRateAddBtn")}
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <div className="system-settings-container">
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <Box
                        sx={{
                            borderBottom: "1px solid var(--scheme-neutral-900)",
                            px: 1,
                            background: "linear-gradient(180deg, var(--scheme-neutral-1200) 0%, var(--scheme-neutral-1100) 100%)",
                        }}
                    >
                        <Tabs
                            value={tabIndex}
                            onChange={(_, newValue) => {
                                const tabs = Object.keys(BUSINESS_TABS) as BusinessTab[];
                                setActiveTab(tabs[newValue]);
                            }}
                            sx={{
                                minHeight: 52,
                                '& .MuiTabs-indicator': {
                                    backgroundColor: 'var(--scheme-brand-600)',
                                    height: 2,
                                },
                            }}
                        >
                            {(Object.keys(BUSINESS_TABS) as BusinessTab[]).map((tab) => (
                                <Tab
                                    key={tab}
                                    label={BUSINESS_TABS[tab]}
                                    sx={{
                                        textTransform: 'none',
                                        minHeight: 52,
                                        color: 'var(--scheme-neutral-500)',
                                        fontWeight: 600,
                                        '&.Mui-selected': {
                                            color: 'var(--scheme-brand-600)',
                                        },
                                    }}
                                />
                            ))}
                        </Tabs>
                    </Box>

                    <div className="system-settings-content">
                        {activeTab === "simulation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleSimulation")}</h3>

                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label={t("systemSettings", "fieldExpirationDays")}
                                        helperText={t("systemSettings", "fieldExpirationDesc")}
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 1, max: 365 }
                                        }}
                                        value={config.simulationExpirationDays}
                                        onChange={(e) => handleChange("simulationExpirationDays", parseInt(e.target.value, 10))}
                                    />
                                </Box>
                            </div>
                        )}

                        {activeTab === "clients" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleClients")}</h3>

                                <Box sx={{ mb: 3 }}>
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
                                </Box>
                            </div>
                        )}

                        {activeTab === "calculation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleCalculation")}</h3>

                                <Stack spacing={4}>
                                    <TaxRateListField
                                        label={t("systemSettings", "fieldIvaRate")}
                                        helperText={t("systemSettings", "fieldIvaRateDesc")}
                                        options={config.ivaRateOptions}
                                        activeValue={config.ivaRate}
                                        step={0.01}
                                        onOptionsChange={(opts) => handleChange("ivaRateOptions", opts)}
                                        onActiveChange={(val) => {
                                            handleChange("ivaRate", val);
                                            handleChange("ivaRateOptions", config.ivaRateOptions.includes(val) ? config.ivaRateOptions : [...config.ivaRateOptions, val].sort((a, b) => a - b));
                                        }}
                                    />

                                    <TaxRateListField
                                        label={t("systemSettings", "fieldElectricityTaxRate")}
                                        helperText={t("systemSettings", "fieldElectricityTaxRateDesc")}
                                        options={config.electricityTaxRateOptions}
                                        activeValue={config.electricityTaxRate}
                                        step={0.000001}
                                        onOptionsChange={(opts) => handleChange("electricityTaxRateOptions", opts)}
                                        onActiveChange={(val) => {
                                            handleChange("electricityTaxRate", val);
                                            handleChange("electricityTaxRateOptions", config.electricityTaxRateOptions.includes(val) ? config.electricityTaxRateOptions : [...config.electricityTaxRateOptions, val].sort((a, b) => a - b));
                                        }}
                                    />

                                    <TaxRateListField
                                        label={t("systemSettings", "fieldHydrocarbonTaxRate")}
                                        helperText={t("systemSettings", "fieldHydrocarbonTaxRateDesc")}
                                        options={config.hydrocarbonTaxRateOptions}
                                        activeValue={config.hydrocarbonTaxRate}
                                        step={0.000001}
                                        onOptionsChange={(opts) => handleChange("hydrocarbonTaxRateOptions", opts)}
                                        onActiveChange={(val) => {
                                            handleChange("hydrocarbonTaxRate", val);
                                            handleChange("hydrocarbonTaxRateOptions", config.hydrocarbonTaxRateOptions.includes(val) ? config.hydrocarbonTaxRateOptions : [...config.hydrocarbonTaxRateOptions, val].sort((a, b) => a - b));
                                        }}
                                    />
                                </Stack>
                            </div>
                        )}

                        {activeTab === "pdf-defaults" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titlePdfDefaults")}</h3>
                                <p className="settings-panel-description">{t("systemSettings", "titlePdfDefaultsDesc")}</p>

                                <Stack spacing={3}>
                                    <FormSelect
                                        label={t("systemSettings", "fieldDefaultPdfGas")}
                                        helperText={t("systemSettings", "fieldDefaultPdfGasDesc")}
                                        value={config.defaultPdfTemplateGasId || ""}
                                        onChange={(value) => handleChange("defaultPdfTemplateGasId", value || null)}
                                        options={[
                                            { value: "", label: t("systemSettings", "noTemplateSelected") },
                                            ...pdfTemplates
                                                .filter((t) => !t.commodity || t.commodity === "GAS")
                                                .map((template) => ({
                                                    value: template.id,
                                                    label: template.name
                                                }))
                                        ]}
                                    />

                                    <FormSelect
                                        label={t("systemSettings", "fieldDefaultPdfElectricity")}
                                        helperText={t("systemSettings", "fieldDefaultPdfElectricityDesc")}
                                        value={config.defaultPdfTemplateElectricityId || ""}
                                        onChange={(value) => handleChange("defaultPdfTemplateElectricityId", value || null)}
                                        options={[
                                            { value: "", label: t("systemSettings", "noTemplateSelected") },
                                            ...pdfTemplates
                                                .filter((t) => !t.commodity || t.commodity === "ELECTRICITY")
                                                .map((template) => ({
                                                    value: template.id,
                                                    label: template.name
                                                }))
                                        ]}
                                    />
                                </Stack>
                            </div>
                        )}

                        {activeTab === "cron" && (
                            <CronSettings onNotify={onNotify} />
                        )}

                        {activeTab !== "cron" && (
                            <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
