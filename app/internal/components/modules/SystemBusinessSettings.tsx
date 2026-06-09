"use client";

import { useState, useEffect } from "react";
import { Box, Tabs, Tab, Button, Stack, IconButton, Tooltip, TextField, Typography, Checkbox, Switch } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { CronSettings } from "./CronSettings";
import { FormInput, FormSelect } from "../ui";

export interface SystemBusinessSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
    role?: string;
}

type BusinessTab = "general" | "simulation" | "clients" | "sessions" | "calculation" | "pdf-defaults" | "cron";

interface ElecZoneConfig {
    ivaRates: number[];
    ivaOptions: number[];
    elecTaxRates: number[];
    elecTaxOptions: number[];
}

interface ElecCanariasConfig {
    igicRates: number[];
    igicOptions: number[];
    elecTaxRates: number[];
    elecTaxOptions: number[];
}

interface GasZoneConfig {
    ivaRates: number[];
    ivaOptions: number[];
}

interface ElectricityTaxConfig {
    peninsula: ElecZoneConfig;
    baleares: ElecZoneConfig;
    canarias: ElecCanariasConfig;
}

interface GasTaxConfig {
    peninsula: GasZoneConfig;
    baleares: GasZoneConfig;
    hydrocarbonTaxRates: number[];
    hydrocarbonTaxOptions: number[];
}

interface BusinessConfig {
    simulationExpirationDays: number;
    autoCreateClientOnSimulation: boolean;
    defaultMaxActiveDevices: number;
    ivaRate: number;
    electricityTaxRate: number;
    hydrocarbonTaxRate: number;
    ivaRateOptions: number[];
    electricityTaxRateOptions: number[];
    hydrocarbonTaxRateOptions: number[];
    electricityTaxConfig: ElectricityTaxConfig;
    gasTaxConfig: GasTaxConfig;
    defaultPdfTemplateGasId: string | null;
    defaultPdfTemplateElectricityId: string | null;
    appVersion: string;
    maintenanceMode: boolean;
    maintenanceUntil: string;
    maintenanceMessage: string;
}

const DEFAULT_ELEC_TAX_CONFIG: ElectricityTaxConfig = {
    peninsula: { ivaRates: [0.21], ivaOptions: [0.21], elecTaxRates: [0.051127], elecTaxOptions: [0.051127] },
    baleares: { ivaRates: [0.21], ivaOptions: [0.21], elecTaxRates: [0.051127], elecTaxOptions: [0.051127] },
    canarias: { igicRates: [0.03], igicOptions: [0.03], elecTaxRates: [0.051127], elecTaxOptions: [0.051127] },
};

const DEFAULT_GAS_TAX_CONFIG: GasTaxConfig = {
    peninsula: { ivaRates: [0.21], ivaOptions: [0.21] },
    baleares: { ivaRates: [0.21], ivaOptions: [0.21] },
    hydrocarbonTaxRates: [0.00234],
    hydrocarbonTaxOptions: [0.00234],
};

const DEFAULT_CONFIG: BusinessConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    defaultMaxActiveDevices: 3,
    ivaRate: 0.21,
    electricityTaxRate: 0.051127,
    hydrocarbonTaxRate: 0.00234,
    ivaRateOptions: [0.21],
    electricityTaxRateOptions: [0.051127],
    hydrocarbonTaxRateOptions: [0.00234],
    electricityTaxConfig: DEFAULT_ELEC_TAX_CONFIG,
    gasTaxConfig: DEFAULT_GAS_TAX_CONFIG,
    defaultPdfTemplateGasId: null,
    defaultPdfTemplateElectricityId: null,
    appVersion: "1.0.0",
    maintenanceMode: false,
    maintenanceUntil: "",
    maintenanceMessage: "",
};

