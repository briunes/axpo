"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box,
    Button,
    ButtonGroup,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { LanguageFlag } from "../../../../src/lib/LanguageFlag";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "../../../../src/lib/supportedLanguages";
import { isLocale, translations, type TranslationKey } from "../../../../src/lib/translations";
import { HtmlEditor } from "./HtmlEditor";
import { AITemplateBuilder, type AIGeneratedTemplate } from "./AITemplateBuilder";
import { DraggableVariables } from "./DraggableVariables";
import { EditableSectionsEditor } from "./EditableSectionsEditor";
import {
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    getTemplateVariables,
    sendTestEmail,
    type EmailTemplate,
    type EmailTemplateTranslationInput,
    type TemplateVariable,
} from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef, SortState } from "../ui";

export interface EmailTemplatesProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

export type EmailTemplateType =
    | "simulation-share"
    | "magic-link"
    | "otp"
    | "welcome"
    | "user-welcome"
    | "password-reset"
    | "expiring-soon"
    | "converted"
    | "notification";

/**
 * Returns the relevant variable list for the DraggableVariables panel
 * based on the selected email template type.
 */
/** Button snippet variables — dropped as complete HTML blocks instead of {{VAR}} placeholders. */
function translateForLocale(
    languageCode: string,
    namespace: TranslationKey,
    key: string,
): string {
    const locale = isLocale(languageCode) ? languageCode : DEFAULT_LANGUAGE;
    const namespaceTranslations = translations[locale][namespace] ?? translations[DEFAULT_LANGUAGE][namespace];
    return (namespaceTranslations as Record<string, string | undefined>)?.[key] ?? key;
}

const getButtonSnippets = (
    t: ReturnType<typeof useI18n>["t"],
    templateLanguage: string,
): Array<{ name: string; label: string; description: string; dragContent: string; isButton: true }> => {
    const buttonText = (key: string) => translateForLocale(templateLanguage, "emailTemplatesModule", key);

    return [
    {
        name: "BTN_SETUP_PASSWORD",
        label: t("emailTemplatesModule", "buttonSetupPasswordLabel"),
        description: t("emailTemplatesModule", "buttonSetupPasswordDesc"),
        isButton: true,
        dragContent: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0;">
  <tbody><tr>
    <td align="center">
      <a href="{{ SETUP_PASSWORD_URL }}" style="display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px;">
        ${buttonText("buttonSetupPasswordText")}
      </a>
    </td>
  </tr></tbody>
</table>`,
    },
    {
        name: "BTN_RESET_PASSWORD",
        label: t("emailTemplatesModule", "buttonResetPasswordLabel"),
        description: t("emailTemplatesModule", "buttonResetPasswordDesc"),
        isButton: true,
        dragContent: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0;">
  <tbody><tr>
    <td align="center">
      <a href="{{ RESET_PASSWORD_URL }}" style="display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px;">
        ${buttonText("buttonResetPasswordText")}
      </a>
    </td>
  </tr></tbody>
</table>`,
    },
    {
        name: "BTN_VIEW_SIMULATION",
        label: t("emailTemplatesModule", "buttonViewSimulationLabel"),
        description: t("emailTemplatesModule", "buttonViewSimulationDesc"),
        isButton: true,
        dragContent: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0;">
  <tbody><tr>
    <td align="center">
      <a href="{{SIMULATION_LINK}}" style="display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px;">
        ${buttonText("buttonViewSimulationText")}
      </a>
    </td>
  </tr></tbody>
</table>`,
    },
    {
        name: "BTN_MAGIC_LINK",
        label: t("emailTemplatesModule", "buttonMagicLinkLabel"),
        description: t("emailTemplatesModule", "buttonMagicLinkDesc"),
        isButton: true,
        dragContent: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0;">
  <tbody><tr>
    <td align="center">
      <a href="{{ MAGIC_LINK }}" style="display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px;">
        ${buttonText("buttonMagicLinkText")}
      </a>
    </td>
  </tr></tbody>
</table>`,
    },
    ];
};

/**
 * Email template types that should ONLY show variables explicitly tagged for
 * them — no "universal" (untagged) variables.
 */
