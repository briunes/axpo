"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import BusinessIcon from "@mui/icons-material/Business";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, LinearProgress, Chip, Tooltip, CircularProgress } from "@mui/material";
import { FormSelect } from "../ui/FormSelect";
import WarningIcon from '@mui/icons-material/Warning';
export interface ExtractedInvoiceData {
    // Client/Holder Information
    cups?: string;
    nombreTitular?: string;
    personaContacto?: string;
    direccion?: string;
    comercializadorActual?: string;
    cif?: string;

    // Tariff and Zone
    tarifaAcceso?: string;
    zonaGeografica?: string;
    perfilCarga?: string;

    // Billing Period
    fechaInicio?: string;
    fechaFin?: string;

    // Consumption (Energy)
    consumoP1?: number;
    consumoP2?: number;
    consumoP3?: number;
    consumoP4?: number;
    consumoP5?: number;
    consumoP6?: number;
    consumoAnual?: number;
    consumoTotal?: number; // For gas

    // Contracted Power
    potenciaP1?: number;
    potenciaP2?: number;
    potenciaP3?: number;
    potenciaP4?: number;
    potenciaP5?: number;
    potenciaP6?: number;

    // Financial
    facturaActual?: number;
    excesoPotencia?: number;
    reactiva?: number;
    alquiler?: number;
    otrosCargos?: number;
    ivaTasa?: number;
    impuestoElectricoTasa?: number;
    impuestoHidrocarburo?: number;

    // Current supplier unit prices (from invoice detail)
    precioPotenciaP1?: number;
    precioPotenciaP2?: number;
    precioPotenciaP3?: number;
    precioPotenciaP4?: number;
    precioPotenciaP5?: number;
    precioPotenciaP6?: number;
    precioEnergiaP1?: number;
    precioEnergiaP2?: number;
    precioEnergiaP3?: number;
    precioEnergiaP4?: number;
    precioEnergiaP5?: number;
    precioEnergiaP6?: number;

    // Gas specific
    telemedida?: string;

    // Type detection
    invoiceType?: "ELECTRICITY" | "GAS" | "BOTH";
}

export interface InvoiceExtractionContext {
    file?: File;
    providerDetectionLogId?: string | null;
    extractionLogId?: string | null;
    isMostlyEmpty?: boolean;
}

interface InvoiceExtractorProps {
    onDataExtracted: (data: ExtractedInvoiceData, context?: InvoiceExtractionContext) => void;
    onError?: (error: string) => void;
    /** Called right before a new extraction starts — use to clear previous extracted data */
    onBeforeExtract?: () => void;
    /** Called when file presence changes (true = file uploaded, false = no file) */
    onFileChange?: (hasFile: boolean) => void;
}

type InvoiceProviderOption = {
    id: string;
    name: string;
    slug: string;
    needsPromptConfig: boolean;
};

let invoiceProvidersCache: InvoiceProviderOption[] | null = null;
let invoiceProvidersPromise: Promise<InvoiceProviderOption[]> | null = null;

async function loadInvoiceProviders(token: string | null): Promise<InvoiceProviderOption[]> {
    if (invoiceProvidersCache) return invoiceProvidersCache;
    if (invoiceProvidersPromise) return invoiceProvidersPromise;

    invoiceProvidersPromise = fetch("/api/v1/internal/invoice-providers", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
            const providers = Array.isArray(data) ? data : [];
            invoiceProvidersCache = providers;
            return providers;
        })
        .catch(() => [])
        .finally(() => {
            invoiceProvidersPromise = null;
        });

    return invoiceProvidersPromise;
}

