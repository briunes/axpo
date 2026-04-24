"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { CronSettings } from "./CronSettings";

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
    defaultPdfTemplateGasId: string | null;
    defaultPdfTemplateElectricityId: string | null;
}

const DEFAULT_CONFIG: BusinessConfig = {
    simulationExpirationDays: 30,
    autoCreateClientOnSimulation: true,
    ivaRate: 0.21,
    electricityTaxRate: 0.051127,
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

    return (
        <div className="system-settings-container">
            {isLoading ? (
                <LoadingState message={t("systemSettings", "loading")} />
            ) : (
                <>
                    <div className="system-settings-tabs">
                        {(Object.keys(BUSINESS_TABS) as BusinessTab[]).map((tab) => (
                            <button
                                key={tab}
                                className={`settings-subtab${activeTab === tab ? " active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {BUSINESS_TABS[tab]}
                            </button>
                        ))}
                    </div>

                    <div className="system-settings-content">
                        {activeTab === "simulation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleSimulation")}</h3>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldExpirationDays")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldExpirationDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={config.simulationExpirationDays}
                                        onChange={(e) => handleChange("simulationExpirationDays", parseInt(e.target.value, 10))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "clients" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleClients")}</h3>

                                <div className="config-field">
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
                                </div>
                            </div>
                        )}

                        {activeTab === "calculation" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titleCalculation")}</h3>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldIvaRate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldIvaRateDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={config.ivaRate}
                                        onChange={(e) => handleChange("ivaRate", parseFloat(e.target.value))}
                                    />
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldElectricityTaxRate")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldElectricityTaxRateDesc")}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.000001"
                                        value={config.electricityTaxRate}
                                        onChange={(e) => handleChange("electricityTaxRate", parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "pdf-defaults" && (
                            <div className="settings-panel">
                                <h3 className="settings-panel-title">{t("systemSettings", "titlePdfDefaults")}</h3>
                                <p className="settings-panel-description">{t("systemSettings", "titlePdfDefaultsDesc")}</p>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldDefaultPdfGas")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldDefaultPdfGasDesc")}
                                    </span>
                                    <select
                                        value={config.defaultPdfTemplateGasId || ""}
                                        onChange={(e) => handleChange("defaultPdfTemplateGasId", e.target.value || null)}
                                    >
                                        <option value="">{t("systemSettings", "noTemplateSelected")}</option>
                                        {pdfTemplates
                                            .filter((t) => !t.commodity || t.commodity === "GAS")
                                            .map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="config-field">
                                    <label className="config-field-label">{t("systemSettings", "fieldDefaultPdfElectricity")}</label>
                                    <span className="config-field-description">
                                        {t("systemSettings", "fieldDefaultPdfElectricityDesc")}
                                    </span>
                                    <select
                                        value={config.defaultPdfTemplateElectricityId || ""}
                                        onChange={(e) => handleChange("defaultPdfTemplateElectricityId", e.target.value || null)}
                                    >
                                        <option value="">{t("systemSettings", "noTemplateSelected")}</option>
                                        {pdfTemplates
                                            .filter((t) => !t.commodity || t.commodity === "ELECTRICITY")
                                            .map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === "cron" && (
                            <CronSettings onNotify={onNotify} />
                        )}

                        {activeTab !== "cron" && (
                            <div className="config-actions">
                                <button
                                    className="config-btn config-btn-primary"
                                    onClick={handleSave}
                                    disabled={!isDirty}
                                >
                                    {t("systemSettings", "btnSave")}
                                </button>
                                <button
                                    className="config-btn config-btn-secondary"
                                    onClick={handleReset}
                                    disabled={!isDirty}
                                >
                                    {t("systemSettings", "btnReset")}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
