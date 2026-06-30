"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import DataObjectOutlinedIcon from "@mui/icons-material/DataObjectOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ViewComfyAltOutlinedIcon from "@mui/icons-material/ViewComfyAltOutlined";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { SystemBusinessSettings } from "./SystemBusinessSettings";
import { OcrUsageDashboard } from "./OcrUsageDashboard";
import { ExcelParserConfigSettings } from "./ExcelParserConfigSettings";
import { PdfTemplatesNew } from "./PdfTemplatesNew";
import { EmailTemplatesNew } from "./EmailTemplatesNew";
import { UserPreferencesSettings } from "./UserPreferencesSettings";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import { SmtpSettings } from "./SmtpSettings";
import { AutomatedEmailsSettings } from "./AutomatedEmailsSettings";
import { LLMSettings } from "./LLMSettings";
import { InvoiceProviderPromptsSettings } from "./InvoiceProviderPromptsSettings";
import "./configurations.css";

export interface ConfigurationsModuleProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
    role?: string;
}

type ConfigPage =
    | "pdf-templates"
    | "email-templates"
    | "pdf-defaults"
    | "automated-emails"
    | "simulation"
    | "clients"
    | "calculation"
    | "excel-parser"
    | "smtp"
    | "general"
    | "sessions"
    | "cache"
    | "cron"
    | "llm"
    | "invoice-providers"
    | "ocr-usage"
    | "preferences"
    | "permissions";

interface ConfigNavItem {
    id: ConfigPage;
    label: string;
    description: string;
    icon: ReactNode;
    sysAdminOnly?: boolean;
}

interface ConfigNavGroup {
    id: string;
    label: string;
    summary: string;
    items: ConfigNavItem[];
}

const LEGACY_TAB_DEFAULTS: Partial<Record<string, ConfigPage>> = {
    "templates-communications": "pdf-templates",
    "system-business": "simulation",
    "user-experience": "preferences",
    integrations: "smtp",
    "ocr-usage": "ocr-usage",
    "excel-parser": "excel-parser",
};

