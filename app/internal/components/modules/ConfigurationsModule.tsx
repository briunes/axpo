"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { SystemSettingsNew } from "./SystemSettingsNew";
import { PdfTemplatesNew } from "./PdfTemplatesNew";
import { EmailTemplatesNew } from "./EmailTemplatesNew";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import "./configurations.css";

export interface ConfigurationsModuleProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type ConfigTab = "system-settings" | "pdf-templates" | "email-templates" | "role-permissions";

export function ConfigurationsModule({ session, onNotify }: ConfigurationsModuleProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<ConfigTab>("system-settings");

    const TAB_LABELS: Record<ConfigTab, string> = {
        "system-settings": t("configurationsModule", "tabSystemSettings"),
        "pdf-templates": t("configurationsModule", "tabPdfTemplates"),
        "email-templates": t("configurationsModule", "tabEmailTemplates"),
        "role-permissions": t("configurationsModule", "tabRolePermissions"),
    };

    return (
        <div className="configurations-container">
            <div className="configurations-header">
                <h1 className="configurations-title">{t("configurationsModule", "title")}</h1>
                <p className="configurations-subtitle">
                    {t("configurationsModule", "subtitle")}
                </p>
            </div>

            <div className="configurations-tabs">
                {(Object.keys(TAB_LABELS) as ConfigTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`config-tab${activeTab === tab ? " active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                        data-testid={`config-tab-${tab}`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            <div className="configurations-content">
                {activeTab === "system-settings" && (
                    <SystemSettingsNew session={session} onNotify={onNotify} />
                )}
                {activeTab === "pdf-templates" && (
                    <PdfTemplatesNew session={session} onNotify={onNotify} />
                )}
                {activeTab === "email-templates" && (
                    <EmailTemplatesNew session={session} onNotify={onNotify} />
                )}
                {activeTab === "role-permissions" && (
                    <RolePermissionsEditor session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
