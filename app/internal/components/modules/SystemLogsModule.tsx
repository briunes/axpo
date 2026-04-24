"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useI18n } from "../../../../src/lib/i18n-context";
import { AuditLogsModule } from "./AuditLogsModule";
import { EmailLogsModule } from "./EmailLogsModule";
import { CronLogsPanel } from "./CronLogsPanel";
import "./configurations.css";

export interface SystemLogsModuleProps {
    session: SessionState;
    auditLogsActions: AuditLogsActions;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onActionButtons?: (buttons: React.ReactNode) => void;
}

type LogType = "audit" | "email" | "cron";

export function SystemLogsModule({ session, auditLogsActions, onNotify, onActionButtons }: SystemLogsModuleProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<LogType>("audit");

    const TAB_LABELS: Record<LogType, string> = {
        audit: "Audit Logs",
        email: "Email Logs",
        cron: "Cron Logs",
    };

    return (
        <div className="configurations-container">
            <div className="configurations-tabs">
                {(Object.keys(TAB_LABELS) as LogType[]).map((tab) => (
                    <button
                        key={tab}
                        className={`config-tab${activeTab === tab ? " active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                        data-testid={`logs-tab-${tab}`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            <div className="configurations-content" style={{ padding: 0 }}>
                {activeTab === "audit" && (
                    <AuditLogsModule
                        session={session}
                        actions={auditLogsActions}
                        onNotify={onNotify}
                        onActionButtons={onActionButtons}
                    />
                )}
                {activeTab === "email" && (
                    <EmailLogsModule
                        session={session}
                        onNotify={onNotify}
                    />
                )}
                {activeTab === "cron" && (
                    <CronLogsPanel
                        session={session}
                        onNotify={onNotify}
                    />
                )}
            </div>
        </div>
    );
}
