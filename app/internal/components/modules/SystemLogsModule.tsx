"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useI18n } from "../../../../src/lib/i18n-context";
import { usePermissions } from "../../lib/permissionsContext";
import type { PermissionKey } from "../../lib/permissionsDefinitions";
import { getSystemConfig } from "../../lib/configApi";
import { AuditLogsModule } from "./AuditLogsModule";
import { EmailLogsModule } from "./EmailLogsModule";
import { CronLogsPanel } from "./CronLogsPanel";
import { OcrLogsPanel } from "./OcrLogsPanel";
import { AppErrorLogsPanel } from "./AppErrorLogsPanel";
import { SimulationIssuesPanel } from "./SimulationIssuesPanel";
import "./configurations.css";

export interface SystemLogsModuleProps {
    session: SessionState;
    auditLogsActions: AuditLogsActions;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onActionButtons?: (buttons: React.ReactNode) => void;
}

type LogType = "audit" | "email" | "cron" | "ocr" | "app-errors" | "simulation-issues";

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
    { id: "simulation-issues", labelKey: "simulationIssues", permission: "section.simulation-issues" },
];

const isElevatedRole = (role: string) => role === "ADMIN" || role === "SYS_ADMIN";

export function SystemLogsModule({ session, auditLogsActions, onNotify, onActionButtons }: SystemLogsModuleProps) {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const { canDo } = usePermissions();
    const [simulationIssuesEnabled, setSimulationIssuesEnabled] = useState<boolean | null>(null);
    const requestedTab = searchParams.get("tab") as LogType | null;
    const [activeTab, setActiveTab] = useState<LogType>(
        requestedTab && LOG_TABS.some((tab) => tab.id === requestedTab) ? requestedTab : "audit",
    );

    useEffect(() => {
        let cancelled = false;
        getSystemConfig({ view: "runtime" })
            .then((config) => {
                if (!cancelled) setSimulationIssuesEnabled(config.simulationIssuesEnabled !== false);
            })
            .catch(() => {
                if (!cancelled) setSimulationIssuesEnabled(false);
            });
        return () => { cancelled = true; };
    }, []);

    const visibleTabs = useMemo(() => isElevatedRole(session.user.role)
        ? LOG_TABS.filter((tab) =>
            canDo(session.user.role, tab.permission) &&
            (tab.id !== "simulation-issues" || simulationIssuesEnabled === true),
        )
        : [], [canDo, session.user.role, simulationIssuesEnabled]);

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [activeTab, visibleTabs]);

    useEffect(() => {
        if (requestedTab && visibleTabs.some((tab) => tab.id === requestedTab)) {
            setActiveTab(requestedTab);
        }
    }, [requestedTab, visibleTabs]);

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
                {simulationIssuesEnabled === true && activeTab === "simulation-issues" && (
                    <SimulationIssuesPanel session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
