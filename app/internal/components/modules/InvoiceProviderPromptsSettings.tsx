"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Switch,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import type { SessionState } from "../../lib/authSession";

export interface InvoiceProviderPromptsSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

interface InvoiceProvider {
    id: string;
    name: string;
    slug: string;
    prompt: string;
    isActive: boolean;
    needsPromptConfig: boolean;
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_PROMPT_TEMPLATE = `You are an expert at extracting data from Spanish energy invoices (electricity and gas) specifically from {PROVIDER_NAME}.

Extract ALL available information from the provided invoice and return it as a JSON object following the standard extraction schema.

IMPORTANT: Return ONLY a valid JSON object with the extracted data.`;

export function InvoiceProviderPromptsSettings({ session, onNotify }: InvoiceProviderPromptsSettingsProps) {
    const [providers, setProviders] = useState<InvoiceProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<InvoiceProvider | null>(null);
    const [editMode, setEditMode] = useState<"view" | "edit" | "create">("view");
    const [isSaving, setIsSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [providerToDelete, setProviderToDelete] = useState<InvoiceProvider | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formPrompt, setFormPrompt] = useState("");
    const [formIsActive, setFormIsActive] = useState(true);

    const token = typeof window !== "undefined"
        ? localStorage.getItem("axpo.internal.auth.token")
        : "";

    const loadProviders = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/v1/internal/invoice-providers", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to load providers");
            const data = await res.json();
            setProviders(data);
        } catch (err) {
            onNotify("Failed to load invoice providers", "error");
        } finally {
            setIsLoading(false);
        }
    }, [token, onNotify]);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const handleSelectProvider = (provider: InvoiceProvider) => {
        setSelectedProvider(provider);
        setFormName(provider.name);
        setFormPrompt(provider.prompt);
        setFormIsActive(provider.isActive);
        setEditMode("view");
    };

    const handleStartCreate = () => {
        setSelectedProvider(null);
        setFormName("");
        setFormPrompt(DEFAULT_PROMPT_TEMPLATE.replace("{PROVIDER_NAME}", "this provider"));
        setFormIsActive(true);
        setEditMode("create");
    };

    const handleStartEdit = (provider: InvoiceProvider) => {
        setSelectedProvider(provider);
        setFormName(provider.name);
        setFormPrompt(provider.prompt);
        setFormIsActive(provider.isActive);
        setEditMode("edit");
    };

    const handleCancelEdit = () => {
        if (selectedProvider) {
            setFormName(selectedProvider.name);
            setFormPrompt(selectedProvider.prompt);
            setFormIsActive(selectedProvider.isActive);
            setEditMode("view");
        } else {
            setEditMode("view");
        }
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            onNotify("Provider name is required", "error");
            return;
        }

        setIsSaving(true);
        try {
            if (editMode === "create") {
                const res = await fetch("/api/v1/internal/invoice-providers", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name: formName, prompt: formPrompt, isActive: formIsActive }),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "Failed to create provider");
                }
                const created = await res.json();
                onNotify(`Provider "${created.name}" created successfully`, "success");
                await loadProviders();
                setSelectedProvider(created);
                setEditMode("view");
            } else if (editMode === "edit" && selectedProvider) {
                const res = await fetch(`/api/v1/internal/invoice-providers/${selectedProvider.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name: formName, prompt: formPrompt, isActive: formIsActive }),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "Failed to update provider");
                }
                const updated = await res.json();
                onNotify(`Provider "${updated.name}" updated successfully`, "success");
                await loadProviders();
                setSelectedProvider(updated);
                setEditMode("view");
            }
        } catch (err: any) {
            onNotify(err.message || "Failed to save provider", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (provider: InvoiceProvider) => {
        try {
            const res = await fetch(`/api/v1/internal/invoice-providers/${provider.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isActive: !provider.isActive }),
            });
            if (!res.ok) throw new Error("Failed to update provider");
            await loadProviders();
            if (selectedProvider?.id === provider.id) {
                setSelectedProvider({ ...selectedProvider, isActive: !provider.isActive });
            }
        } catch (err: any) {
            onNotify("Failed to toggle provider status", "error");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!providerToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/v1/internal/invoice-providers/${providerToDelete.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to delete provider");
            onNotify(`Provider "${providerToDelete.name}" deleted`, "success");
            if (selectedProvider?.id === providerToDelete.id) {
                setSelectedProvider(null);
                setEditMode("view");
            }
            await loadProviders();
        } catch (err: any) {
            onNotify("Failed to delete provider", "error");
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setProviderToDelete(null);
        }
    };

    const isEditing = editMode === "edit" || editMode === "create";

    return (
        <div className="provider-prompts-container">
            {/* Left panel — provider list */}
            <div className="provider-list-panel">
                <div className="provider-list-header">
                    <div>
                        <div className="provider-list-title">Invoice Providers</div>
                        <div className="provider-list-subtitle">
                            {providers.length} provider{providers.length !== 1 ? "s" : ""} configured
                        </div>
                    </div>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleStartCreate}
                        sx={{ flexShrink: 0 }}
                    >
                        Add
                    </Button>
                </div>

                {isLoading ? (
                    <div className="provider-list-loading">
                        <CircularProgress size={24} />
                    </div>
                ) : providers.length === 0 ? (
                    <div className="provider-list-empty">
                        <BusinessIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                        <div>No providers yet</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>Click Add to create your first provider</div>
                    </div>
                ) : (
                    <div className="provider-list">
                        {providers.map(provider => (
                            <div
                                key={provider.id}
                                className={`provider-item${selectedProvider?.id === provider.id ? " selected" : ""}${!provider.isActive ? " inactive" : ""}`}
                                onClick={() => handleSelectProvider(provider)}
                            >
                                <div className="provider-item-content">
                                    <BusinessIcon sx={{ fontSize: 18, flexShrink: 0, opacity: provider.isActive ? 1 : 0.4 }} />
                                    <div className="provider-item-info">
                                        <div className="provider-item-name">{provider.name}</div>
                                        <div className="provider-item-meta">
                                            {provider.needsPromptConfig ? (
                                                <Chip label="⚠️ Needs prompt setup" size="small" color="warning" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                                            ) : provider.prompt.trim() ? (
                                                <Chip label="Custom prompt" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                                            ) : (
                                                <Chip label="No prompt" size="small" variant="outlined" sx={{ fontSize: 10, height: 18, opacity: 0.5 }} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="provider-item-actions" onClick={e => e.stopPropagation()}>
                                    <Tooltip title={provider.isActive ? "Disable" : "Enable"}>
                                        <Switch
                                            size="small"
                                            checked={provider.isActive}
                                            onChange={() => handleToggleActive(provider)}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Edit">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleStartEdit(provider)}
                                        >
                                            <EditIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => {
                                                setProviderToDelete(provider);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right panel — detail/edit */}
            <div className="provider-detail-panel">
                {editMode === "view" && !selectedProvider && (
                    <div className="provider-detail-empty">
                        <BusinessIcon sx={{ fontSize: 48, opacity: 0.2, mb: 2 }} />
                        <Typography variant="h6" sx={{ opacity: 0.5, mb: 1 }}>
                            Select a provider
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.4, textAlign: "center", maxWidth: 300 }}>
                            Select a provider from the list to view or edit its custom extraction prompt, or click Add to create a new one.
                        </Typography>
                    </div>
                )}

                {(editMode === "edit" || editMode === "create" || (editMode === "view" && selectedProvider)) && (
                    <div className="provider-detail-content">
                        {/* Warning banner for providers that need prompt configuration */}
                        {selectedProvider?.needsPromptConfig && editMode === "view" && (
                            <div style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: "12px 16px",
                                borderRadius: 8,
                                marginBottom: 16,
                                background: "#fffbeb",
                                border: "1px solid #f59e0b",
                                color: "#78350f",
                                fontSize: 13,
                            }}>
                                <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>⚠️</span>
                                <div>
                                    <strong>Prompt not yet configured.</strong> This provider was added automatically from a simulation page. Please edit this provider and add a custom extraction prompt so the AI knows how to read invoices from <strong>{selectedProvider.name}</strong>.
                                </div>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    startIcon={<EditIcon />}
                                    onClick={() => handleStartEdit(selectedProvider)}
                                    sx={{ flexShrink: 0, ml: "auto" }}
                                >
                                    Configure now
                                </Button>
                            </div>
                        )}
                        <div className="provider-detail-header">
                            <div>
                                <div className="provider-detail-title">
                                    {editMode === "create"
                                        ? "New Provider"
                                        : isEditing
                                            ? `Editing: ${selectedProvider?.name}`
                                            : selectedProvider?.name}
                                </div>
                                {selectedProvider && !isEditing && (
                                    <div className="provider-detail-meta">
                                        Slug: <code>{selectedProvider.slug}</code>
                                        {" · "}
                                        {selectedProvider.isActive ? (
                                            <span style={{ color: "#10b981" }}>Active</span>
                                        ) : (
                                            <span style={{ color: "#f59e0b" }}>Disabled</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!isEditing && selectedProvider && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<EditIcon />}
                                    onClick={() => handleStartEdit(selectedProvider)}
                                >
                                    Edit
                                </Button>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="provider-form">
                                <div className="form-field">
                                    <label className="form-label">Provider Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="e.g. Repsol, NEON, Iberdrola..."
                                        autoFocus={editMode === "create"}
                                    />
                                    <span className="form-hint">
                                        The slug will be auto-generated from this name and is used by the AI to match invoices.
                                    </span>
                                </div>

                                <div className="form-field">
                                    <label className="form-label">Status</label>
                                    <label className="form-toggle">
                                        <Switch
                                            size="small"
                                            checked={formIsActive}
                                            onChange={e => setFormIsActive(e.target.checked)}
                                        />
                                        <span>{formIsActive ? "Active" : "Disabled"}</span>
                                    </label>
                                    <span className="form-hint">
                                        Disabled providers won't appear in the detection list sent to the AI.
                                    </span>
                                </div>

                                <div className="form-field" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                    <label className="form-label">Extraction Prompt</label>
                                    <span className="form-hint" style={{ marginBottom: 8 }}>
                                        This prompt will be sent to the AI instead of the default when an invoice from this provider is detected.
                                        Leave empty to use the system default prompt.
                                    </span>
                                    <textarea
                                        className="form-textarea"
                                        value={formPrompt}
                                        onChange={e => setFormPrompt(e.target.value)}
                                        placeholder="Enter a custom extraction prompt for this provider's invoice format..."
                                        rows={16}
                                    />
                                </div>

                                <div className="form-actions">
                                    <Button
                                        variant="contained"
                                        startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                        onClick={handleSave}
                                        disabled={isSaving || !formName.trim()}
                                    >
                                        {isSaving ? "Saving..." : "Save Provider"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<CloseIcon />}
                                        onClick={handleCancelEdit}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : selectedProvider && (
                            <div className="provider-view">
                                <div className="prompt-preview-label">Extraction Prompt</div>
                                {selectedProvider.prompt.trim() ? (
                                    <pre className="prompt-preview">{selectedProvider.prompt}</pre>
                                ) : (
                                    <div className="prompt-empty">
                                        <Typography variant="body2" sx={{ opacity: 0.5, fontStyle: "italic" }}>
                                            No custom prompt configured — the system default prompt will be used for invoices from this provider.
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<EditIcon />}
                                            onClick={() => handleStartEdit(selectedProvider)}
                                            sx={{ mt: 2 }}
                                        >
                                            Add Custom Prompt
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete Provider</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{providerToDelete?.name}</strong>?
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>

            <style jsx>{`
                .provider-prompts-container {
                    display: flex;
                    gap: 0;
                    height: 100%;
                    min-height: 500px;
                    background: var(--scheme-neutral-1200);
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid var(--scheme-neutral-900);
                }

                /* Left panel */
                .provider-list-panel {
                    width: 280px;
                    flex-shrink: 0;
                    border-right: 1px solid var(--scheme-neutral-900);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .provider-list-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px;
                    border-bottom: 1px solid var(--scheme-neutral-900);
                    gap: 12px;
                }

                .provider-list-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--scheme-neutral-100);
                }

                .provider-list-subtitle {
                    font-size: 12px;
                    color: var(--scheme-neutral-500);
                    margin-top: 2px;
                }

                .provider-list-loading,
                .provider-list-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    padding: 24px;
                    color: var(--scheme-neutral-500);
                    text-align: center;
                    font-size: 13px;
                }

                .provider-list {
                    overflow-y: auto;
                    flex: 1;
                }

                .provider-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--scheme-neutral-950, rgba(0,0,0,0.1));
                    transition: background 0.1s;
                    gap: 8px;
                }

                .provider-item:hover {
                    background: var(--scheme-neutral-1100);
                }

                .provider-item.selected {
                    background: var(--scheme-neutral-1000);
                    border-left: 3px solid var(--scheme-brand-600, #ff3254);
                }

                .provider-item.inactive {
                    opacity: 0.55;
                }

                .provider-item-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    min-width: 0;
                }

                .provider-item-info {
                    flex: 1;
                    min-width: 0;
                }

                .provider-item-name {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--scheme-neutral-100);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .provider-item-meta {
                    margin-top: 3px;
                }

                .provider-item-actions {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    flex-shrink: 0;
                }

                /* Right panel */
                .provider-detail-panel {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                }

                .provider-detail-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--scheme-neutral-500);
                }

                .provider-detail-content {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }

                .provider-detail-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    padding: 20px 24px 16px;
                    border-bottom: 1px solid var(--scheme-neutral-900);
                    gap: 12px;
                }

                .provider-detail-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--scheme-neutral-100);
                }

                .provider-detail-meta {
                    font-size: 12px;
                    color: var(--scheme-neutral-500);
                    margin-top: 4px;
                }

                .provider-detail-meta code {
                    background: var(--scheme-neutral-1000);
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-size: 11px;
                }

                /* Form */
                .provider-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding: 20px 24px;
                    flex: 1;
                    overflow-y: auto;
                }

                .form-field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--scheme-neutral-200);
                }

                .form-hint {
                    font-size: 12px;
                    color: var(--scheme-neutral-500);
                }

                .form-input {
                    height: 38px;
                    padding: 0 12px;
                    background: var(--scheme-neutral-1000);
                    border: 1px solid var(--scheme-neutral-800);
                    border-radius: 6px;
                    color: var(--scheme-neutral-100);
                    font-size: 14px;
                    transition: border-color 0.15s;
                }

                .form-input:focus {
                    outline: none;
                    border-color: var(--scheme-brand-600, #ff3254);
                }

                .form-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: var(--scheme-neutral-200);
                }

                .form-textarea {
                    flex: 1;
                    padding: 12px;
                    background: var(--scheme-neutral-1000);
                    border: 1px solid var(--scheme-neutral-800);
                    border-radius: 6px;
                    color: var(--scheme-neutral-100);
                    font-size: 13px;
                    font-family: "Fira Code", "Courier New", monospace;
                    resize: vertical;
                    min-height: 280px;
                    line-height: 1.6;
                    transition: border-color 0.15s;
                }

                .form-textarea:focus {
                    outline: none;
                    border-color: var(--scheme-brand-600, #ff3254);
                }

                .form-actions {
                    display: flex;
                    gap: 12px;
                    padding-top: 4px;
                }

                /* View mode */
                .provider-view {
                    display: flex;
                    flex-direction: column;
                    padding: 20px 24px;
                    flex: 1;
                    overflow-y: auto;
                }

                .prompt-preview-label {
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--scheme-neutral-500);
                    margin-bottom: 12px;
                }

                .prompt-preview {
                    background: var(--scheme-neutral-1000);
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 8px;
                    padding: 16px;
                    font-family: "Fira Code", "Courier New", monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    color: var(--scheme-neutral-200);
                    white-space: pre-wrap;
                    word-break: break-word;
                    flex: 1;
                    overflow-y: auto;
                    max-height: 500px;
                }

                .prompt-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }
            `}</style>
        </div>
    );
}
