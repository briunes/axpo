"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";

export interface PdfTemplatesProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface PdfTemplate {
    id: string;
    name: string;
    description: string;
    type: "simulation" | "contract" | "report";
    active: boolean;
    template: string;
}

const MOCK_TEMPLATES: PdfTemplate[] = [
    {
        id: "simulation-default",
        name: "Default Simulation PDF",
        description: "Standard simulation output with pricing and product details",
        type: "simulation",
        active: true,
        template: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #0066cc; }
    .content { margin-top: 30px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .data-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .label { font-weight: 500; }
    .value { color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">AXPO Energy Simulation</div>
    <p>Simulation Code: {{simulationCode}}</p>
  </div>
  
  <div class="content">
    <div class="section">
      <div class="section-title">Client Information</div>
      <div class="data-row">
        <span class="label">Company:</span>
        <span class="value">{{clientName}}</span>
      </div>
      <div class="data-row">
        <span class="label">Contact:</span>
        <span class="value">{{contactPerson}}</span>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Simulation Results</div>
      <div class="data-row">
        <span class="label">Product:</span>
        <span class="value">{{productName}}</span>
      </div>
      <div class="data-row">
        <span class="label">Total Cost:</span>
        <span class="value">{{totalCost}}</span>
      </div>
    </div>
  </div>
</body>
</html>`,
    },
    {
        id: "simulation-detailed",
        name: "Detailed Simulation PDF",
        description: "Comprehensive simulation with charts and historical data",
        type: "simulation",
        active: false,
        template: "<!-- Detailed template here -->",
    },
    {
        id: "contract-template",
        name: "Contract Template",
        description: "Official contract document for client signature",
        type: "contract",
        active: true,
        template: "<!-- Contract template here -->",
    },
];

export function PdfTemplates({ session, onNotify }: PdfTemplatesProps) {
    const [templates, setTemplates] = useState<PdfTemplate[]>(MOCK_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate | null>(MOCK_TEMPLATES[0]);
    const [editedTemplate, setEditedTemplate] = useState<string>(MOCK_TEMPLATES[0].template);

    const handleSelectTemplate = (template: PdfTemplate) => {
        setSelectedTemplate(template);
        setEditedTemplate(template.template);
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;

        try {
            // TODO: Save template to API
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === selectedTemplate.id ? { ...t, template: editedTemplate } : t
                )
            );
            onNotify("PDF template saved successfully", "success");
        } catch (error) {
            onNotify("Failed to save PDF template", "error");
        }
    };

    const handleToggleActive = async (templateId: string) => {
        try {
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === templateId ? { ...t, active: !t.active } : t
                )
            );
            onNotify("Template status updated", "success");
        } catch (error) {
            onNotify("Failed to update template status", "error");
        }
    };

    return (
        <div className="config-panel">
            <div className="config-section">
                <h3 className="config-section-title">PDF Template Builder</h3>
                <p className="config-section-description">
                    Manage PDF templates for simulations, contracts, and reports. Use HTML with template variables like {`{{variableName}}`}.
                </p>

                <div className="template-list">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className={`template-card${selectedTemplate?.id === template.id ? " active" : ""}`}
                            onClick={() => handleSelectTemplate(template)}
                        >
                            <div className="template-card-title">{template.name}</div>
                            <div className="template-card-description">{template.description}</div>
                            <div style={{ marginTop: "12px", fontSize: "12px" }}>
                                <span
                                    style={{
                                        display: "inline-block",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        background: template.active ? "#10b981" : "#6b7280",
                                        color: "white",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                    }}
                                >
                                    {template.active ? "Active" : "Inactive"}
                                </span>
                                <span style={{ marginLeft: "8px", color: "#6b7280", textTransform: "capitalize" }}>
                                    {template.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedTemplate && (
                    <>
                        <div className="template-editor">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
                                    Editing: {selectedTemplate.name}
                                </h4>
                                <button
                                    className="config-btn config-btn-secondary"
                                    onClick={() => handleToggleActive(selectedTemplate.id)}
                                    style={{ padding: "6px 12px", fontSize: "13px" }}
                                >
                                    {selectedTemplate.active ? "Deactivate" : "Activate"}
                                </button>
                            </div>

                            <div className="config-field">
                                <label className="config-field-label">HTML Template</label>
                                <span className="config-field-description">
                                    Available variables: {`{{simulationCode}}`}, {`{{clientName}}`}, {`{{contactPerson}}`}, {`{{productName}}`}, {`{{totalCost}}`}
                                </span>
                                <textarea
                                    className="code-editor"
                                    value={editedTemplate}
                                    onChange={(e) => setEditedTemplate(e.target.value)}
                                    style={{ minHeight: "400px", fontFamily: "monospace" }}
                                />
                            </div>
                        </div>

                        <div className="template-preview">
                            <div className="template-preview-title">Preview (HTML Render)</div>
                            <div
                                style={{
                                    border: "1px solid #e5e7eb",
                                    padding: "20px",
                                    background: "white",
                                    minHeight: "300px",
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: editedTemplate
                                        .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
                                        .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.")
                                        .replace(/\{\{contactPerson\}\}/g, "John Doe")
                                        .replace(/\{\{productName\}\}/g, "Premium Energy Plan")
                                        .replace(/\{\{totalCost\}\}/g, "€1,250.00"),
                                }}
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="config-actions">
                <button
                    className="config-btn config-btn-primary"
                    onClick={handleSave}
                    disabled={!selectedTemplate}
                >
                    Save Template
                </button>
                <button
                    className="config-btn config-btn-secondary"
                    onClick={() => setEditedTemplate(selectedTemplate?.template || "")}
                    disabled={!selectedTemplate}
                >
                    Reset Changes
                </button>
            </div>
        </div>
    );
}
