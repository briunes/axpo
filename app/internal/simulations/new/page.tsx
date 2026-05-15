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
        address: {},
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
    const [isDarkMode, setIsDarkMode] = useState(false);

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
                address: {},
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
                address: {},
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
            address: {},
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
                                onBeforeExtract={() => setExtractedData(null)}
                            />
                        </div>
                    )}

                    {/* Display Extracted Data */}
                    {llmEnabled && extractedData && (
                        <div style={{
                            background: isDarkMode ? "linear-gradient(135deg, #0d1f17, #12261d)" : "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                            border: isDarkMode ? "1px solid #1b3a2a" : "1px solid #86efac",
                            borderRadius: 12,
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
                                {extractedData.invoiceType && (
                                    <span style={{
                                        marginLeft: "auto",
                                        padding: "2px 10px",
                                        borderRadius: 20,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        background: extractedData.invoiceType === "GAS" ? "#1e3a5f" : "#7c3aed",
                                        color: "#fff",
                                    }}>
                                        {extractedData.invoiceType}
                                    </span>
                                )}
                            </div>

                            {/* Grid of fields */}
                            {(() => {
                                const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 };
                                const valueStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827" };
                                const missingStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: isDarkMode ? "#a16207" : "#92400e", fontStyle: "italic", display: "flex", alignItems: "center", gap: 4 };
                                const warnIcon = <span title="Not extracted by AI" style={{ fontSize: 13, lineHeight: 1 }}>⚠️</span>;
                                return (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px 20px" }}>
                                        {/* CLIENT - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldClient")}</div>
                                            {extractedData.nombreTitular
                                                ? <div style={valueStyle}>{extractedData.nombreTitular}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* CIF - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldCIF")}</div>
                                            {extractedData.cif
                                                ? <div style={valueStyle}>{extractedData.cif}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* CUPS - always show, span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldCUPS")}</div>
                                            {extractedData.cups
                                                ? <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", fontFamily: "monospace" }}>{extractedData.cups}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* TARIFF - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldTariff")}</div>
                                            {extractedData.tarifaAcceso
                                                ? <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{extractedData.tarifaAcceso}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* ZONE - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldZone")}</div>
                                            {extractedData.zonaGeografica
                                                ? <div style={valueStyle}>{extractedData.zonaGeografica}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* BILLING PERIOD - always show, span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldPeriod")}</div>
                                            {extractedData.fechaInicio && extractedData.fechaFin
                                                ? <div style={valueStyle}>{extractedData.fechaInicio} → {extractedData.fechaFin}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* AMOUNT - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldAmount")}</div>
                                            {extractedData.facturaActual !== undefined
                                                ? <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{extractedData.facturaActual.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* CURRENT SUPPLIER - always show */}
                                        <div>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldSupplier")}</div>
                                            {extractedData.comercializadorActual
                                                ? <div style={valueStyle}>{extractedData.comercializadorActual}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* ADDRESS - always show, span 2 */}
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div style={labelStyle}>{t("invoiceExtractor", "fieldAddress")}</div>
                                            {extractedData.direccion
                                                ? <div style={valueStyle}>{extractedData.direccion}</div>
                                                : <div style={missingStyle}>{warnIcon} Not found</div>}
                                        </div>
                                        {/* EXCESS POWER - only show if present */}
                                        {extractedData.excesoPotencia !== undefined && (
                                            <div>
                                                <div style={labelStyle}>{t("invoiceExtractor", "fieldExcesoPotencia")}</div>
                                                <div style={valueStyle}>{extractedData.excesoPotencia.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Consumption table: consumo per period */}
                            {(() => {
                                const periods = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
                                const activeConsumo = periods.filter(p =>
                                    extractedData[`consumo${p}` as keyof typeof extractedData] !== undefined
                                );
                                if (activeConsumo.length === 0) return null;
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
                                                        {activeConsumo.map(p => (
                                                            <th key={p} style={{ textAlign: "center", padding: "3px 12px", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}>{p}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ padding: "4px 10px 4px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>Energy (kWh)</td>
                                                        {activeConsumo.map(p => {
                                                            const val = extractedData[`consumo${p}` as keyof typeof extractedData] as number | undefined;
                                                            return <td key={p} style={{ textAlign: "center", padding: "4px 12px", fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827", fontFamily: "monospace", fontSize: 12 }}>{val !== undefined ? val.toLocaleString("es-ES") : "—"}</td>;
                                                        })}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Price table: current supplier unit prices */}
                            {(() => {
                                const periods = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
                                const activePeriods = periods.filter(p =>
                                    extractedData[`precioPotencia${p}` as keyof typeof extractedData] !== undefined ||
                                    extractedData[`precioEnergia${p}` as keyof typeof extractedData] !== undefined
                                );
                                if (activePeriods.length === 0) return null;
                                const hasPotencia = periods.some(p => extractedData[`precioPotencia${p}` as keyof typeof extractedData] !== undefined);
                                const hasEnergia = periods.some(p => extractedData[`precioEnergia${p}` as keyof typeof extractedData] !== undefined);
                                return (
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? "#8ca397" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                            {t("invoiceExtractor", "fieldCurrentPrices")}
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: "left", padding: "3px 10px 3px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}></th>
                                                        {activePeriods.map(p => (
                                                            <th key={p} style={{ textAlign: "center", padding: "3px 12px", color: isDarkMode ? "#8ca397" : "#6b7280", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${isDarkMode ? "#2a3a32" : "#e5e7eb"}` }}>{p}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {hasPotencia && (
                                                        <tr>
                                                            <td style={{ padding: "4px 10px 4px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>{t("invoiceExtractor", "fieldPricePower")} (€/kW/día)</td>
                                                            {activePeriods.map(p => {
                                                                const val = extractedData[`precioPotencia${p}` as keyof typeof extractedData] as number | undefined;
                                                                return <td key={p} style={{ textAlign: "center", padding: "4px 12px", fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827", fontFamily: "monospace", fontSize: 12 }}>{val !== undefined ? val.toFixed(6) : "—"}</td>;
                                                            })}
                                                        </tr>
                                                    )}
                                                    {hasEnergia && (
                                                        <tr>
                                                            <td style={{ padding: "4px 10px 4px 0", color: isDarkMode ? "#8ca397" : "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>{t("invoiceExtractor", "fieldPriceEnergy")} (€/kWh)</td>
                                                            {activePeriods.map(p => {
                                                                const val = extractedData[`precioEnergia${p}` as keyof typeof extractedData] as number | undefined;
                                                                return <td key={p} style={{ textAlign: "center", padding: "4px 12px", fontWeight: 600, color: isDarkMode ? "#e5eee9" : "#111827", fontFamily: "monospace", fontSize: 12 }}>{val !== undefined ? val.toFixed(6) : "—"}</td>;
                                                            })}
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}
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
                            agencies={userAgency}
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
