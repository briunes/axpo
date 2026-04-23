"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getClient, shareSimulation } from "../../../lib/internalApi";
import {
    getPdfTemplates,
    getEmailTemplates,
    getTemplateVariables,
    type PdfTemplate,
    type EmailTemplate,
    type TemplateVariable,
} from "../../../lib/configApi";
import { HtmlEditor } from "../../../components/modules/HtmlEditor";
import { DraggableVariables } from "../../../components/modules/DraggableVariables";
import { extractVariableValues, replaceVariables as replaceVars } from "@/infrastructure/pdf/variableReplacer";
import type { EditableSectionOverrides, EditableSectionsConfig } from "@/infrastructure/templates/editableSections";
import { mergeEditableSections } from "@/infrastructure/templates/editableSections";
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
    Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { LoadingState } from "../../../components/shared";

type ShareMode = "pdf" | "email";

interface ShareSimulationViewProps {
    simulation: any;
    token: string;
    isTestingMode?: boolean;
    loggedUserEmail?: string;
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
    onStatusChange?: () => void;
}

export function ShareSimulationView({ simulation, token, isTestingMode, loggedUserEmail, onSuccess, onError, onStatusChange }: ShareSimulationViewProps) {
    const { t } = useI18n();

    const [shareMode, setShareMode] = useState<ShareMode>("pdf");
    const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([]);
    const [selectedPdfTemplate, setSelectedPdfTemplate] = useState<string>("");
    const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>("");
    const [selectedEmailPdfTemplate, setSelectedEmailPdfTemplate] = useState<string>("");
    const [editedPdfContent, setEditedPdfContent] = useState("");
    const [editedEmailContent, setEditedEmailContent] = useState("");
    const [editedEmailPdfContent, setEditedEmailPdfContent] = useState("");
    const [editedSubject, setEditedSubject] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [attachPdfToEmail, setAttachPdfToEmail] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [templateViewMode, setTemplateViewMode] = useState<"preview" | "edit">("preview");
    const [pdfTemplateViewMode, setPdfTemplateViewMode] = useState<"preview" | "edit">("preview");
    const [activeTab, setActiveTab] = useState<"email" | "pdf">("email");

    // Editable sections state
    const [pdfEditableOverrides, setPdfEditableOverrides] = useState<EditableSectionOverrides>({});
    const [emailEditableOverrides, setEmailEditableOverrides] = useState<EditableSectionOverrides>({});
    const [emailPdfEditableOverrides, setEmailPdfEditableOverrides] = useState<EditableSectionOverrides>({});

    useEffect(() => {
        Promise.all([
            getPdfTemplates({ active: true, excludeType: "price-history" }),
            getEmailTemplates({ active: true, excludeType: "price-history" }),
            getTemplateVariables(),
        ])
            .then(async ([pdfTpl, emailTpl, variables]) => {
                // Get simulation type from payload (defaults to ELECTRICITY if not specified)
                const payload = simulation.payloadJson as { type?: "ELECTRICITY" | "GAS" } | null;
                const simulationType = payload?.type || "ELECTRICITY";

                // Filter PDF templates by commodity and type
                const simulationPdfTemplates = pdfTpl.filter((t) => {
                    // Must be simulation template type
                    if (t.type !== "simulation-output" && t.type !== "simulation-detailed") return false;

                    // Filter by commodity - treat null/undefined as ELECTRICITY
                    const templateCommodity = t.commodity || "ELECTRICITY";
                    return templateCommodity === simulationType;
                });

                const simulationEmailTemplates = emailTpl.filter(
                    (t) => t.type === "simulation-share"
                );

                setPdfTemplates(simulationPdfTemplates);
                setEmailTemplates(simulationEmailTemplates);
                setTemplateVariables(variables);

                // Set default selections
                const defaultPdf = simulationPdfTemplates.find((t) => t.active);
                const defaultEmail = simulationEmailTemplates.find((t) => t.active);
                if (defaultPdf) {
                    setSelectedPdfTemplate(defaultPdf.id);
                    setEditedPdfContent(defaultPdf.htmlContent);
                    setSelectedEmailPdfTemplate(defaultPdf.id);
                    setEditedEmailPdfContent(defaultPdf.htmlContent);
                    // Seed editable section defaults so variables resolve immediately
                    if (defaultPdf.editableSections) {
                        const defaults = Object.fromEntries(
                            Object.entries(defaultPdf.editableSections).map(([k, v]) => [k, v.default])
                        );
                        setPdfEditableOverrides(defaults);
                        setEmailPdfEditableOverrides(defaults);
                    }
                }
                if (defaultEmail) {
                    setSelectedEmailTemplate(defaultEmail.id);
                    setEditedEmailContent(defaultEmail.htmlContent);
                    setEditedSubject(defaultEmail.subject);
                    // Seed editable section defaults
                    if (defaultEmail.editableSections) {
                        const defaults = Object.fromEntries(
                            Object.entries(defaultEmail.editableSections).map(([k, v]) => [k, v.default])
                        );
                        setEmailEditableOverrides(defaults);
                    }
                }

                // Pre-fill recipient email
                if (isTestingMode && loggedUserEmail) {
                    // Testing mode: always use the logged-in user's email
                    setRecipientEmail(loggedUserEmail);
                } else if (simulation.clientId) {
                    try {
                        const clientData = await getClient(token, simulation.clientId);
                        if (clientData.contactEmail) {
                            setRecipientEmail(clientData.contactEmail);
                        }
                    } catch (err) {
                        // Client data not available, that's okay
                    }
                }
            })
            .catch((err) => {
                onError?.(err.message || "Failed to load templates");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [simulation, token]);

    const handleTemplateChange = (templateId: string) => {
        if (shareMode === "pdf") {
            setSelectedPdfTemplate(templateId);
            const template = pdfTemplates.find((t) => t.id === templateId);
            if (template) {
                setEditedPdfContent(template.htmlContent);
                const defaults = template.editableSections
                    ? Object.fromEntries(Object.entries(template.editableSections).map(([k, v]) => [k, v.default]))
                    : {};
                setPdfEditableOverrides(defaults);
            }
        } else {
            setSelectedEmailTemplate(templateId);
            const template = emailTemplates.find((t) => t.id === templateId);
            if (template) {
                setEditedEmailContent(template.htmlContent);
                setEditedSubject(template.subject);
                const defaults = template.editableSections
                    ? Object.fromEntries(Object.entries(template.editableSections).map(([k, v]) => [k, v.default]))
                    : {};
                setEmailEditableOverrides(defaults);
            }
        }
    };

    const handleShareModeChange = (mode: ShareMode) => {
        setShareMode(mode);
    };

    // Editable section inline editing modal state
    const [editingSection, setEditingSection] = useState<{
        key: string;
        label: string;
        value: string;
        multiline: boolean;
        maxLength?: number;
        onSave: (val: string) => void;
    } | null>(null);

    const replaceVariables = (
        content: string,
        simulationLink?: string,
        editableOverrides?: EditableSectionOverrides,
        templateSections?: EditableSectionsConfig | null,
    ) => {
        if (!simulation) return content;

        const payload = simulation.payloadJson;
        const variableValues = extractVariableValues(simulation, payload, {
            pin: simulation.pinSnapshot ?? undefined,
            ...(simulationLink ? { simulationLink } : {}),
        });
        // Merge: use override value if set, otherwise fall back to section default
        if (templateSections) {
            const merged = mergeEditableSections(templateSections, editableOverrides);
            Object.assign(variableValues, merged);
        } else if (editableOverrides) {
            Object.assign(variableValues, editableOverrides);
        }
        return replaceVars(content, variableValues);
    };

    /**
     * Like replaceVariables but wraps editable section values in clickable
     * zones with a subtle dashed border so users can click to edit inline.
     */
    const replaceVariablesWithZones = (
        content: string,
        editableOverrides: EditableSectionOverrides,
        templateSections: EditableSectionsConfig,
        simulationLink?: string,
    ) => {
        if (!simulation) return content;
        const payload = simulation.payloadJson;
        const variableValues = extractVariableValues(simulation, payload, {
            pin: simulation.pinSnapshot ?? undefined,
            ...(simulationLink ? { simulationLink } : {}),
        });
        let result = replaceVars(content, variableValues);
        const merged = mergeEditableSections(templateSections, editableOverrides);
        for (const key of Object.keys(templateSections)) {
            const value = merged[key] ?? "";
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            result = result.replace(
                regex,
                `<span data-editable-key="${key}" style="outline:2px dashed #e53935;outline-offset:4px;border-radius:3px;cursor:pointer;position:relative;display:inline-block;min-width:40px;" title="Click to edit">${value}<span aria-hidden="true" style="position:absolute;top:-9px;right:-9px;background:#e53935;color:white;border-radius:50%;width:18px;height:18px;font-size:10px;line-height:18px;text-align:center;pointer-events:none;">✎</span></span>`,
            );
        }
        return result;
    };

    const handlePreviewClick = (
        e: React.MouseEvent<HTMLDivElement>,
        templateSections: EditableSectionsConfig,
        overrides: EditableSectionOverrides,
        setOverrides: (o: EditableSectionOverrides) => void,
    ) => {
        const target = (e.target as HTMLElement).closest("[data-editable-key]") as HTMLElement | null;
        if (!target) return;
        const key = target.getAttribute("data-editable-key");
        if (!key || !templateSections[key]) return;
        const def = templateSections[key];
        setEditingSection({
            key,
            label: def.label,
            value: overrides[key] ?? def.default,
            multiline: def.multiline ?? true,
            maxLength: def.maxLength,
            onSave: (val) => {
                setOverrides({ ...overrides, [key]: val });
                setEditingSection(null);
            },
        });
    };

    const handleDownloadPdf = async (markAsShared: boolean = false) => {
        setIsSending(true);
        try {
            // When producing the final (shared) PDF, share the simulation first so
            // the publicToken is available for SIMULATION_LINK variable replacement.
            let simulationLink: string | undefined;
            if (markAsShared) {
                try {
                    const shared = await shareSimulation(token, simulation.id);
                    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://tuenergia.axpoiberia.es";
                    if (shared.publicToken) {
                        simulationLink = `${baseUrl}/simulador/?token=${shared.publicToken}`;
                    }
                    onStatusChange?.();
                } catch (err) {
                    console.error("Failed to share simulation before downloading PDF:", err);
                }
            }

            const processedContent = replaceVariables(editedPdfContent, simulationLink, pdfEditableOverrides);

            const response = await fetch(`/api/v1/internal/simulations/${simulation.id}/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    htmlContent: processedContent,
                    watermark: isTestingMode ? 'TESTING' : (!markAsShared ? 'DRAFT' : undefined),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `simulation-${simulation.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            onSuccess?.(t("shareSimulation", "pdfDownloaded") || "PDF downloaded successfully");
            return true;
        } catch (err) {
            onError?.(err instanceof Error ? err.message : "Failed to download PDF");
            return false;
        } finally {
            setIsSending(false);
        }
    };

    const handleSendEmail = async () => {
        if (!recipientEmail) {
            onError?.(t("shareSimulation", "emailRequired") || "Email is required");
            return false;
        }

        setIsSending(true);
        try {
            // Share the simulation first so a publicToken is generated and the
            // SIMULATION_LINK variable resolves to a real URL instead of N/A.
            let simulationLink: string | undefined;
            try {
                const shared = await shareSimulation(token, simulation.id);
                const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://tuenergia.axpoiberia.es";
                if (shared.publicToken) {
                    simulationLink = `${baseUrl}/simulador/?token=${shared.publicToken}`;
                }
                onStatusChange?.();
            } catch (err) {
                console.error("Failed to share simulation before sending email:", err);
            }

            const processedContent = replaceVariables(editedEmailContent, simulationLink, emailEditableOverrides);
            const processedSubject = replaceVariables(editedSubject, simulationLink);
            let processedPdfContent = attachPdfToEmail ? replaceVariables(editedEmailPdfContent, simulationLink, emailPdfEditableOverrides) : undefined;
            if (processedPdfContent && isTestingMode) {
                const watermarkCss = `<style>@media print{body::before{content:"TESTING";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;font-weight:bold;color:rgba(0,0,0,0.08);z-index:9999;pointer-events:none;white-space:nowrap;font-family:Arial,sans-serif;letter-spacing:0.1em;}}</style>`;
                processedPdfContent = processedPdfContent.includes("</head>")
                    ? processedPdfContent.replace("</head>", `${watermarkCss}\n</head>`)
                    : `${watermarkCss}\n${processedPdfContent}`;
            }

            const response = await fetch(`/api/v1/internal/simulations/${simulation.id}/send-email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject: processedSubject,
                    htmlContent: processedContent,
                    pdfHtmlContent: processedPdfContent,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to send email");
            }

            onSuccess?.(t("shareSimulation", "emailSent") || "Email sent successfully");
            return true;
        } catch (err) {
            onError?.(err instanceof Error ? err.message : "Failed to send email");
            return false;
        } finally {
            setIsSending(false);
        }
    };

    const currentTemplate = shareMode === "pdf"
        ? pdfTemplates.find((t) => t.id === selectedPdfTemplate)
        : emailTemplates.find((t) => t.id === selectedEmailTemplate);

    if (isLoading) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <LoadingState size={100} message={t("shareSimulation", "loading") || "Loading..."} />
            </Box>
        );
    }

    const sec = editingSection;

    return (
        <>
            <Stack spacing={3} sx={{ p: 2 }}>
                {/* Share Mode and Template Selection */}
                <Card>
                    <CardContent>
                        <Box sx={{ display: "flex", gap: 3, flexDirection: { xs: "column", md: "row" } }}>
                            {/* Share Mode Selection */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" gutterBottom>
                                    {t("shareSimulation", "selectMode") || "Select Mode"}
                                </Typography>
                                <RadioGroup
                                    value={shareMode}
                                    onChange={(e) => handleShareModeChange(e.target.value as ShareMode)}
                                >
                                    <FormControlLabel
                                        value="pdf"
                                        control={<Radio />}
                                        label={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <DownloadIcon />
                                                {t("shareSimulation", "downloadPdfAndShare") || "Download PDF and Share"}
                                            </Box>
                                        }
                                    />
                                    <FormControlLabel
                                        value="email"
                                        control={<Radio />}
                                        label={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <SendIcon />
                                                {t("shareSimulation", "sendEmail") || "Send Email"}
                                            </Box>
                                        }
                                    />
                                </RadioGroup>
                            </Box>

                            {/* Template Selection */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" gutterBottom>
                                    {t("shareSimulation", "selectTemplate") || "Select Template"}
                                </Typography>
                                <FormControl fullWidth>
                                    <InputLabel>{t("shareSimulation", "selectTemplate") || "Template"}</InputLabel>
                                    <Select
                                        value={shareMode === "pdf" ? selectedPdfTemplate : selectedEmailTemplate}
                                        onChange={(e) => handleTemplateChange(e.target.value)}
                                        label={t("shareSimulation", "selectTemplate") || "Template"}
                                    >
                                        {(shareMode === "pdf" ? pdfTemplates : emailTemplates).map((template) => (
                                            <MenuItem key={template.id} value={template.id}>
                                                <Box>
                                                    <Typography variant="body2">{template.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {template.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Email Recipient (only for email mode) */}
                {shareMode === "email" && (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {t("shareSimulation", "recipient") || "Recipient"}
                            </Typography>
                            <TextField
                                fullWidth
                                type="email"
                                label={t("shareSimulation", "recipientEmail") || "Email"}
                                value={recipientEmail}
                                onChange={(e) => !isTestingMode && setRecipientEmail(e.target.value)}
                                placeholder="client@example.com"
                                disabled={isTestingMode}
                                helperText={isTestingMode ? "Testing mode: email will be sent to your account only" : undefined}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Attach PDF to Email (only for email mode) */}
                {shareMode === "email" && (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {t("shareSimulation", "attachPdf") || "Attach PDF to email"}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={attachPdfToEmail}
                                            onChange={(e) => setAttachPdfToEmail(e.target.checked)}
                                        />
                                    }
                                    label={t("shareSimulation", "attachPdfLabel") || "Include PDF attachment"}
                                />
                                {attachPdfToEmail && (
                                    <FormControl sx={{ flex: 1 }}>
                                        <InputLabel>{t("shareSimulation", "selectPdfTemplate") || "PDF Template"}</InputLabel>
                                        <Select
                                            value={selectedEmailPdfTemplate}
                                            onChange={(e) => {
                                                const templateId = e.target.value;
                                                setSelectedEmailPdfTemplate(templateId);
                                                const template = pdfTemplates.find((t) => t.id === templateId);
                                                if (template) setEditedEmailPdfContent(template.htmlContent);
                                            }}
                                            label={t("shareSimulation", "selectPdfTemplate") || "PDF Template"}
                                        >
                                            {pdfTemplates.map((template) => (
                                                <MenuItem key={template.id} value={template.id}>
                                                    <Box>
                                                        <Typography variant="body2">{template.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {template.description}
                                                        </Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Template Editor / Preview */}
                {currentTemplate && (
                    <Card>
                        <CardContent>
                            {/* Tabs for Email mode - always show tabs */}
                            {shareMode === "email" ? (
                                <>
                                    <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
                                        <Tab label={t("shareSimulation", "tabPreviewEmail") || "Preview Email"} value="email" />
                                        {attachPdfToEmail && selectedEmailPdfTemplate && (
                                            <Tab label={t("shareSimulation", "tabPreviewPdf") || "Preview PDF"} value="pdf" />
                                        )}
                                    </Tabs>

                                    {/* Email Tab */}
                                    {activeTab === "email" && (
                                        <>
                                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 2 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={templateViewMode === "edit" ? <VisibilityIcon /> : <EditIcon />}
                                                    onClick={() => setTemplateViewMode(templateViewMode === "edit" ? "preview" : "edit")}
                                                >
                                                    {templateViewMode === "edit"
                                                        ? t("shareSimulation", "btnPreviewEmailTemplate") || "Preview"
                                                        : t("shareSimulation", "btnEditEmailTemplate") || "Edit"}
                                                </Button>
                                            </Box>

                                            {templateViewMode === "edit" ? (
                                                <>
                                                    <TextField
                                                        fullWidth
                                                        label={t("shareSimulation", "subject") || "Subject"}
                                                        value={editedSubject}
                                                        onChange={(e) => setEditedSubject(e.target.value)}
                                                        sx={{ mb: 2 }}
                                                    />
                                                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 2 }}>
                                                        <HtmlEditor
                                                            key={`email-${selectedEmailTemplate}`}
                                                            initialHtml={editedEmailContent}
                                                            onChange={setEditedEmailContent}
                                                            height="500px"
                                                        />
                                                        <DraggableVariables
                                                            variables={[
                                                                // Regular template variables
                                                                ...templateVariables.map(v => ({
                                                                    name: v.key,
                                                                    label: v.label,
                                                                    description: v.description || "",
                                                                })),
                                                                // Editable sections from current template
                                                                ...Object.entries((currentTemplate?.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                                    name: key,
                                                                    label: `📝 ${section.label || key}`,
                                                                    description: section.description || "Editable section",
                                                                }))
                                                            ]}
                                                        />
                                                    </Box>
                                                </>
                                            ) : (
                                                <>
                                                    {currentTemplate?.editableSections && (
                                                        <Box sx={{ mb: 1.5, fontSize: "0.75rem", color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: "#e53935" }} />
                                                            Click highlighted sections to edit them
                                                        </Box>
                                                    )}
                                                    <Paper
                                                        variant="outlined"
                                                        sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                                        onClick={(e) => currentTemplate?.editableSections && handlePreviewClick(e, currentTemplate.editableSections as EditableSectionsConfig, emailEditableOverrides, setEmailEditableOverrides)}
                                                        dangerouslySetInnerHTML={{
                                                            __html: currentTemplate?.editableSections
                                                                ? replaceVariablesWithZones(editedEmailContent, emailEditableOverrides, currentTemplate.editableSections as EditableSectionsConfig)
                                                                : replaceVariables(editedEmailContent, undefined, emailEditableOverrides),
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}

                                    {/* PDF Tab */}
                                    {activeTab === "pdf" && attachPdfToEmail && selectedEmailPdfTemplate && (() => {
                                        const emailPdfTpl = pdfTemplates.find(t => t.id === selectedEmailPdfTemplate);
                                        return (
                                            <>
                                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 2 }}>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={pdfTemplateViewMode === "edit" ? <VisibilityIcon /> : <EditIcon />}
                                                        onClick={() => setPdfTemplateViewMode(pdfTemplateViewMode === "edit" ? "preview" : "edit")}
                                                    >
                                                        {pdfTemplateViewMode === "edit"
                                                            ? t("shareSimulation", "btnPreviewPdfTemplate") || "Preview"
                                                            : t("shareSimulation", "btnEditPdfTemplate") || "Edit"}
                                                    </Button>
                                                </Box>

                                                {pdfTemplateViewMode === "edit" ? (
                                                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 2 }}>
                                                        <HtmlEditor
                                                            key={`email-pdf-${selectedEmailPdfTemplate}`}
                                                            initialHtml={editedEmailPdfContent}
                                                            onChange={setEditedEmailPdfContent}
                                                            height="500px"
                                                        />
                                                        <DraggableVariables
                                                            variables={[
                                                                // Regular template variables
                                                                ...templateVariables.map(v => ({
                                                                    name: v.key,
                                                                    label: v.label,
                                                                    description: v.description || "",
                                                                })),
                                                                // Editable sections from current PDF template
                                                                ...Object.entries((emailPdfTpl?.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                                    name: key,
                                                                    label: `📝 ${section.label || key}`,
                                                                    description: section.description || "Editable section",
                                                                }))
                                                            ]}
                                                        />
                                                    </Box>
                                                ) : (
                                                    <>
                                                        {emailPdfTpl?.editableSections && (
                                                            <Box sx={{ mb: 1.5, fontSize: "0.75rem", color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: "#e53935" }} />
                                                                Click highlighted sections to edit them
                                                            </Box>
                                                        )}
                                                        <Paper
                                                            variant="outlined"
                                                            sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                                            onClick={(e) => emailPdfTpl?.editableSections && handlePreviewClick(e, emailPdfTpl.editableSections as EditableSectionsConfig, emailPdfEditableOverrides, setEmailPdfEditableOverrides)}
                                                            dangerouslySetInnerHTML={{
                                                                __html: emailPdfTpl?.editableSections
                                                                    ? replaceVariablesWithZones(editedEmailPdfContent, emailPdfEditableOverrides, emailPdfTpl.editableSections as EditableSectionsConfig)
                                                                    : replaceVariables(editedEmailPdfContent, undefined, emailPdfEditableOverrides),
                                                            }}
                                                        />
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </>
                            ) : (
                                <>
                                    {/* PDF Download Mode - Edit/Preview toggle + always-on live preview when editable sections exist */}
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                                        <Typography variant="h6">
                                            {templateViewMode === "edit"
                                                ? t("shareSimulation", "editTemplate") || "Edit Template"
                                                : t("shareSimulation", "previewTemplate") || "Preview Template"}
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={templateViewMode === "edit" ? <VisibilityIcon /> : <EditIcon />}
                                            onClick={() => setTemplateViewMode(templateViewMode === "edit" ? "preview" : "edit")}
                                        >
                                            {templateViewMode === "edit"
                                                ? t("shareSimulation", "previewTemplate") || "Preview"
                                                : t("shareSimulation", "editTemplate") || "Edit"}
                                        </Button>
                                    </Box>

                                    {templateViewMode === "edit" ? (
                                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 2 }}>
                                            <HtmlEditor
                                                key={`pdf-${selectedPdfTemplate}`}
                                                initialHtml={editedPdfContent}
                                                onChange={setEditedPdfContent}
                                                height="500px"
                                            />
                                            <DraggableVariables
                                                variables={[
                                                    // Regular template variables
                                                    ...templateVariables.map(v => ({
                                                        name: v.key,
                                                        label: v.label,
                                                        description: v.description || "",
                                                    })),
                                                    // Editable sections from current template
                                                    ...Object.entries((currentTemplate?.editableSections as any) || {}).map(([key, section]: [string, any]) => ({
                                                        name: key,
                                                        label: `📝 ${section.label || key}`,
                                                        description: section.description || "Editable section",
                                                    }))
                                                ]}
                                            />
                                        </Box>
                                    ) : (
                                        <>
                                            {currentTemplate?.editableSections && (
                                                <Box sx={{ mb: 1.5, fontSize: "0.75rem", color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: "#e53935" }} />
                                                    Click highlighted sections to edit them
                                                </Box>
                                            )}
                                            <Paper
                                                variant="outlined"
                                                sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                                onClick={(e) => currentTemplate?.editableSections && handlePreviewClick(e, currentTemplate.editableSections as EditableSectionsConfig, pdfEditableOverrides, setPdfEditableOverrides)}
                                                dangerouslySetInnerHTML={{
                                                    __html: currentTemplate?.editableSections
                                                        ? replaceVariablesWithZones(editedPdfContent, pdfEditableOverrides, currentTemplate.editableSections as EditableSectionsConfig)
                                                        : replaceVariables(editedPdfContent, undefined, pdfEditableOverrides),
                                                }}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                    {shareMode === "pdf" && (
                        <Button
                            variant="outlined"
                            onClick={() => handleDownloadPdf(false)}
                            disabled={isSending || !currentTemplate}
                            startIcon={<DownloadIcon />}
                        >
                            {t("shareSimulation", "downloadOnly") || "Download PDF"}
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={shareMode === "pdf" ? () => handleDownloadPdf(true) : handleSendEmail}
                        disabled={
                            isSending ||
                            !currentTemplate ||
                            (shareMode === "email" && !recipientEmail) ||
                            (shareMode === "email" && attachPdfToEmail && !selectedEmailPdfTemplate)
                        }
                        startIcon={shareMode === "pdf" ? <DownloadIcon /> : <SendIcon />}
                    >
                        {isSending
                            ? t("shareSimulation", "processing") || "Processing..."
                            : shareMode === "pdf"
                                ? t("shareSimulation", "downloadPdfAndShare") || "Download PDF and Share"
                                : t("shareSimulation", "sendEmail") || "Send Email"}
                    </Button>
                </Box>
            </Stack>

            {/* Inline section editing modal */}
            {sec && (
                <Dialog open onClose={() => setEditingSection(null)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ pb: 1 }}>Edit: {sec.label}</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            multiline={sec.multiline}
                            minRows={sec.multiline ? 3 : 1}
                            maxRows={10}
                            value={sec.value}
                            onChange={(e) => setEditingSection({ ...sec, value: e.target.value })}
                            inputProps={{ maxLength: sec.maxLength }}
                            helperText={sec.maxLength ? `${sec.value.length} / ${sec.maxLength}` : undefined}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditingSection(null)}>Cancel</Button>
                        <Button variant="contained" onClick={() => sec.onSave(sec.value)}>
                            Apply
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
}
