"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AddIcon from "@mui/icons-material/Add";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createSimulation, createClient, listClients, getAgency, type ClientItem, type AgencyItem } from "../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../components/shared";
import { CrudFormContainer } from "../../components/shared/CrudFormContainer";
import { getSystemConfig } from "../../lib/configApi";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControl, Box, Paper } from "@mui/material";
import { ClientForm, type ClientFormData } from "../../components/modules/ClientForm";
import { InvoiceExtractor, type ExtractedInvoiceData, type InvoiceExtractionContext } from "../../components/modules";
import { FormSelect } from "../../components/ui/FormSelect";
import { DateInput } from "../../components/ui/DateInput";
import { FormInput } from "../../components/ui/FormInput";
import { CurrencyInput } from "../../components/ui/CurrencyInput";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

type SimType = "ELECTRICITY" | "GAS";

function addDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

export default function NewSimulationPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [clients, setClients] = useState<ClientItem[]>([]);
    const [clientId, setClientId] = useState("");
    const [userAgency, setUserAgency] = useState<AgencyItem[]>([]);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [quickClientData, setQuickClientData] = useState<ClientFormData>({
        name: "",
        cif: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        otherDetails: "",
        agencyId: session?.user.agencyId ?? "",
        address: { country: "ES" },
        language: "es",
    });
    const [clientFormError, setClientFormError] = useState<string | null>(null);
    const [allowQuickCreate, setAllowQuickCreate] = useState(false);
    const [llmEnabled, setLlmEnabled] = useState(false);
    const [simType, setSimType] = useState<SimType>("ELECTRICITY");
    const [expiresAt, setExpiresAt] = useState("");
    const [defaultDays, setDefaultDays] = useState<any>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage,] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
    const [isValidatedExtractedData, setIsValidatedExtractedData] = useState(false);
    const [uploadedInvoiceFile, setUploadedInvoiceFile] = useState<File | null>(null);
    const [ocrLogIds, setOcrLogIds] = useState<string[]>([]);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMostlyEmpty, setIsMostlyEmpty] = useState(false);
    const [extractionLogId, setExtractionLogId] = useState<string | null>(null);
    const [showReportIssue, setShowReportIssue] = useState(false);
    const [reportIssueMessage, setReportIssueMessage] = useState("");
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [reportSubmitted, setReportSubmitted] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        const updateTheme = () => {
            setIsDarkMode(root.getAttribute("data-theme") === "dark");
        };

        updateTheme();

        const observer = new MutationObserver(updateTheme);
        observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

        return () => observer.disconnect();
    }, []);

    const handleInvoiceDataExtracted = (data: ExtractedInvoiceData, context?: InvoiceExtractionContext) => {
        setExtractedData(data);
        if (context?.file) {
            setUploadedInvoiceFile(context.file);
        }
        setOcrLogIds([
            context?.providerDetectionLogId,
            context?.extractionLogId,
        ].filter((value): value is string => !!value));
        setIsMostlyEmpty(context?.isMostlyEmpty ?? false);
        setExtractionLogId(context?.extractionLogId ?? null);
        setShowReportIssue(false);
        setReportIssueMessage("");
        setReportSubmitted(false);

        // Auto-detect commodity type from invoiceType or tariff
        if (data.invoiceType) {
            if (data.invoiceType.toUpperCase() === "GAS") {
                setSimType("GAS");
            } else if (data.invoiceType.toUpperCase() === "ELECTRICITY") {
                setSimType("ELECTRICITY");
            }
        } else if (data.tarifaAcceso) {
            const tariff = data.tarifaAcceso.toLowerCase();
            if (tariff.includes("2.0td") || tariff.includes("3.0td") || tariff.includes("6.1td")) {
                setSimType("ELECTRICITY");
            } else if (tariff.includes("rl") || tariff.includes("gas")) {
                setSimType("GAS");
            }
        }

        // Try to find existing client by CIF (most reliable) or name
        let existingClient = null;
        if (data.cif) {
            existingClient = clients.find(
                c => c.cif && c.cif.toLowerCase() === data.cif?.toLowerCase()
            );
        }
        if (!existingClient && data.nombreTitular) {
            existingClient = clients.find(
                c => c.name.toLowerCase() === data.nombreTitular?.toLowerCase()
            );
        }

        if (existingClient) {
            // Auto-select the found client
            setClientId(existingClient.id);
            showSuccess(t("newSimulationPage", "clientFound"));
        } else if (data.nombreTitular && allowQuickCreate) {
            // Pre-fill quick create form for new client and open modal instantly
            setQuickClientData({
                name: data.nombreTitular,
                cif: data.cif || "",
                contactName: "",
                contactEmail: "",
                contactPhone: "",
                otherDetails: data.cups ? `CUPS: ${data.cups}` : "",
                agencyId: session?.user.agencyId ?? "",
                address: { country: "ES" },
                language: "es",
            });
            setShowQuickCreate(true);
        }
    };

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;

        Promise.all([
            // Load system config to check if quick create is enabled and get default expiration days
            getSystemConfig()
                .then((config) => {
                    setAllowQuickCreate(config.autoCreateClientOnSim);
                    setDefaultDays(config.simulationExpirationDays);
                    setExpiresAt(addDays(config.simulationExpirationDays));
                    setLlmEnabled(config.llmEnabled ?? false);
                })
                .catch(() => {
                    // Fallback to 30 days if config fetch fails
                    setDefaultDays(30);
                    setExpiresAt(addDays(30));
                }),
            // Load clients list
            listClients(session.token, { pageSize: 1000 })
                .then((res) => {
                    setClients(res.items);
                })
                .catch(() => { }),
            // Load the user's own agency for the quick-create client form
            session.user.agencyId
                ? getAgency(session.token, session.user.agencyId)
                    .then((agency) => setUserAgency([agency]))
                    .catch(() => { })
                : Promise.resolve(),
        ]).finally(() => {
            setIsLoading(false);
        });
    }, [session]);

    if (!session) return null;

    const handleQuickCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!quickClientData.name.trim()) {
            setClientFormError(t("newSimulationPage", "clientNameRequired"));
            return;
        }

        setIsCreatingClient(true);
        setClientFormError(null);

        try {
            const newClient = await createClient(session.token, {
                name: quickClientData.name,
                cif: quickClientData.cif || undefined,
                contactName: quickClientData.contactName || undefined,
                contactEmail: quickClientData.contactEmail || undefined,
                contactPhone: quickClientData.contactPhone || undefined,
                otherDetails: quickClientData.otherDetails || undefined,
                agencyId: quickClientData.agencyId || session.user.agencyId,
            });

            // Add to clients list
            setClients((prev) => [...prev, newClient]);
            // Pre-select the newly created client
            setClientId(newClient.id);
            // Close the dialog
            setShowQuickCreate(false);
            // Reset form
            setQuickClientData({
                name: "",
                cif: "",
                contactName: "",
                contactEmail: "",
                contactPhone: "",
                otherDetails: "",
                agencyId: session.user.agencyId,
                address: { country: "ES" },
                language: "es",
            });
            showSuccess(t("newSimulationPage", "clientCreated"));
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not create client.";
            setClientFormError(msg);
        } finally {
            setIsCreatingClient(false);
        }
    };

    const handleCancelQuickCreate = () => {
        setShowQuickCreate(false);
        setClientFormError(null);
        // Intentionally do NOT reset quickClientData here so inputs are preserved if the modal is reopened
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!clientId) {
            showError(t("newSimulationPage", "selectClientError"));
            return;
        }

        if (llmEnabled && extractedData && !isValidatedExtractedData) {
            showError(t("newSimulationPage", "validateExtractedData"));
            return;
        }

        setIsSubmitting(true);

        try {
            // Build payload with extracted invoice data if available
            const payload: any = {
                schemaVersion: "1",
                type: simType
            };
            // Include extracted invoice data for pre-filling the simulation form
            if (extractedData) {
                payload.invoiceData = {
                    cups: extractedData.cups,
                    nombreTitular: extractedData.nombreTitular,
                    direccion: extractedData.direccion,
                    comercializadorActual: extractedData.comercializadorActual,
                    cif: extractedData.cif,
                    tarifaAcceso: extractedData.tarifaAcceso,
                    fechaInicio: extractedData.fechaInicio,
                    fechaFin: extractedData.fechaFin,
                    consumoTotal: extractedData.consumoTotal,
                    consumoP1: extractedData.consumoP1,
                    consumoP2: extractedData.consumoP2,
                    consumoP3: extractedData.consumoP3,
                    consumoP4: extractedData.consumoP4,
                    consumoP5: extractedData.consumoP5,
                    consumoP6: extractedData.consumoP6,
                    potenciaP1: extractedData.potenciaP1,
                    potenciaP2: extractedData.potenciaP2,
                    potenciaP3: extractedData.potenciaP3,
                    potenciaP4: extractedData.potenciaP4,
                    potenciaP5: extractedData.potenciaP5,
                    potenciaP6: extractedData.potenciaP6,
                    facturaActual: extractedData.facturaActual,
                    excesoPotencia: extractedData.excesoPotencia,
                    alquiler: extractedData.alquiler,
                    otrosCargos: extractedData.otrosCargos,
                    reactiva: extractedData.reactiva,
                    precioPotenciaP1: extractedData.precioPotenciaP1,
                    precioPotenciaP2: extractedData.precioPotenciaP2,
                    precioPotenciaP3: extractedData.precioPotenciaP3,
                    precioPotenciaP4: extractedData.precioPotenciaP4,
                    precioPotenciaP5: extractedData.precioPotenciaP5,
                    precioPotenciaP6: extractedData.precioPotenciaP6,
                    precioEnergiaP1: extractedData.precioEnergiaP1,
                    precioEnergiaP2: extractedData.precioEnergiaP2,
                    precioEnergiaP3: extractedData.precioEnergiaP3,
                    precioEnergiaP4: extractedData.precioEnergiaP4,
                    precioEnergiaP5: extractedData.precioEnergiaP5,
                    precioEnergiaP6: extractedData.precioEnergiaP6,
                    invoiceType: extractedData.invoiceType,
                };
            }

            const created = await createSimulation(session.token, {
                clientId: clientId || undefined,
                expiresAt: new Date(expiresAt + "T23:59:59Z").toISOString(),
                payloadJson: payload,
                ocrLogIds: ocrLogIds.length > 0 ? ocrLogIds : undefined,
            });

            // Upload invoice file if one was extracted
            if (uploadedInvoiceFile) {
                try {
                    const formData = new FormData();
                    formData.append("file", uploadedInvoiceFile);
                    formData.append("simulationId", created.id);

                    await fetch("/api/v1/internal/simulations/upload-invoice", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${session.token}`,
                        },
                        body: formData,
                    });
                } catch (uploadErr) {
                    console.error("Failed to upload invoice file:", uploadErr);
                    // Don't fail the simulation creation if file upload fails
                }
            }

            showSuccess(t("newSimulationPage", "created"));
            router.push(`/internal/simulations/${created.id}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not create simulation.";
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CrudPageLayout
            title={t("newSimulationPage", "title")}
            subtitle={t("newSimulationPage", "subtitle")}
            backHref="/internal/simulations"
        >
            {isLoading ? (
                <div style={{ padding: "40px", textAlign: "center" }}>
                    <LoadingState message={t("common", "loading")} />
                </div>
            ) : (
                <CrudFormContainer
                    onSubmit={handleSubmit}
                    submitLabel={t("newSimulationPage", "submitLabel")}
                    cancelLabel={t("actions", "cancel")}
                    onCancel={() => router.push("/internal/simulations")}
                    isSubmitting={isSubmitting}
                >
                    {/* Invoice Data Extraction - Only show if LLM is enabled */}
                    {llmEnabled && (
                        <div className="crud-form-section" style={{
                            background: "var(--scheme-neutral-1100)",
                            border: "1px solid var(--scheme-neutral-900)",
                            borderRadius: 12,
                            padding: "20px 24px",
                            marginBottom: 24,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    background: "var(--scheme-neutral-1000)",
                                    border: "1px solid var(--scheme-neutral-900)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0
                                }}>
                                    <span style={{ fontSize: 18 }}>✨</span>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--scheme-neutral-100)" }}>
                                        {t("invoiceExtractor", "title") || "Invoice Data Extraction"}
                                    </h3>
                                </div>
                            </div>
                            <InvoiceExtractor
                                onDataExtracted={handleInvoiceDataExtracted}
                                onBeforeExtract={() => {
                                    setExtractedData(null);
                                    setIsValidatedExtractedData(false);
                                    setUploadedInvoiceFile(null);
                                    setOcrLogIds([]);
                                    setIsMostlyEmpty(false);
                                    setExtractionLogId(null);
                                    setShowReportIssue(false);
                                    setReportIssueMessage("");
                                    setReportSubmitted(false);
                                }}
                            />
                        </div>
                    )}

                    {/* Display Extracted Data */}
                    {llmEnabled && extractedData && isMostlyEmpty && !reportSubmitted && (
                        <div style={{
                            display: "flex", flexDirection: "column", gap: 0,
                            padding: "10px 14px",
                            borderRadius: 8, marginBottom: 12,
                            fontSize: 13,
                            background: isDarkMode ? "#1c1507" : "#fffbeb",
                            color: isDarkMode ? "#fcd34d" : "#78350f",
                            border: `1px solid ${isDarkMode ? "#3d2a05" : "#f59e0b"}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontWeight: 500, lineHeight: 1.4 }}>
                                <span style={{ flexShrink: 0, fontSize: 15, lineHeight: 1.3 }}>⚠️</span>
                                <span>{t("invoiceExtractor", "reportIssueTitle")}</span>
                            </div>
                            {!showReportIssue ? (
                                <button
                                    type="button"
                                    onClick={() => setShowReportIssue(true)}
                                    style={{
                                        alignSelf: "flex-start", marginTop: 8,
                                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                                        background: "transparent",
                                        border: `1px solid ${isDarkMode ? "#3d2a05" : "#f59e0b"}`,
                                        borderRadius: 999, padding: "3px 12px",
                                        color: isDarkMode ? "#fcd34d" : "#92400e",
                                    }}
                                >
                                    {t("invoiceExtractor", "reportIssueButton")}
                                </button>
                            ) : (
                                <div style={{ marginTop: 8 }}>
                                    <textarea
                                        placeholder={t("invoiceExtractor", "reportIssuePlaceholder") ?? ""}
                                        value={reportIssueMessage}
                                        onChange={e => setReportIssueMessage(e.target.value)}
                                        rows={3}
                                        style={{
                                            width: "100%", boxSizing: "border-box",
                                            border: `1px solid ${isDarkMode ? "#3d2a05" : "#f59e0b"}`,
                                            borderRadius: 5, padding: "7px 10px",
                                            fontSize: 12, fontFamily: "inherit", resize: "vertical",
                                            background: isDarkMode ? "#0f0900" : "#fff",
                                            color: isDarkMode ? "#fcd34d" : "#1a1a1a",
                                            outline: "none",
                                        }}
                                    />
                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowReportIssue(false)}
                                            style={{ fontSize: 11, cursor: "pointer", background: "transparent", border: "none", color: isDarkMode ? "#fcd34d" : "#92400e", padding: "3px 8px" }}
                                        >
                                            {t("invoiceExtractor", "reportIssueCancel")}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!reportIssueMessage.trim() || isSubmittingReport}
                                            onClick={async () => {
                                                if (!extractionLogId || !reportIssueMessage.trim()) return;
                                                setIsSubmittingReport(true);
                                                try {
                                                    const res = await fetch(`/api/v1/internal/ocr-logs/${extractionLogId}/report`, {
                                                        method: "PATCH",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            Authorization: `Bearer ${session?.token}`,
                                                        },
                                                        body: JSON.stringify({ message: reportIssueMessage.trim() }),
                                                    });
                                                    if (res.ok) { setReportSubmitted(true); setShowReportIssue(false); }
                                                } finally {
                                                    setIsSubmittingReport(false);
                                                }
                                            }}
                                            style={{
                                                fontSize: 11, fontWeight: 700, cursor: "pointer",
                                                background: isDarkMode ? "#3d2a05" : "#f59e0b",
                                                border: "none", borderRadius: 999, padding: "4px 14px",
                                                color: isDarkMode ? "#fcd34d" : "#fff",
                                                opacity: (!reportIssueMessage.trim() || isSubmittingReport) ? 0.5 : 1,
                                            }}
                                        >
                                            {isSubmittingReport ? t("invoiceExtractor", "reportIssueSubmitting") : t("invoiceExtractor", "reportIssueSubmit")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {llmEnabled && extractedData && isMostlyEmpty && reportSubmitted && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: 8, marginBottom: 12,
                            fontSize: 13, fontWeight: 500,
                            background: isDarkMode ? "#052e16" : "#f0fdf4",
                            color: isDarkMode ? "#86efac" : "#166534",
                            border: `1px solid ${isDarkMode ? "#166534" : "#86efac"}`,
                        }}>
                            <span style={{ flexShrink: 0, fontSize: 15, lineHeight: 1.3 }}>✓</span>
                            <span>{t("invoiceExtractor", "reportIssueConfirm")}</span>
                        </div>
                    )}

                    {/* Display Extracted Data */}
                    {llmEnabled && extractedData && (
                        <Box sx={{
                            background: isDarkMode ? "linear-gradient(135deg, #0d1f17, #12261d)" : "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                            border: isDarkMode ? "1px solid" : "1px solid",
                            borderColor: isDarkMode ? "#1b3a2a" : "success.main",
                            borderRadius: 4,
                            padding: "16px 20px",
                            marginBottom: 24,
                            boxShadow: isDarkMode ? "0 2px 8px rgba(0,0,0,0.18)" : "0 2px 8px rgba(16,185,129,0.08)"
                        }}>
                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    background: isDarkMode ? "#1b3a2a" : "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                                }}>
                                    <span style={{ color: isDarkMode ? "#9dd8bc" : "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
                                </div>
                                <span style={{ fontWeight: 700, color: isDarkMode ? "#9dd8bc" : "#065f46", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                    {t("invoiceExtractor", "extractedDataTitle")}
                                </span>
                                {/* Commodity type toggle - always visible */}
                                <ToggleButtonGroup
                                    size="small"
                                    exclusive
                                    value={extractedData.invoiceType ?? "ELECTRICITY"}
                                    onChange={(_, val) => {
                                        if (!val) return;
                                        setExtractedData(prev => prev ? { ...prev, invoiceType: val } : prev);
                                        setSimType(val as SimType);
                                    }}
                                    sx={{ ml: 1, height: 26 }}
                                >
                                    <ToggleButton value="ELECTRICITY" sx={{ px: 1.2, py: 0, fontSize: 11, fontWeight: 700, gap: 0.5 }}>
                                        <BoltIcon sx={{ fontSize: 13, color: "#f59e0b" }} />
                                        Electricity
                                    </ToggleButton>
                                    <ToggleButton value="GAS" sx={{ px: 1.2, py: 0, fontSize: 11, fontWeight: 700, gap: 0.5 }}>
                                        <LocalFireDepartmentIcon sx={{ fontSize: 13, color: "#ef4444" }} />
                                        Gas
                                    </ToggleButton>
                                </ToggleButtonGroup>
                                <Button
                                    type="button"
                                    size="small"
                                    variant={isValidatedExtractedData ? "contained" : "outlined"}
                                    color={isValidatedExtractedData ? "success" : "warning"}
                                    onClick={() => setIsValidatedExtractedData(v => !v)}
                                    startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                    sx={{ ml: "auto", fontSize: 11, py: 0.3, px: 1.2, minWidth: 0, textTransform: "none", fontWeight: 700 }}
                                >
                                    {isValidatedExtractedData ? "Validated" : "Validate"}
                                </Button>
                            </div>

                            {/* Grid of fields */}
                            {(() => {
                                const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 };
                                const valueStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827" };
                                const missingStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: isDarkMode ? "#a16207" : "#92400e", fontStyle: "italic", display: "flex", alignItems: "center", gap: 4 };
                                const warnIcon = <span title="Not extracted by AI" style={{ fontSize: 13, lineHeight: 1 }}>⚠️</span>;
                                const upStr = (key: keyof ExtractedInvoiceData, val: string) =>
                                    setExtractedData(prev => prev ? { ...prev, [key]: val || undefined } : prev);
                                return (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px 20px" }}>
                                        {/* CLIENT */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("newSimulationPage", "clientLabel")}</div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                                <div style={{ flex: 1 }}>
                                                    <FormSelect
                                                        label=""
                                                        options={clients.map((c) => {
                                                            const secondaryParts: string[] = [];
                                                            if (c.cif) secondaryParts.push(`CIF: ${c.cif}`);
                                                            if (c.contactName) secondaryParts.push(c.contactName);
                                                            if (c.contactEmail) secondaryParts.push(c.contactEmail);
                                                            return { value: c.id, label: c.name, secondaryLabel: secondaryParts.join(" • ") };
                                                        })}
                                                        value={clientId}
                                                        onChange={(value) => setClientId(value as string)}
                                                        required
                                                        placeholder={t("newSimulationPage", "selectClient")}
                                                        helperText={t("newSimulationPage", "clientHint")}
                                                    />
                                                </div>
                                                {allowQuickCreate && (
                                                    <Button type="button" variant="outlined" onClick={() => setShowQuickCreate(true)} title={t("newSimulationPage", "createNew")} style={{ flexShrink: 0, marginTop: 2 }}>
                                                        <AddIcon />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {/* CUPS - span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldCUPS")}</div>
                                            <FormInput label="" size="small" type="text" value={extractedData.cups ?? ""} onChange={e => upStr("cups", e.target.value)}
                                                sx={{ '& input': { fontFamily: 'monospace', color: '#0369a1' } }} />
                                        </div>
                                        {/* TARIFF */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldTariff")}</div>
                                            {(() => {
                                                const gasOptions = ["RL01", "RL02", "RL03", "RL04", "RL05", "RL06", "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6"];
                                                const elecOptions = ["2.0TD", "3.0TD", "6.1TD"];
                                                const availableOptions = simType === "GAS" ? gasOptions : elecOptions;
                                                const extracted = extractedData.tarifaAcceso;
                                                const isUnsupported = extracted && !availableOptions.includes(extracted);
                                                return (
                                                    <FormSelect label="" size="small" value={isUnsupported ? "" : (extractedData.tarifaAcceso ?? "")}
                                                        onChange={v => upStr("tarifaAcceso", v as string)}
                                                        helperText={isUnsupported ? `⚠️ OCR detected "${extracted}" — not supported by Axpo. Please select manually.` : undefined}
                                                        options={simType === "GAS"
                                                            ? gasOptions.map(v => ({ value: v, label: v }))
                                                            : [
                                                                { value: "2.0TD", label: "2.0TD (BT ≤15 kW)" },
                                                                { value: "3.0TD", label: "3.0TD (BT >15 kW)" },
                                                                { value: "6.1TD", label: "6.1TD (AT)" },
                                                            ]
                                                        } />
                                                );
                                            })()}
                                        </div>
                                        {/* ZONE */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldZone")}</div>
                                            <FormSelect label="" size="small" value={extractedData.zonaGeografica ?? ""}
                                                onChange={v => upStr("zonaGeografica", v as string)}
                                                options={[
                                                    { value: "Peninsula", label: "Peninsula" },
                                                    { value: "Baleares", label: "Baleares" },
                                                    { value: "Canarias", label: "Canarias" },
                                                    { value: "Ceuta", label: "Ceuta" },
                                                    { value: "Melilla", label: "Melilla" },
                                                ]} />
                                        </div>
                                        {/* BILLING PERIOD - span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldPeriod")}</div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <div style={{ flex: 1 }}>
                                                    <DateInput value={extractedData.fechaInicio ?? ""} onChange={v => upStr("fechaInicio", v)} label="" />
                                                </div>
                                                <span style={{ color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 12, flexShrink: 0 }}>→</span>
                                                <div style={{ flex: 1 }}>
                                                    <DateInput value={extractedData.fechaFin ?? ""} onChange={v => upStr("fechaFin", v)} label="" />
                                                </div>
                                            </div>
                                        </div>
                                        {/* AMOUNT */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldAmount")}</div>
                                            <CurrencyInput value={extractedData.facturaActual ?? 0} onChange={v => setExtractedData(prev => prev ? { ...prev, facturaActual: isNaN(v) ? undefined : v } : prev)} />
                                        </div>
                                        {/* CURRENT SUPPLIER */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldSupplier")}</div>
                                            <FormInput label="" size="small" type="text" value={extractedData.comercializadorActual ?? ""} onChange={e => upStr("comercializadorActual", e.target.value)} />
                                        </div>
                                        {/* ADDRESS - span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldAddress")}</div>
                                            <FormInput label="" size="small" type="text" value={extractedData.direccion ?? ""} onChange={e => upStr("direccion", e.target.value)} />
                                        </div>
                                        {/* EXCESS POWER */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldExcesoPotencia")}</div>
                                            <CurrencyInput value={extractedData.excesoPotencia ?? 0} onChange={v => setExtractedData(prev => prev ? { ...prev, excesoPotencia: isNaN(v) ? undefined : v } : prev)} />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Consumption table: consumo per period */}
                            {(() => {
                                const periods = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
                                const displayPeriods = periods;
                                const hasConsumo = periods.some(p => extractedData[`consumo${p}` as keyof ExtractedInvoiceData] != null);
                                if (!hasConsumo) return null;
                                return (
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                            Consumo (kWh)
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: "left", padding: "3px 10px 3px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}></th>
                                                        {displayPeriods.map(p => (
                                                            <th key={p} style={{ textAlign: "center", padding: "3px 12px", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}>{p}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ padding: "4px 10px 4px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>Energy (kWh)</td>
                                                        {displayPeriods.map(p => {
                                                            const key = `consumo${p}` as keyof ExtractedInvoiceData;
                                                            const val = extractedData[key] as number | undefined;
                                                            return <td key={p} style={{ textAlign: "center", padding: "4px 6px", fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827", fontFamily: "monospace", fontSize: 12 }}>
                                                                <FormInput size="small" type="number" value={val ?? ""}
                                                                    onChange={e => setExtractedData(prev => prev ? { ...prev, [key]: e.target.value === "" ? undefined : parseFloat(e.target.value) } : prev)}
                                                                    slotProps={{ htmlInput: { step: 0.01, style: { fontSize: 12, textAlign: 'center', fontFamily: 'monospace', width: 80, padding: '4px 6px' } } }}
                                                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }} />
                                                            </td>;
                                                        })}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Potencia table: potencia per period */}
                            {(() => {
                                const periods = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
                                const hasPotencia = periods.some(p => extractedData[`potencia${p}` as keyof ExtractedInvoiceData] != null);
                                if (!hasPotencia) return null;
                                return (
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                            Potencia (kW)
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: "left", padding: "3px 10px 3px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}></th>
                                                        {periods.map(p => (
                                                            <th key={p} style={{ textAlign: "center", padding: "3px 12px", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}>{p}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ padding: "4px 10px 4px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>Power (kW)</td>
                                                        {periods.map(p => {
                                                            const key = `potencia${p}` as keyof ExtractedInvoiceData;
                                                            const val = extractedData[key] as number | undefined;
                                                            return (
                                                                <td key={p} style={{ textAlign: "center", padding: "4px 6px" }}>
                                                                    <FormInput size="small" type="number" value={val ?? ""}
                                                                        onChange={e => setExtractedData(prev => prev ? { ...prev, [key]: e.target.value === "" ? undefined : parseFloat(e.target.value) } : prev)}
                                                                        slotProps={{ htmlInput: { step: 0.01, style: { fontSize: 12, textAlign: "center", fontFamily: "monospace", width: 80, padding: "4px 6px" } } }}
                                                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "6px" } }} />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Simulation settings: expiration date */}
                            <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${isDarkMode ? "#1b3a2a" : "#bbf7d0"}`, alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{t("newSimulationPage", "expirationLabel")}</div>
                                    <DateInput
                                        label=""
                                        value={expiresAt}
                                        onChange={(value) => setExpiresAt(value)}
                                        helperText={t("newSimulationPage", "expirationHint").replace("{{days}}", defaultDays)}
                                        nopadding
                                    />
                                </div>
                            </div>
                        </Box>
                    )}

                    {/* Client, Commodity Type, and Expiration Date - Only shown when no OCR data */}
                    {!(llmEnabled && extractedData) && (<div className="crud-form-section">
                        <div className="crud-form-row" style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                            {/* Client */}
                            <div className="crud-form-group" style={{ flex: 1 }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>

                                    <div style={{ flex: 1 }}>
                                        <FormSelect
                                            label={t("newSimulationPage", "clientLabel")}
                                            options={clients.map((c) => {
                                                // Build secondary label with multiple client fields
                                                const secondaryParts: string[] = [];
                                                if (c.cif) secondaryParts.push(`CIF: ${c.cif}`);
                                                if (c.contactName) secondaryParts.push(c.contactName);
                                                if (c.contactEmail) secondaryParts.push(c.contactEmail);

                                                return {
                                                    value: c.id,
                                                    label: c.name,
                                                    secondaryLabel: secondaryParts.join(' • ')
                                                };
                                            })}
                                            value={clientId}
                                            onChange={(value) => setClientId(value as string)}
                                            required
                                            placeholder={t("newSimulationPage", "selectClient")}
                                            helperText={t("newSimulationPage", "clientHint")}
                                        />
                                    </div>
                                    {allowQuickCreate && (
                                        <Button type="button" variant="outlined" onClick={() => setShowQuickCreate(true)} title={t("newSimulationPage", "createNew")} style={{ flexShrink: 0, marginTop: 30 }}>
                                            <AddIcon />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Commodity type */}
                            <div className="crud-form-group" style={{ flex: 1 }}>
                                <FormSelect
                                    label={t("newSimulationPage", "commodityLabel")}
                                    options={[
                                        {
                                            value: "ELECTRICITY", label: t("newSimulationPage", "electricity"),
                                            icon: (
                                                <>
                                                    <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
                                                </>
                                            )
                                        },
                                        {
                                            value: "GAS",
                                            label: t("newSimulationPage", "gas"),
                                            icon: <LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                                        }
                                    ]}
                                    value={simType}
                                    onChange={(value) => setSimType(value as SimType)}
                                    helperText={t("newSimulationPage", "commodityHint")}
                                />
                            </div>

                            {/* Expiration date */}
                            <div className="crud-form-group" style={{ flex: 1 }}>
                                <DateInput
                                    label={t("newSimulationPage", "expirationLabel")}
                                    labelPosition="top"
                                    value={expiresAt}
                                    onChange={(value) => setExpiresAt(value)}
                                    helperText={t("newSimulationPage", "expirationHint").replace("{{days}}", defaultDays)}
                                    nopadding
                                />
                            </div>
                        </div>
                    </div>)}
                </CrudFormContainer>
            )}

            {/* Client Creation Dialog */}
            <Dialog
                open={showQuickCreate}
                onClose={handleCancelQuickCreate}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>{t("newSimulationPage", "createNewClientTitle")}</DialogTitle>
                <DialogContent>
                    <div style={{ paddingTop: "8px" }}>
                        <ClientForm
                            session={session}
                            agencies={userAgency}
                            data={quickClientData}
                            onChange={setQuickClientData}
                            onSubmit={handleQuickCreateClient}
                            isSubmitting={isCreatingClient}
                            submitLabel={t("newSimulationPage", "saveClient")}
                            cancelLabel={t("actions", "cancel")}
                            onCancel={handleCancelQuickCreate}
                            mode="create"
                            onRenderActions={(actions) => {
                                // Actions will be rendered in DialogActions below
                                return null;
                            }}
                        />
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleCancelQuickCreate}
                        disabled={isCreatingClient}
                    >
                        {t("actions", "cancel")}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        size="small"
                        disabled={isCreatingClient}
                        onClick={handleQuickCreateClient}
                    >
                        {t("newSimulationPage", "saveClient")}
                    </Button>
                </DialogActions>
            </Dialog>
        </CrudPageLayout>
    );
}
