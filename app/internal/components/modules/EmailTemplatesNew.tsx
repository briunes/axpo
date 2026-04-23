"use client";

import { useState, useEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { HtmlEditor } from "./HtmlEditor";
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
    type TemplateVariable,
} from "../../lib/configApi";
import { LoadingState } from "../shared/LoadingState";

export interface EmailTemplatesProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

export type EmailTemplateType =
    | "simulation-share"
    | "magic-link"
    | "welcome"
    | "user-welcome"
    | "password-reset"
    | "expiring-soon"
    | "converted"
    | "notification";

export function EmailTemplatesNew({ session, onNotify }: EmailTemplatesProps) {
    const { t } = useI18n();
    const TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
        "simulation-share": t("emailTemplatesModule", "typeSimulationShare"),
        "magic-link": t("emailTemplatesModule", "typeMagicLink"),
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
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showTestEmailInput, setShowTestEmailInput] = useState(false);
    const [testEmailAddress, setTestEmailAddress] = useState("");
    const [isSendingTest, setIsSendingTest] = useState(false);

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

    const handleCreate = () => {
        setFormData({
            name: "",
            description: "",
            type: "simulation-share",
            active: true,
            subject: "",
            htmlContent: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #374151; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>New Email Template</h1>
        <p>Your content here...</p>
    </div>
</body>
</html>`,
        });
        setIsCreating(true);
    };

    const handleEdit = (template: EmailTemplate) => {
        setFormData({ ...template });
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
            if (isCreating) {
                const newTemplate = await createEmailTemplate({
                    name: formData.name!,
                    description: formData.description!,
                    type: formData.type!,
                    active: formData.active ?? true,
                    subject: formData.subject!,
                    htmlContent: formData.htmlContent!,
                });
                setTemplates([...templates, newTemplate]);
                onNotify(t("emailTemplatesModule", "createdSuccess"), "success");
            } else if (editingTemplate) {
                const updated = await updateEmailTemplate(editingTemplate.id, formData);
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
        setShowPreview(false);
    };

    const handleSubjectDrop = (e: React.DragEvent<HTMLInputElement>) => {
        e.preventDefault();
        const variable = e.dataTransfer.getData("text/plain");
        const input = e.target as HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const text = input.value;
        const newValue = text.substring(0, start) + variable + text.substring(end);
        setFormData({ ...formData, subject: newValue });

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
        const html = formData.htmlContent || "";
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
            .replace(/\{\{magicLink\}\}/g, "https://axpo.example.com/login/magic/abc123");
        return sampleData;
    };

    const renderSubjectPreview = () => {
        const subject = formData.subject || "";
        return subject
            .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
            .replace(/\{\{userName\}\}/g, "John Doe")
            .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.");
    };

    const isEditorOpen = isCreating || editingTemplate !== null;

    return (
        <div className="template-table-container">
            {isLoading ? (
                <LoadingState message={t("emailTemplatesModule", "loading")} />
            ) : (
                <>
                    <div className="template-table-header">
                        <h2 className="template-table-title">{t("emailTemplatesModule", "title")}</h2>
                        <div className="template-table-actions">
                            <button className="config-btn config-btn-primary" onClick={handleCreate}>
                                {t("emailTemplatesModule", "btnNew")}
                            </button>
                        </div>
                    </div>

                    <div className="template-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t("emailTemplatesModule", "colName")}</th>
                                    <th>{t("emailTemplatesModule", "colType")}</th>
                                    <th>{t("emailTemplatesModule", "colSubject")}</th>
                                    <th>{t("emailTemplatesModule", "colStatus")}</th>
                                    <th>{t("emailTemplatesModule", "colUpdated")}</th>
                                    <th>{t("emailTemplatesModule", "colActions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map((template) => (
                                    <tr key={template.id}>
                                        <td style={{ fontWeight: 600 }}>{template.name}</td>
                                        <td>
                                            <span className="template-type-badge">
                                                {TEMPLATE_TYPE_LABELS[template.type as EmailTemplateType]}
                                            </span>
                                        </td>
                                        <td style={{ color: "#6b7280", fontSize: "13px", maxWidth: "300px" }}>
                                            {template.subject}
                                        </td>
                                        <td>
                                            <span className={`template-status-badge ${template.active ? "active" : "inactive"}`}>
                                                {template.active ? t("emailTemplatesModule", "statusActive") : t("emailTemplatesModule", "statusInactive")}
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
                                                    {t("emailTemplatesModule", "btnEdit")}
                                                </button>
                                                <button
                                                    className="template-action-btn"
                                                    onClick={() => handleToggleActive(template.id)}
                                                >
                                                    {template.active ? t("emailTemplatesModule", "btnDeactivate") : t("emailTemplatesModule", "btnActivate")}
                                                </button>
                                                <button
                                                    className="template-action-btn delete"
                                                    onClick={() => handleDelete(template.id)}
                                                >
                                                    {t("emailTemplatesModule", "btnDelete")}
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
                                    <h2>{isCreating ? t("emailTemplatesModule", "modalTitleCreate") : t("emailTemplatesModule", "modalTitleEdit")}</h2>
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
                                            <label className="config-field-label">{t("emailTemplatesModule", "fieldSubject")}</label>
                                            <input
                                                type="text"
                                                value={formData.subject || ""}
                                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                onDrop={handleSubjectDrop}
                                                onDragOver={handleSubjectDragOver}
                                                placeholder={t("emailTemplatesModule", "fieldSubjectPlaceholder")}
                                            />
                                            {formData.subject && (
                                                <div style={{ marginTop: "8px", padding: "8px", background: "#f9fafb", borderRadius: "6px", fontSize: "13px", color: "#6b7280" }}>
                                                    {t("emailTemplatesModule", "subjectPreviewLabel")} <strong>{renderSubjectPreview()}</strong>
                                                </div>
                                            )}
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

                                    <div className="config-field">
                                        <label className="config-field-label">{t("emailTemplatesModule", "fieldHtml")}</label>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
                                            <HtmlEditor
                                                key={editingTemplate?.id || "new-template"}
                                                initialHtml={formData.htmlContent || ""}
                                                onChange={(html) => setFormData({ ...formData, htmlContent: html })}
                                                height="500px"
                                            />
                                            <DraggableVariables variables={[
                                                // Regular template variables
                                                ...variables.map(v => ({
                                                    name: v.key,
                                                    label: v.label,
                                                    description: v.description || "",
                                                })),
                                                // Editable sections as variables
                                                ...Object.entries((formData.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                    name: key,
                                                    label: `📝 ${section.label || key}`,
                                                    description: section.description || "Editable section",
                                                }))
                                            ]} />
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
                                                        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
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
                                            <div style={{ color: "red", fontSize: "12px", marginBottom: "16px" }}>
                                                {t("emailTemplatesModule", "errorNotSaved")}
                                            </div>
                                        )}

                                        {showPreview && (
                                            <div className="template-preview">
                                                <div className="template-preview-title">{t("emailTemplatesModule", "previewTitle")}</div>
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
                                        {t("emailTemplatesModule", "btnCancel")}
                                    </button>
                                    <button className="config-btn config-btn-primary" onClick={handleSave}>
                                        {isCreating ? t("emailTemplatesModule", "btnCreate") : t("emailTemplatesModule", "btnSave")}
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
