"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
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

    const tabIndex = (Object.keys(INTEGRATION_TABS) as IntegrationTab[]).indexOf(activeTab);

    return (
        <div className="system-settings-container">
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, newValue) => {
                        const tabs = Object.keys(INTEGRATION_TABS) as IntegrationTab[];
                        setActiveTab(tabs[newValue]);
                    }}
                >
                    {(Object.keys(INTEGRATION_TABS) as IntegrationTab[]).map((tab) => (
                        <Tab key={tab} label={INTEGRATION_TABS[tab]} sx={{textTransform: 'none'}}/>
                    ))}
                </Tabs>
            </Box>

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
