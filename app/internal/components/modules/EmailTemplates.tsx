"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";

export interface EmailTemplatesProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface EmailTemplate {
    id: string;
    name: string;
    description: string;
    type: "simulation-share" | "magic-link" | "welcome" | "notification";
    active: boolean;
    subject: string;
    body: string;
}

const MOCK_EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: "simulation-share",
        name: "Simulation Share Email",
        description: "Email sent to clients when sharing a simulation",
        type: "simulation-share",
        active: true,
        subject: "Your AXPO Energy Simulation - {{simulationCode}}",
        body: `Dear {{contactPerson}},

Thank you for your interest in AXPO energy solutions.

We have prepared a personalized energy simulation for {{clientName}}. You can view the detailed results by clicking the link below:

{{simulationLink}}

Your access PIN is: {{pin}}

This simulation will be available for {{expirationDays}} days. If you have any questions or would like to discuss the results, please don't hesitate to contact me.

Best regards,
{{commercialName}}
{{commercialEmail}}
{{commercialPhone}}

---
AXPO Energy Solutions
`,
    },
    {
        id: "magic-link",
        name: "Magic Link Login",
        description: "Email with magic link for passwordless login",
        type: "magic-link",
        active: true,
        subject: "Your AXPO Login Link",
        body: `Hello {{userName}},

Click the link below to log in to your AXPO account:

{{magicLink}}

This link will expire in 15 minutes for security reasons.

If you did not request this login link, please ignore this email.

Best regards,
AXPO Team
`,
    },
    {
        id: "welcome-user",
        name: "Welcome New User",
        description: "Welcome email sent to new users",
        type: "welcome",
        active: true,
        subject: "Welcome to AXPO Simulator",
        body: `Welcome to AXPO Simulator, {{userName}}!

Your account has been created with the following details:

Email: {{userEmail}}
Role: {{userRole}}
Agency: {{agencyName}}

You can log in at: {{loginUrl}}

If you have any questions, please contact your administrator.

Best regards,
AXPO Team
`,
    },
    {
        id: "simulation-expiring",
        name: "Simulation Expiring Soon",
        description: "Notification sent when a simulation is about to expire",
        type: "notification",
        active: false,
        subject: "Reminder: Your Simulation Expires Soon - {{simulationCode}}",
        body: `Dear {{contactPerson}},

This is a friendly reminder that your energy simulation ({{simulationCode}}) will expire in {{daysRemaining}} days.

To review your simulation before it expires, please visit:
{{simulationLink}}

If you have any questions or need an extension, please contact us.

Best regards,
{{commercialName}}
AXPO Energy Solutions
`,
    },
];

