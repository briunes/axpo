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
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { HtmlEditor } from "./HtmlEditor";
import { DraggableVariables } from "./DraggableVariables";
import { EditableSectionsEditor } from "./EditableSectionsEditor";
import {
    getPdfTemplates,
    createPdfTemplate,
    updatePdfTemplate,
    deletePdfTemplate,
    getTemplateVariables,
    type PdfTemplate,
    type PdfTemplateTranslationInput,
    type TemplateVariable,
} from "../../lib/configApi";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "../../../../src/lib/supportedLanguages";
import { LoadingState } from "../shared/LoadingState";
import { AITemplateBuilder, type AIGeneratedTemplate } from "./AITemplateBuilder";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef, SortState } from "../ui";

export interface PdfTemplatesProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

export type PdfTemplateType =
    | "simulation-output"
    | "simulation-detailed"
    | "contract"
    | "price-history"
    | "invoice"
    | "report";

const SIMULATION_REFERENCE_VARIABLE = {
    name: "SIMULATION_REFERENCE",
    label: "Simulation Reference",
    description: "Human-readable simulation reference number",
    example: "00123/2026",
};

/** Common metadata variables shared across all price-history templates (injected by DownloadHistoryDialog — NOT in the DB). */
const PRICE_HISTORY_COMMON_VARIABLES = [
    {
        name: "CLIENT_NAME",
        label: "Client Name",
        description: "Company or client name linked to the simulation",
    },
    {
        name: "SIMULATION_ID",
        label: "Simulation ID",
        description: "Unique simulation identifier",
    },
    {
        name: "SIMULATION_REFERENCE",
        label: SIMULATION_REFERENCE_VARIABLE.label,
        description: SIMULATION_REFERENCE_VARIABLE.description,
    },
    {
        name: "CREATED_AT",
        label: "Creation Date",
        description: "Date the simulation was created",
    },
    {
        name: "OWNER_NAME",
        label: "Owner Name",
        description: "Name of the commercial user who owns the simulation",
    },
    {
        name: "OWNER_EMAIL",
        label: "Owner Email",
        description: "Commercial email of the simulation owner",
    },
];

/** Electricity-specific price-history variables (injected by DownloadHistoryDialog — NOT in the DB). */
const PRICE_HISTORY_ELECTRICITY_VARIABLES = [
    {
        name: "HISTORY_TABLES",
        label: "History Tables (all electricity tariffs)",
        description: "All generated price-history tables (2.0TD + 3.0TD + 6.1TD). Place this where the tables should appear.",
    },
    {
        name: "HISTORY_TABLE_2TD",
        label: "History Table — 2.0 TD",
        description: "Price-history table for electricity tariff 2.0TD only (P1–P3).",
    },
    {
        name: "HISTORY_TABLE_3TD",
        label: "History Table — 3.0 TD",
        description: "Price-history table for electricity tariff 3.0TD only (P1–P6).",
    },
    {
        name: "HISTORY_TABLE_6TD",
        label: "History Table — 6.1 TD",
        description: "Price-history table for electricity tariff 6.1TD only (P1–P6).",
    },
    {
        name: "PRODUCT_LABEL",
        label: "Product Label",
        description: "Product name, e.g. \"Dinámica N1 - Perfil Normal\"",
    },
    {
        name: "PERFIL",
        label: "Load Profile",
        description: "Perfil Normal or Perfil Diurno",
    },
    {
        name: "TARIFA",
        label: "Access Tariff",
        description: "Electricity access tariff code, e.g. 2.0TD",
    },
    ...PRICE_HISTORY_COMMON_VARIABLES,
];

