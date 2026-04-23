"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { TemplatesCommunications } from "./TemplatesCommunications";
import { SystemBusinessSettings } from "./SystemBusinessSettings";
import { UserExperienceSettings } from "./UserExperienceSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";
import "./configurations.css";

export interface ConfigurationsModuleProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type ConfigTab = "templates-communications" | "system-business" | "user-experience" | "integrations";

export function ConfigurationsModule({ session, onNotify }: ConfigurationsModuleProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<ConfigTab>("templates-communications");

    const TAB_LABELS: Record<ConfigTab, string> = {
        "templates-communications": t("configurationsModule", "tabTemplatesCommunications"),
        "system-business": t("configurationsModule", "tabSystemBusiness"),
        "user-experience": t("configurationsModule", "tabUserExperience"),
        "integrations": t("configurationsModule", "tabIntegrations"),
    };

    return (
        <div className="configurations-container">

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
                {activeTab === "templates-communications" && (
                    <TemplatesCommunications session={session} onNotify={onNotify} />
                )}
                {activeTab === "system-business" && (
                    <SystemBusinessSettings session={session} onNotify={onNotify} />
                )}
                {activeTab === "user-experience" && (
                    <UserExperienceSettings session={session} onNotify={onNotify} />
                )}
                {activeTab === "integrations" && (
                    <IntegrationsSettings session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
