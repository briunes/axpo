"use client";

import { useState } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { Button, LinearProgress } from "@mui/material";

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

interface InvoiceExtractorProps {
    onDataExtracted: (data: ExtractedInvoiceData, file?: File) => void;
    onError?: (error: string) => void;
    /** Called right before a new extraction starts — use to clear previous extracted data */
    onBeforeExtract?: () => void;
}

export function InvoiceExtractor({ onDataExtracted, onError, onBeforeExtract }: InvoiceExtractorProps) {
    const { t } = useI18n();
    const [files, setFiles] = useState<File[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);

    const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const currentType: "pdf" | "image" | null = files.length === 0 ? null : isPdf(files[0]) ? "pdf" : "image";

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
            // PDF: only 1 allowed, replace everything
            setFiles([firstIncoming]);
        } else {
            // Images: accumulate, but don't mix with PDF
            setFiles(prev => {
                if (prev.length > 0 && isPdf(prev[0])) {
                    // Currently a PDF selected — replace with images
                    return incoming.filter(f => !isPdf(f));
                }
                const existingNames = new Set(prev.map(f => f.name));
                const newOnes = incoming.filter(f => !isPdf(f) && !existingNames.has(f.name));
                return [...prev, ...newOnes];
            });
        }
        setExtractionStatus("idle");
        setStatusMessage("");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        if (selected.length > 0) addFiles(selected);
        // Reset input so same file can be re-added after removal
        e.target.value = "";
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setExtractionStatus("idle");
        setStatusMessage("");
    };

    const handleExtract = async () => {
        if (files.length === 0) return;

        onBeforeExtract?.();
        setIsExtracting(true);
        setExtractionStatus("idle");
        setStatusMessage("");
        setProgress(0);

        // Animate progress bar: ramp quickly to ~85%, then stall until done
        let rafId: ReturnType<typeof setInterval>;
        let current = 0;
        rafId = setInterval(() => {
            current += current < 70 ? 3 : current < 85 ? 0.5 : 0;
            setProgress(Math.min(current, 85));
        }, 120);

        try {
            const formData = new FormData();
            files.forEach(f => formData.append("file", f));

            console.log("Sending invoice extraction request...");
            const response = await fetch("/api/v1/internal/invoices/extract", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("axpo.internal.auth.token")}`,
                },
                body: formData,
            });

            console.log("Response status:", response.status, response.statusText);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Extraction failed" }));
                console.error("API Error Response:", error);
                const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
                const providerInfo = error.provider && error.model ? `\n\nProvider: ${error.provider}, Model: ${error.model}` : '';
                throw new Error(error.message + errorDetails + providerInfo || "Failed to extract data from invoice");
            }

            const result = await response.json();
            console.log("Extraction result:", result);

            if (result.success && result.data) {
                setExtractionStatus("success");
                setStatusMessage(result.message || "Data extracted successfully!");
                onDataExtracted(result.data, files[0]);
            } else {
                throw new Error(result.message || "No data could be extracted");
            }
        } catch (err: any) {
            console.error("=== EXTRACTION ERROR (Frontend) ===");
            console.error("Error:", err);
            console.error("===================================");
            setExtractionStatus("error");
            const errorMsg = err.message || "Failed to extract invoice data";
            setStatusMessage(errorMsg);
            if (onError) onError(errorMsg);
        } finally {
            clearInterval(rafId);
            setProgress(100);
            // Small delay so the bar flashes full before hiding
            setTimeout(() => {
                setIsExtracting(false);
                setProgress(0);
            }, 400);
        }
    };

    const handleClear = () => {
        setFiles([]);
        setExtractionStatus("idle");
        setStatusMessage("");
    };

    return (
        <div className="invoice-extractor">
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
                        <div className="file-list">
                            {files.map((f, i) => (
                                <div className="file-info" key={i}>
                                    <div className="file-info-text">
                                        <div className="file-name">{f.name}</div>
                                        <div className="file-size">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                    {currentType === "image" && (
                                        <button
                                            type="button"
                                            className="file-remove-btn"
                                            onClick={() => handleRemoveFile(i)}
                                            disabled={isExtracting}
                                            title="Remove"
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="file-actions">
                            <Button
                                variant="contained"
                                type="button"
                                className="btn-primary"
                                onClick={handleExtract}
                                disabled={isExtracting}
                            >
                                {isExtracting ? (
                                    <>
                                        <span className="spinner" />
                                        {t("invoiceExtractor", "extracting")}
                                    </>
                                ) : (
                                    <>
                                        <AutoFixHighIcon sx={{ fontSize: 18, mr: 1 }} />
                                        {t("invoiceExtractor", "extract")}
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                className="btn-secondary"
                                onClick={handleClear}
                                disabled={isExtracting}
                                variant="outlined"
                            >
                                <DeleteIcon sx={{ fontSize: 18, mr: 1 }} />
                                {t("invoiceExtractor", "remove")}
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
                            sx={{ borderRadius: 999, height: 6, mb: 1 }}
                        />
                        <span style={{ fontSize: 13, color: "var(--scheme-neutral-400, #9ca3af)" }}>
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
                        <span className="ocr-disclaimer-icon">⚠️</span>
                        <span>{t("invoiceExtractor", "ocrDisclaimer") ?? "O OCR pode conter erros. Por favor, valide os dados preenchidos antes de continuar."}</span>
                    </div>
                )}
            </div>

            <style jsx>{`
                .invoice-extractor {
                    background: var(--scheme-neutral-1100);
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 12px;
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
                    background: var(--scheme-neutral-1100);
                    border-radius: 8px;
                    padding: 20px;
                    color: var(--scheme-neutral-100);
                }

                .file-upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    border: 2px dashed var(--scheme-neutral-800);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--scheme-neutral-1000);
                }

                .file-upload-area:hover,
                .file-upload-area.dragging {
                    border-color: var(--scheme-primary-500);
                    background: var(--scheme-neutral-900);
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
                    gap: 16px;
                }

                .file-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .file-info {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--scheme-neutral-1000);
                    border-radius: 8px;
                    border: 1px solid var(--scheme-neutral-900);
                }

                .file-info-text {
                    flex: 1;
                    min-width: 0;
                }

                .file-name {
                    font-weight: 600;
                    color: var(--scheme-neutral-100);
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .file-size {
                    font-size: 13px;
                    color: var(--scheme-neutral-500);
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

                .file-actions {
                    display: flex;
                    gap: 12px;
                }

                .extraction-status {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-top: 16px;
                    font-size: 14px;
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
                    padding: 10px 14px;
                    border-radius: 8px;
                    margin-top: 10px;
                    font-size: 13px;
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