export function ConfigurationsModule({ session, onNotify, role }: ConfigurationsModuleProps) {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const isSysAdmin = role === "SYS_ADMIN";
    const requestedPage = searchParams.get("page") ?? searchParams.get("tab");

    const groups = useMemo<ConfigNavGroup[]>(() => [
        {
            id: "documents",
            label: t("configurationsModule", "groupDocuments"),
            summary: t("configurationsModule", "groupDocumentsSummary"),
            items: [
                {
                    id: "pdf-templates",
                    label: t("configurationsModule", "tabPdfTemplates"),
                    description: t("configurationsModule", "descPdfTemplates"),
                    icon: <DescriptionOutlinedIcon fontSize="small" />,
                },
                {
                    id: "email-templates",
                    label: t("configurationsModule", "tabEmailTemplates"),
                    description: t("configurationsModule", "descEmailTemplates"),
                    icon: <EmailOutlinedIcon fontSize="small" />,
                },
                {
                    id: "pdf-defaults",
                    label: t("configurationsModule", "tabPdfDefaults"),
                    description: t("configurationsModule", "descPdfDefaults"),
                    icon: <ArticleOutlinedIcon fontSize="small" />,
                },
                {
                    id: "automated-emails",
                    label: t("systemSettings", "tabAutomatedEmails"),
                    description: t("configurationsModule", "descAutomatedEmails"),
                    icon: <MarkEmailReadOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
            ],
        },
        {
            id: "business",
            label: t("configurationsModule", "groupBusiness"),
            summary: t("configurationsModule", "groupBusinessSummary"),
            items: [
                {
                    id: "simulation",
                    label: t("systemSettings", "tabSimulation"),
                    description: t("configurationsModule", "descSimulation"),
                    icon: <BusinessCenterOutlinedIcon fontSize="small" />,
                },
                {
                    id: "clients",
                    label: t("systemSettings", "tabClients"),
                    description: t("configurationsModule", "descClients"),
                    icon: <PeopleAltOutlinedIcon fontSize="small" />,
                },
                {
                    id: "calculation",
                    label: t("systemSettings", "tabCalculation"),
                    description: t("configurationsModule", "descCalculation"),
                    icon: <CalculateOutlinedIcon fontSize="small" />,
                },
                {
                    id: "excel-parser",
                    label: t("excelParserConfig", "title"),
                    description: t("configurationsModule", "descExcelParser"),
                    icon: <DataObjectOutlinedIcon fontSize="small" />,
                },
            ],
        },
        {
            id: "platform",
            label: t("configurationsModule", "groupPlatform"),
            summary: t("configurationsModule", "groupPlatformSummary"),
            items: [
                {
                    id: "general",
                    label: t("configurationsModule", "tabGeneralMaintenance"),
                    description: t("configurationsModule", "descGeneralMaintenance"),
                    icon: <SettingsOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
                {
                    id: "smtp",
                    label: t("systemSettings", "tabSmtp"),
                    description: t("configurationsModule", "descSmtp"),
                    icon: <CloudSyncOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
                {
                    id: "sessions",
                    label: t("configurationsModule", "tabSessions"),
                    description: t("configurationsModule", "descSessions"),
                    icon: <MemoryOutlinedIcon fontSize="small" />,
                },
                {
                    id: "cache",
                    label: t("configurationsModule", "tabCache"),
                    description: t("configurationsModule", "descCache"),
                    icon: <TuneOutlinedIcon fontSize="small" />,
                },
                {
                    id: "cron",
                    label: t("configurationsModule", "tabCronJobs"),
                    description: t("configurationsModule", "descCronJobs"),
                    icon: <ScheduleOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
            ],
        },
        {
            id: "ai-ocr",
            label: t("configurationsModule", "groupAiOcr"),
            summary: t("configurationsModule", "groupAiOcrSummary"),
            items: [
                {
                    id: "llm",
                    label: t("configurationsModule", "tabLlmSettings"),
                    description: t("configurationsModule", "descLlmSettings"),
                    icon: <AutoAwesomeOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
                {
                    id: "invoice-providers",
                    label: t("configurationsModule", "tabInvoiceProviders"),
                    description: t("configurationsModule", "descInvoiceProviders"),
                    icon: <CodeOutlinedIcon fontSize="small" />,
                    sysAdminOnly: true,
                },
                {
                    id: "ocr-usage",
                    label: t("ocrUsage", "title"),
                    description: t("configurationsModule", "descOcrUsage"),
                    icon: <PaidOutlinedIcon fontSize="small" />,
                },
            ],
        },
        {
            id: "access",
            label: t("configurationsModule", "groupAccess"),
            summary: t("configurationsModule", "groupAccessSummary"),
            items: [
                {
                    id: "preferences",
                    label: t("systemSettings", "tabPreferences"),
                    description: t("configurationsModule", "descPreferences"),
                    icon: <ViewComfyAltOutlinedIcon fontSize="small" />,
                },
                {
                    id: "permissions",
                    label: t("configurationsModule", "tabRolePermissions"),
                    description: t("configurationsModule", "descPermissions"),
                    icon: <SecurityOutlinedIcon fontSize="small" />,
                },
            ],
        },
    ], [t]);

    const visibleGroups = useMemo(() => groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.sysAdminOnly || isSysAdmin),
        }))
        .filter((group) => group.items.length > 0), [groups, isSysAdmin]);

    const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);
    const requestedConfigPage = requestedPage
        ? (LEGACY_TAB_DEFAULTS[requestedPage] ?? requestedPage) as ConfigPage
        : null;
    const [activePage, setActivePage] = useState<ConfigPage>(
        requestedConfigPage && visibleItems.some((item) => item.id === requestedConfigPage)
            ? requestedConfigPage
            : visibleItems[0]?.id ?? "pdf-templates",
    );

    const resolvedPage = visibleItems.some((item) => item.id === activePage)
        ? activePage
        : visibleItems[0]?.id ?? "pdf-templates";
    const activeItem = visibleItems.find((item) => item.id === resolvedPage);
    const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.id === resolvedPage));

    useEffect(() => {
        if (requestedConfigPage && visibleItems.some((item) => item.id === requestedConfigPage)) {
            setActivePage(requestedConfigPage);
        }
    }, [requestedConfigPage, visibleItems]);

    return (
        <div className="configurations-container">
            <aside className="configurations-sidebar" aria-label={t("configurationsModule", "sidebarAria")}>
                <div className="configurations-sidebar-heading">
                    <span className="configurations-sidebar-kicker">{t("configurationsModule", "settingsKicker")}</span>
                    <h2>{t("configurationsModule", "title")}</h2>
                </div>
                <nav className="configurations-nav">
                    {visibleGroups.map((group) => (
                        <section className="configurations-nav-group" key={group.id}>
                            <div className="configurations-nav-group-header">
                                <span>{group.label}</span>
                                <small>{group.summary}</small>
                            </div>
                            <div className="configurations-nav-items">
                                {group.items.map((item) => {
                                    const isActive = resolvedPage === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`configurations-nav-item${isActive ? " is-active" : ""}`}
                                            data-testid={`config-page-${item.id}`}
                                            onClick={() => setActivePage(item.id)}
                                        >
                                            <span className="configurations-nav-icon">{item.icon}</span>
                                            <span className="configurations-nav-copy">
                                                <span>{item.label}</span>
                                                <small>{item.description}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </nav>
            </aside>

            <div className="configurations-main">
                <header className="configurations-page-header">
                    <div>
                        <span className="configurations-page-eyebrow">{activeGroup?.label}</span>
                        <h1>{activeItem?.label}</h1>
                        <p>{activeItem?.description}</p>
                    </div>
                </header>

                <div className="configurations-content">
                    {resolvedPage === "pdf-templates" && (
                        <PdfTemplatesNew session={session} onNotify={onNotify} />
                    )}
                    {resolvedPage === "email-templates" && (
                        <EmailTemplatesNew session={session} onNotify={onNotify} />
                    )}
                    {resolvedPage !== "pdf-templates" && resolvedPage !== "email-templates" && (
                        <div className="configuration-content-frame">
                            {resolvedPage === "pdf-defaults" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="pdf-defaults" hideNavigation />
                            )}
                            {resolvedPage === "automated-emails" && (
                                <AutomatedEmailsSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "simulation" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="simulation" hideNavigation />
                            )}
                            {resolvedPage === "clients" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="clients" hideNavigation />
                            )}
                            {resolvedPage === "calculation" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="calculation" hideNavigation />
                            )}
                            {resolvedPage === "excel-parser" && (
                                <ExcelParserConfigSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "smtp" && (
                                <SmtpSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "general" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="general" hideNavigation />
                            )}
                            {resolvedPage === "sessions" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="sessions" hideNavigation />
                            )}
                            {resolvedPage === "cache" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="cache" hideNavigation />
                            )}
                            {resolvedPage === "cron" && (
                                <SystemBusinessSettings session={session} onNotify={onNotify} role={role} activeSection="cron" hideNavigation />
                            )}
                            {resolvedPage === "llm" && (
                                <LLMSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "invoice-providers" && (
                                <InvoiceProviderPromptsSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "ocr-usage" && (
                                <OcrUsageDashboard session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "preferences" && (
                                <UserPreferencesSettings session={session} onNotify={onNotify} />
                            )}
                            {resolvedPage === "permissions" && (
                                <RolePermissionsEditor session={session} onNotify={onNotify} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