export function InvoiceExtractor({ onDataExtracted, onError, onBeforeExtract, onFileChange }: InvoiceExtractorProps) {
    const { t } = useI18n();
    const [files, setFiles] = useState<File[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");

    useEffect(() => {
        onFileChange?.(files.length > 0);
    }, [files.length]);
    const [statusMessage, setStatusMessage] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);

    // All providers (for the select dropdown)
    const [allProviders, setAllProviders] = useState<InvoiceProviderOption[]>([]);
    const [isAddingProvider, setIsAddingProvider] = useState(false);

    // Provider detection state
    const [detectionStatus, setDetectionStatus] = useState<"idle" | "detecting" | "detected" | "failed">("idle");
    const [detectedProvider, setDetectedProvider] = useState<{
        providerId: string | null;
        providerName: string | null;
        isKnown: boolean;
        confidence: "high" | "low";
        invoiceType: "ELECTRICITY" | "GAS" | "BOTH" | null;
    } | null>(null);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [providerDetectionLogId, setProviderDetectionLogId] = useState<string | null>(null);
    const [extractionLogId, setExtractionLogId] = useState<string | null>(null);
    const detectionAbortRef = useRef<AbortController | null>(null);

    // Load all providers for the select
    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("axpo.internal.auth.token") : null;
        let cancelled = false;
        loadInvoiceProviders(token).then((providers) => {
            if (!cancelled) setAllProviders(providers);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const currentType: "pdf" | "image" | null = files.length === 0 ? null : isPdf(files[0]) ? "pdf" : "image";

    // Auto-detect provider whenever files change (debounced to avoid multiple rapid requests)
    useEffect(() => {
        if (files.length === 0) {
            setDetectionStatus("idle");
            setDetectedProvider(null);
            setSelectedProviderId(null);
            setProviderDetectionLogId(null);
            setExtractionLogId(null);
            return;
        }

        setDetectionStatus("detecting");

        // Debounce: wait 400ms after last file change before sending the request
        const debounceTimer = setTimeout(() => {
            // Cancel any in-flight detection
            detectionAbortRef.current?.abort();
            const controller = new AbortController();
            detectionAbortRef.current = controller;

            setDetectedProvider(null);
            setSelectedProviderId(null);
            setProviderDetectionLogId(null);

            const run = async () => {
                try {
                    const formData = new FormData();
                    // Only send the first file for detection — all images are from the same invoice
                    formData.append("file", files[0]);

                    const response = await fetch("/api/v1/internal/invoices/detect-provider", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("axpo.internal.auth.token")}`,
                        },
                        body: formData,
                        signal: controller.signal,
                    });

                    const result = await response.json().catch(() => null);
                    setProviderDetectionLogId(result?.ocrLogId ?? null);

                    if (!response.ok) {
                        setDetectionStatus("failed");
                        return;
                    }

                    if (result?.success) {
                        setDetectedProvider({
                            providerId: result.providerId,
                            providerName: result.providerName,
                            isKnown: result.isKnown,
                            confidence: result.confidence,
                            invoiceType: result.invoiceType ?? null,
                        });
                        setSelectedProviderId(result.providerId ?? null);
                        setDetectionStatus("detected");
                    } else {
                        setDetectionStatus("failed");
                    }
                } catch (err: any) {
                    if (err.name === "AbortError") return;
                    setDetectionStatus("failed");
                }
            };

            run();
        }, 400);

        return () => {
            clearTimeout(debounceTimer);
            detectionAbortRef.current?.abort();
        };
    }, [files]);

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files ?? []);
        if (droppedFiles.length === 0) return;
        addFiles(droppedFiles);
    };

    const addFiles = (incoming: File[]) => {
        if (incoming.length === 0) return;
        const firstIncoming = incoming[0];
        if (isPdf(firstIncoming)) {
            setFiles([firstIncoming]);
        } else {
            setFiles(prev => {
                if (prev.length > 0 && isPdf(prev[0])) {
                    return incoming.filter(f => !isPdf(f));
                }
                const existingNames = new Set(prev.map(f => f.name));
                const newOnes = incoming.filter(f => !isPdf(f) && !existingNames.has(f.name));
                return [...prev, ...newOnes];
            });
        }
        setExtractionStatus("idle");
        setStatusMessage("");
        setProviderDetectionLogId(null);
        setExtractionLogId(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        if (selected.length > 0) addFiles(selected);
        e.target.value = "";
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setExtractionStatus("idle");
        setStatusMessage("");
        setProviderDetectionLogId(null);
        setExtractionLogId(null);
    };

    const handleExtract = async () => {
        if (files.length === 0) return;

        onBeforeExtract?.();
        setIsExtracting(true);
        setExtractionStatus("idle");
        setStatusMessage("");
        setProgress(0);
        setExtractionLogId(null);

        let rafId: ReturnType<typeof setInterval>;
        let current = 0;
        rafId = setInterval(() => {
            // Eases toward 90% over ~20 seconds
            current += (90 - current) * 0.011;
            setProgress(Math.min(current, 90));
        }, 200);

        try {
            const formData = new FormData();
            files.forEach(f => formData.append("file", f));
            if (selectedProviderId) {
                // Only pass the providerId if the provider has an actual configured prompt
                const selectedProvider = allProviders.find(p => p.id === selectedProviderId);
                if (selectedProvider && !selectedProvider.needsPromptConfig) {
                    formData.append("providerId", selectedProviderId);
                }
            }
            // Pass the detected invoice type so the extract route picks the correct prompt
            const invoiceType = detectedProvider?.invoiceType;
            if (invoiceType === "ELECTRICITY" || invoiceType === "GAS") {
                formData.append("invoiceType", invoiceType);
            }

            const response = await fetch("/api/v1/internal/invoices/extract", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("axpo.internal.auth.token")}`,
                },
                body: formData,
            });

            const result = await response.json().catch(() => null);
            setExtractionLogId(result?.ocrLogId ?? null);

            if (!response.ok) {
                const error = result ?? { message: "Extraction failed" };
                const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
                const providerInfo = error.provider && error.model ? `\n\nProvider: ${error.provider}, Model: ${error.model}` : '';
                throw new Error(error.message + errorDetails + providerInfo || "Failed to extract data from invoice");
            }

            if (result?.success && result.data) {
                setExtractionStatus("success");
                setStatusMessage(t("invoiceExtractor", "success"));

                // Detect mostly-empty result: fewer than 3 non-null/non-empty fields
                const dataValues = Object.entries(result.data as Record<string, unknown>)
                    .filter(([key]) => key !== "invoiceType")
                    .map(([, v]) => v);
                const filledCount = dataValues.filter(v => v !== null && v !== undefined && v !== "").length;
                const isEmpty = filledCount < 3;

                onDataExtracted(result.data, {
                    file: files[0],
                    providerDetectionLogId,
                    extractionLogId: result.ocrLogId ?? null,
                    isMostlyEmpty: isEmpty,
                });
            } else {
                throw new Error(result?.message || t("invoiceExtractor", "error"));
            }
        } catch (err: any) {
            setExtractionStatus("error");
            const errorMsg = err.message || t("invoiceExtractor", "error");
            setStatusMessage(errorMsg);
            if (onError) onError(errorMsg);
        } finally {
            clearInterval(rafId);
            setProgress(100);
            setTimeout(() => {
                setIsExtracting(false);
                setProgress(0);
            }, 600);
        }
    };

    const handleClear = () => {
        setFiles([]);
        setExtractionStatus("idle");
        setStatusMessage("");
        setProviderDetectionLogId(null);
        setExtractionLogId(null);
    };

    const handleAddToProviderList = async () => {
        if (!detectedProvider?.providerName) return;
        setIsAddingProvider(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("axpo.internal.auth.token") : null;
        try {
            const res = await fetch("/api/v1/internal/invoice-providers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: detectedProvider.providerName,
                    prompt: "",
                    isActive: true,
                    needsPromptConfig: true,
                }),
            });
            if (res.ok) {
                const created = await res.json();
                invoiceProvidersCache = [...(invoiceProvidersCache ?? allProviders), created];
                setAllProviders(invoiceProvidersCache);
                setSelectedProviderId(created.id);
                setDetectedProvider(prev => prev ? { ...prev, providerId: created.id, isKnown: true } : prev);
            }
        } catch (err) {
            // silently fail
        } finally {
            setIsAddingProvider(false);
        }
    };

    return (
        <div className="invoice-extractor notranslate" translate="no">
            <div className="extractor-header">
                <div className="extractor-icon">
                    <AutoFixHighIcon />
                </div>
                <div>
                    <h3 className="extractor-title">{t("invoiceExtractor", "title")}</h3>
                    <p className="extractor-description">{t("invoiceExtractor", "description")}</p>
                </div>
            </div>

            <div className="extractor-content">
                {/* Upload area — always visible for images so more can be added */}
                {(files.length === 0 || currentType === "image") && (
                    <label
                        className={`file-upload-area${isDragging ? " dragging" : ""}${files.length > 0 ? " compact" : ""}`}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            multiple={currentType !== "pdf"}
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />
                        <CloudUploadIcon sx={{ fontSize: files.length > 0 ? 28 : 48, color: "text.disabled", mb: files.length > 0 ? 0.5 : 2 }} />
                        <div className="upload-text">
                            <strong>{files.length > 0 ? t("invoiceExtractor", "addMoreImages") ?? "Add more images" : t("invoiceExtractor", "uploadPrompt")}</strong>
                            {files.length === 0 && <span>{t("invoiceExtractor", "uploadHint")}</span>}
                        </div>
                    </label>
                )}

                {files.length > 0 && (
                    <div className="file-selected">
                        {/* Image grid (multiple files) or single PDF row */}
                        {currentType === "image" ? (
                            <div className="image-cards-grid">
                                {files.map((f, i) => (
                                    <div
                                        className="image-card"
                                        key={`${f.name}-${f.size}-${f.lastModified}`}
                                    >
                                        <button
                                            type="button"
                                            className="image-card-remove"
                                            onClick={() => handleRemoveFile(i)}
                                            disabled={isExtracting}
                                            title="Remove"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </button>
                                        <div className="image-card-icon">🖼️</div>
                                        <div className="image-card-name">{f.name}</div>
                                        <div className="image-card-size">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="file-row">
                                <div className="file-list">
                                    {files.map((f, i) => (
                                        <div
                                            className="file-info"
                                            key={`${f.name}-${f.size}-${f.lastModified}`}
                                        >
                                            <div className="file-info-text">
                                                <span className="file-name">{f.name}</span>
                                                <span className="file-size">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                            {/* Provider detection inline for PDF */}
                                            <div className="provider-section pdf-inline">
                                                {detectionStatus === "detecting" && (
                                                    <span className="provider-detecting-label">
                                                        <span className="provider-spinner" />
                                                        {t("invoiceExtractor", "detectingProvider") ?? "Detecting..."}
                                                    </span>
                                                )}
                                                {detectionStatus === "detected" && detectedProvider && (
                                                    <div className={`provider-inline-badge ${detectedProvider.isKnown ? "known" : "unknown"}`}>
                                                        {detectedProvider.isKnown ? (
                                                            <BusinessIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                                                        ) : (
                                                            <HelpOutlineIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                                                        )}
                                                        <span className="provider-inline-label">
                                                            {detectedProvider.isKnown
                                                                ? (t("invoiceExtractor", "detectedProvider") ?? "Provider detected:")
                                                                : (t("invoiceExtractor", "unknownProvider") ?? "Provider not in list:")}
                                                        </span>
                                                        {!detectedProvider.isKnown && detectedProvider.providerName && (
                                                            <span className="provider-detected-name">{detectedProvider.providerName}</span>
                                                        )}
                                                        <div style={{ minWidth: 180 }}>
                                                            <FormSelect
                                                                label=""
                                                                value={selectedProviderId ?? ""}
                                                                onChange={v => setSelectedProviderId(v as string | null)}
                                                                placeholder={t("invoiceExtractor", "selectProvider") ?? "Select provider"}
                                                                options={allProviders.map(p => ({ value: p.id, label: p.name }))}
                                                                sx={{ width: 300 }}
                                                            />
                                                        </div>
                                                        {!detectedProvider.isKnown && detectedProvider.providerName && !allProviders.find(p => p.name.toLowerCase() === detectedProvider.providerName!.toLowerCase()) && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="warning"
                                                                startIcon={isAddingProvider ? <CircularProgress size={12} /> : <AddCircleOutlineIcon fontSize="small" />}
                                                                onClick={handleAddToProviderList}
                                                                disabled={isAddingProvider}
                                                                sx={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
                                                            >
                                                                {t("invoiceExtractor", "addToList") ?? "Add to list"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {detectionStatus === "failed" && (
                                                    <div className="provider-inline-badge failed">
                                                        <HelpOutlineIcon sx={{ fontSize: 14, flexShrink: 0, opacity: 0.5 }} />
                                                        {allProviders.length > 0 && (
                                                            <div style={{ minWidth: 180 }}>
                                                                <FormSelect
                                                                    label=""
                                                                    value={selectedProviderId ?? ""}
                                                                    onChange={v => setSelectedProviderId(v as string | null)}
                                                                    placeholder={t("invoiceExtractor", "selectProvider") ?? "Select provider"}
                                                                    options={allProviders.map(p => ({ value: p.id, label: p.name }))}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="file-remove-btn"
                                                onClick={handleClear}
                                                disabled={isExtracting}
                                                title={t("invoiceExtractor", "remove") ?? "Remove"}
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Provider detection — shown once below cards for images only */}
                        {currentType === "image" && <div className="provider-section">
                            {detectionStatus === "detecting" && (
                                <span className="provider-detecting-label">
                                    <span className="provider-spinner" />
                                    {t("invoiceExtractor", "detectingProvider") ?? "Detecting provider..."}
                                </span>
                            )}
                            {detectionStatus === "detected" && detectedProvider && (
                                <div className={`provider-inline-badge ${detectedProvider.isKnown ? "known" : "unknown"}`}>
                                    {detectedProvider.isKnown ? (
                                        <BusinessIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                                    ) : (
                                        <HelpOutlineIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                                    )}
                                    <span className="provider-inline-label">
                                        {detectedProvider.isKnown
                                            ? (t("invoiceExtractor", "detectedProvider") ?? "Provider detected:")
                                            : (t("invoiceExtractor", "unknownProvider") ?? "Provider not in list:")}
                                        {detectedProvider.confidence === "low" && (
                                            <Tooltip title={t("invoiceExtractor", "lowConfidenceHint") ?? "Low confidence — may not be accurate"}>
                                                <HelpOutlineIcon sx={{ fontSize: 12, ml: 0.5, verticalAlign: "middle", opacity: 0.5 }} />
                                            </Tooltip>
                                        )}
                                    </span>
                                    {!detectedProvider.isKnown && detectedProvider.providerName && (
                                        <span className="provider-detected-name">{detectedProvider.providerName}</span>
                                    )}
                                    <div style={{ minWidth: 180 }}>
                                        <FormSelect
                                            label=""
                                            value={selectedProviderId ?? ""}
                                            onChange={v => setSelectedProviderId(v as string | null)}
                                            placeholder={t("invoiceExtractor", "selectProvider") ?? "Select provider"}
                                            options={allProviders.map(p => ({ value: p.id, label: p.name }))}
                                            sx={{ width: 300 }}
                                        />
                                    </div>
                                    {!detectedProvider.isKnown && detectedProvider.providerName && !allProviders.find(p => p.name.toLowerCase() === detectedProvider.providerName!.toLowerCase()) && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            startIcon={isAddingProvider ? <CircularProgress size={12} /> : <AddCircleOutlineIcon fontSize="small" />}
                                            onClick={handleAddToProviderList}
                                            disabled={isAddingProvider}
                                            sx={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
                                        >
                                            {t("invoiceExtractor", "addToList") ?? "Add to list"}
                                        </Button>
                                    )}
                                </div>
                            )}
                            {detectionStatus === "failed" && (
                                <div className="provider-inline-badge failed">
                                    <HelpOutlineIcon sx={{ fontSize: 14, flexShrink: 0, opacity: 0.5 }} />
                                    <span className="provider-inline-label" style={{ opacity: 0.6 }}>
                                        {t("invoiceExtractor", "providerDetectionFailed") ?? "Could not detect provider"}
                                    </span>
                                    {allProviders.length > 0 && (
                                        <div style={{ minWidth: 180 }}>
                                            <FormSelect
                                                label=""
                                                value={selectedProviderId ?? ""}
                                                onChange={v => setSelectedProviderId(v as string | null)}
                                                placeholder={t("invoiceExtractor", "selectProvider") ?? "Select provider"}
                                                options={allProviders.map(p => ({ value: p.id, label: p.name }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>}

                        {/* Row 2: Extract Data button */}
                        <div className="file-actions">
                            <Button
                                variant="contained"
                                type="button"
                                className="btn-primary"
                                onClick={handleExtract}
                                disabled={isExtracting || detectionStatus === "detecting"}
                                size="small"
                            >
                                {isExtracting ? (
                                    <>
                                        <span className="spinner" />
                                        {t("invoiceExtractor", "extracting")}
                                    </>
                                ) : (
                                    <>
                                        <AutoFixHighIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                        {t("invoiceExtractor", "extract")}
                                    </>
                                )}
                            </Button>
                        </div>

                    </div>
                )}

                {isExtracting && (
                    <div style={{ marginTop: 16 }}>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            color="primary"
                            sx={{
                                borderRadius: 999,
                                height: 6,
                                mb: 1,
                                "& .MuiLinearProgress-bar": {
                                    transition: progress >= 100 ? "transform 0.3s ease-in" : "transform 0.2s linear",
                                },
                            }}
                        />
                        <span style={{color: "var(--scheme-neutral-400, #9ca3af)" }}>
                            {t("invoiceExtractor", "extracting")}
                        </span>
                    </div>
                )}

                {extractionStatus !== "idle" && !isExtracting && (
                    <div className={`extraction-status status-${extractionStatus}`}>
                        {extractionStatus === "success" ? (
                            <CheckCircleIcon sx={{ fontSize: 24 }} />
                        ) : (
                            <ErrorIcon sx={{ fontSize: 24 }} />
                        )}
                        <span>{statusMessage}</span>
                    </div>
                )}

                {extractionStatus === "success" && !isExtracting && (
                    <div className="ocr-disclaimer">
                        <WarningIcon fontSize="small" sx={{ color: "warning.main" }} />
                        <span>{t("invoiceExtractor", "ocrDisclaimer") ?? "O OCR pode conter erros. Por favor, valide os dados preenchidos antes de continuar."}</span>
                    </div>
                )}


            </div>

            <style jsx>{`
                .invoice-extractor {
                    background: transparent;
                    border: 0;
                    border-radius: 0;
                    padding: 0;
                    color: var(--scheme-neutral-100);
                }

                .extractor-header {
                    display: none;
                }

                .extractor-icon {
                    display: none;
                }

                .extractor-title {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                }

                .extractor-description {
                    font-size: 14px;
                    margin: 0;
                    opacity: 0.9;
                }

                .extractor-content {
                    background: transparent;
                    border-radius: 0;
                    padding: 0;
                    color: var(--scheme-neutral-100);
                }

                .file-upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 190px;
                    padding: 36px 20px;
                    border: 1px dashed color-mix(in srgb, var(--scheme-neutral-800) 86%, var(--scheme-neutral-700));
                    border-radius: 12px;
                    cursor: pointer;
                    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease, transform 160ms ease;
                    background:
                        linear-gradient(180deg, color-mix(in srgb, var(--scheme-surface-raised) 92%, var(--scheme-surface-raised-subtle)), var(--scheme-surface-raised-muted));
                }

                .file-upload-area:hover,
                .file-upload-area.dragging {
                    border-color: var(--scheme-brand-600);
                    background: var(--scheme-surface-raised);
                    box-shadow: 0 0 0 4px var(--scheme-brand-600-15);
                    transform: translateY(-1px);
                }

                .upload-text {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    text-align: center;
                }

                .upload-text strong {
                    color: var(--scheme-neutral-100);
                    font-size: 16px;
                }

                .upload-text span {
                    color: var(--scheme-neutral-500);
                    font-size: 14px;
                }

                .file-upload-area.compact {
                    padding: 14px 20px;
                    flex-direction: row;
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .file-upload-area.compact .upload-text strong {
                    font-size: 14px;
                }

                .file-selected {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .file-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .file-list {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    background: var(--scheme-surface-raised-muted);
                    border-radius: 10px;
                    border: 1px solid color-mix(in srgb, var(--scheme-neutral-900) 82%, transparent);
                    min-width: 0;
                }

                .file-info-text {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .file-name {
                    font-weight: 600;
                    color: var(--scheme-neutral-100);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .file-size {
                    font-size: 12px;
                    color: var(--scheme-neutral-500);
                    flex-shrink: 0;
                }

                .file-remove-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--scheme-neutral-500);
                    display: flex;
                    align-items: center;
                    padding: 4px;
                    border-radius: 4px;
                    flex-shrink: 0;
                    margin-left: 8px;
                    transition: color 0.15s;
                }

                .file-remove-btn:hover:not(:disabled) {
                    color: var(--scheme-error-400, #ef4444);
                }

                /* Provider detection row */
                .provider-detection {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 6px 10px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                }

                .provider-detection-inner {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .provider-detection-left {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex: 1;
                    min-width: 0;
                }

                .provider-select-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .provider-detection.detecting {
                    background: var(--scheme-neutral-1000);
                    border-color: var(--scheme-neutral-800);
                    color: var(--scheme-neutral-400);
                }

                .provider-detection.known {
                    background: #ecfdf5;
                    border-color: #10b981;
                    color: #065f46;
                }

                [data-theme="dark"] .provider-detection.known {
                    background: #0d2118;
                    border-color: #1b5e40;
                    color: #6ee7b7;
                }

                .provider-detection.unknown {
                    background: #fffbeb;
                    border-color: #f59e0b;
                    color: #78350f;
                }

                [data-theme="dark"] .provider-detection.unknown {
                    background: #1c1507;
                    border-color: #92400e;
                    color: #fcd34d;
                }

                .provider-detection.failed {
                    background: var(--scheme-neutral-1000);
                    border-color: var(--scheme-neutral-800);
                    color: var(--scheme-neutral-500);
                }

                .provider-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid currentColor;
                    border-top-color: transparent;
                    border-radius: 50%;
                    display: inline-block;
                    flex-shrink: 0;
                    animation: spin 0.7s linear infinite;
                }

                .file-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-start;
                }

                .file-actions .MuiButton-root {
                    border-radius: 9px;
                    min-height: 34px;
                    box-shadow: none;
                }

                /* Image cards grid */
                .image-cards-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .image-card {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 10px 12px 8px;
                    background: var(--scheme-neutral-1000);
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 8px;
                    min-width: 100px;
                    max-width: 140px;
                    flex: 1 1 100px;
                    text-align: center;
                }

                .image-card-remove {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--scheme-neutral-500);
                    display: flex;
                    align-items: center;
                    padding: 2px;
                    border-radius: 3px;
                    transition: color 0.15s;
                    line-height: 1;
                }

                .image-card-remove:hover:not(:disabled) {
                    color: var(--scheme-error-400, #ef4444);
                }

                .image-card-icon {
                    font-size: 20px;
                    line-height: 1;
                }

                .image-card-name {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--scheme-neutral-200);
                    word-break: break-all;
                    line-height: 1.3;
                    max-width: 100%;
                }

                .image-card-size {
                    font-size: 10px;
                    color: var(--scheme-neutral-500);
                }

                /* Provider section — shown once below all files */
                .provider-section {
                    display: flex;
                    align-items: center;
                    min-height: 32px;
                }

                /* For PDF: provider sits inline inside the file-info row */
                .provider-section.pdf-inline {
                    flex: 1;
                    justify-content: flex-end;
                    min-height: unset;
                    margin: 0;
                }

                .provider-detecting-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: var(--scheme-neutral-400);
                    white-space: nowrap;
                }

                .provider-inline-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 8px 6px 10px;
                    border-radius: 9px;
                    font-size: 12px;
                    border: 1px solid transparent;
                }

                .provider-inline-badge.known {
                    background: #ecfdf5;
                    border-color: #10b981;
                    color: #065f46;
                }

                [data-theme="dark"] .provider-inline-badge.known {
                    background: #0d2118;
                    border-color: #1b5e40;
                    color: #6ee7b7;
                }

                .provider-inline-badge.unknown {
                    background: #fffbeb;
                    border-color: #f59e0b;
                    color: #78350f;
                }

                [data-theme="dark"] .provider-inline-badge.unknown {
                    background: #1c1507;
                    border-color: #92400e;
                    color: #fcd34d;
                }

                .provider-inline-badge.failed {
                    background: var(--scheme-neutral-1000);
                    border-color: var(--scheme-neutral-800);
                    color: var(--scheme-neutral-500);
                }

                .provider-inline-label {
                    font-weight: 700;
                    white-space: nowrap;
                    font-size: 11px;
                    letter-spacing: 0.02em;
                }

                .provider-detected-name {
                    font-size: 12px;
                    font-weight: 700;
                    opacity: 0.85;
                    white-space: nowrap;
                    max-width: 160px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .extraction-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    margin-top: 0;
                    margin-bottom: 10px;
                    margin-top: 10px;

                }

                .status-success {
                    background: #ecfdf5;
                    color: #065f46;
                    border: 1px solid #10b981;
                }

                [data-theme="dark"] .status-success {
                    background: #0d1f17;
                    color: #9dd8bc;
                    border: 1px solid #1b3a2a;
                }

                .status-error {
                    background: #fef2f2;
                    color: #991b1b;
                    border: 1px solid #ef4444;
                }

                .ocr-disclaimer {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    margin-top: 0;
                    font-size: 12px;
                    background: #fffbeb;
                    color: #78350f;
                    border: 1px solid #f59e0b;
                }

                [data-theme="dark"] .ocr-disclaimer {
                    background: #1c1507;
                    color: #fcd34d;
                    border: 1px solid #3d2a05;
                }

                .ocr-disclaimer-icon {
                    flex-shrink: 0;
                    font-size: 15px;
                    line-height: 1.3;
                }

                .ocr-report-issue-banner {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    padding: 10px 12px;
                    border-radius: 6px;
                    margin-top: 0;
                    font-size: 12px;
                    background: #fffbeb;
                    color: #78350f;
                    border: 1px solid #f59e0b;
                }

                [data-theme="dark"] .ocr-report-issue-banner {
                    background: #1c1507;
                    color: #fcd34d;
                    border: 1px solid #3d2a05;
                }

                .ocr-report-issue-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 7px;
                    font-size: 12px;
                    font-weight: 500;
                    line-height: 1.4;
                }

                .ocr-report-issue-form {
                    margin-top: 8px;
                }

                .ocr-report-textarea {
                    width: 100%;
                    box-sizing: border-box;
                    border: 1px solid #f59e0b;
                    border-radius: 5px;
                    padding: 7px 10px;
                    font-size: 12px;
                    font-family: inherit;
                    resize: vertical;
                    background: #fff;
                    color: #1a1a1a;
                    outline: none;
                }

                [data-theme="dark"] .ocr-report-textarea {
                    background: #0f0900;
                    color: #fcd34d;
                    border-color: #3d2a05;
                }

                .ocr-report-submitted {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    background: #f0fdf4;
                    color: #166534;
                    border: 1px solid #86efac;
                }

                [data-theme="dark"] .ocr-report-submitted {
                    background: #052e16;
                    color: #86efac;
                    border: 1px solid #166534;
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    display: inline-block;
                    margin-right: 8px;
                    animation: spin 0.6s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
