"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { HtmlEditor } from "./HtmlEditor";
import { DraggableVariables } from "./DraggableVariables";
import {
    getPdfTemplates,
    createPdfTemplate,
    updatePdfTemplate,
    deletePdfTemplate,
    getTemplateVariables,
    type PdfTemplate,
    type TemplateVariable,
} from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";

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

/** Hardcoded variables available in price-history templates.
 *  These are injected by DownloadHistoryDialog — they are NOT in the DB. */
const PRICE_HISTORY_VARIABLES = [
    {
        name: "HISTORY_TABLES",
        label: "History Tables (all tariffs)",
        description: "All generated price-history tables (2.0TD + 3.0TD + 6.1TD). Place this where the tables should appear.",
    },
    {
        name: "HISTORY_TABLE_2TD",
        label: "History Table — 2.0 TD",
        description: "Price-history table for tariff 2.0TD only (P1–P3).",
    },
    {
        name: "HISTORY_TABLE_3TD",
        label: "History Table — 3.0 TD",
        description: "Price-history table for tariff 3.0TD only (P1–P6).",
    },
    {
        name: "HISTORY_TABLE_6TD",
        label: "History Table — 6.1 TD",
        description: "Price-history table for tariff 6.1TD only (P1–P6).",
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
        description: "Tariff code, e.g. 2.0TD",
    },
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
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
        setFormData({
            name: "",
            description: "",
            type: "simulation-output",
            active: true,
            htmlContent: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
    </style>
</head>
<body>
    <h1>New PDF Template</h1>
</body>
</html>`,
        });
        setIsCreating(true);
    };

    const handleEdit = (template: PdfTemplate) => {
        setFormData({ ...template });
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
            if (isCreating) {
                const newTemplate = await createPdfTemplate({
                    name: formData.name!,
                    description: formData.description!,
                    type: formData.type!,
                    active: formData.active ?? true,
                    htmlContent: formData.htmlContent!,
                });
                setTemplates([...templates, newTemplate]);
                onNotify(t("pdfTemplatesModule", "createdSuccess"), "success");
            } else if (editingTemplate) {
                const updated = await updatePdfTemplate(editingTemplate.id, formData);
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
        setShowPreview(false);
    };

    const renderPreview = () => {
        const html = formData.htmlContent || "";
        let sampleData = html;

        // Replace all variables with their example values
        variables.forEach((variable) => {
            const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, "g");
            sampleData = sampleData.replace(regex, variable.example || variable.label);
        });

        return sampleData;
    };

    const isEditorOpen = isCreating || editingTemplate !== null;

    return (
        <div className="template-table-container">
            {isLoading ? (
                <LoadingState message={t("pdfTemplatesModule", "loading")} />
            ) : (
                <>
                    <div className="template-table-header">
                        <h2 className="template-table-title">{t("pdfTemplatesModule", "title")}</h2>
                        <div className="template-table-actions">
                            <button className="config-btn config-btn-primary" onClick={handleCreate}>
                                {t("pdfTemplatesModule", "btnNew")}
                            </button>
                        </div>
                    </div>

                    <div className="template-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t("pdfTemplatesModule", "colName")}</th>
                                    <th>{t("pdfTemplatesModule", "colType")}</th>
                                    <th>{t("pdfTemplatesModule", "colDescription")}</th>
                                    <th>{t("pdfTemplatesModule", "colStatus")}</th>
                                    <th>{t("pdfTemplatesModule", "colUpdated")}</th>
                                    <th>{t("pdfTemplatesModule", "colActions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map((template) => (
                                    <tr key={template.id}>
                                        <td style={{ fontWeight: 600 }}>{template.name}</td>
                                        <td>
                                            <span className="template-type-badge">
                                                {TEMPLATE_TYPE_LABELS[template.type as PdfTemplateType]}
                                            </span>
                                        </td>
                                        <td style={{ color: "#6b7280", fontSize: "13px" }}>
                                            {template.description}
                                        </td>
                                        <td>
                                            <span className={`template-status-badge ${template.active ? "active" : "inactive"}`}>
                                                {template.active ? t("pdfTemplatesModule", "statusActive") : t("pdfTemplatesModule", "statusInactive")}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: "13px", color: "#6b7280" }}>
                                            {(() => { const d = new Date(template.updatedAt); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })()}
                                        </td>
                                        <td>
                                            <div className="template-row-actions">
                                                <button
                                                    className="template-action-btn"
                                                    onClick={() => handleEdit(template)}
                                                >
                                                    {t("pdfTemplatesModule", "btnEdit")}
                                                </button>
                                                <button
                                                    className="template-action-btn"
                                                    onClick={() => handleToggleActive(template.id)}
                                                >
                                                    {template.active ? t("pdfTemplatesModule", "btnDeactivate") : t("pdfTemplatesModule", "btnActivate")}
                                                </button>
                                                <button
                                                    className="template-action-btn delete"
                                                    onClick={() => handleDelete(template.id)}
                                                >
                                                    {t("pdfTemplatesModule", "btnDelete")}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

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
                                            color: "#6b7280",
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="template-editor-body">
                                    <div className="config-field">
                                        <label className="config-field-label">{t("pdfTemplatesModule", "fieldName")}</label>
                                        <input
                                            type="text"
                                            value={formData.name || ""}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder={t("pdfTemplatesModule", "fieldNamePlaceholder")}
                                        />
                                    </div>

                                    <div className="config-field">
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

                                    <div className="config-field">
                                        <label className="config-field-label">{t("pdfTemplatesModule", "fieldDescription")}</label>
                                        <input
                                            type="text"
                                            value={formData.description || ""}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder={t("pdfTemplatesModule", "fieldDescriptionPlaceholder")}
                                        />
                                    </div>

                                    <div className="config-field">
                                        <label className="config-field-inline">
                                            <input
                                                type="checkbox"
                                                checked={formData.active ?? true}
                                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                            />
                                            <span>{t("pdfTemplatesModule", "fieldActive")}</span>
                                        </label>
                                    </div>

                                    <div className="config-field">
                                        <label className="config-field-label">{t("pdfTemplatesModule", "fieldHtml")}</label>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
                                            <HtmlEditor
                                                key={editingTemplate?.id || "new-template"}
                                                initialHtml={formData.htmlContent || ""}
                                                onChange={(html) => setFormData({ ...formData, htmlContent: html })}
                                                height="500px"
                                            />
                                            <DraggableVariables variables={
                                                formData.type === "price-history"
                                                    ? PRICE_HISTORY_VARIABLES
                                                    : variables.map(v => ({
                                                        name: v.key,
                                                        label: v.label,
                                                        description: v.description || "",
                                                    }))
                                            } />
                                        </div>
                                    </div>

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
                                                        border: "2px solid #e5e7eb",
                                                        padding: "20px",
                                                        background: "white",
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
                </>
            )}
        </div>
    );
}
