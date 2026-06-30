"use client";

import { use, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getSimulation, getSimulationShareInit, maybePersistRefreshedToken, shareSimulation } from "../../../lib/internalApi";
import {
    type PdfTemplate,
    type EmailTemplate,
    type TemplateVariable,
} from "../../../lib/configApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { HtmlEditor } from "../../../components/modules/HtmlEditor";
import { DraggableVariables } from "../../../components/modules/DraggableVariables";
import { extractVariableValues, replaceVariables as replaceVars } from "@/infrastructure/pdf/variableReplacer";
import { buildSimulationPdfFilenameFromSimulation } from "@/infrastructure/pdf/pdfFilename";
import { normalizeLanguageCode, resolveTranslation, getLanguageFromCountry } from "@/lib/supportedLanguages";
import {
    Box,
    Button,
    Card,
    CardContent,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    TextField,
    Typography,
    Stack,
    Divider,
    Paper,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import { DownloadHistoryDialog } from "../components/DownloadHistoryDialog";
import { useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

type ShareMode = "pdf" | "email";

interface ShareSimulationPageProps {
    params: Promise<{ id: string }>;
}

export default function ShareSimulationPage({ params }: ShareSimulationPageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { t } = useI18n();
    const { showSuccess, showError } = useAlerts();

    const [simulation, setSimulation] = useState<any>(null);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [selectedOfferProductKey, setSelectedOfferProductKey] = useState<string>("");
    const [hasResults, setHasResults] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>("pdf");
    const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([]);
    const [selectedPdfTemplate, setSelectedPdfTemplate] = useState<string>("");
    const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>("");
    const [editedPdfContent, setEditedPdfContent] = useState("");
    const [editedEmailContent, setEditedEmailContent] = useState("");
    const [editedSubject, setEditedSubject] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [clientLanguage, setClientLanguage] = useState<string>("en");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [templateViewMode, setTemplateViewMode] = useState<"preview" | "edit">("preview");
    const simulationBreadcrumbLabel =
        simulation?.referenceNumber || simulation?.client?.name || simulation?.id || id;
    const breadcrumbs = useMemo(
        () => simulation ? [
            { label: simulationBreadcrumbLabel, href: `/internal/simulations/${simulation.id}` },
            { label: t("shareSimulation", "title") },
        ] : null,
        [simulation, simulationBreadcrumbLabel, t],
    );
    useTopBarBreadcrumbs(breadcrumbs);

    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;

        Promise.all([
            getSimulation(session.token, id),
            getSimulationShareInit(session.token, id),
        ])
            .then(([simData, init]) => {
                setSimulation(simData.simulation);
                const payload = simData.simulation.payloadJson as {
                    type?: "ELECTRICITY" | "GAS";
                    results?: any;
                    selectedOffer?: { productKey: string }
                } | null;

                if (payload?.results) setHasResults(true);
                setSelectedOfferProductKey(payload?.selectedOffer?.productKey ?? "");

                setPdfTemplates(init.pdfTemplates);
                setEmailTemplates(init.emailTemplates);
                setTemplateVariables(init.templateVariables);

                // Pre-fill recipient email if client exists and detect the client
                // language so we can pick the matching template translation.
                let detectedLanguage = "en";
                const clientDefaults = init.clientDefaults ?? simData.simulation.client;
                if (clientDefaults?.contactEmail) {
                    setRecipientEmail(clientDefaults.contactEmail);
                }
                detectedLanguage = normalizeLanguageCode(clientDefaults?.language
                    ? clientDefaults.language
                    : getLanguageFromCountry(clientDefaults?.country));
                setClientLanguage(detectedLanguage);

                // Set default selections
                const defaultPdf = init.pdfTemplates.find((t) => t.active);
                const defaultEmail = init.emailTemplates.find((t) => t.active);
                if (defaultPdf) {
                    const pdfTranslation = resolveTranslation(defaultPdf.translations ?? [], detectedLanguage);
                    setSelectedPdfTemplate(defaultPdf.id);
                    setEditedPdfContent(pdfTranslation?.htmlContent ?? defaultPdf.htmlContent);
                }
                if (defaultEmail) {
                    const emailTranslation = resolveTranslation(defaultEmail.translations ?? [], detectedLanguage);
                    setSelectedEmailTemplate(defaultEmail.id);
                    setEditedEmailContent(emailTranslation?.htmlContent ?? defaultEmail.htmlContent);
                    setEditedSubject(emailTranslation?.subject ?? defaultEmail.subject);
                }
            })
            .catch((err) => {
                showError(err.message || "Failed to load data");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [session, id]);

    if (!session) return null;

    const handleTemplateChange = (templateId: string) => {
        if (shareMode === "pdf") {
            setSelectedPdfTemplate(templateId);
            const template = pdfTemplates.find((t) => t.id === templateId);
            if (template) {
                const translation = resolveTranslation(template.translations ?? [], clientLanguage);
                setEditedPdfContent(translation?.htmlContent ?? template.htmlContent);
            }
        } else {
            setSelectedEmailTemplate(templateId);
            const template = emailTemplates.find((t) => t.id === templateId);
            if (template) {
                const translation = resolveTranslation(template.translations ?? [], clientLanguage);
                setEditedEmailContent(translation?.htmlContent ?? template.htmlContent);
                setEditedSubject(translation?.subject ?? template.subject);
            }
        }
    };

    const handleShareModeChange = (mode: ShareMode) => {
        setShareMode(mode);
    };

    const resolveVariables = (content: string) => {
        if (!simulation) return content;
        // payloadJson is attached directly to the simulation object by the API
        const payload = simulation.payloadJson;
        const variableValues = extractVariableValues(simulation, payload, {
            pin: simulation.pinSnapshot ?? undefined,
        });
        return replaceVars(content, variableValues);
    };

    const handleDownloadPdf = async () => {
        setIsSending(true);
        try {
            const processedContent = resolveVariables(editedPdfContent);

            // Call backend API to generate PDF
            const requestToken = loadSession()?.token ?? session.token;
            const response = await fetch(`/api/v1/internal/simulations/${id}/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${requestToken}`,
                },
                body: JSON.stringify({ htmlContent: processedContent }),
            });
            maybePersistRefreshedToken(response);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = buildSimulationPdfFilenameFromSimulation(simulation);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showSuccess(t("shareSimulation", "pdfDownloaded"));
            return true;
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to download PDF");
            return false;
        } finally {
            setIsSending(false);
        }
    };

    const handleSendEmail = async () => {
        if (!recipientEmail) {
            showError(t("shareSimulation", "emailRequired"));
            return;
        }

        setIsSending(true);
        try {
            // TODO: Implement actual email sending via API
            const processedContent = resolveVariables(editedEmailContent);
            const processedSubject = resolveVariables(editedSubject);

            // TODO: Replace with actual email API endpoint
            console.log("Sending email:", {
                to: recipientEmail,
                subject: processedSubject,
                html: processedContent,
            });

            showSuccess(t("shareSimulation", "emailSent"));
            return true;
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to send email");
            return false;
        } finally {
            setIsSending(false);
        }
    };

    const handleShareAndSave = async () => {
        let success = false;

        if (shareMode === "pdf") {
            success = (await handleDownloadPdf()) || false;
        } else {
            success = (await handleSendEmail()) || false;
        }

        if (success) {
            try {
                // Mark simulation as shared via API
                await shareSimulation(session.token, id);
                showSuccess(t("shareSimulation", "sharedSuccessfully"));
                setTimeout(() => {
                    router.push("/internal/simulations");
                }, 1500);
            } catch (err) {
                showError(err instanceof Error ? err.message : "Failed to mark simulation as shared");
            }
        }
    };

    const currentTemplate = shareMode === "pdf"
        ? pdfTemplates.find((t) => t.id === selectedPdfTemplate)
        : emailTemplates.find((t) => t.id === selectedEmailTemplate);
    const currentTemplateOptions = shareMode === "pdf" ? pdfTemplates : emailTemplates;
    const onlyTemplate = currentTemplateOptions.length === 1 ? currentTemplateOptions[0] : null;

    return (
        <CrudPageLayout
            title={t("shareSimulation", "title")}
            subtitle={t("shareSimulation", "subtitle")}
            backHref="/internal/simulations"
        >
            {isLoading ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                    <LoadingState size={100} message={t("shareSimulation", "loading") || "Loading..."} />
                </Box>
            ) : (
                <Stack spacing={3}>
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
                                                    {t("shareSimulation", "downloadPdf")}
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
                    {shareMode === "email" && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {t("shareSimulation", "recipient")}
                                </Typography>
                                <TextField
                                    fullWidth
                                    type="email"
                                    label={t("shareSimulation", "recipientEmail")}
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    placeholder="client@example.com"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Template Editor / Preview */}
                    {currentTemplate && (
                        <Card>
                            <CardContent>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                                    <Typography variant="h6">
                                        {templateViewMode === "edit"
                                            ? t("shareSimulation", "editTemplate")
                                            : t("shareSimulation", "previewTemplate")}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={templateViewMode === "edit" ? <VisibilityIcon /> : <EditIcon />}
                                        onClick={() => setTemplateViewMode(templateViewMode === "edit" ? "preview" : "edit")}
                                    >
                                        {templateViewMode === "edit"
                                            ? t("shareSimulation", "previewTemplate")
                                            : t("shareSimulation", "editTemplate")}
                                    </Button>
                                </Box>

                                {templateViewMode === "edit" ? (
                                    <>
                                        {shareMode === "email" && (
                                            <TextField
                                                fullWidth
                                                label={t("shareSimulation", "subject")}
                                                value={editedSubject}
                                                onChange={(e) => setEditedSubject(e.target.value)}
                                                sx={{ mb: 2 }}
                                            />
                                        )}
                                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 280px" }, gap: 2 }}>
                                            <HtmlEditor
                                                key={`${shareMode}-${shareMode === "pdf" ? selectedPdfTemplate : selectedEmailTemplate}`}
                                                initialHtml={shareMode === "pdf" ? editedPdfContent : editedEmailContent}
                                                onChange={shareMode === "pdf" ? setEditedPdfContent : setEditedEmailContent}
                                                height="500px"
                                            />
                                            <DraggableVariables
                                                variables={templateVariables.map(v => ({
                                                    name: v.key,
                                                    label: v.label,
                                                    description: v.description || "",
                                                }))}
                                            />
                                        </Box>
                                    </>
                                ) : (
                                    <Paper
                                        variant="outlined"
                                        sx={{ p: 3, minHeight: 400, overflow: "auto", bgcolor: "background.paper" }}
                                        dangerouslySetInnerHTML={{
                                            __html: resolveVariables(
                                                shareMode === "pdf" ? editedPdfContent : editedEmailContent
                                            ),
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => router.push("/internal/simulations")}
                            >
                                {t("actions", "cancel")}
                            </Button>
                            {hasResults && (
                                <Button
                                    variant="outlined"
                                    startIcon={<HistoryIcon />}
                                    onClick={() => setShowHistoryDialog(true)}
                                >
                                    {t("downloadHistory", "buttonLabel") || "Download History"}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            {shareMode === "pdf" && (
                                <Button
                                    variant="outlined"
                                    onClick={handleDownloadPdf}
                                    disabled={isSending || !currentTemplate}
                                    startIcon={<DownloadIcon />}
                                >
                                    {t("shareSimulation", "downloadPdf")}
                                </Button>
                            )}
                            <Button
                                variant="contained"
                                onClick={handleShareAndSave}
                                disabled={isSending || !currentTemplate || (shareMode === "email" && !recipientEmail)}
                                startIcon={shareMode === "pdf" ? <DownloadIcon /> : <SendIcon />}
                            >
                                {isSending
                                    ? t("shareSimulation", "processing")
                                    : shareMode === "pdf"
                                        ? t("shareSimulation", "downloadAndSave")
                                        : t("shareSimulation", "sendEmail")}
                            </Button>
                        </Box>
                    </Box>
                </Stack>
            )}

            {simulation && (
                <DownloadHistoryDialog
                    open={showHistoryDialog}
                    onClose={() => setShowHistoryDialog(false)}
                    simulation={simulation}
                    token={session.token}
                    initialProductKey={selectedOfferProductKey}
                    onSuccess={(msg) => {
                        showSuccess(msg);
                        setShowHistoryDialog(false);
                    }}
                    onError={showError}
                />
            )}
        </CrudPageLayout>
    );
}
