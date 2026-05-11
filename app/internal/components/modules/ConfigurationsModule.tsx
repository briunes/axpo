"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
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

    const tabIndex = (Object.keys(TAB_LABELS) as ConfigTab[]).indexOf(activeTab);

    return (
        <div className="configurations-container">
            <Box
                sx={{
                    borderBottom: "1px solid var(--scheme-neutral-900)",
                    px: 2,
                    background: "linear-gradient(180deg, var(--scheme-neutral-1200) 0%, var(--scheme-neutral-1100) 100%)",
                }}
            >
                <Tabs
                    value={tabIndex}
                    onChange={(_, newValue) => {
                        const tabs = Object.keys(TAB_LABELS) as ConfigTab[];
                        setActiveTab(tabs[newValue]);
                    }}
                    sx={{
                        minHeight: 56,
                        '& .MuiTabs-indicator': {
                            backgroundColor: 'var(--scheme-brand-600)',
                            height: 2,
                        },
                    }}
                >
                    {(Object.keys(TAB_LABELS) as ConfigTab[]).map((tab) => (
                        <Tab
                            key={tab}
                            label={TAB_LABELS[tab]}
                            data-testid={`config-tab-${tab}`}
                            sx={{
                                textTransform: 'none',
                                minHeight: 56,
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
