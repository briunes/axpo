"use client";

import { useState, useEffect } from "react";
import { Box, Tabs, Tab, Button, Stack } from "@mui/material";
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
    defaultPdfTemplateGasId: string | null;
    defaultPdfTemplateElectricityId: string | null;
}

const DEFAULT_CONFIG: BusinessConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    ivaRate: 0.21,
    electricityTaxRate: 0.051127,
    hydrocarbonTaxRate: 0.00234,
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
            setConfig({
                simulationExpirationDays: data.simulationExpirationDays,
                autoCreateClientOnSimulation: data.autoCreateClientOnSim,
                ivaRate: (data as any).ivaRate || 0.21,
                electricityTaxRate: (data as any).electricityTaxRate || 0.051127,
                hydrocarbonTaxRate: (data as any).hydrocarbonTaxRate || 0.00234,
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

    return (
        <div className="system-settings-container">
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                        <Tabs
                            value={tabIndex}
                            onChange={(_, newValue) => {
                                const tabs = Object.keys(BUSINESS_TABS) as BusinessTab[];
                                setActiveTab(tabs[newValue]);
                            }}
                        >
                            {(Object.keys(BUSINESS_TABS) as BusinessTab[]).map((tab) => (
                                <Tab key={tab} label={BUSINESS_TABS[tab]} sx={{textTransform: 'none'}}/>
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

                                <Stack spacing={3}>
                                    <FormInput
                                        label={t("systemSettings", "fieldIvaRate")}
                                        helperText={t("systemSettings", "fieldIvaRateDesc")}
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 0, max: 1, step: 0.01 }
                                        }}
                                        value={config.ivaRate}
                                        onChange={(e) => handleChange("ivaRate", parseFloat(e.target.value))}
                                    />

                                    <FormInput
                                        label={t("systemSettings", "fieldElectricityTaxRate")}
                                        helperText={t("systemSettings", "fieldElectricityTaxRateDesc")}
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 0, max: 1, step: 0.000001 }
                                        }}
                                        value={config.electricityTaxRate}
                                        onChange={(e) => handleChange("electricityTaxRate", parseFloat(e.target.value))}
                                    />

                                    <FormInput
                                        label={t("systemSettings", "fieldHydrocarbonTaxRate")}
                                        helperText={t("systemSettings", "fieldHydrocarbonTaxRateDesc")}
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 0, step: 0.000001 }
                                        }}
                                        value={config.hydrocarbonTaxRate}
                                        onChange={(e) => handleChange("hydrocarbonTaxRate", parseFloat(e.target.value))}
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
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
