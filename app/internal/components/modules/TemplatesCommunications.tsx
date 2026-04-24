"use client";

import { useState } from "react";
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

    return (
        <div className="system-settings-container">
            <div className="system-settings-tabs">
                {(Object.keys(TEMPLATE_TABS) as TemplateTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`settings-subtab${activeTab === tab ? " active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {TEMPLATE_TABS[tab]}
                    </button>
                ))}
            </div>

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
