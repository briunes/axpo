"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Tabs, Tab } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { TemplatesCommunications } from "./TemplatesCommunications";
import { SystemBusinessSettings } from "./SystemBusinessSettings";
import { UserExperienceSettings } from "./UserExperienceSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";
import { OcrUsageDashboard } from "./OcrUsageDashboard";
import { ExcelParserConfigSettings } from "./ExcelParserConfigSettings";
import "./configurations.css";

export interface ConfigurationsModuleProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
    role?: string;
}

type ConfigTab = "templates-communications" | "system-business" | "user-experience" | "integrations" | "ocr-usage" | "excel-parser";

export function ConfigurationsModule({ session, onNotify, role }: ConfigurationsModuleProps) {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const isSysAdmin = role === "SYS_ADMIN";
    const requestedTab = searchParams.get("tab") as ConfigTab | null;
    const [activeTab, setActiveTab] = useState<ConfigTab>(
        requestedTab ? requestedTab : "templates-communications",
    );

    const ALL_TAB_LABELS: Record<ConfigTab, string> = {
        "templates-communications": t("configurationsModule", "tabTemplatesCommunications"),
        "system-business": t("configurationsModule", "tabSystemBusiness"),
        "user-experience": t("configurationsModule", "tabUserExperience"),
        "integrations": t("configurationsModule", "tabIntegrations"),
        "ocr-usage": t("ocrUsage", "title"),
        "excel-parser": "Excel Parser",
    };

    // SYS_ADMIN-only tabs
    const SYS_ADMIN_TABS: ConfigTab[] = ["integrations"];

    const visibleTabs = (Object.keys(ALL_TAB_LABELS) as ConfigTab[]).filter(
        (tab) => !SYS_ADMIN_TABS.includes(tab) || isSysAdmin,
    );

    const TAB_LABELS: Partial<Record<ConfigTab, string>> = Object.fromEntries(
        visibleTabs.map((tab) => [tab, ALL_TAB_LABELS[tab]]),
    );

    const tabIndex = visibleTabs.indexOf(activeTab);
    // Reset active tab if it becomes invisible
    const resolvedTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0];

    useEffect(() => {
        if (requestedTab && visibleTabs.includes(requestedTab)) {
            setActiveTab(requestedTab);
        }
    }, [requestedTab, visibleTabs]);

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
                    value={visibleTabs.indexOf(resolvedTab)}
                    onChange={(_, newValue) => {
                        setActiveTab(visibleTabs[newValue]);
                    }}
                    sx={{
                        minHeight: 56,
                        '& .MuiTabs-indicator': {
                            backgroundColor: 'var(--scheme-brand-600)',
                            height: 2,
                        },
                    }}
                >
                    {visibleTabs.map((tab) => (
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
                {resolvedTab === "templates-communications" && (
                    <TemplatesCommunications session={session} onNotify={onNotify} />
                )}
                {resolvedTab === "system-business" && (
                    <SystemBusinessSettings session={session} onNotify={onNotify} role={role} />
                )}
                {resolvedTab === "user-experience" && (
                    <UserExperienceSettings session={session} onNotify={onNotify} />
                )}
                {resolvedTab === "integrations" && (
                    <IntegrationsSettings session={session} onNotify={onNotify} />
                )}
                {resolvedTab === "ocr-usage" && (
                    <OcrUsageDashboard session={session} onNotify={onNotify} />
                )}
                {resolvedTab === "excel-parser" && (
                    <ExcelParserConfigSettings session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
