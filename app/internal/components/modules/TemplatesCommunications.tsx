"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { PdfTemplatesNew } from "./PdfTemplatesNew";
import { EmailTemplatesNew } from "./EmailTemplatesNew";

export interface TemplatesCommunicationsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type TemplateTab = "pdf" | "email";

export function TemplatesCommunications({ session, onNotify }: TemplatesCommunicationsProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<TemplateTab>("pdf");

    const TEMPLATE_TABS: Record<TemplateTab, string> = {
        pdf: t("configurationsModule", "tabPdfTemplates"),
        email: t("configurationsModule", "tabEmailTemplates"),
    };

    const tabIndex = (Object.keys(TEMPLATE_TABS) as TemplateTab[]).indexOf(activeTab);

    return (
        <div className="system-settings-container">
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, newValue) => {
                        const tabs = Object.keys(TEMPLATE_TABS) as TemplateTab[];
                        setActiveTab(tabs[newValue]);
                    }}
                >
                    {(Object.keys(TEMPLATE_TABS) as TemplateTab[]).map((tab) => (
                        <Tab key={tab} label={TEMPLATE_TABS[tab]} sx={{textTransform: 'none'}} />
                    ))}
                </Tabs>
            </Box>

            <div className="system-settings-content">
                {activeTab === "pdf" && (
                    <PdfTemplatesNew session={session} onNotify={onNotify} />
                )}
                {activeTab === "email" && (
                    <EmailTemplatesNew session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