const CLOSED_EMAIL_TYPES = new Set(["user-welcome", "welcome", "password-reset", "magic-link", "otp"]);

/** Types that should include the button snippets panel */
const BUTTON_SNIPPET_TYPES = new Set(["user-welcome", "welcome", "password-reset", "magic-link", "simulation-share", "expiring-soon", "converted", "notification"]);

const getBuiltinEmailVariables = (t: ReturnType<typeof useI18n>["t"]): Record<
    string,
    Array<{ name: string; label: string; description: string }>
> => ({
    "user-welcome": [
        {
            name: "SETUP_PASSWORD_VALIDITY_HOURS",
            label: t("emailTemplatesModule", "varSetupPasswordValidityLabel"),
            description: t("emailTemplatesModule", "varSetupPasswordValidityDesc"),
        },
    ],
    welcome: [
        {
            name: "SETUP_PASSWORD_VALIDITY_HOURS",
            label: t("emailTemplatesModule", "varSetupPasswordValidityLabel"),
            description: t("emailTemplatesModule", "varSetupPasswordValidityDesc"),
        },
    ],
    "magic-link": [
        {
            name: "MAGIC_LINK_VALIDITY_MINUTES",
            label: t("emailTemplatesModule", "varMagicLinkValidityLabel"),
            description: t("emailTemplatesModule", "varMagicLinkValidityDesc"),
        },
    ],
    otp: [
        {
            name: "OTP_VALIDITY_MINUTES",
            label: t("emailTemplatesModule", "varOtpValidityLabel"),
            description: t("emailTemplatesModule", "varOtpValidityDesc"),
        },
    ],
});

function getVariablesForEmailTemplate(
    type: string | undefined,
    dbVariables: TemplateVariable[],
    t: ReturnType<typeof useI18n>["t"],
    templateLanguage: string,
): Array<{ name: string; label: string; description: string; dragContent?: string; isButton?: boolean }> {
    let vars: Array<{ name: string; label: string; description: string; dragContent?: string; isButton?: boolean }>;

    if (!type) {
        vars = dbVariables
            .filter((v) => !v.templateTypes)
            .map((v) => ({ name: v.key, label: v.label, description: v.description || "" }));
    } else if (CLOSED_EMAIL_TYPES.has(type)) {
        vars = dbVariables
            .filter((v) => v.templateTypes?.split(",").map((s) => s.trim()).includes(type))
            .map((v) => ({ name: v.key, label: v.label, description: v.description || "" }));
    } else {
        vars = dbVariables
            .filter((v) => !v.templateTypes || v.templateTypes.split(",").map((s) => s.trim()).includes(type))
            .map((v) => ({ name: v.key, label: v.label, description: v.description || "" }));
    }

    const builtinVariables = type ? (getBuiltinEmailVariables(t)[type] ?? []) : [];
    const existingNames = new Set(vars.map((variable) => variable.name));
    vars = [
        ...builtinVariables.filter((variable) => !existingNames.has(variable.name)),
        ...vars,
    ];

    // Prepend relevant button snippets
    if (type && BUTTON_SNIPPET_TYPES.has(type)) {
        const relevantButtons = getButtonSnippets(t, templateLanguage).filter((b) => {
            if (type === "password-reset") return b.name === "BTN_RESET_PASSWORD";
            if (type === "magic-link") return b.name === "BTN_MAGIC_LINK";
            if (type === "simulation-share" || type === "expiring-soon" || type === "converted" || type === "notification") return b.name === "BTN_VIEW_SIMULATION";
            return b.name === "BTN_SETUP_PASSWORD" || b.name === "BTN_RESET_PASSWORD"; // user-welcome / welcome get both password buttons
        });
        vars = [...relevantButtons, ...vars];
    }

    return vars;
}