export function SystemBusinessSettings({ session, onNotify, role }: SystemBusinessSettingsProps) {
    const { t } = useI18n();
    const isSysAdmin = role === "SYS_ADMIN";
    const [activeTab, setActiveTab] = useState<BusinessTab>(isSysAdmin ? "general" : "simulation");
    const [calcEnergyTab, setCalcEnergyTab] = useState<"electricity" | "gas">("electricity");
    const [config, setConfig] = useState<BusinessConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfTemplates, setPdfTemplates] = useState<any[]>([]);

    const ALL_BUSINESS_TABS: Record<BusinessTab, string> = {
        general: "General",
        simulation: t("systemSettings", "tabSimulation"),
        clients: t("systemSettings", "tabClients"),
        sessions: "Sessions",
        calculation: t("systemSettings", "tabCalculation"),
        "pdf-defaults": t("systemSettings", "tabPdfDefaults"),
        cron: "Cron Jobs",
    };

    // general and cron are SYS_ADMIN-only
    const SYS_ADMIN_BUSINESS_TABS: BusinessTab[] = ["general", "cron"];
    const visibleBusinessTabs = (Object.keys(ALL_BUSINESS_TABS) as BusinessTab[]).filter(
        (tab) => !SYS_ADMIN_BUSINESS_TABS.includes(tab) || isSysAdmin,
    );
    const BUSINESS_TABS: Partial<Record<BusinessTab, string>> = Object.fromEntries(
        visibleBusinessTabs.map((tab) => [tab, ALL_BUSINESS_TABS[tab]]),
    );
    const resolvedBusinessTab = visibleBusinessTabs.includes(activeTab) ? activeTab : visibleBusinessTabs[0];

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
            const data = await getSystemConfig({ view: "admin" });
            const ivaRateVal = (data as any).ivaRate || 0.21;
            const elecTaxVal = (data as any).electricityTaxRate || 0.051127;
            const hydroVal = (data as any).hydrocarbonTaxRate || 0.00234;
            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                autoCreateClientOnSimulation: data.autoCreateClientOnSim,
                defaultMaxActiveDevices: (data as any).defaultMaxActiveDevices ?? 3,
                ivaRate: ivaRateVal,
                electricityTaxRate: elecTaxVal,
                hydrocarbonTaxRate: hydroVal,
                ivaRateOptions: (data as any).ivaRateOptions ?? [ivaRateVal],
                electricityTaxRateOptions: (data as any).electricityTaxRateOptions ?? [elecTaxVal],
                hydrocarbonTaxRateOptions: (data as any).hydrocarbonTaxRateOptions ?? [hydroVal],
                electricityTaxConfig: (data as any).electricityTaxConfig ?? DEFAULT_ELEC_TAX_CONFIG,
                gasTaxConfig: (data as any).gasTaxConfig ?? DEFAULT_GAS_TAX_CONFIG,
                defaultPdfTemplateGasId: (data as any).defaultPdfTemplateGasId || null,
                defaultPdfTemplateElectricityId: (data as any).defaultPdfTemplateElectricityId || null,
                appVersion: (data as any).appVersion ?? "1.0.0",
                maintenanceMode: (data as any).maintenanceMode ?? false,
                maintenanceUntil: (data as any).maintenanceUntil ? new Date((data as any).maintenanceUntil).toISOString().slice(0, 16) : "",
                maintenanceMessage: (data as any).maintenanceMessage ?? "",
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
                defaultMaxActiveDevices: config.defaultMaxActiveDevices,
                ivaRate: config.ivaRate,
                electricityTaxRate: config.electricityTaxRate,
                hydrocarbonTaxRate: config.hydrocarbonTaxRate,
                ivaRateOptions: config.ivaRateOptions,
                electricityTaxRateOptions: config.electricityTaxRateOptions,
                hydrocarbonTaxRateOptions: config.hydrocarbonTaxRateOptions,
                electricityTaxConfig: config.electricityTaxConfig,
                gasTaxConfig: config.gasTaxConfig,
                defaultPdfTemplateGasId: config.defaultPdfTemplateGasId ?? undefined,
                defaultPdfTemplateElectricityId: config.defaultPdfTemplateElectricityId ?? undefined,
                appVersion: config.appVersion,
                maintenanceMode: config.maintenanceMode,
                maintenanceUntil: config.maintenanceUntil ? new Date(config.maintenanceUntil).toISOString() : null,
                maintenanceMessage: config.maintenanceMessage || null,
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

    const tabIndex = visibleBusinessTabs.indexOf(resolvedBusinessTab);

    // ── Per-zone config helpers ──────────────────────────────────────────────
    const handleElecZoneChange = <Z extends keyof ElectricityTaxConfig, K extends keyof ElectricityTaxConfig[Z]>(
        zone: Z, key: K, value: ElectricityTaxConfig[Z][K]
    ) => {
        setConfig((prev) => ({
            ...prev,
            electricityTaxConfig: {
                ...prev.electricityTaxConfig,
                [zone]: { ...prev.electricityTaxConfig[zone], [key]: value },
            },
        }));
        setIsDirty(true);
    };

    const handleGasZoneChange = <Z extends "peninsula" | "baleares", K extends keyof GasZoneConfig>(
        zone: Z, key: K, value: GasZoneConfig[K]
    ) => {
        setConfig((prev) => ({
            ...prev,
            gasTaxConfig: {
                ...prev.gasTaxConfig,
                [zone]: { ...prev.gasTaxConfig[zone], [key]: value },
            },
        }));
        setIsDirty(true);
    };

    const handleGasHydroChange = (key: "hydrocarbonTaxRates" | "hydrocarbonTaxOptions", value: any) => {
        setConfig((prev) => ({
            ...prev,
            gasTaxConfig: { ...prev.gasTaxConfig, [key]: value },
        }));
        setIsDirty(true);
    };

    // ── Tax Rate Table ──────────────────────────────────────────────────────────
    function TaxRateTable({
        title,
        rows,
        columns,
        step,
        onAddRow,
        onRemoveRow,
    }: {
        title: string;
        rows: number[];
        columns: Array<{ key: string; label: string; activeValues: number[]; onToggle: (val: number) => void }>;
        step?: number;
        onAddRow: (val: number) => void;
        onRemoveRow: (val: number) => void;
    }) {
        const [newValue, setNewValue] = useState("");

        const addRow = () => {
            const v = parseFloat(newValue);
            if (isNaN(v) || rows.includes(v)) return;
            onAddRow(v);
            setNewValue("");
        };

        const isActiveAnywhere = (val: number) => columns.some(c => c.activeValues.includes(val));

        return (
            <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, mb: 1.5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontSize: 11 }}>
                    {title}
                </Typography>
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
                    {/* Header */}
                    <Box sx={{ display: "grid", gridTemplateColumns: `180px ${columns.map(() => "1fr").join(" ")} 36px`, bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em" }}>Value</Typography>
                        </Box>
                        {columns.map(col => (
                            <Box key={col.key} sx={{ px: 1, py: 1, textAlign: "center" }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em" }}>{col.label}</Typography>
                            </Box>
                        ))}
                        <Box />
                    </Box>
                    {/* Rows */}
                    {rows.map(val => (
                        <Box
                            key={val}
                            sx={{
                                display: "grid",
                                gridTemplateColumns: `180px ${columns.map(() => "1fr").join(" ")} 36px`,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                                "&:last-child": { borderBottom: "none" },
                                alignItems: "center",
                            }}
                        >
                            <Box sx={{ px: 2, py: 0.75 }}>
                                <Typography variant="body2" fontFamily="monospace" fontSize={13}>{val}</Typography>
                            </Box>
                            {columns.map(col => (
                                <Box key={col.key} sx={{ display: "flex", justifyContent: "center" }}>
                                    <Checkbox
                                        size="small"
                                        checked={col.activeValues.includes(val)}
                                        onChange={() => col.onToggle(val)}
                                        sx={{ p: 0.75, color: "var(--scheme-neutral-600)", '&.Mui-checked': { color: "var(--scheme-brand-600)" } }}
                                    />
                                </Box>
                            ))}
                            <Box sx={{ display: "flex", justifyContent: "center" }}>
                                <Tooltip title={t("systemSettings", "taxRateRemoveTooltip")}>
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={isActiveAnywhere(val) || rows.length <= 1}
                                            onClick={() => onRemoveRow(val)}
                                            sx={{ color: "var(--scheme-neutral-600)", "&:hover:not(:disabled)": { color: "error.main" } }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        </Box>
                    ))}
                </Box>
                {/* Add new value */}
                <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                    <TextField
                        size="small"
                        type="number"
                        inputProps={{ step: step ?? 0.000001 }}
                        placeholder={t("systemSettings", "taxRateAddPlaceholder")}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addRow()}
                        sx={{ flex: 1 }}
                    />
                    <Button
                        variant="outlined"
                        onClick={addRow}
                        disabled={newValue === "" || isNaN(parseFloat(newValue))}
                        sx={{ textTransform: "none", height: 40, whiteSpace: "nowrap" }}
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
                                setActiveTab(visibleBusinessTabs[newValue]);
                            }}
                            sx={{
                                minHeight: 52,
                                '& .MuiTabs-indicator': {
                                    backgroundColor: 'var(--scheme-brand-600)',
                                    height: 2,
                                },
                            }}
                        >
                            {visibleBusinessTabs.map((tab) => (
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
                        {resolvedBusinessTab === "general" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">General</h3>

                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label="App Version"
                                        helperText="Bump this value after each deployment to force all clients to clear their cache and reload the latest version."
                                        value={config.appVersion}
                                        onChange={(e) => handleChange("appVersion", e.target.value)}
                                    />
                                </Box>

                                {/* ── Maintenance Mode ─────────────────────────────────── */}
                                <Box sx={{
                                    mt: 2,
                                    p: 2.5,
                                    border: config.maintenanceMode
                                        ? "1.5px solid rgba(239, 68, 68, 0.5)"
                                        : "1px solid var(--scheme-neutral-800)",
                                    borderRadius: 2,
                                    background: config.maintenanceMode
                                        ? "rgba(239, 68, 68, 0.05)"
                                        : "transparent",
                                    transition: "all 0.2s",
                                }}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: config.maintenanceMode ? 2.5 : 0 }}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: config.maintenanceMode ? "error.main" : "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
                                                {config.maintenanceMode && (
                                                    <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }} />
                                                )}
                                                Maintenance Mode
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                {config.maintenanceMode
                                                    ? "Site is currently down for maintenance — all visitors see the maintenance page."
                                                    : "When enabled, all visitors will be redirected to a maintenance page."}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={config.maintenanceMode}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("maintenanceMode", e.target.checked)}
                                            color="error"
                                            sx={{ ml: 2, flexShrink: 0 }}
                                        />
                                    </Box>

                                    {config.maintenanceMode && (
                                        <Stack spacing={2}>
                                            <Box>
                                                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.75 }}>
                                                    Expected back online (optional)
                                                </Typography>
                                                <TextField
                                                    type="datetime-local"
                                                    size="small"
                                                    fullWidth
                                                    value={config.maintenanceUntil}
                                                    onChange={(e) => handleChange("maintenanceUntil", e.target.value)}
                                                    helperText="Leave blank to show no expected time to visitors."
                                                    slotProps={{ htmlInput: { min: new Date().toISOString().slice(0, 16) } }}
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.75 }}>
                                                    Maintenance message (optional)
                                                </Typography>
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    multiline
                                                    rows={2}
                                                    placeholder="We're performing scheduled maintenance to improve your experience."
                                                    value={config.maintenanceMessage}
                                                    onChange={(e) => handleChange("maintenanceMessage", e.target.value)}
                                                    helperText="Custom message shown to visitors on the maintenance page."
                                                />
                                            </Box>
                                        </Stack>
                                    )}
                                </Box>
                            </div>
                        )}

                        {resolvedBusinessTab === "simulation" && (
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

                        {resolvedBusinessTab === "clients" && (
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

                        {resolvedBusinessTab === "sessions" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">Sessions</h3>

                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label="Default max active sessions per user"
                                        helperText="Used as the default and maximum limit when creating users or when a user has no explicit value."
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 1 }
                                        }}
                                        value={config.defaultMaxActiveDevices}
                                        onChange={(e) => {
                                            const parsed = Number.parseInt(e.target.value, 10);
                                            handleChange("defaultMaxActiveDevices", Number.isNaN(parsed) ? 1 : parsed);
                                        }}
                                    />
                                </Box>
                            </div>
                        )}

                        {resolvedBusinessTab === "calculation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleCalculation")}</h3>

                                {/* ─── Electricity / Gas tabs ─── */}
                                <Box sx={{ borderBottom: "1px solid var(--scheme-neutral-800)", mb: 3 }}>
                                    <Tabs
                                        value={calcEnergyTab}
                                        onChange={(_, v) => setCalcEnergyTab(v)}
                                        sx={{ minHeight: 44, '& .MuiTabs-indicator': { backgroundColor: 'var(--scheme-brand-600)', height: 2 } }}
                                    >
                                        <Tab value="electricity" label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><span>⚡</span><span>{t("systemSettings", "calcElectricity")}</span></Box>} sx={{ textTransform: "none", minHeight: 44, fontWeight: 600, color: "var(--scheme-neutral-500)", '&.Mui-selected': { color: "var(--scheme-brand-600)" } }} />
                                        <Tab value="gas" label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><span>🔥</span><span>{t("systemSettings", "calcGas")}</span></Box>} sx={{ textTransform: "none", minHeight: 44, fontWeight: 600, color: "var(--scheme-neutral-500)", '&.Mui-selected': { color: "var(--scheme-brand-600)" } }} />
                                    </Tabs>
                                </Box>

                                {/* ─── Electricity tab content ─── */}
                                {calcEnergyTab === "electricity" && (() => {
                                    const ivaRows = [...new Set([...config.electricityTaxConfig.peninsula.ivaOptions, ...config.electricityTaxConfig.baleares.ivaOptions])].sort((a, b) => a - b);
                                    const igicRows = [...config.electricityTaxConfig.canarias.igicOptions].sort((a, b) => a - b);
                                    const elecTaxRows = [...new Set([...config.electricityTaxConfig.peninsula.elecTaxOptions, ...config.electricityTaxConfig.baleares.elecTaxOptions, ...config.electricityTaxConfig.canarias.elecTaxOptions])].sort((a, b) => a - b);
                                    return (
                                        <Stack spacing={4}>
                                            <TaxRateTable
                                                title={t("systemSettings", "fieldIvaRate")}
                                                rows={ivaRows}
                                                columns={[
                                                    { key: "peninsula", label: t("systemSettings", "calcPeninsula"), activeValues: config.electricityTaxConfig.peninsula.ivaRates, onToggle: (val) => { const cur = config.electricityTaxConfig.peninsula.ivaRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("peninsula", "ivaRates", next); if (!config.electricityTaxConfig.peninsula.ivaOptions.includes(val)) handleElecZoneChange("peninsula", "ivaOptions", [...config.electricityTaxConfig.peninsula.ivaOptions, val].sort((a, b) => a - b)); } },
                                                    { key: "baleares", label: t("systemSettings", "calcBaleares"), activeValues: config.electricityTaxConfig.baleares.ivaRates, onToggle: (val) => { const cur = config.electricityTaxConfig.baleares.ivaRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("baleares", "ivaRates", next); if (!config.electricityTaxConfig.baleares.ivaOptions.includes(val)) handleElecZoneChange("baleares", "ivaOptions", [...config.electricityTaxConfig.baleares.ivaOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.01}
                                                onAddRow={(val) => { handleElecZoneChange("peninsula", "ivaOptions", [...new Set([...config.electricityTaxConfig.peninsula.ivaOptions, val])].sort((a, b) => a - b)); handleElecZoneChange("baleares", "ivaOptions", [...new Set([...config.electricityTaxConfig.baleares.ivaOptions, val])].sort((a, b) => a - b)); }}
                                                onRemoveRow={(val) => { handleElecZoneChange("peninsula", "ivaOptions", config.electricityTaxConfig.peninsula.ivaOptions.filter(v => v !== val)); handleElecZoneChange("baleares", "ivaOptions", config.electricityTaxConfig.baleares.ivaOptions.filter(v => v !== val)); }}
                                            />
                                            <TaxRateTable
                                                title={`${t("systemSettings", "fieldIgicRate")} — ${t("systemSettings", "calcCanarias")}`}
                                                rows={igicRows}
                                                columns={[
                                                    { key: "canarias", label: t("systemSettings", "calcCanarias"), activeValues: config.electricityTaxConfig.canarias.igicRates, onToggle: (val) => { const cur = config.electricityTaxConfig.canarias.igicRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("canarias", "igicRates", next); if (!config.electricityTaxConfig.canarias.igicOptions.includes(val)) handleElecZoneChange("canarias", "igicOptions", [...config.electricityTaxConfig.canarias.igicOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.01}
                                                onAddRow={(val) => handleElecZoneChange("canarias", "igicOptions", [...new Set([...config.electricityTaxConfig.canarias.igicOptions, val])].sort((a, b) => a - b))}
                                                onRemoveRow={(val) => handleElecZoneChange("canarias", "igicOptions", config.electricityTaxConfig.canarias.igicOptions.filter(v => v !== val))}
                                            />
                                            <TaxRateTable
                                                title={t("systemSettings", "fieldElectricityTaxRate")}
                                                rows={elecTaxRows}
                                                columns={[
                                                    { key: "peninsula", label: t("systemSettings", "calcPeninsula"), activeValues: config.electricityTaxConfig.peninsula.elecTaxRates, onToggle: (val) => { const cur = config.electricityTaxConfig.peninsula.elecTaxRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("peninsula", "elecTaxRates", next); if (!config.electricityTaxConfig.peninsula.elecTaxOptions.includes(val)) handleElecZoneChange("peninsula", "elecTaxOptions", [...config.electricityTaxConfig.peninsula.elecTaxOptions, val].sort((a, b) => a - b)); } },
                                                    { key: "baleares", label: t("systemSettings", "calcBaleares"), activeValues: config.electricityTaxConfig.baleares.elecTaxRates, onToggle: (val) => { const cur = config.electricityTaxConfig.baleares.elecTaxRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("baleares", "elecTaxRates", next); if (!config.electricityTaxConfig.baleares.elecTaxOptions.includes(val)) handleElecZoneChange("baleares", "elecTaxOptions", [...config.electricityTaxConfig.baleares.elecTaxOptions, val].sort((a, b) => a - b)); } },
                                                    { key: "canarias", label: t("systemSettings", "calcCanarias"), activeValues: config.electricityTaxConfig.canarias.elecTaxRates, onToggle: (val) => { const cur = config.electricityTaxConfig.canarias.elecTaxRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("canarias", "elecTaxRates", next); if (!config.electricityTaxConfig.canarias.elecTaxOptions.includes(val)) handleElecZoneChange("canarias", "elecTaxOptions", [...config.electricityTaxConfig.canarias.elecTaxOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.000001}
                                                onAddRow={(val) => { handleElecZoneChange("peninsula", "elecTaxOptions", [...new Set([...config.electricityTaxConfig.peninsula.elecTaxOptions, val])].sort((a, b) => a - b)); handleElecZoneChange("baleares", "elecTaxOptions", [...new Set([...config.electricityTaxConfig.baleares.elecTaxOptions, val])].sort((a, b) => a - b)); handleElecZoneChange("canarias", "elecTaxOptions", [...new Set([...config.electricityTaxConfig.canarias.elecTaxOptions, val])].sort((a, b) => a - b)); }}
                                                onRemoveRow={(val) => { handleElecZoneChange("peninsula", "elecTaxOptions", config.electricityTaxConfig.peninsula.elecTaxOptions.filter(v => v !== val)); handleElecZoneChange("baleares", "elecTaxOptions", config.electricityTaxConfig.baleares.elecTaxOptions.filter(v => v !== val)); handleElecZoneChange("canarias", "elecTaxOptions", config.electricityTaxConfig.canarias.elecTaxOptions.filter(v => v !== val)); }}
                                            />
                                        </Stack>
                                    );
                                })()}

                                {/* ─── Gas tab content ─── */}
                                {calcEnergyTab === "gas" && (() => {
                                    const ivaRows = [...new Set([...config.gasTaxConfig.peninsula.ivaOptions, ...config.gasTaxConfig.baleares.ivaOptions])].sort((a, b) => a - b);
                                    const hydroRows = [...config.gasTaxConfig.hydrocarbonTaxOptions].sort((a, b) => a - b);
                                    return (
                                        <Stack spacing={4}>
                                            <TaxRateTable
                                                title={t("systemSettings", "fieldIvaRate")}
                                                rows={ivaRows}
                                                columns={[
                                                    { key: "peninsula", label: t("systemSettings", "calcPeninsula"), activeValues: config.gasTaxConfig.peninsula.ivaRates, onToggle: (val) => { const cur = config.gasTaxConfig.peninsula.ivaRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleGasZoneChange("peninsula", "ivaRates", next); if (!config.gasTaxConfig.peninsula.ivaOptions.includes(val)) handleGasZoneChange("peninsula", "ivaOptions", [...config.gasTaxConfig.peninsula.ivaOptions, val].sort((a, b) => a - b)); } },
                                                    { key: "baleares", label: t("systemSettings", "calcBaleares"), activeValues: config.gasTaxConfig.baleares.ivaRates, onToggle: (val) => { const cur = config.gasTaxConfig.baleares.ivaRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleGasZoneChange("baleares", "ivaRates", next); if (!config.gasTaxConfig.baleares.ivaOptions.includes(val)) handleGasZoneChange("baleares", "ivaOptions", [...config.gasTaxConfig.baleares.ivaOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.01}
                                                onAddRow={(val) => { handleGasZoneChange("peninsula", "ivaOptions", [...new Set([...config.gasTaxConfig.peninsula.ivaOptions, val])].sort((a, b) => a - b)); handleGasZoneChange("baleares", "ivaOptions", [...new Set([...config.gasTaxConfig.baleares.ivaOptions, val])].sort((a, b) => a - b)); }}
                                                onRemoveRow={(val) => { handleGasZoneChange("peninsula", "ivaOptions", config.gasTaxConfig.peninsula.ivaOptions.filter(v => v !== val)); handleGasZoneChange("baleares", "ivaOptions", config.gasTaxConfig.baleares.ivaOptions.filter(v => v !== val)); }}
                                            />
                                            <TaxRateTable
                                                title={t("systemSettings", "fieldHydrocarbonTaxRate")}
                                                rows={hydroRows}
                                                columns={[
                                                    { key: "global", label: "Global", activeValues: config.gasTaxConfig.hydrocarbonTaxRates, onToggle: (val) => { const cur = config.gasTaxConfig.hydrocarbonTaxRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleGasHydroChange("hydrocarbonTaxRates", next); if (!config.gasTaxConfig.hydrocarbonTaxOptions.includes(val)) handleGasHydroChange("hydrocarbonTaxOptions", [...config.gasTaxConfig.hydrocarbonTaxOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.000001}
                                                onAddRow={(val) => handleGasHydroChange("hydrocarbonTaxOptions", [...new Set([...config.gasTaxConfig.hydrocarbonTaxOptions, val])].sort((a, b) => a - b))}
                                                onRemoveRow={(val) => handleGasHydroChange("hydrocarbonTaxOptions", config.gasTaxConfig.hydrocarbonTaxOptions.filter(v => v !== val))}
                                            />
                                        </Stack>
                                    );
                                })()}
                            </div>
                        )}

                        {resolvedBusinessTab === "pdf-defaults" && (
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

                        {resolvedBusinessTab === "cron" && (
                            <CronSettings onNotify={onNotify} />
                        )}

                        {resolvedBusinessTab !== "cron" && (
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
