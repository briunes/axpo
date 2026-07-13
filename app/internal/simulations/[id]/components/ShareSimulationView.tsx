"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getSimulationShareInit, maybePersistRefreshedToken, shareSimulation } from "../../../lib/internalApi";
import { loadSession } from "../../../lib/authSession";
import {
    type PdfTemplate,
    type EmailTemplate,
} from "../../../lib/configApi";
import { extractVariableValues, replaceVariables as replaceVars } from "@/infrastructure/pdf/variableReplacer";
import { buildSimulationPdfFilenameFromSimulation } from "@/infrastructure/pdf/pdfFilename";
import type { EditableSectionOverrides, EditableSectionsConfig } from "@/infrastructure/templates/editableSections";
import { mergeEditableSections } from "@/infrastructure/templates/editableSections";
import { normalizeLanguageCode, resolveTranslation, getLanguageFromCountry } from "@/lib/supportedLanguages";
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grow,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Tab,
    Tabs,
    Typography,
    Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DownloadIcon from "@mui/icons-material/Download";
import { LoadingState } from "../../../components/shared";
import { FormInput } from "../../../components/ui/FormInput";

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
    const { t, locale } = useI18n();

    const [shareMode, setShareMode] = useState<ShareMode>("pdf");
    const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
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
    const [activeTab, setActiveTab] = useState<"email" | "pdf">("email");

    // Editable sections state
    const [pdfEditableOverrides, setPdfEditableOverrides] = useState<EditableSectionOverrides>({});
    const [emailEditableOverrides, setEmailEditableOverrides] = useState<EditableSectionOverrides>({});
    const [emailPdfEditableOverrides, setEmailPdfEditableOverrides] = useState<EditableSectionOverrides>({});
    const [clientLanguage, setClientLanguage] = useState<string>("en");

    useEffect(() => {
        let isCurrent = true;
        setIsLoading(true);
        getSimulationShareInit(token, simulation.id)
            .then((init) => {
                if (!isCurrent) return;

                setPdfTemplates(init.pdfTemplates);
                setEmailTemplates(init.emailTemplates);

                // Determine client language from language preference (falls back to country detection).
                // Testing mode still renders the client-facing PDF in the client's language;
                // it only redirects email delivery to the logged-in user.
                const clientDefaults = init.clientDefaults ?? simulation.client;
                const detectedLanguage = normalizeLanguageCode(clientDefaults?.language
                    ? clientDefaults.language
                    : getLanguageFromCountry(clientDefaults?.country));
                if (isTestingMode && loggedUserEmail) {
                    setRecipientEmail(loggedUserEmail);
                } else if (clientDefaults?.contactEmail) {
                    setRecipientEmail(clientDefaults.contactEmail);
                }
                setClientLanguage(detectedLanguage);

                // Set default selections
                const defaultPdf = init.pdfTemplates.find((t) => t.active);
                const defaultEmail = init.emailTemplates.find((t) => t.active);
                if (defaultPdf) {
                    const pdfTranslation = resolveTranslation(defaultPdf.translations ?? [], detectedLanguage);
                    const pdfContent = pdfTranslation?.htmlContent ?? defaultPdf.htmlContent;
                    setSelectedPdfTemplate(defaultPdf.id);
                    setEditedPdfContent(pdfContent);
                    setSelectedEmailPdfTemplate(defaultPdf.id);
                    setEditedEmailPdfContent(pdfContent);
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
                    const emailTranslation = resolveTranslation(defaultEmail.translations ?? [], detectedLanguage);
                    setSelectedEmailTemplate(defaultEmail.id);
                    setEditedEmailContent(emailTranslation?.htmlContent ?? defaultEmail.htmlContent);
                    setEditedSubject(emailTranslation?.subject ?? defaultEmail.subject);
                    // Seed editable section defaults
                    if (defaultEmail.editableSections) {
                        const defaults = Object.fromEntries(
                            Object.entries(defaultEmail.editableSections).map(([k, v]) => [k, v.default])
                        );
                        setEmailEditableOverrides(defaults);
                    }
                }
            })
            .catch((err) => {
                if (!isCurrent) return;
                onError?.(err.message || t("shareSimulation", "loadTemplatesFailed"));
            })
            .finally(() => {
                if (!isCurrent) return;
                setIsLoading(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [simulation, token, locale, isTestingMode, loggedUserEmail]);

    const handleTemplateChange = (templateId: string) => {
        if (shareMode === "pdf") {
            setSelectedPdfTemplate(templateId);
            const template = pdfTemplates.find((t) => t.id === templateId);
            if (template) {
                const translation = resolveTranslation(template.translations ?? [], clientLanguage);
                setEditedPdfContent(translation?.htmlContent ?? template.htmlContent);
                const defaults = template.editableSections
                    ? Object.fromEntries(Object.entries(template.editableSections).map(([k, v]) => [k, v.default]))
                    : {};
                setPdfEditableOverrides(defaults);
            }
        } else {
            setSelectedEmailTemplate(templateId);
            const template = emailTemplates.find((t) => t.id === templateId);
            if (template) {
                const translation = resolveTranslation(template.translations ?? [], clientLanguage);
                setEditedEmailContent(translation?.htmlContent ?? template.htmlContent);
                setEditedSubject(translation?.subject ?? template.subject);
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

    const replaceVariablesWithEditableSections = (
        content: string,
        editableOverrides: EditableSectionOverrides,
        templateSections?: EditableSectionsConfig | null,
        simulationLink?: string,
    ) => {
        if (!templateSections) {
            return replaceVariables(content, simulationLink, editableOverrides);
        }

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
                `<span data-editable-key="${key}" style="outline:2px dashed #FF3254;outline-offset:3px;border-radius:3px;cursor:pointer;display:inline-block;min-width:40px;background:rgba(255,50,84,0.12);" title="${t("shareSimulation", "editableSection")}">${value}</span>`,
            );
        }

        return result;
    };

    const handlePreviewClick = (
        e: React.MouseEvent<HTMLDivElement>,
        templateSections: EditableSectionsConfig | null | undefined,
        overrides: EditableSectionOverrides,
        setOverrides: (o: EditableSectionOverrides) => void,
    ) => {
        if (!templateSections) return;
        const target = (e.target as HTMLElement).closest("[data-editable-key]") as HTMLElement | null;
        if (!target) return;
        const key = target.getAttribute("data-editable-key");
        if (!key || !templateSections[key]) return;
        const section = templateSections[key];
        setEditingSection({
            key,
            label: section.label,
            value: overrides[key] ?? section.default,
            multiline: section.multiline ?? true,
            maxLength: section.maxLength,
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
            let didShare = false;
            if (markAsShared) {
                try {
                    const shared = await shareSimulation(token, simulation.id, "PDF");
                    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://simuladorpublicoaxpo.b-cdn.net";
                    if (shared.publicToken) {
                        simulationLink = `${baseUrl}/?token=${shared.publicToken}`;
                    }
                    didShare = true;
                } catch (err) {
                    console.error("Failed to share simulation before downloading PDF:", err);
                }
            }

            const selectedPdf = pdfTemplates.find((t) => t.id === selectedPdfTemplate);
            const processedContent = replaceVariables(
                editedPdfContent,
                simulationLink,
                pdfEditableOverrides,
                selectedPdf?.editableSections,
            );

            const requestToken = loadSession()?.token ?? token;
            const response = await fetch(`/api/v1/internal/simulations/${simulation.id}/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${requestToken}`,
                },
                body: JSON.stringify({
                    htmlContent: processedContent,
                    watermark: isTestingMode ? 'TESTING' : (!markAsShared ? 'DRAFT' : undefined),
                }),
            });
            maybePersistRefreshedToken(response);

            if (!response.ok) {
                const errorData = await response.json();
                const errMsg = typeof errorData.error === "string" ? errorData.error : (errorData.error?.message || t("shareSimulation", "generatePdfFailed"));
                throw new Error(errMsg);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = buildSimulationPdfFilenameFromSimulation(simulation);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (didShare) {
                onStatusChange?.();
            }
            onSuccess?.(t("shareSimulation", "pdfDownloaded"));
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
            onError?.(t("shareSimulation", "emailRequired"));
            return false;
        }

        setIsSending(true);
        try {
            // Share the simulation first so a publicToken is generated and the
            // SIMULATION_LINK variable resolves to a real URL instead of N/A.
            let simulationLink: string | undefined;
            let didShare = false;
            try {
                const shared = await shareSimulation(token, simulation.id, "EMAIL");
                const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_SIMULADOR_URL || "https://simuladorpublicoaxpo.b-cdn.net";
                if (shared.publicToken) {
                    simulationLink = `${baseUrl}/?token=${shared.publicToken}`;
                }
                didShare = true;
            } catch (err) {
                console.error("Failed to share simulation before sending email:", err);
            }

            const selectedEmail = emailTemplates.find((t) => t.id === selectedEmailTemplate);
            const selectedEmailPdf = pdfTemplates.find((t) => t.id === selectedEmailPdfTemplate);
            const processedContent = replaceVariables(
                editedEmailContent,
                simulationLink,
                emailEditableOverrides,
                selectedEmail?.editableSections,
            );
            const processedSubject = replaceVariables(editedSubject, simulationLink);
            let processedPdfContent = attachPdfToEmail
                ? replaceVariables(
                    editedEmailPdfContent,
                    simulationLink,
                    emailPdfEditableOverrides,
                    selectedEmailPdf?.editableSections,
                )
                : undefined;
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
                const errMsg = typeof errorData.error === "string" ? errorData.error : (errorData.error?.message || t("shareSimulation", "sendEmailFailed"));
                throw new Error(errMsg);
            }

            if (didShare) {
                onStatusChange?.();
            }
            onSuccess?.(t("shareSimulation", "emailSent"));
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
    const currentTemplateOptions = shareMode === "pdf" ? pdfTemplates : emailTemplates;
    const onlyTemplate = currentTemplateOptions.length === 1 ? currentTemplateOptions[0] : null;
    const onlyEmailPdfTemplate = pdfTemplates.length === 1 ? pdfTemplates[0] : null;

    if (isLoading) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <LoadingState size={100} message={t("shareSimulation", "loading")} />
            </Box>
        );
    }

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
                                    {t("shareSimulation", "selectMode")}
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
                                                {t("shareSimulation", "downloadPdfAndShare")}
                                            </Box>
                                        }
                                    />
                                    <FormControlLabel
                                        value="email"
                                        control={<Radio />}
                                        label={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <SendIcon />
                                                {t("shareSimulation", "sendEmail")}
                                            </Box>
                                        }
                                    />
                                </RadioGroup>
                            </Box>

                            {/* Template Selection */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" gutterBottom>
                                    {t("shareSimulation", "selectTemplate")}
                                </Typography>
                                {onlyTemplate ? (
                                    <Paper variant="outlined" sx={{ px: 1.5, py: 1.25 }}>
                                        <Typography variant="body2">{onlyTemplate.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {onlyTemplate.description}
                                        </Typography>
                                    </Paper>
                                ) : (
                                    <FormControl fullWidth>
                                        <InputLabel>{t("shareSimulation", "selectTemplate")}</InputLabel>
                                        <Select
                                            value={shareMode === "pdf" ? selectedPdfTemplate : selectedEmailTemplate}
                                            onChange={(e) => handleTemplateChange(e.target.value)}
                                            label={t("shareSimulation", "selectTemplate")}
                                        >
                                            {currentTemplateOptions.map((template) => (
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
                        </Box>
                    </CardContent>
                </Card>

                {/* Email Recipient (only for email mode) */}
                <Grow in={shareMode === "email"} mountOnEnter unmountOnExit>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {t("shareSimulation", "recipient")}
                            </Typography>
                            <FormInput
                                fullWidth
                                type="email"
                                label={t("shareSimulation", "recipientEmail")}
                                value={recipientEmail}
                                onChange={(e) => !isTestingMode && setRecipientEmail(e.target.value)}
                                placeholder="client@example.com"
                                disabled={isTestingMode}
                                helperText={isTestingMode ? t("shareSimulation", "testingModeEmailHint") : undefined}
                            />
                        </CardContent>
                    </Card>
                </Grow>

                {/* Attach PDF to Email (only for email mode) */}
                <Grow in={shareMode === "email"} mountOnEnter unmountOnExit>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {t("shareSimulation", "attachPdf")}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={attachPdfToEmail}
                                            onChange={(e) => setAttachPdfToEmail(e.target.checked)}
                                        />
                                    }
                                    label={t("shareSimulation", "attachPdfLabel")}
                                />
                                <Collapse in={attachPdfToEmail} timeout="auto" unmountOnExit sx={{ flex: 1 }}>
                                    {onlyEmailPdfTemplate ? (
                                        <Paper variant="outlined" sx={{ px: 1.5, py: 1.25 }}>
                                            <Typography variant="body2">{onlyEmailPdfTemplate.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {onlyEmailPdfTemplate.description}
                                            </Typography>
                                        </Paper>
                                    ) : (
                                        <FormControl sx={{ flex: 1 }}>
                                            <InputLabel>{t("shareSimulation", "selectPdfTemplate")}</InputLabel>
                                            <Select
                                                value={selectedEmailPdfTemplate}
                                                onChange={(e) => {
                                                    const templateId = e.target.value;
                                                    setSelectedEmailPdfTemplate(templateId);
                                                    const template = pdfTemplates.find((t) => t.id === templateId);
                                                    if (template) {
                                                        const translation = resolveTranslation(template.translations ?? [], clientLanguage);
                                                        setEditedEmailPdfContent(translation?.htmlContent ?? template.htmlContent);
                                                        const defaults = template.editableSections
                                                            ? Object.fromEntries(Object.entries(template.editableSections).map(([k, v]) => [k, v.default]))
                                                            : {};
                                                        setEmailPdfEditableOverrides(defaults);
                                                    }
                                                }}
                                                label={t("shareSimulation", "selectPdfTemplate")}
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
                                </Collapse>
                            </Box>
                        </CardContent>
                    </Card>
                </Grow>

                {/* Template Editor / Preview */}
                {currentTemplate && (
                    <>
                    <Card sx={{ display: { xs: "block", md: "none" } }}>
                        <CardContent>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 1,
                                    border: "1px dashed",
                                    borderColor: "divider",
                                    bgcolor: "action.hover",
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    {t("shareSimulation", "previewUnavailableMobileTitle") || "Preview not available on mobile"}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t("shareSimulation", "previewUnavailableMobile") || "Template previews are available on medium screens and above."}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card sx={{ display: { xs: "none", md: "block" } }}>
                        <CardContent>
                            {/* Tabs for Email mode - always show tabs */}
                            {shareMode === "email" ? (
                                <>
                                    <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
                                        <Tab label={t("shareSimulation", "tabPreviewEmail")} value="email" />
                                        {attachPdfToEmail && selectedEmailPdfTemplate && (
                                            <Tab label={t("shareSimulation", "tabPreviewPdf")} value="pdf" />
                                        )}
                                    </Tabs>

                                    {/* Email Tab */}
                                    {activeTab === "email" && (
                                        <Paper
                                            variant="outlined"
                                            sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                            onClick={(e) => handlePreviewClick(e, currentTemplate.editableSections, emailEditableOverrides, setEmailEditableOverrides)}
                                            dangerouslySetInnerHTML={{
                                                __html: replaceVariablesWithEditableSections(editedEmailContent, emailEditableOverrides, currentTemplate.editableSections),
                                            }}
                                        />
                                    )}

                                    {/* PDF Tab */}
                                    {activeTab === "pdf" && attachPdfToEmail && selectedEmailPdfTemplate && (() => {
                                        const emailPdfTpl = pdfTemplates.find(t => t.id === selectedEmailPdfTemplate);
                                        return (
                                            <Paper
                                                variant="outlined"
                                                sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                                onClick={(e) => handlePreviewClick(e, emailPdfTpl?.editableSections, emailPdfEditableOverrides, setEmailPdfEditableOverrides)}
                                                dangerouslySetInnerHTML={{
                                                    __html: replaceVariablesWithEditableSections(editedEmailPdfContent, emailPdfEditableOverrides, emailPdfTpl?.editableSections),
                                                }}
                                            />
                                        );
                                    })()}
                                </>
                            ) : (
                                <>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                                        <Typography variant="h6">
                                            {t("shareSimulation", "previewTemplate")}
                                        </Typography>
                                    </Box>

                                    <Paper
                                        variant="outlined"
                                        sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                        onClick={(e) => handlePreviewClick(e, currentTemplate.editableSections, pdfEditableOverrides, setPdfEditableOverrides)}
                                        dangerouslySetInnerHTML={{
                                            __html: replaceVariablesWithEditableSections(editedPdfContent, pdfEditableOverrides, currentTemplate.editableSections),
                                        }}
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                    </>
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
                            {t("shareSimulation", "downloadOnly")}
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
                            ? t("shareSimulation", "processing")
                            : shareMode === "pdf"
                                ? t("shareSimulation", "downloadPdfAndShare")
                                : t("shareSimulation", "sendEmail")}
                    </Button>
                </Box>
            </Stack>

            {editingSection && (
                <Dialog open onClose={() => setEditingSection(null)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ pb: 1 }}>
                        {t("shareSimulation", "editSectionTitle", { label: editingSection.label })}
                    </DialogTitle>
                    <DialogContent>
                        <FormInput
                            autoFocus
                            fullWidth
                            multiline={editingSection.multiline}
                            minRows={editingSection.multiline ? 3 : 1}
                            maxRows={10}
                            value={editingSection.value}
                            onChange={(e) => setEditingSection({ ...editingSection, value: e.target.value })}
                            inputProps={{ maxLength: editingSection.maxLength }}
                            helperText={editingSection.maxLength ? `${editingSection.value.length} / ${editingSection.maxLength}` : undefined}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditingSection(null)}>{t("common", "cancel")}</Button>
                        <Button variant="contained" onClick={() => editingSection.onSave(editingSection.value)}>
                            {t("common", "apply")}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
}
