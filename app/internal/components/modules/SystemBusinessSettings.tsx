"use client";

import { useState, useEffect } from "react";
import { Box, Tabs, Tab, Button, Stack, IconButton, Tooltip, TextField, Typography, Checkbox, Switch, Accordion, AccordionSummary, AccordionDetails, Chip, Divider } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { SUPPORTED_LANGUAGES } from "../../../../src/lib/supportedLanguages";
import { getPdfTemplates, getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { CronSettings } from "./CronSettings";
import { FormInput, FormSelect } from "../ui";
import { RequestCacheSettings } from "./RequestCacheSettings";

export interface SystemBusinessSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
    role?: string;
    activeSection?: BusinessTab;
    hideNavigation?: boolean;
}

type BusinessTab = "general" | "simulation" | "clients" | "sessions" | "calculation" | "pdf-defaults" | "cache" | "cron";

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
    maxUploadFileSizeMb: number;
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
    appChangelog: AppChangelogEntry[];
    appChangelogNotes: Record<string, string>;
    maintenanceMode: boolean;
    maintenanceUntil: string;
    maintenanceMessage: string;
}

interface AppChangelogEntry {
    version: string;
    title: string;
    notes: string[];
    notesByLanguage?: Record<string, string[]>;
    publishedAt: string;
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
    maxUploadFileSizeMb: 15,
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
    appVersion: "0.2.1",
    appChangelog: [],
    appChangelogNotes: {},
    maintenanceMode: false,
    maintenanceUntil: "",
    maintenanceMessage: "",
};

function formatChangelogDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

function hasReleaseNotes(notesByLanguage: Record<string, string>): boolean {
    return Object.values(notesByLanguage).some((value) => value.trim().length > 0);
}

function releaseNotesPayload(notesByLanguage: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(notesByLanguage)
            .map(([languageCode, notes]) => [languageCode, notes.trim()])
            .filter(([, notes]) => notes.length > 0),
    );
}

function notesForLanguage(entry: AppChangelogEntry, languageCode: string): string[] {
    return entry.notesByLanguage?.[languageCode] ?? [];
}

function notesTextForLanguage(entry: AppChangelogEntry, languageCode: string): string {
    const translatedNotes = notesForLanguage(entry, languageCode);
    if (translatedNotes.length > 0) return translatedNotes.join("\n");

    if (!entry.notesByLanguage || Object.keys(entry.notesByLanguage).length === 0) {
        return entry.notes.join("\n");
    }

    return "";
}

function editableNotesFromEntry(entry: AppChangelogEntry | undefined): Record<string, string> {
    if (!entry) return {};

    const notesByLanguage = Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => [language.code, notesTextForLanguage(entry, language.code)]),
    );

    if (Object.values(notesByLanguage).some((notes) => notes.trim().length > 0)) {
        return notesByLanguage;
    }

    return {};
}

