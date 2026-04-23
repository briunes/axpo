"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AddIcon from "@mui/icons-material/Add";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createSimulation, createClient, listClients, type ClientItem } from "../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../components/shared";
import { CrudFormContainer } from "../../components/shared/CrudFormContainer";
import { getSystemConfig } from "../../lib/configApi";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControl, Box, Paper, Typography, Chip } from "@mui/material";
import { ClientForm, type ClientFormData } from "../../components/modules/ClientForm";
import { InvoiceExtractor, type ExtractedInvoiceData } from "../../components/modules";
import { FormSelect } from "../../components/ui/FormSelect";
import { DateInput } from "../../components/ui/DateInput";

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
    });
    const [clientFormError, setClientFormError] = useState<string | null>(null);
    const [allowQuickCreate, setAllowQuickCreate] = useState(false);
    const [llmEnabled, setLlmEnabled] = useState(false);
    const [simType, setSimType] = useState<SimType>("ELECTRICITY");
    const [expiresAt, setExpiresAt] = useState("");
    const [defaultDays, setDefaultDays] = useState<any>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
    const [uploadedInvoiceFile, setUploadedInvoiceFile] = useState<File | null>(null);

    const handleInvoiceDataExtracted = (data: ExtractedInvoiceData, file?: File) => {
        setExtractedData(data);
        if (file) {
            setUploadedInvoiceFile(file);
        }

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
            showSuccess(t("newSimulationPage", "clientFound") || `Client found: ${existingClient.name}`);
        } else if (data.nombreTitular && allowQuickCreate) {
            // Pre-fill quick create form for new client
            setQuickClientData({
                name: data.nombreTitular,
                cif: data.cif || "",
                contactName: "",
                contactEmail: "",
                contactPhone: "",
                otherDetails: data.cups ? `CUPS: ${data.cups}` : "",
                agencyId: session?.user.agencyId ?? "",
            });
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
                .catch(() => { })
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
        setQuickClientData({
            name: "",
            cif: "",
            contactName: "",
            contactEmail: "",
            contactPhone: "",
            otherDetails: "",
            agencyId: session.user.agencyId,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!clientId) {
            setErrorMessage(t("newSimulationPage", "selectClientError"));
            showError(t("newSimulationPage", "selectClientError"));
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

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
                    alquiler: extractedData.alquiler,
                    otrosCargos: extractedData.otrosCargos,
                    reactiva: extractedData.reactiva,
                    invoiceType: extractedData.invoiceType,
                };
            }

            const created = await createSimulation(session.token, {
                clientId: clientId || undefined,
                expiresAt: new Date(expiresAt + "T23:59:59Z").toISOString(),
                payloadJson: payload,
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
            setErrorMessage(msg);
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
                    errorMessage={errorMessage}
                    submitLabel={t("newSimulationPage", "submitLabel")}
                    cancelLabel={t("actions", "cancel")}
                    onCancel={() => router.push("/internal/simulations")}
                    isSubmitting={isSubmitting}
                >
                    {/* Invoice Data Extraction - Only show if LLM is enabled */}
                    {llmEnabled && (
                        <div className="crud-form-section" style={{
                            background: "white",
                            border: "1px solid var(--scheme-neutral-900, rgba(0,0,0,0.08))",
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
                                    background: "var(--scheme-neutral-950, #f1f5f9)",
                                    border: "1px solid var(--scheme-neutral-900, rgba(0,0,0,0.08))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0
                                }}>
                                    <span style={{ fontSize: 18 }}>✨</span>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                                        {t("invoiceExtractor", "title") || "Invoice Data Extraction"}
                                    </h3>
                                </div>
                            </div>
                            <InvoiceExtractor onDataExtracted={handleInvoiceDataExtracted} />
                        </div>
                    )}

                    {/* Display Extracted Data */}
                    {llmEnabled && extractedData && (
                        <div className="crud-form-section" style={{
                            background: "white",
                            border: "1px solid #d1fae5",
                            borderRadius: 12,
                            padding: "16px 20px",
                            marginBottom: 24,
                            boxShadow: "0 2px 8px rgba(16,185,129,0.1)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16, color: "#10b981" }}>✓</span>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#065f46", fontSize: 14 }}>
                                    {t("invoiceExtractor", "extractedData") || "Extracted Invoice Data"}
                                </Typography>
                            </div>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {extractedData.nombreTitular && (
                                    <Chip label={`${t("invoiceExtractor", "client") || "Client"}: ${extractedData.nombreTitular}`} size="small" />
                                )}
                                {extractedData.cif && (
                                    <Chip label={`CIF: ${extractedData.cif}`} size="small" />
                                )}
                                {extractedData.cups && (
                                    <Chip label={`CUPS: ${extractedData.cups}`} size="small" color="primary" variant="outlined" />
                                )}
                                {extractedData.tarifaAcceso && (
                                    <Chip label={`${t("invoiceExtractor", "tariff") || "Tariff"}: ${extractedData.tarifaAcceso}`} size="small" color="secondary" variant="outlined" />
                                )}
                                {extractedData.consumoTotal !== undefined && (
                                    <Chip label={`${t("invoiceExtractor", "consumption") || "Consumption"}: ${extractedData.consumoTotal} kWh`} size="small" />
                                )}
                                {extractedData.facturaActual !== undefined && (
                                    <Chip label={`${t("invoiceExtractor", "amount") || "Amount"}: ${extractedData.facturaActual.toFixed(2)}€`} size="small" color="success" variant="outlined" />
                                )}
                                {extractedData.fechaInicio && extractedData.fechaFin && (
                                    <Chip label={`${t("invoiceExtractor", "period") || "Period"}: ${extractedData.fechaInicio} → ${extractedData.fechaFin}`} size="small" />
                                )}
                                {extractedData.invoiceType && (
                                    <Chip label={`${t("invoiceExtractor", "type") || "Type"}: ${extractedData.invoiceType}`} size="small" color="info" />
                                )}
                            </Box>
                        </div>
                    )}

                    {/* Client, Commodity Type, and Expiration Date - All in one row */}
                    <div className="crud-form-section">
                        <div className="crud-form-row" style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                            {/* Client */}
                            <div className="crud-form-group" style={{ flex: 1 }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                                        <Button
                                            type="button"
                                            variant="outlined"
                                            onClick={() => setShowQuickCreate(true)}
                                            title={t("newSimulationPage", "createNew")}

                                        >
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
                    </div>
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
                            data={quickClientData}
                            onChange={setQuickClientData}
                            onSubmit={handleQuickCreateClient}
                            errorMessage={clientFormError}
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