/** Gas-specific price-history variables (injected by DownloadHistoryDialog — NOT in the DB). */
const PRICE_HISTORY_GAS_VARIABLES = [
    {
        name: "HISTORY_TABLES_GAS",
        label: "Gas History Tables (all tariffs)",
        description: "All generated gas price-history tables. Place this where the tables should appear.",
    },
    {
        name: "HISTORY_TABLE_GAS",
        label: "Gas History Table",
        description: "Gas price-history table (all consumption bands).",
    },
    {
        name: "HISTORY_TABLE_GAS_R1",
        label: "Gas History Table — R1 (low consumption)",
        description: "Gas price-history for TUR band R1 — residential low consumption.",
    },
    {
        name: "HISTORY_TABLE_GAS_R2",
        label: "Gas History Table — R2 (medium consumption)",
        description: "Gas price-history for TUR band R2 — residential medium consumption.",
    },
    {
        name: "HISTORY_TABLE_GAS_R3",
        label: "Gas History Table — R3 (high consumption)",
        description: "Gas price-history for TUR band R3 — residential high consumption.",
    },
    {
        name: "GAS_PRODUCT_LABEL",
        label: "Gas Product Label",
        description: "Gas product name, e.g. \"Gas Estable N1\"",
    },
    {
        name: "GAS_TARIFA",
        label: "Gas Access Tariff",
        description: "Gas tariff code, e.g. TUR or RL3",
    },
    ...PRICE_HISTORY_COMMON_VARIABLES,
];

/**
 * Returns the correct variable list for the DraggableVariables panel
 * based on the selected template type and commodity.
 */
function getVariablesForTemplate(
    type: string | undefined,
    commodity: string | undefined,
    dbVariables: TemplateVariable[],
    t: ReturnType<typeof useI18n>["t"],
): Array<{ name: string; label: string; description: string }> {
    const c = commodity || "ELECTRICITY";
    const ensureSimulationReference = (
        templateVariables: Array<{ name: string; label: string; description: string }>,
    ) => {
        if (templateVariables.some((variable) => variable.name === SIMULATION_REFERENCE_VARIABLE.name)) {
            return templateVariables;
        }

        return [
            {
                name: SIMULATION_REFERENCE_VARIABLE.name,
                label: SIMULATION_REFERENCE_VARIABLE.label,
                description: SIMULATION_REFERENCE_VARIABLE.description,
            },
            ...templateVariables,
        ];
    };
    const translateBuiltInVariable = (variable: { name: string; label: string; description: string }) => {
        const label = t("pdfTemplateVariables", `${variable.name}_label`);
        const description = t("pdfTemplateVariables", `${variable.name}_description`);
        return {
            ...variable,
            label: label === `${variable.name}_label` ? variable.label : label,
            description: description === `${variable.name}_description` ? variable.description : description,
        };
    };

    if (type === "price-history") {
        return (c === "GAS" ? PRICE_HISTORY_GAS_VARIABLES : PRICE_HISTORY_ELECTRICITY_VARIABLES)
            .map(translateBuiltInVariable);
    }

    if (type === "simulation-output" || type === "simulation-detailed") {
        // Filter DB variables: include those that match the commodity OR have no commodity set
        const dbVars = dbVariables
            .filter((v) => !v.commodity || v.commodity === c)
            .map((v) => ({
                name: v.key,
                label: v.label,
                description: v.description || "",
            }));

        // Prepend the Comparativa chart variable
        return ensureSimulationReference([
            {
                name: "CHART_COMPARATIVA",
                label: t("pdfTemplateVariables", "CHART_COMPARATIVA_label"),
                description: t("pdfTemplateVariables", "CHART_COMPARATIVA_description"),
            },
            ...dbVars,
        ]);
    }

    // For contract, invoice, report, etc. — show only generic (client/user/simulation) vars
    return ensureSimulationReference(dbVariables
        .filter((v) => !v.templateTypes && !v.commodity)
        .map((v) => ({
            name: v.key,
            label: v.label,
            description: v.description || "",
        })));
}

