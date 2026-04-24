"use client";

import { useState } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

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
    reactiva?: number;
    alquiler?: number;
    otrosCargos?: number;

    // Gas specific
    telemedida?: string;

    // Type detection
    invoiceType?: "ELECTRICITY" | "GAS" | "BOTH";
}

interface InvoiceExtractorProps {
    onDataExtracted: (data: ExtractedInvoiceData, file?: File) => void;
    onError?: (error: string) => void;
}

export function InvoiceExtractor({ onDataExtracted, onError }: InvoiceExtractorProps) {
    const { t } = useI18n();
    const [file, setFile] = useState<File | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");
    const [statusMessage, setStatusMessage] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setExtractionStatus("idle");
            setStatusMessage("");
        }
    };

    const handleExtract = async () => {
        if (!file) return;

        setIsExtracting(true);
        setExtractionStatus("idle");
        setStatusMessage("");

        try {
            const formData = new FormData();
            formData.append("file", file);

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
                onDataExtracted(result.data, file);
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
            setIsExtracting(false);
        }
    };

    const handleClear = () => {
        setFile(null);
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
                {!file ? (
                    <label className="file-upload-area">
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />
                        <CloudUploadIcon sx={{ fontSize: 48, color: "#9ca3af", mb: 2 }} />
                        <div className="upload-text">
                            <strong>{t("invoiceExtractor", "uploadPrompt")}</strong>
                            <span>{t("invoiceExtractor", "uploadHint")}</span>
                        </div>
                    </label>
                ) : (
                    <div className="file-selected">
                        <div className="file-info">
                            <div className="file-name">{file.name}</div>
                            <div className="file-size">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                        </div>
                        <div className="file-actions">
                            <button
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
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleClear}
                                disabled={isExtracting}
                            >
                                <DeleteIcon sx={{ fontSize: 18, mr: 1 }} />
                                {t("invoiceExtractor", "remove")}
                            </button>
                        </div>
                    </div>
                )}

                {extractionStatus !== "idle" && (
                    <div className={`extraction-status status-${extractionStatus}`}>
                        {extractionStatus === "success" ? (
                            <CheckCircleIcon sx={{ fontSize: 24 }} />
                        ) : (
                            <ErrorIcon sx={{ fontSize: 24 }} />
                        )}
                        <span>{statusMessage}</span>
                    </div>
                )}
            </div>

            <style jsx>{`
                .invoice-extractor {
                    background: white;
                    border: 1px solid var(--scheme-neutral-900, rgba(0,0,0,0.08));
                    border-radius: 12px;
                    padding: 0;
                    color: #1f2937;
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
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    color: #1f2937;
                }

                .file-upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    border: 2px dashed #d1d5db;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #f9fafb;
                }

                .file-upload-area:hover {
                    border-color: #6b7280;
                    background: #f3f4f6;
                }

                .upload-text {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    text-align: center;
                }

                .upload-text strong {
                    color: #111827;
                    font-size: 16px;
                }

                .upload-text span {
                    color: #6b7280;
                    font-size: 14px;
                }

                .file-selected {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .file-info {
                    padding: 16px;
                    background: #f9fafb;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                }

                .file-name {
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 4px;
                }

                .file-size {
                    font-size: 13px;
                    color: #6b7280;
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

                .status-error {
                    background: #fef2f2;
                    color: #991b1b;
                    border: 1px solid #ef4444;
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
