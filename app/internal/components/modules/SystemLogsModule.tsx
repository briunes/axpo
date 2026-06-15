"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useI18n } from "../../../../src/lib/i18n-context";
import { usePermissions } from "../../lib/permissionsContext";
import type { PermissionKey } from "../../lib/permissionsDefinitions";
import { AuditLogsModule } from "./AuditLogsModule";
import { EmailLogsModule } from "./EmailLogsModule";
import { CronLogsPanel } from "./CronLogsPanel";
import { OcrLogsPanel } from "./OcrLogsPanel";
import { AppErrorLogsPanel } from "./AppErrorLogsPanel";
import "./configurations.css";

export interface SystemLogsModuleProps {
    session: SessionState;
    auditLogsActions: AuditLogsActions;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onActionButtons?: (buttons: React.ReactNode) => void;
}

type LogType = "audit" | "email" | "cron" | "ocr" | "app-errors";

const LOG_TABS: Array<{
    id: LogType;
    labelKey: string;
    permission: PermissionKey;
}> = [
    { id: "audit", labelKey: "auditLogs", permission: "section.audit-logs" },
    { id: "email", labelKey: "emailLogs", permission: "section.email-logs" },
    { id: "cron", labelKey: "cronLogs", permission: "section.cron-logs" },
    { id: "ocr", labelKey: "ocrLogs", permission: "section.ocr-logs" },
    { id: "app-errors", labelKey: "appErrors", permission: "section.app-error-logs" },
];

const isElevatedRole = (role: string) => role === "ADMIN" || role === "SYS_ADMIN";

export function SystemLogsModule({ session, auditLogsActions, onNotify, onActionButtons }: SystemLogsModuleProps) {
    const { t } = useI18n();
    const { canDo } = usePermissions();
    const [activeTab, setActiveTab] = useState<LogType>("audit");

    const visibleTabs = isElevatedRole(session.user.role)
        ? LOG_TABS.filter((tab) => canDo(session.user.role, tab.permission))
        : [];

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [activeTab, visibleTabs]);

    if (visibleTabs.length === 0) {
        return (
            <div className="configurations-container logs-configurations-container">
                <div className="settings-panel">
                    {t("rolePermissionsModule", "noLogPermissions")}
                </div>
            </div>
        );
    }

    return (
        <div className="configurations-container logs-configurations-container">
            <div className="configurations-tabs">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`config-tab${activeTab === tab.id ? " active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                        data-testid={`logs-tab-${tab.id}`}
                    >
                        {t("logs", tab.labelKey)}
                    </button>
                ))}
            </div>

            <div className="configurations-content logs-configurations-content" style={{ padding: 0 }}>
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
                {activeTab === "ocr" && (
                    <OcrLogsPanel
                        session={session}
                        onNotify={onNotify}
                    />
                )}
                {activeTab === "app-errors" && (
                    <AppErrorLogsPanel
                        session={session}
                        onNotify={onNotify}
                    />
                )}
            </div>
        </div>
    );
}