export function PdfTemplatesNew({ session, onNotify }: PdfTemplatesProps) {
    const { t } = useI18n();
    const TEMPLATE_TYPE_LABELS: Record<PdfTemplateType, string> = {
        "simulation-output": t("pdfTemplatesModule", "typeSimulationOutput"),
        "simulation-detailed": t("pdfTemplatesModule", "typeDetailedSimulation"),
        "contract": t("pdfTemplatesModule", "typeContract"),
        "price-history": t("pdfTemplatesModule", "typePriceHistory"),
        "invoice": t("pdfTemplatesModule", "typeInvoice"),
        "report": t("pdfTemplatesModule", "typeReport"),
    };
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [variables, setVariables] = useState<TemplateVariable[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<PdfTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<Partial<PdfTemplate>>({});
    // translations map: languageCode -> { htmlContent }
    const [translationsMap, setTranslationsMap] = useState<Record<string, { htmlContent: string }>>({});
    const [activeLanguage, setActiveLanguage] = useState<string>(DEFAULT_LANGUAGE);
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
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
                getPdfTemplates(),
                getTemplateVariables(),
            ]);
            setTemplates(templatesData);
            setVariables(variablesData);
        } catch (error) {
            console.error("Failed to load data:", error);
            onNotify(t("pdfTemplatesModule", "loadError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            setIsLoading(true);
            const data = await getPdfTemplates();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to load templates:", error);
            onNotify(t("pdfTemplatesModule", "loadTemplatesError"), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        const defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        .mainbody { font-family: Arial, sans-serif; padding: 40px;  }
    </style>
</head>
<body>
<div class="mainbody">
    <h1>${t("pdfTemplatesModule", "defaultHtmlTitle")}</h1>
</div>
</body>
</html>`;
        const emptyMap = SUPPORTED_LANGUAGES.reduce<Record<string, { htmlContent: string }>>((acc, lang) => {
            acc[lang.code] = { htmlContent: lang.code === DEFAULT_LANGUAGE ? defaultHtml : "" };
            return acc;
        }, {});
        setTranslationsMap(emptyMap);
        setActiveLanguage(DEFAULT_LANGUAGE);
        setFormData({
            name: "",
            description: "",
            type: "simulation-output",
            commodity: "ELECTRICITY",
            active: true,
            htmlContent: defaultHtml,
        });
        setIsCreating(true);
    };

    const handleEdit = (template: PdfTemplate) => {
        setFormData({ ...template, commodity: template.commodity || "ELECTRICITY" });
        // Build translations map
        const map = SUPPORTED_LANGUAGES.reduce<Record<string, { htmlContent: string }>>((acc, lang) => {
            acc[lang.code] = { htmlContent: "" };
            return acc;
        }, {});
        (template.translations ?? []).forEach((tr) => {
            map[tr.languageCode] = { htmlContent: tr.htmlContent };
        });
        setTranslationsMap(map);
        setActiveLanguage(DEFAULT_LANGUAGE);
        setEditingTemplate(template);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("pdfTemplatesModule", "confirmDelete"))) return;

        try {
            await deletePdfTemplate(id);
            setTemplates(templates.filter(t => t.id !== id));
            onNotify(t("pdfTemplatesModule", "deletedSuccess"), "success");
        } catch (error) {
            onNotify(t("pdfTemplatesModule", "deletedError"), "error");
        }
    };

    const handleToggleActive = async (id: string) => {
        try {
            const template = templates.find(t => t.id === id);
            if (!template) return;

            await updatePdfTemplate(id, { active: !template.active });
            setTemplates(templates.map(t =>
                t.id === id ? { ...t, active: !t.active } : t
            ));
            onNotify(t("pdfTemplatesModule", "statusUpdated"), "success");
        } catch (error) {
            onNotify(t("pdfTemplatesModule", "updateError"), "error");
        }
    };

    const handleSave = async () => {
        try {
            const translations: PdfTemplateTranslationInput[] = Object.entries(translationsMap)
                .filter(([, val]) => val.htmlContent.trim())
                .map(([languageCode, val]) => ({
                    languageCode,
                    htmlContent: val.htmlContent,
                }));

            const primaryHtml =
                translationsMap[DEFAULT_LANGUAGE]?.htmlContent ||
                Object.values(translationsMap)[0]?.htmlContent ||
                formData.htmlContent ||
                "";

            const payload = {
                ...formData,
                htmlContent: primaryHtml,
                translations,
            };

            if (isCreating) {
                const newTemplate = await createPdfTemplate({
                    name: payload.name!,
                    description: payload.description!,
                    type: payload.type!,
                    commodity: payload.commodity || "ELECTRICITY",
                    active: payload.active ?? true,
                    htmlContent: primaryHtml,
                    translations,
                });
                setTemplates([...templates, newTemplate]);
                onNotify(t("pdfTemplatesModule", "createdSuccess"), "success");
            } else if (editingTemplate) {
                const updated = await updatePdfTemplate(editingTemplate.id, payload);
                setTemplates(templates.map(t =>
                    t.id === editingTemplate.id ? updated : t
                ));
                onNotify(t("pdfTemplatesModule", "updatedSuccess"), "success");
            }
            handleCancel();
        } catch (error) {
            onNotify(t("pdfTemplatesModule", "savedError"), "error");
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
        setFormData((prev) => ({
            ...prev,
            ...(result.name ? { name: result.name } : {}),
            ...(result.description ? { description: result.description } : {}),
            ...(result.type ? { type: result.type as PdfTemplateType } : {}),
            ...(result.commodity ? { commodity: result.commodity } : {}),
        }));
        // Fill in HTML content per language
        if (result.translations?.length) {
            setTranslationsMap((prev) => {
                const updated = { ...prev };
                result.translations.forEach((tr) => {
                    updated[tr.languageCode] = { htmlContent: tr.htmlContent };
                });
                return updated;
            });
            // Switch preview to first returned language
            setActiveLanguage(result.translations[0].languageCode);
        }
    };

    const renderPreview = () => {
        const html = translationsMap[activeLanguage]?.htmlContent || formData.htmlContent || "";
        let sampleData = html;

        // Replace all variables with their example values
        variables.forEach((variable) => {
            const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, "g");
            sampleData = sampleData.replace(regex, variable.example || variable.label);
        });
        sampleData = sampleData.replace(
            /\{\{SIMULATION_REFERENCE\}\}/g,
            SIMULATION_REFERENCE_VARIABLE.example,
        );

        return sampleData;
    };

    const formatDateTime = (value: string | Date) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "—";
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const getCommodityLabel = (commodity?: string | null) =>
        commodity === "GAS"
            ? (t("simulationForm", "gasLabel").trim() || "Gas")
            : (t("simulationForm", "electricityLabel").trim() || "Electricity");

    const filteredTemplates = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const rows = normalizedSearch
            ? templates.filter((template) => [
                template.name,
                template.description,
                TEMPLATE_TYPE_LABELS[template.type as PdfTemplateType],
                getCommodityLabel(template.commodity),
                template.active ? t("pdfTemplatesModule", "statusActive") : t("pdfTemplatesModule", "statusInactive"),
            ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch)))
            : [...templates];

        const direction = sortState.direction === "asc" ? 1 : -1;
        rows.sort((a, b) => {
            const getValue = (template: PdfTemplate) => {
                switch (sortState.column) {
                    case "name": return template.name ?? "";
                    case "type": return TEMPLATE_TYPE_LABELS[template.type as PdfTemplateType] ?? template.type ?? "";
                    case "commodity": return getCommodityLabel(template.commodity);
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

    const columns = useMemo<ColumnDef<PdfTemplate>[]>(() => [
        {
            key: "name",
            label: t("pdfTemplatesModule", "colName"),
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
            label: t("pdfTemplatesModule", "colType"),
            sortable: true,
            renderCell: (template) => (
                <StatusBadge
                    label={TEMPLATE_TYPE_LABELS[template.type as PdfTemplateType] ?? template.type}
                    tone="neutral"
                />
            ),
        },
        {
            key: "commodity",
            label: t("pdfTemplatesModule", "colCommodity") || "Commodity",
            sortable: true,
            renderCell: (template) => {
                const isGas = template.commodity === "GAS";
                const label = getCommodityLabel(template.commodity);
                const icon = isGas
                    ? <LocalFireDepartmentIcon sx={{ fontSize: 16, color: "#ef4444" }} />
                    : <BoltIcon sx={{ fontSize: 16, color: "#f59e0b" }} />;
                return (
                    <StatusBadge
                        label={label}
                        tone={isGas ? "danger" : "warning"}
                        icon={icon}
                    />
                );
            },
        },
        {
            key: "description",
            label: t("pdfTemplatesModule", "colDescription"),
            copyable: true,
            renderCell: (template) => (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                    {template.description || "—"}
                </Typography>
            ),
        },
        {
            key: "status",
            label: t("pdfTemplatesModule", "colStatus"),
            sortable: true,
            width: "120",
            renderCell: (template) => (
                <StatusBadge
                    label={template.active ? t("pdfTemplatesModule", "statusActive") : t("pdfTemplatesModule", "statusInactive")}
                    tone={template.active ? "success" : "neutral"}
                />
            ),
        },
        {
            key: "updatedAt",
            label: t("pdfTemplatesModule", "colUpdated"),
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
            label: t("pdfTemplatesModule", "colActions"),
            renderCell: (template) => {
                const secondaryItems = [
                    {
                        label: template.active ? t("pdfTemplatesModule", "btnDeactivate") : t("pdfTemplatesModule", "btnActivate"),
                        onClick: () => handleToggleActive(template.id),
                        icon: template.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />,
                        danger: template.active,
                    },
                    {
                        label: t("pdfTemplatesModule", "btnDelete"),
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
                                title={t("pdfTemplatesModule", "btnEdit")}
                                aria-label={t("pdfTemplatesModule", "btnEdit")}
                                sx={{ minWidth: "88px !important" }}
                            >
                                {t("pdfTemplatesModule", "btnEdit")}
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
                <LoadingState message={t("pdfTemplatesModule", "loading")} />
            ) : (
                <>
                    <DataTable<PdfTemplate>
                        tableId="pdf-templates"
                        columns={columns}
                        rows={pagedTemplates}
                        loading={isLoading}
                        searchValue={search}
                        onSearch={(value) => { setSearch(value); setPage(1); }}
                        onClearFilters={() => { setSearch(""); setPage(1); }}
                        searchPlaceholder={t("pdfTemplatesModule", "title")}
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
                            <Tooltip title={t("pdfTemplatesModule", "btnNew")} arrow>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleCreate}
                                    startIcon={<AddIcon fontSize="small" />}
                                    sx={{ whiteSpace: "nowrap" }}
                                >
                                    {t("pdfTemplatesModule", "btnNew").replace("+ ", "")}
                                </Button>
                            </Tooltip>
                        }
                        mobileCard={{
                            title: "name",
                            status: "status",
                            icon: (template) => template.commodity === "GAS"
                                ? <LocalFireDepartmentIcon sx={{ fontSize: 20, color: "#ef4444" }} />
                                : <BoltIcon sx={{ fontSize: 20, color: "#f59e0b" }} />,
                            fields: ["type", "commodity", "description", "updatedAt"],
                            actions: "actions",
                        }}
                    />

                    {isEditorOpen && (
                        <div className="template-editor-overlay" onClick={handleCancel}>
                            <div className="template-editor-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="template-editor-header">
                                    <h2>{isCreating ? t("pdfTemplatesModule", "modalTitleCreate") : t("pdfTemplatesModule", "modalTitleEdit")}</h2>
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
                                        mode="pdf"
                                        variables={getVariablesForTemplate(formData.type, formData.commodity ?? undefined, variables, t).map((variable) => ({
                                            key: variable.name,
                                            label: variable.label,
                                            description: variable.description,
                                        })) as TemplateVariable[]}
                                        isEditing={editingTemplate !== null}
                                        currentFormData={formData as Record<string, any>}
                                        currentTranslationsMap={translationsMap}
                                        onApply={handleAIApply}
                                        onNotify={onNotify}
                                        session={session}
                                    />

                                    {/* Row 1: Name, Type, and Commodity */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 200px", gap: "12px", marginBottom: "12px" }}>
                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("pdfTemplatesModule", "fieldName")}</label>
                                            <input
                                                type="text"
                                                value={formData.name || ""}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder={t("pdfTemplatesModule", "fieldNamePlaceholder")}
                                            />
                                        </div>

                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("pdfTemplatesModule", "fieldType")}</label>
                                            <select
                                                value={formData.type || "simulation-output"}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value as PdfTemplateType })}
                                            >
                                                {Object.entries(TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("pdfTemplatesModule", "fieldCommodity") || "Commodity"}</label>
                                            <select
                                                value={formData.commodity || "ELECTRICITY"}
                                                onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
                                            >
                                                <option value="ELECTRICITY">{t("pdfTemplatesModule", "commodityElectricity") || "Electricity Only"}</option>
                                                <option value="GAS">{t("pdfTemplatesModule", "commodityGas") || "Gas Only"}</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Row 2: Description and Active */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "end", marginBottom: "12px" }}>
                                        <div className="config-field" style={{ marginBottom: 0 }}>
                                            <label className="config-field-label">{t("pdfTemplatesModule", "fieldDescription")}</label>
                                            <input
                                                type="text"
                                                value={formData.description || ""}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                placeholder={t("pdfTemplatesModule", "fieldDescriptionPlaceholder")}
                                            />
                                        </div>

                                        <div className="config-field" style={{ marginBottom: 0, paddingBottom: "8px" }}>
                                            <label className="config-field-inline">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.active ?? true}
                                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                                />
                                                <span>{t("pdfTemplatesModule", "fieldActive")}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="config-field">
                                        <label className="config-field-label">{t("pdfTemplatesModule", "fieldHtml")}</label>

                                        {/* Language Tabs */}
                                        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--scheme-neutral-900)", marginBottom: "12px" }}>
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
                                                    {lang.flag} {lang.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
                                            <HtmlEditor
                                                key={`${editingTemplate?.id ?? "new"}-${activeLanguage}`}
                                                initialHtml={translationsMap[activeLanguage]?.htmlContent ?? ""}
                                                onChange={(html) => setTranslationsMap((prev) => ({
                                                    ...prev,
                                                    [activeLanguage]: { htmlContent: html },
                                                }))}
                                                height="500px"
                                            />
                                            <DraggableVariables variables={[
                                                // Variables filtered by template type and commodity
                                                ...getVariablesForTemplate(formData.type, formData.commodity ?? undefined, variables, t),
                                                // Editable sections as variables
                                                ...Object.entries((formData.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                    name: key,
                                                    label: section.label || key,
                                                    description: section.description || t("pdfTemplateVariables", "editableSection"),
                                                }))
                                            ]} />
                                        </div>
                                    </div>

                                    <EditableSectionsEditor
                                        value={(formData.editableSections as any) || null}
                                        onChange={(sections) => setFormData({ ...formData, editableSections: sections as any })}
                                    />

                                    <div style={{ marginTop: "20px" }}>
                                        <button
                                            className="config-btn config-btn-secondary"
                                            onClick={() => setShowPreview(!showPreview)}
                                            style={{ marginBottom: "16px" }}
                                        >
                                            {showPreview ? t("pdfTemplatesModule", "btnHidePreview") : t("pdfTemplatesModule", "btnShowPreview")}
                                        </button>

                                        {showPreview && (
                                            <div className="template-preview">
                                                <div className="template-preview-title">{t("pdfTemplatesModule", "previewTitle")}</div>
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
                                        {t("pdfTemplatesModule", "btnCancel")}
                                    </button>
                                    <button className="config-btn config-btn-primary" onClick={handleSave}>
                                        {isCreating ? t("pdfTemplatesModule", "btnCreate") : t("pdfTemplatesModule", "btnSave")}
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