export function EmailTemplates({ session, onNotify }: EmailTemplatesProps) {
    const [templates, setTemplates] = useState<EmailTemplate[]>(MOCK_EMAIL_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(
        MOCK_EMAIL_TEMPLATES[0]
    );
    const [editedSubject, setEditedSubject] = useState<string>(MOCK_EMAIL_TEMPLATES[0].subject);
    const [editedBody, setEditedBody] = useState<string>(MOCK_EMAIL_TEMPLATES[0].body);

    const handleSelectTemplate = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setEditedSubject(template.subject);
        setEditedBody(template.body);
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;

        try {
            // TODO: Save template to API
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === selectedTemplate.id
                        ? { ...t, subject: editedSubject, body: editedBody }
                        : t
                )
            );
            onNotify("Email template saved successfully", "success");
        } catch (error) {
            onNotify("Failed to save email template", "error");
        }
    };

    const handleToggleActive = async (templateId: string) => {
        try {
            setTemplates((prev) =>
                prev.map((t) => (t.id === templateId ? { ...t, active: !t.active } : t))
            );
            onNotify("Template status updated", "success");
        } catch (error) {
            onNotify("Failed to update template status", "error");
        }
    };

    const handleSendTest = () => {
        onNotify("Test email would be sent to your email address", "success");
    };

    return (
        <div className="config-panel">
            <div className="config-section">
                <h3 className="config-section-title">Email Template Builder</h3>
                <p className="config-section-description">
                    Manage email templates for notifications, sharing, and communications. Use template variables like {`{{variableName}}`}.
                </p>

                <div className="template-list">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className={`template-card${selectedTemplate?.id === template.id ? " active" : ""
                                }`}
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
                                <span
                                    style={{
                                        marginLeft: "8px",
                                        color: "#6b7280",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {template.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedTemplate && (
                    <>
                        <div className="template-editor">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "16px",
                                }}
                            >
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
                                <label className="config-field-label">Email Subject</label>
                                <span className="config-field-description">
                                    Available variables: {`{{simulationCode}}`}, {`{{userName}}`}, {`{{clientName}}`}, {`{{contactPerson}}`}
                                </span>
                                <input
                                    type="text"
                                    value={editedSubject}
                                    onChange={(e) => setEditedSubject(e.target.value)}
                                />
                            </div>

                            <div className="config-field">
                                <label className="config-field-label">Email Body</label>
                                <span className="config-field-description">
                                    Available variables: {`{{simulationCode}}`}, {`{{simulationLink}}`}, {`{{pin}}`}, {`{{commercialName}}`}, {`{{commercialEmail}}`}, {`{{commercialPhone}}`}, {`{{expirationDays}}`}
                                </span>
                                <textarea
                                    value={editedBody}
                                    onChange={(e) => setEditedBody(e.target.value)}
                                    style={{ minHeight: "300px" }}
                                />
                            </div>
                        </div>

                        <div className="template-preview">
                            <div className="template-preview-title">Preview (with sample data)</div>
                            <div
                                style={{
                                    border: "1px solid #e5e7eb",
                                    padding: "20px",
                                    background: "white",
                                    whiteSpace: "pre-wrap",
                                    fontFamily: "system-ui, sans-serif",
                                    fontSize: "14px",
                                    lineHeight: "1.6",
                                }}
                            >
                                <div style={{ fontWeight: "600", marginBottom: "12px", fontSize: "16px" }}>
                                    Subject: {editedSubject
                                        .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
                                        .replace(/\{\{userName\}\}/g, "John Doe")
                                        .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.")
                                        .replace(/\{\{contactPerson\}\}/g, "John Doe")}
                                </div>
                                <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
                                <div>
                                    {editedBody
                                        .replace(/\{\{simulationCode\}\}/g, "SIM-2026-001")
                                        .replace(/\{\{userName\}\}/g, "John Doe")
                                        .replace(/\{\{clientName\}\}/g, "Sample Company Ltd.")
                                        .replace(/\{\{contactPerson\}\}/g, "John Doe")
                                        .replace(/\{\{simulationLink\}\}/g, "https://axpo.example.com/sim/abc123")
                                        .replace(/\{\{pin\}\}/g, "1234")
                                        .replace(/\{\{commercialName\}\}/g, session.user.fullName)
                                        .replace(/\{\{commercialEmail\}\}/g, "commercial@axpo.com")
                                        .replace(/\{\{commercialPhone\}\}/g, "+351 123 456 789")
                                        .replace(/\{\{expirationDays\}\}/g, "30")
                                        .replace(/\{\{magicLink\}\}/g, "https://axpo.example.com/login/magic/abc123")
                                        .replace(/\{\{userEmail\}\}/g, "user@example.com")
                                        .replace(/\{\{userRole\}\}/g, "COMMERCIAL")
                                        .replace(/\{\{agencyName\}\}/g, "Lisbon Agency")
                                        .replace(/\{\{loginUrl\}\}/g, "https://axpo.example.com/internal/login")
                                        .replace(/\{\{daysRemaining\}\}/g, "3")}
                                </div>
                            </div>
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
                    onClick={handleSendTest}
                    disabled={!selectedTemplate}
                >
                    Send Test Email
                </button>
                <button
                    className="config-btn config-btn-secondary"
                    onClick={() => {
                        setEditedSubject(selectedTemplate?.subject || "");
                        setEditedBody(selectedTemplate?.body || "");
                    }}
                    disabled={!selectedTemplate}
                >
                    Reset Changes
                </button>
            </div>
        </div>
    );
}