export function EmailTemplatesNew({ session, onNotify }: EmailTemplatesProps) {
    const { t } = useI18n();
    const TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
        "simulation-share": t("emailTemplatesModule", "typeSimulationShare"),
        "magic-link": t("emailTemplatesModule", "typeMagicLink"),
        "otp": t("emailTemplatesModule", "typeOtp"),
        "welcome": t("emailTemplatesModule", "typeWelcome"),
        "user-welcome": t("emailTemplatesModule", "typeUserWelcome"),
        "password-reset": t("emailTemplatesModule", "typePasswordReset"),
        "expiring-soon": t("emailTemplatesModule", "typeExpiringSoon"),
        "converted": t("emailTemplatesModule", "typeConverted"),
        "notification": t("emailTemplatesModule", "typeNotification"),
    };
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [variables, setVariables] = useState<TemplateVariable[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<Partial<EmailTemplate>>({});
    // translations map: languageCode -> { subject, htmlContent }
    const [translationsMap, setTranslationsMap] = useState<Record<string, { subject: string; htmlContent: string }>>({});
    const [activeLanguage, setActiveLanguage] = useState<string>(DEFAULT_LANGUAGE);
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showTestEmailInput, setShowTestEmailInput] = useState(false);
    const [testEmailAddress, setTestEmailAddress] = useState("");
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortState, setSortState] = useState<SortState>({ column: "updatedAt", direction: "desc" });
    const [dropdownState, setDropdownState] = useState<{
        anchorEl: HTMLElement | null;
        items: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean }>;
    }>({ anchorEl: null, items: [] });
    const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [templatesData, variablesData] = await Promise.all([
                getEmailTemplates(),
                getTemplateVariables(),
            ]);
            setTemplates(templatesData);
            setVariables(variablesData);
        } catch (error) {
            onNotify(t("emailTemplatesModule", "loadError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            setIsLoading(true);
            const data = await getEmailTemplates();
            setTemplates(data);
        } catch (error) {
            onNotify(t("emailTemplatesModule", "loadTemplatesError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    /** Build an empty translations map with all supported languages */
    const buildEmptyTranslationsMap = () => {
        return SUPPORTED_LANGUAGES.reduce<Record<string, { subject: string; htmlContent: string }>>((acc, lang) => {
            acc[lang.code] = { subject: "", htmlContent: "" };
            return acc;
        }, {});
    };

    /** Build a translations map from existing template translations */
    const buildTranslationsMapFromTemplate = (template: EmailTemplate) => {
        const map = buildEmptyTranslationsMap();
        (template.translations ?? []).forEach((tr) => {
            map[tr.languageCode] = { subject: tr.subject, htmlContent: tr.htmlContent };
        });
        return map;
    };

    const handleCreate = () => {
        const defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #374151; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${t("emailTemplatesModule", "defaultHtmlTitle")}</h1>
        <p>${t("emailTemplatesModule", "defaultHtmlBody")}</p>
    </div>
</body>
</html>`;
        const emptyMap = buildEmptyTranslationsMap();
        // Pre-fill the default language with empty content
        emptyMap[DEFAULT_LANGUAGE] = { subject: "", htmlContent: defaultHtml };
        setTranslationsMap(emptyMap);
        setActiveLanguage(DEFAULT_LANGUAGE);
        setFormData({
            name: "",
            description: "",
            type: "simulation-share",
            active: true,
            subject: "",
            htmlContent: defaultHtml,
        });
        setIsCreating(true);
    };

    const handleEdit = (template: EmailTemplate) => {
        setFormData({ ...template });
        setTranslationsMap(buildTranslationsMapFromTemplate(template));
        setActiveLanguage(DEFAULT_LANGUAGE);
        setEditingTemplate(template);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("emailTemplatesModule", "confirmDelete"))) return;

        try {
            await deleteEmailTemplate(id);
            setTemplates(templates.filter(t => t.id !== id));
            onNotify(t("emailTemplatesModule", "deletedSuccess"), "success");
        } catch (error) {
            onNotify(t("emailTemplatesModule", "deletedError"), "error");
        }
    };

    const handleToggleActive = async (id: string) => {
        try {
            const template = templates.find(t => t.id === id);
            if (!template) return;

            await updateEmailTemplate(id, { active: !template.active });
            setTemplates(templates.map(t =>
                t.id === id ? { ...t, active: !t.active } : t
            ));
            onNotify(t("emailTemplatesModule", "statusUpdated"), "success");
        } catch (error) {
            onNotify(t("emailTemplatesModule", "updateError"), "error");
        }
    };

    const handleSave = async () => {
        try {
            // Build translations array from the map
            const translations: EmailTemplateTranslationInput[] = Object.entries(translationsMap)
                .filter(([, val]) => val.subject.trim() || val.htmlContent.trim())
                .map(([languageCode, val]) => ({
                    languageCode,
                    subject: val.subject,
                    htmlContent: val.htmlContent,
                }));

            // Use en (or first language) content as the parent fallback columns
            const primaryTranslation =
                translationsMap[DEFAULT_LANGUAGE] ?? Object.values(translationsMap)[0];

            const payload = {
                ...formData,
                subject: primaryTranslation?.subject ?? formData.subject ?? "",
                htmlContent: primaryTranslation?.htmlContent ?? formData.htmlContent ?? "",
                translations,
            };

            if (isCreating) {
                const newTemplate = await createEmailTemplate({
                    name: payload.name!,
                    description: payload.description!,
                    type: payload.type!,
                    active: payload.active ?? true,
                    subject: payload.subject,
                    htmlContent: payload.htmlContent,
                    editableSections: payload.editableSections,
                    translations,
                });
                setTemplates([...templates, newTemplate]);
                onNotify(t("emailTemplatesModule", "createdSuccess"), "success");
            } else if (editingTemplate) {
                const updated = await updateEmailTemplate(editingTemplate.id, payload);
                setTemplates(templates.map(t =>
                    t.id === editingTemplate.id ? updated : t
                ));
                onNotify(t("emailTemplatesModule", "updatedSuccess"), "success");
            }
            handleCancel();
        } catch (error) {
            onNotify(t("emailTemplatesModule", "savedError"), "error");
        }
    };

    const handleCancel = () => {
        setEditingTemplate(null);
        setIsCreating(false);
        setFormData({});
        setTranslationsMap({});
        setActiveLanguage(DEFAULT_LANGUAGE);
        setShowPreview(false);
    };

    const handleAIApply = (result: AIGeneratedTemplate) => {
        // Fill in metadata fields if AI provided them
        if (result.name || result.description || result.type) {
            setFormData((prev) => ({
                ...prev,
                ...(result.name ? { name: result.name } : {}),
                ...(result.description ? { description: result.description } : {}),
                ...(result.type ? { type: result.type as EmailTemplateType } : {}),
            }));
        }
        // Fill in HTML + subject per language
        if (result.translations?.length) {
            setTranslationsMap((prev) => {
                const updated = { ...prev };
                result.translations.forEach((tr) => {
                    updated[tr.languageCode] = {
                        subject: tr.subject ?? prev[tr.languageCode]?.subject ?? "",
                        htmlContent: tr.htmlContent,
                    };
                });
                return updated;
            });
            // Also update top-level subject from primary language
            const primaryTr =
                result.translations.find((tr) => tr.languageCode === DEFAULT_LANGUAGE) ??
                result.translations[0];
            if (primaryTr?.subject) {
                setFormData((prev) => ({ ...prev, subject: primaryTr.subject }));
            }
            setActiveLanguage(result.translations[0].languageCode);
        }
    };

    const handleSubjectDrop = (e: React.DragEvent<HTMLInputElement>) => {
        e.preventDefault();
        const variable = e.dataTransfer.getData("text/plain");
        const input = e.target as HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const text = input.value;
        const newValue = text.substring(0, start) + variable + text.substring(end);
        setTranslationsMap((prev) => ({
            ...prev,
            [activeLanguage]: { ...prev[activeLanguage], subject: newValue },
        }));

        // Set cursor position after the inserted variable
        setTimeout(() => {
            input.selectionStart = input.selectionEnd = start + variable.length;
            input.focus();
        }, 0);
    };

    const handleSubjectDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleSendTest = async () => {
        if (!testEmailAddress) {
            onNotify(t("emailTemplatesModule", "errorNoEmail"), "error");
            return;
        }

        if (!editingTemplate && !isCreating) return;
        const currentTemplate = formData as EmailTemplate;
        if (!currentTemplate.id) {
            onNotify(t("emailTemplatesModule", "errorNotSaved"), "error");
            return;
        }

        try {
            setIsSendingTest(true);
            await sendTestEmail({
                recipientEmail: testEmailAddress,
                templateId: currentTemplate.id
            });
            onNotify(t("emailTemplatesModule", "testEmailSent"), "success");
            setShowTestEmailInput(false);
            setTestEmailAddress("");
        } catch (error) {
            onNotify(error instanceof Error ? error.message : t("emailTemplatesModule", "testEmailError"), "error");
        } finally {
            setIsSendingTest(false);
        }
    };

    const renderPreview = () => {
        const html = translationsMap[activeLanguage]?.htmlContent || formData.htmlContent || "";
        const sampleData = html
            .replace(/\{\{contactPerson\}\}/g, "John Doe")
            .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.")
            .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
            .replace(/\{\{simulationLink\}\}/g, "https://axpo.example.com/simulation/123")
            .replace(/\{\{pin\}\}/g, "1234")
            .replace(/\{\{expirationDays\}\}/g, "30")
            .replace(/\{\{commercialName\}\}/g, "Maria Silva")
            .replace(/\{\{commercialEmail\}\}/g, "maria.silva@axpo.com")
            .replace(/\{\{commercialPhone\}\}/g, "+351 912 345 678")
            .replace(/\{\{userName\}\}/g, "John Doe")
            .replace(/\{\{userEmail\}\}/g, "john@example.com")
            .replace(
                /\{\{\s*SETUP_PASSWORD_VALIDITY_HOURS\s*\}\}/g,
                "72",
            )
            .replace(
                /\{\{\s*MAGIC_LINK_VALIDITY_MINUTES\s*\}\}/g,
                "15",
            )
            .replace(/\{\{\s*MAGIC_LINK\s*\}\}/g, "https://axpo.example.com/login/magic/abc123")
            .replace(/\{\{magicLink\}\}/g, "https://axpo.example.com/login/magic/abc123");
        return sampleData;
    };

    const renderSubjectPreview = () => {
        const subject = translationsMap[activeLanguage]?.subject || formData.subject || "";
        return subject
            .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
            .replace(/\{\{userName\}\}/g, "John Doe")
            .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.");
    };

    const formatDateTime = (value: string | Date) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "—";
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const filteredTemplates = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const rows = normalizedSearch
            ? templates.filter((template) => [
                template.name,
                template.subject,
                template.description,
                TEMPLATE_TYPE_LABELS[template.type as EmailTemplateType],
                template.active ? t("emailTemplatesModule", "statusActive") : t("emailTemplatesModule", "statusInactive"),
            ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch)))
            : [...templates];

        const direction = sortState.direction === "asc" ? 1 : -1;
        rows.sort((a, b) => {
            const getValue = (template: EmailTemplate) => {
                switch (sortState.column) {
                    case "name": return template.name ?? "";
                    case "type": return TEMPLATE_TYPE_LABELS[template.type as EmailTemplateType] ?? template.type ?? "";
                    case "subject": return template.subject ?? "";
                    case "status": return template.active ? 1 : 0;
                    case "updatedAt": return new Date(template.updatedAt).getTime();
                    default: return "";
                }
            };
            const aValue = getValue(a);
            const bValue = getValue(b);
            if (typeof aValue === "number" && typeof bValue === "number") return (aValue - bValue) * direction;
            return String(aValue).localeCompare(String(bValue)) * direction;
        });

        return rows;
    }, [TEMPLATE_TYPE_LABELS, search, sortState.column, sortState.direction, templates, t]);

    const pagedTemplates = useMemo(
        () => filteredTemplates.slice((page - 1) * pageSize, page * pageSize),
        [filteredTemplates, page, pageSize],
    );

    const columns = useMemo<ColumnDef<EmailTemplate>[]>(() => [
        {
            key: "name",
            label: t("emailTemplatesModule", "colName"),
            sortable: true,
            copyable: true,
            renderCell: (template) => (
                <Typography variant="body2" className="dt-cell-primary" sx={{ fontWeight: 600 }}>
                    {template.name}
                </Typography>
            ),
        },
        {
            key: "type",
            label: t("emailTemplatesModule", "colType"),
            sortable: true,
            renderCell: (template) => (
                <StatusBadge
                    label={TEMPLATE_TYPE_LABELS[template.type as EmailTemplateType] ?? template.type}
                    tone="neutral"
                />
            ),
        },
        {
            key: "subject",
            label: t("emailTemplatesModule", "colSubject"),
            sortable: true,
            copyable: true,
            renderCell: (template) => (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                    {template.subject || "—"}
                </Typography>
            ),
        },
        {
            key: "status",
            label: t("emailTemplatesModule", "colStatus"),
            sortable: true,
            width: "120",
            renderCell: (template) => (
                <StatusBadge
                    label={template.active ? t("emailTemplatesModule", "statusActive") : t("emailTemplatesModule", "statusInactive")}
                    tone={template.active ? "success" : "neutral"}
                />
            ),
        },
        {
            key: "updatedAt",
            label: t("emailTemplatesModule", "colUpdated"),
            sortable: true,
            width: "170",
            renderCell: (template) => (
                <Typography variant="body2" sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
                    {formatDateTime(template.updatedAt)}
                </Typography>
            ),
        },
        {
            key: "actions",
            label: t("emailTemplatesModule", "colActions"),
            renderCell: (template) => {
                const secondaryItems = [
                    {
                        label: template.active ? t("emailTemplatesModule", "btnDeactivate") : t("emailTemplatesModule", "btnActivate"),
                        onClick: () => handleToggleActive(template.id),
                        icon: template.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />,
                        danger: template.active,
                    },
                    {
                        label: t("emailTemplatesModule", "btnDelete"),
                        onClick: () => handleDelete(template.id),
                        icon: <DeleteOutlineIcon fontSize="small" />,
                        danger: true,
                    },
                ];

                return (
                    <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                        <ButtonGroup variant="outlined" size="small">
                            <Button
                                onClick={() => handleEdit(template)}
                                startIcon={<EditIcon fontSize="small" />}
                                title={t("emailTemplatesModule", "btnEdit")}
                                aria-label={t("emailTemplatesModule", "btnEdit")}
                                sx={{ minWidth: "88px !important" }}
                            >
                                {t("emailTemplatesModule", "btnEdit")}
                            </Button>
                            <Button
                                size="small"
                                onClick={(e) => setDropdownState({ anchorEl: e.currentTarget, items: secondaryItems })}
                                aria-label="More actions"
                                sx={{ px: 0.5, minWidth: 32 }}
                            >
                                <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                            </Button>
                        </ButtonGroup>
                    </Box>
                );
            },
        },
    ], [TEMPLATE_TYPE_LABELS, t, templates]);

    const isEditorOpen = isCreating || editingTemplate !== null;

    return (
        <div className="template-table-container">
            {isLoading ? (
                <LoadingState message={t("emailTemplatesModule", "loading")} />
            ) : (
                <>
                    <DataTable<EmailTemplate>
                        tableId="email-templates"
                        columns={columns}
                        rows={pagedTemplates}
                        loading={isLoading}
                        searchValue={search}
                        onSearch={(value) => { setSearch(value); setPage(1); }}
                        onClearFilters={() => { setSearch(""); setPage(1); }}
                        searchPlaceholder={t("emailTemplatesModule", "title")}
                        emptyMessage="No templates found."
                        sortState={sortState}
                        onSort={(column) => {
                            setSortState((current) => ({
                                column,
                                direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
                            }));
                            setPage(1);
                        }}
                        pagination={{
                            page,
                            pageSize,
                            total: filteredTemplates.length,
                            onPageChange: setPage,
                            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
                        }}
                        headerRight={
                            <Tooltip title={t("emailTemplatesModule", "btnNew")} arrow>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleCreate}
                                    startIcon={<AddIcon fontSize="small" />}
                                    sx={{ whiteSpace: "nowrap" }}
                                >
                                    {t("emailTemplatesModule", "btnNew").replace("+ ", "")}
                                </Button>
                            </Tooltip>
                        }
                        mobileCard={{
                            title: "name",
                            status: "status",
                            fields: ["type", "subject", "updatedAt"],
                            actions: "actions",
                        }}
                    />

                    {isEditorOpen && (
                        <div className="template-editor-overlay" onClick={handleCancel}>
                            <div className="template-editor-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="template-editor-header">
                                    <h2>{isCreating ? t("emailTemplatesModule", "modalTitleCreate") : t("emailTemplatesModule", "modalTitleEdit")}</h2>
                                    <button
                                        onClick={handleCancel}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            fontSize: "24px",
                                            cursor: "pointer",
                                            color: "var(--scheme-neutral-500)",
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="template-editor-body">
                                    {/* AI Template Builder */}
                                    <AITemplateBuilder
                                        mode="email"
                                        variables={variables}
                                        isEditing={editingTemplate !== null}
                                        currentFormData={formData as Record<string, any>}
                                        currentTranslationsMap={translationsMap}
                                        onApply={handleAIApply}
                                        onNotify={onNotify}
                                        session={session}
                                    />

                                    {/* Row 1: Name, Type, Description */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 1fr", gap: "12px", marginBottom: "12px" }}>
                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldName")}</label>
                                            <input
                                                type="text"
                                                value={formData.name || ""}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder={t("emailTemplatesModule", "fieldNamePlaceholder")}
                                            />
                                        </div>

                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldType")}</label>
                                            <select
                                                value={formData.type || "simulation-share"}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value as EmailTemplateType })}
                                            >
                                                {Object.entries(TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldDescription")}</label>
                                            <input
                                                type="text"
                                                value={formData.description || ""}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                placeholder={t("emailTemplatesModule", "fieldDescriptionPlaceholder")}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2: Subject and Active */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                        </div>
                                        <div className="config-field" style={{ marginBottom: 0, paddingBottom: "8px" }}>
                                            <label className="config-field-inline">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.active ?? true}
                                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                                />
                                                <span>{t("emailTemplatesModule", "fieldActive")}</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Language Tabs */}
                                    <div style={{ marginBottom: "16px" }}>
                                        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--scheme-neutral-900)", marginBottom: "16px" }}>
                                            {SUPPORTED_LANGUAGES.map((lang) => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => setActiveLanguage(lang.code)}
                                                    style={{
                                                        padding: "8px 16px",
                                                        border: "none",
                                                        borderBottom: activeLanguage === lang.code ? "2px solid var(--scheme-brand-600)" : "2px solid transparent",
                                                        background: "none",
                                                        cursor: "pointer",
                                                        fontWeight: activeLanguage === lang.code ? 700 : 400,
                                                        color: activeLanguage === lang.code ? "var(--scheme-brand-600)" : "var(--scheme-neutral-500)",
                                                        fontSize: "14px",
                                                        marginBottom: "-2px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                    }}
                                                >
                                                    <LanguageFlag code={lang.code} label={lang.label} width={22} height={15} /> {lang.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Subject for active language */}
                                        <div className="config-field" style={{ marginBottom: "12px" }}>
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldSubject")}</label>
                                            <input
                                                type="text"
                                                value={translationsMap[activeLanguage]?.subject ?? ""}
                                                onChange={(e) => setTranslationsMap((prev) => ({
                                                    ...prev,
                                                    [activeLanguage]: { ...prev[activeLanguage], subject: e.target.value },
                                                }))}
                                                onDrop={handleSubjectDrop}
                                                onDragOver={handleSubjectDragOver}
                                                placeholder={t("emailTemplatesModule", "fieldSubjectPlaceholder")}
                                            />
                                            {translationsMap[activeLanguage]?.subject && (
                                                <div style={{ marginTop: "8px", padding: "8px", background: "var(--scheme-neutral-1100)", borderRadius: "6px", color: "var(--scheme-neutral-500)", border: "1px solid var(--scheme-neutral-900)" }}>
                                                    {t("emailTemplatesModule", "subjectPreviewLabel")} <strong>{renderSubjectPreview()}</strong>
                                                </div>
                                            )}
                                        </div>

                                        {/* HTML content for active language */}
                                        <div className="config-field">
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldHtml")}</label>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
                                                <HtmlEditor
                                                    key={`${editingTemplate?.id ?? "new"}-${activeLanguage}`}
                                                    initialHtml={translationsMap[activeLanguage]?.htmlContent ?? ""}
                                                    onChange={(html) => setTranslationsMap((prev) => ({
                                                        ...prev,
                                                        [activeLanguage]: { ...prev[activeLanguage], htmlContent: html },
                                                    }))}
                                                    height="500px"
                                                />
                                                <DraggableVariables variables={[
                                                    // Variables filtered by email template type
                                                    ...getVariablesForEmailTemplate(formData.type, variables, t, activeLanguage),
                                                    // Editable sections as variables
                                                    ...Object.entries((formData.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                        name: key,
                                                        label: section.label || key,
                                                        description: section.description || t("pdfTemplateVariables", "editableSection"),
                                                    }))
                                                ]} />
                                            </div>
                                        </div>
                                    </div>

                                    <EditableSectionsEditor
                                        value={(formData.editableSections as any) || null}
                                        onChange={(sections) => setFormData({ ...formData, editableSections: sections as any })}
                                    />

                                    <div style={{ marginTop: "20px" }}>
                                        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                                            <button
                                                className="config-btn config-btn-secondary"
                                                onClick={() => setShowPreview(!showPreview)}
                                            >
                                                {showPreview ? t("emailTemplatesModule", "btnHidePreview") : t("emailTemplatesModule", "btnShowPreview")}
                                            </button>
                                            <button
                                                className="config-btn config-btn-secondary"
                                                onClick={() => setShowTestEmailInput(!showTestEmailInput)}
                                            >
                                                {t("emailTemplatesModule", "btnSendTest")}
                                            </button>
                                            {showTestEmailInput && (
                                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                    <input
                                                        type="email"
                                                        value={testEmailAddress}
                                                        onChange={(e) => setTestEmailAddress(e.target.value)}
                                                        placeholder={t("emailTemplatesModule", "testEmailPlaceholder")}
                                                        style={{ padding: "8px", border: "1px solid var(--scheme-neutral-900)", borderRadius: "4px", background: "var(--scheme-neutral-1200)", color: "var(--scheme-neutral-100)" }}
                                                    />
                                                    <button
                                                        className="config-btn config-btn-primary"
                                                        onClick={handleSendTest}
                                                        disabled={isSendingTest || !testEmailAddress || !formData.id}
                                                    >
                                                        {isSendingTest ? t("emailTemplatesModule", "sending") : t("emailTemplatesModule", "btnSend")}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!formData.id && showTestEmailInput && (
                                            <div style={{ color: "#f87171", fontSize: "12px", marginBottom: "16px" }}>
                                                {t("emailTemplatesModule", "errorNotSaved")}
                                            </div>
                                        )}

                                        {showPreview && (
                                            <div className="template-preview">
                                                <div className="template-preview-title">{t("emailTemplatesModule", "previewTitle")}</div>
                                                <div
                                                    style={{
                                                        border: "1px solid var(--scheme-neutral-900)",
                                                        padding: "20px",
                                                        background: "var(--scheme-neutral-1200)",
                                                        minHeight: "400px",
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: renderPreview() }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="template-editor-footer">
                                    <button className="config-btn config-btn-secondary" onClick={handleCancel}>
                                        {t("emailTemplatesModule", "btnCancel")}
                                    </button>
                                    <button className="config-btn config-btn-primary" onClick={handleSave}>
                                        {isCreating ? t("emailTemplatesModule", "btnCreate") : t("emailTemplatesModule", "btnSave")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <Menu
                        open={!!dropdownState.anchorEl}
                        anchorEl={dropdownState.anchorEl}
                        onClose={closeDropdown}
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                    >
                        {dropdownState.items.map((item) => (
                            <MenuItem
                                key={item.label}
                                onClick={() => { item.onClick(); closeDropdown(); }}
                                sx={{ color: item.danger ? "error.main" : "text.primary", gap: 1 }}
                            >
                                {item.icon && <Box component="span" sx={{ display: "inline-flex", width: 18 }}>{item.icon}</Box>}
                                {item.label}
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            )}
        </div>
    );
}