export function SystemBusinessSettings({ session, onNotify, role, activeSection, hideNavigation = false }: SystemBusinessSettingsProps) {
    const { t } = useI18n();
    const isSysAdmin = role === "SYS_ADMIN";
    const [activeTab, setActiveTab] = useState<BusinessTab>(activeSection ?? (isSysAdmin ? "general" : "simulation"));
    const [calcEnergyTab, setCalcEnergyTab] = useState<"electricity" | "gas">("electricity");
    const [config, setConfig] = useState<BusinessConfig>(DEFAULT_CONFIG);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfTemplates, setPdfTemplates] = useState<any[]>([]);
    const [activeReleaseNotesLanguage, setActiveReleaseNotesLanguage] = useState(
        SUPPORTED_LANGUAGES[0]?.code ?? "en",
    );

    const ALL_BUSINESS_TABS: Record<BusinessTab, string> = {
        general: t("systemSettings", "tabGeneral"),
        simulation: t("systemSettings", "tabSimulation"),
        clients: t("systemSettings", "tabClients"),
        sessions: t("systemSettings", "tabSessions"),
        calculation: t("systemSettings", "tabCalculation"),
        "pdf-defaults": t("systemSettings", "tabPdfDefaults"),
        cache: t("systemSettings", "tabCache"),
        cron: t("systemSettings", "tabCronJobs"),
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

    useEffect(() => {
        if (activeSection && visibleBusinessTabs.includes(activeSection)) {
            setActiveTab(activeSection);
        }
    }, [activeSection, visibleBusinessTabs]);

    const loadPdfTemplates = async () => {
        try {
            setPdfTemplates(await getPdfTemplates());
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
            const appVersion = (data as any).appVersion ?? "0.2.1";
            const appChangelog = Array.isArray((data as any).appChangelog) ? (data as any).appChangelog : [];
            const currentVersionEntry = appChangelog.find(
                (entry: AppChangelogEntry) => entry.version.trim() === appVersion.trim(),
            );

            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                maxUploadFileSizeMb: (data as any).maxUploadFileSizeMb ?? 15,
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
                appVersion,
                appChangelog,
                appChangelogNotes: editableNotesFromEntry(currentVersionEntry),
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

    const handleReleaseNotesChange = (languageCode: string, value: string) => {
        setConfig((prev) => ({
            ...prev,
            appChangelogNotes: {
                ...prev.appChangelogNotes,
                [languageCode]: value,
            },
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            await updateSystemConfig({
                simulationExpirationDays: config.simulationExpirationDays,
                maxUploadFileSizeMb: config.maxUploadFileSizeMb,
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
                ...(hasReleaseNotes(config.appChangelogNotes)
                    ? { appChangelogNotes: releaseNotesPayload(config.appChangelogNotes) }
                    : {}),
                maintenanceMode: config.maintenanceMode,
                maintenanceUntil: config.maintenanceUntil ? new Date(config.maintenanceUntil).toISOString() : null,
                maintenanceMessage: config.maintenanceMessage || null,
            });
            onNotify(t("systemSettings", "savedSuccess"), "success");
            await loadConfig();
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

    const sortUniqueNumbers = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
    const replaceNumberValue = (values: number[], previousValue: number, nextValue: number) =>
        sortUniqueNumbers(values.map((value) => (value === previousValue ? nextValue : value)));
    const removeNumberValue = (values: number[], valueToRemove: number) =>
        values.filter((value) => value !== valueToRemove);

    // ── Tax Rate Table ──────────────────────────────────────────────────────────
    function TaxRateTable({
        title,
        rows,
        columns,
        step,
        onAddRow,
        onUpdateRow,
        onRemoveRow,
    }: {
        title: string;
        rows: number[];
        columns: Array<{ key: string; label: string; activeValues: number[]; onToggle: (val: number) => void }>;
        step?: number;
        onAddRow: (val: number) => void;
        onUpdateRow: (previousValue: number, nextValue: number) => void;
        onRemoveRow: (val: number) => void;
    }) {
        const [newValue, setNewValue] = useState("");
        const [editingValues, setEditingValues] = useState<Record<string, string>>({});

        const addRow = () => {
            const v = parseFloat(newValue);
            if (isNaN(v) || rows.includes(v)) return;
            onAddRow(v);
            setNewValue("");
        };

        const setEditingValue = (value: number, nextText: string) => {
            setEditingValues((prev) => ({ ...prev, [String(value)]: nextText }));
        };

        const resetEditingValue = (value: number) => {
            setEditingValues((prev) => {
                const next = { ...prev };
                delete next[String(value)];
                return next;
            });
        };

        const commitEditingValue = (previousValue: number) => {
            const rawValue = editingValues[String(previousValue)];
            if (rawValue === undefined) return;
            const nextValue = parseFloat(rawValue);
            if (!Number.isFinite(nextValue) || (nextValue !== previousValue && rows.includes(nextValue))) {
                resetEditingValue(previousValue);
                return;
            }
            if (nextValue !== previousValue) {
                onUpdateRow(previousValue, nextValue);
            }
            resetEditingValue(previousValue);
        };

        return (
            <Box className="calculation-rate-table">
                <Typography variant="caption" sx={{ fontWeight: 700, mb: 1.25, display: "block", textTransform: "uppercase", letterSpacing: "0.04em", color: "text.secondary", fontSize: 11 }}>
                    {title}
                </Typography>
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
                    {/* Header */}
                    <Box sx={{ display: "grid", gridTemplateColumns: `minmax(150px, 190px) ${columns.map(() => "1fr").join(" ")} 44px`, bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em" }}>{t("systemSettings", "taxRateValue")}</Typography>
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
                                gridTemplateColumns: `minmax(150px, 190px) ${columns.map(() => "1fr").join(" ")} 44px`,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                                "&:last-child": { borderBottom: "none" },
                                alignItems: "center",
                            }}
                        >
                            <Box sx={{ px: 1.5, py: 0.5 }}>
                                <TextField
                                    variant="standard"
                                    type="number"
                                    size="small"
                                    value={editingValues[String(val)] ?? String(val)}
                                    onChange={(event) => setEditingValue(val, event.target.value)}
                                    onBlur={() => commitEditingValue(val)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitEditingValue(val);
                                        }
                                        if (event.key === "Escape") {
                                            resetEditingValue(val);
                                        }
                                    }}
                                    inputProps={{ step: step ?? 0.000001 }}
                                    sx={{
                                        width: "100%",
                                        "& input": {
                                            fontFamily: "monospace",
                                            fontSize: 13,
                                            py: 0.5,
                                        },
                                    }}
                                />
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
                                            disabled={rows.length <= 1}
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
                    {!hideNavigation && (
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
                    )}

                    <div className="system-settings-content">
                        {resolvedBusinessTab === "general" && (
                            <div className="settings-panel">
                                {/* ── Maintenance Mode ─────────────────────────────────── */}
                                <Box sx={{
                                    mb: 3,
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
                                                {t("systemSettings", "fieldMaintenanceMode")}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                {config.maintenanceMode
                                                    ? t("systemSettings", "fieldMaintenanceModeActiveDesc")
                                                    : t("systemSettings", "fieldMaintenanceModeDesc")}
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
                                                    {t("systemSettings", "fieldMaintenanceUntil")}
                                                </Typography>
                                                <TextField
                                                    type="datetime-local"
                                                    size="small"
                                                    fullWidth
                                                    value={config.maintenanceUntil}
                                                    onChange={(e) => handleChange("maintenanceUntil", e.target.value)}
                                                    helperText={t("systemSettings", "fieldMaintenanceUntilDesc")}
                                                    slotProps={{ htmlInput: { min: new Date().toISOString().slice(0, 16) } }}
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.75 }}>
                                                    {t("systemSettings", "fieldMaintenanceMessage")}
                                                </Typography>
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    multiline
                                                    rows={2}
                                                    placeholder={t("systemSettings", "fieldMaintenanceMessagePlaceholder")}
                                                    value={config.maintenanceMessage}
                                                    onChange={(e) => handleChange("maintenanceMessage", e.target.value)}
                                                    helperText={t("systemSettings", "fieldMaintenanceMessageDesc")}
                                                />
                                            </Box>
                                        </Stack>
                                    )}
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label={t("systemSettings", "fieldAppVersion")}
                                        helperText={t("systemSettings", "fieldAppVersionDesc")}
                                        value={config.appVersion}
                                        onChange={(e) => handleChange("appVersion", e.target.value)}
                                    />
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        {t("systemSettings", "appChangelogHistory")}
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        {config.appChangelog.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                {t("systemSettings", "appChangelogEmpty")}
                                            </Typography>
                                        ) : (
                                            config.appChangelog.map((entry) => {
                                                const isCurrentVersion = entry.version.trim() === config.appVersion.trim();
                                                const hasTranslatedNotes = SUPPORTED_LANGUAGES.some(
                                                    (language) => notesForLanguage(entry, language.code).length > 0,
                                                );

                                                if (isCurrentVersion) {
                                                    return (
                                                        <Box
                                                            key={`${entry.version}-${entry.publishedAt}`}
                                                            sx={{
                                                                border: "1px solid var(--scheme-neutral-800)",
                                                                borderRadius: 1,
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
                                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                        v{entry.version} · {entry.title}
                                                                    </Typography>
                                                                    <Chip size="small" color="primary" variant="outlined" label="Current" />
                                                                </Stack>
                                                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                                                    {formatChangelogDate(entry.publishedAt)}
                                                                </Typography>
                                                            </Stack>

                                                            <Divider />

                                                            <Box sx={{ p: 1.5 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                                    {t("systemSettings", "fieldAppChangelogNotes")}
                                                                </Typography>
                                                                <Tabs
                                                                    value={activeReleaseNotesLanguage}
                                                                    onChange={(_, value) => setActiveReleaseNotesLanguage(value)}
                                                                    variant="scrollable"
                                                                    scrollButtons="auto"
                                                                    sx={{ minHeight: 40, mb: 1.5 }}
                                                                >
                                                                    {SUPPORTED_LANGUAGES.map((language) => (
                                                                        <Tab
                                                                            key={language.code}
                                                                            value={language.code}
                                                                            label={language.label}
                                                                            sx={{ minHeight: 40, textTransform: "none" }}
                                                                        />
                                                                    ))}
                                                                </Tabs>
                                                                <TextField
                                                                    label={SUPPORTED_LANGUAGES.find((language) => language.code === activeReleaseNotesLanguage)?.label}
                                                                    helperText={t("systemSettings", "fieldAppChangelogNotesDesc")}
                                                                    placeholder={t("systemSettings", "fieldAppChangelogNotesPlaceholder")}
                                                                    value={config.appChangelogNotes[activeReleaseNotesLanguage] ?? ""}
                                                                    onChange={(e) => handleReleaseNotesChange(activeReleaseNotesLanguage, e.target.value)}
                                                                    fullWidth
                                                                    multiline
                                                                    minRows={5}
                                                                />
                                                            </Box>
                                                        </Box>
                                                    );
                                                }

                                                return (
                                                    <Accordion
                                                        key={`${entry.version}-${entry.publishedAt}`}
                                                        disableGutters
                                                        variant="outlined"
                                                        sx={{
                                                            borderRadius: "8px !important",
                                                            borderColor: "var(--scheme-neutral-800)",
                                                            boxShadow: "none",
                                                            overflow: "hidden",
                                                            "&:before": { display: "none" },
                                                        }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={<ExpandMoreIcon fontSize="small" />}
                                                            sx={{
                                                                minHeight: 52,
                                                                px: 1.5,
                                                                "& .MuiAccordionSummary-content": {
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    gap: 2,
                                                                    m: 0,
                                                                },
                                                                "&.Mui-expanded": {
                                                                    minHeight: 52,
                                                                },
                                                                "& .MuiAccordionSummary-content.Mui-expanded": {
                                                                    m: 0,
                                                                },
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                v{entry.version} · {entry.title}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
                                                                {formatChangelogDate(entry.publishedAt)}
                                                            </Typography>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                                                            <Divider sx={{ mb: 1.5 }} />
                                                            <Stack spacing={1}>
                                                                {hasTranslatedNotes ? (
                                                                    SUPPORTED_LANGUAGES.map((language) => {
                                                                        const notes = notesForLanguage(entry, language.code);
                                                                        if (notes.length === 0) return null;
                                                                        return (
                                                                            <Box key={language.code}>
                                                                                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                                                                    {language.label}
                                                                                </Typography>
                                                                                <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
                                                                                    {notes.map((note, index) => (
                                                                                        <Typography key={index} component="li" variant="body2">
                                                                                            {note}
                                                                                        </Typography>
                                                                                    ))}
                                                                                </Box>
                                                                            </Box>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    entry.notes.length > 0 && (
                                                                        <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
                                                                            {entry.notes.map((note, index) => (
                                                                                <Typography key={index} component="li" variant="body2">
                                                                                    {note}
                                                                                </Typography>
                                                                            ))}
                                                                        </Box>
                                                                    )
                                                                )}
                                                            </Stack>
                                                        </AccordionDetails>
                                                    </Accordion>
                                                );
                                            })
                                        )}
                                    </Stack>
                                </Box>
                            </div>
                        )}

                        {resolvedBusinessTab === "simulation" && (
                            <div className="settings-panel">
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
                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label={t("systemSettings", "fieldMaxUploadFileSize")}
                                        helperText={t("systemSettings", "fieldMaxUploadFileSizeDesc")}
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 1, step: 1 }
                                        }}
                                        value={config.maxUploadFileSizeMb}
                                        onChange={(e) => {
                                            const parsed = Number.parseInt(e.target.value, 10);
                                            handleChange("maxUploadFileSizeMb", Number.isNaN(parsed) ? 1 : parsed);
                                        }}
                                    />
                                </Box>
                            </div>
                        )}

                        {resolvedBusinessTab === "clients" && (
                            <div className="settings-panel">
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

                        {resolvedBusinessTab === "cache" && (
                            <RequestCacheSettings session={session} onNotify={onNotify} />
                        )}

                        {resolvedBusinessTab === "sessions" && (
                            <div className="settings-panel">
                                <Box sx={{ mb: 3 }}>
                                    <FormInput
                                        label={t("systemSettings", "fieldDefaultMaxActiveDevices")}
                                        helperText={t("systemSettings", "fieldDefaultMaxActiveDevicesDesc")}
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
                            <div className="settings-panel calculation-settings-panel">
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
                                                onAddRow={(val) => { handleElecZoneChange("peninsula", "ivaOptions", sortUniqueNumbers([...config.electricityTaxConfig.peninsula.ivaOptions, val])); handleElecZoneChange("baleares", "ivaOptions", sortUniqueNumbers([...config.electricityTaxConfig.baleares.ivaOptions, val])); }}
                                                onUpdateRow={(oldVal, newVal) => { handleElecZoneChange("peninsula", "ivaOptions", replaceNumberValue(config.electricityTaxConfig.peninsula.ivaOptions, oldVal, newVal)); handleElecZoneChange("peninsula", "ivaRates", replaceNumberValue(config.electricityTaxConfig.peninsula.ivaRates, oldVal, newVal)); handleElecZoneChange("baleares", "ivaOptions", replaceNumberValue(config.electricityTaxConfig.baleares.ivaOptions, oldVal, newVal)); handleElecZoneChange("baleares", "ivaRates", replaceNumberValue(config.electricityTaxConfig.baleares.ivaRates, oldVal, newVal)); }}
                                                onRemoveRow={(val) => { handleElecZoneChange("peninsula", "ivaOptions", removeNumberValue(config.electricityTaxConfig.peninsula.ivaOptions, val)); handleElecZoneChange("peninsula", "ivaRates", removeNumberValue(config.electricityTaxConfig.peninsula.ivaRates, val)); handleElecZoneChange("baleares", "ivaOptions", removeNumberValue(config.electricityTaxConfig.baleares.ivaOptions, val)); handleElecZoneChange("baleares", "ivaRates", removeNumberValue(config.electricityTaxConfig.baleares.ivaRates, val)); }}
                                            />
                                            <TaxRateTable
                                                title={`${t("systemSettings", "fieldIgicRate")} — ${t("systemSettings", "calcCanarias")}`}
                                                rows={igicRows}
                                                columns={[
                                                    { key: "canarias", label: t("systemSettings", "calcCanarias"), activeValues: config.electricityTaxConfig.canarias.igicRates, onToggle: (val) => { const cur = config.electricityTaxConfig.canarias.igicRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleElecZoneChange("canarias", "igicRates", next); if (!config.electricityTaxConfig.canarias.igicOptions.includes(val)) handleElecZoneChange("canarias", "igicOptions", [...config.electricityTaxConfig.canarias.igicOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.01}
                                                onAddRow={(val) => handleElecZoneChange("canarias", "igicOptions", sortUniqueNumbers([...config.electricityTaxConfig.canarias.igicOptions, val]))}
                                                onUpdateRow={(oldVal, newVal) => { handleElecZoneChange("canarias", "igicOptions", replaceNumberValue(config.electricityTaxConfig.canarias.igicOptions, oldVal, newVal)); handleElecZoneChange("canarias", "igicRates", replaceNumberValue(config.electricityTaxConfig.canarias.igicRates, oldVal, newVal)); }}
                                                onRemoveRow={(val) => { handleElecZoneChange("canarias", "igicOptions", removeNumberValue(config.electricityTaxConfig.canarias.igicOptions, val)); handleElecZoneChange("canarias", "igicRates", removeNumberValue(config.electricityTaxConfig.canarias.igicRates, val)); }}
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
                                                onAddRow={(val) => { handleElecZoneChange("peninsula", "elecTaxOptions", sortUniqueNumbers([...config.electricityTaxConfig.peninsula.elecTaxOptions, val])); handleElecZoneChange("baleares", "elecTaxOptions", sortUniqueNumbers([...config.electricityTaxConfig.baleares.elecTaxOptions, val])); handleElecZoneChange("canarias", "elecTaxOptions", sortUniqueNumbers([...config.electricityTaxConfig.canarias.elecTaxOptions, val])); }}
                                                onUpdateRow={(oldVal, newVal) => { handleElecZoneChange("peninsula", "elecTaxOptions", replaceNumberValue(config.electricityTaxConfig.peninsula.elecTaxOptions, oldVal, newVal)); handleElecZoneChange("peninsula", "elecTaxRates", replaceNumberValue(config.electricityTaxConfig.peninsula.elecTaxRates, oldVal, newVal)); handleElecZoneChange("baleares", "elecTaxOptions", replaceNumberValue(config.electricityTaxConfig.baleares.elecTaxOptions, oldVal, newVal)); handleElecZoneChange("baleares", "elecTaxRates", replaceNumberValue(config.electricityTaxConfig.baleares.elecTaxRates, oldVal, newVal)); handleElecZoneChange("canarias", "elecTaxOptions", replaceNumberValue(config.electricityTaxConfig.canarias.elecTaxOptions, oldVal, newVal)); handleElecZoneChange("canarias", "elecTaxRates", replaceNumberValue(config.electricityTaxConfig.canarias.elecTaxRates, oldVal, newVal)); }}
                                                onRemoveRow={(val) => { handleElecZoneChange("peninsula", "elecTaxOptions", removeNumberValue(config.electricityTaxConfig.peninsula.elecTaxOptions, val)); handleElecZoneChange("peninsula", "elecTaxRates", removeNumberValue(config.electricityTaxConfig.peninsula.elecTaxRates, val)); handleElecZoneChange("baleares", "elecTaxOptions", removeNumberValue(config.electricityTaxConfig.baleares.elecTaxOptions, val)); handleElecZoneChange("baleares", "elecTaxRates", removeNumberValue(config.electricityTaxConfig.baleares.elecTaxRates, val)); handleElecZoneChange("canarias", "elecTaxOptions", removeNumberValue(config.electricityTaxConfig.canarias.elecTaxOptions, val)); handleElecZoneChange("canarias", "elecTaxRates", removeNumberValue(config.electricityTaxConfig.canarias.elecTaxRates, val)); }}
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
                                                onAddRow={(val) => { handleGasZoneChange("peninsula", "ivaOptions", sortUniqueNumbers([...config.gasTaxConfig.peninsula.ivaOptions, val])); handleGasZoneChange("baleares", "ivaOptions", sortUniqueNumbers([...config.gasTaxConfig.baleares.ivaOptions, val])); }}
                                                onUpdateRow={(oldVal, newVal) => { handleGasZoneChange("peninsula", "ivaOptions", replaceNumberValue(config.gasTaxConfig.peninsula.ivaOptions, oldVal, newVal)); handleGasZoneChange("peninsula", "ivaRates", replaceNumberValue(config.gasTaxConfig.peninsula.ivaRates, oldVal, newVal)); handleGasZoneChange("baleares", "ivaOptions", replaceNumberValue(config.gasTaxConfig.baleares.ivaOptions, oldVal, newVal)); handleGasZoneChange("baleares", "ivaRates", replaceNumberValue(config.gasTaxConfig.baleares.ivaRates, oldVal, newVal)); }}
                                                onRemoveRow={(val) => { handleGasZoneChange("peninsula", "ivaOptions", removeNumberValue(config.gasTaxConfig.peninsula.ivaOptions, val)); handleGasZoneChange("peninsula", "ivaRates", removeNumberValue(config.gasTaxConfig.peninsula.ivaRates, val)); handleGasZoneChange("baleares", "ivaOptions", removeNumberValue(config.gasTaxConfig.baleares.ivaOptions, val)); handleGasZoneChange("baleares", "ivaRates", removeNumberValue(config.gasTaxConfig.baleares.ivaRates, val)); }}
                                            />
                                            <TaxRateTable
                                                title={t("systemSettings", "fieldHydrocarbonTaxRate")}
                                                rows={hydroRows}
                                                columns={[
                                                    { key: "global", label: t("excelParserConfig", "scopeGlobal"), activeValues: config.gasTaxConfig.hydrocarbonTaxRates, onToggle: (val) => { const cur = config.gasTaxConfig.hydrocarbonTaxRates; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; handleGasHydroChange("hydrocarbonTaxRates", next); if (!config.gasTaxConfig.hydrocarbonTaxOptions.includes(val)) handleGasHydroChange("hydrocarbonTaxOptions", [...config.gasTaxConfig.hydrocarbonTaxOptions, val].sort((a, b) => a - b)); } },
                                                ]}
                                                step={0.000001}
                                                onAddRow={(val) => handleGasHydroChange("hydrocarbonTaxOptions", sortUniqueNumbers([...config.gasTaxConfig.hydrocarbonTaxOptions, val]))}
                                                onUpdateRow={(oldVal, newVal) => { handleGasHydroChange("hydrocarbonTaxOptions", replaceNumberValue(config.gasTaxConfig.hydrocarbonTaxOptions, oldVal, newVal)); handleGasHydroChange("hydrocarbonTaxRates", replaceNumberValue(config.gasTaxConfig.hydrocarbonTaxRates, oldVal, newVal)); }}
                                                onRemoveRow={(val) => { handleGasHydroChange("hydrocarbonTaxOptions", removeNumberValue(config.gasTaxConfig.hydrocarbonTaxOptions, val)); handleGasHydroChange("hydrocarbonTaxRates", removeNumberValue(config.gasTaxConfig.hydrocarbonTaxRates, val)); }}
                                            />
                                        </Stack>
                                    );
                                })()}
                            </div>
                        )}

                        {resolvedBusinessTab === "pdf-defaults" && (
                            <div className="settings-panel">
                                <Box className="pdf-defaults-grid">
                                    <FormSelect
                                        label={t("systemSettings", "fieldDefaultPdfGas")}
                                        helperText={t("systemSettings", "fieldDefaultPdfGasDesc")}
                                        value={config.defaultPdfTemplateGasId || ""}
                                        onChange={(value) => handleChange("defaultPdfTemplateGasId", value || null)}
                                        options={[
                                            { value: "", label: t("systemSettings", "noTemplateSelected") },
                                            ...pdfTemplates
                                                .filter((t) => t.commodity === "GAS")
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
                                                .filter((t) => t.commodity === "ELECTRICITY")
                                                .map((template) => ({
                                                    value: template.id,
                                                    label: template.name
                                                }))
                                        ]}
                                    />
                                </Box>
                            </div>
                        )}

                        {resolvedBusinessTab === "cron" && (
                            <CronSettings session={session} onNotify={onNotify} />
                        )}

                        {resolvedBusinessTab !== "cron" && (
                            <Box className="configuration-page-actions" sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
