"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { SmtpSettings } from "./SmtpSettings";
import { AutomatedEmailsSettings } from "./AutomatedEmailsSettings";
import { LLMSettings } from "./LLMSettings";

export interface IntegrationsSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type IntegrationTab = "smtp" | "emails" | "llm";

export function IntegrationsSettings({ session, onNotify }: IntegrationsSettingsProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<IntegrationTab>("smtp");

    const INTEGRATION_TABS: Record<IntegrationTab, string> = {
        smtp: t("systemSettings", "tabSmtp"),
        emails: t("systemSettings", "tabAutomatedEmails"),
        llm: t("configurationsModule", "tabLlmSettings"),
    };

    return (
        <div className="system-settings-container">
            <div className="system-settings-tabs">
                {(Object.keys(INTEGRATION_TABS) as IntegrationTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`settings-subtab${activeTab === tab ? " active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {INTEGRATION_TABS[tab]}
                    </button>
                ))}
            </div>

            <div className="system-settings-content">
                {activeTab === "smtp" && (
                    <SmtpSettings session={session} onNotify={onNotify} />
                )}
                {activeTab === "emails" && (
                    <AutomatedEmailsSettings session={session} onNotify={onNotify} />
                )}
                {activeTab === "llm" && (
                    <LLMSettings session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
