"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createSimulation, createClient, listClients, type ClientItem } from "../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../components/shared";
import { CrudFormContainer } from "../../components/shared/CrudFormContainer";
import { getSystemConfig } from "../../lib/configApi";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControl } from "@mui/material";
import { ClientForm, type ClientFormData } from "../../components/modules/ClientForm";

type SimType = "ELECTRICITY" | "GAS" | "BOTH";

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
    const [simType, setSimType] = useState<SimType>("ELECTRICITY");
    const [expiresAt, setExpiresAt] = useState("");
    const [defaultDays, setDefaultDays] = useState<any>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
                })
                .catch(() => {
                    // Fallback to 30 days if config fetch fails
                    setDefaultDays(30);
                    setExpiresAt(addDays(30));
                }),
            // Load clients list
            listClients(session.token, {})
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
            const created = await createSimulation(session.token, {
                clientId: clientId || undefined,
                expiresAt: new Date(expiresAt + "T23:59:59Z").toISOString(),
                payloadJson: { schemaVersion: "1", type: simType },
            });
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
                    {/* Client */}
                    <div className="crud-form-section">
                        <div className="crud-form-row">
                            <div className="crud-form-group" style={{ flex: "1 1 280px" }}>
                                <label className="crud-form-label">
                                    {t("newSimulationPage", "clientLabel")} <span style={{ color: "var(--scheme-error-400, #f87171)" }}>*</span>
                                </label>
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                    <FormControl style={{ flex: 1 }}>
                                        <Select
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            required
                                            displayEmpty
                                            size="small"
                                        >
                                            <MenuItem value=""><em style={{ color: 'var(--scheme-neutral-400, #9ca3af)', fontStyle: 'normal' }}>{t("newSimulationPage", "selectClient")}</em></MenuItem>
                                            {clients.map((c) => (
                                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {allowQuickCreate && (
                                        <button
                                            type="button"
                                            onClick={() => setShowQuickCreate(true)}
                                            title={t("newSimulationPage", "createNew")}
                                            style={{
                                                padding: "10px 12px",
                                                border: "1px solid var(--scheme-neutral-300, #d1d5db)",
                                                borderRadius: "6px",
                                                background: "white",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "var(--scheme-neutral-600, #4b5563)",
                                                fontSize: "18px",
                                                lineHeight: "1",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            +
                                        </button>
                                    )}
                                </div>
                                <span className="crud-form-hint">{t("newSimulationPage", "clientHint")}</span>
                            </div>
                        </div>
                    </div>

                    {/* Commodity type */}
                    <div className="crud-form-section">
                        <div className="crud-form-row">
                            <div className="crud-form-group" style={{ flex: "1 1 300px" }}>
                                <label className="crud-form-label">{t("newSimulationPage", "commodityLabel")}</label>
                                <FormControl fullWidth>
                                    <Select
                                        value={simType}
                                        onChange={(e) => setSimType(e.target.value as SimType)}
                                        size="small"
                                    >
                                        <MenuItem value="ELECTRICITY">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
                                                <span>{t("newSimulationPage", "electricity")}</span>
                                            </div>
                                        </MenuItem>
                                        <MenuItem value="GAS">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                                                <span>{t("newSimulationPage", "gas")}</span>
                                            </div>
                                        </MenuItem>
                                        <MenuItem value="BOTH">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <BoltIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
                                                <LocalFireDepartmentIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                                                <span>{t("newSimulationPage", "both")}</span>
                                            </div>
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                                <span className="crud-form-hint">{t("newSimulationPage", "commodityHint")}</span>
                            </div>

                            <div className="crud-form-group" style={{ flex: "0 0 200px" }}>
                                <label className="crud-form-label">{t("newSimulationPage", "expirationLabel")}</label>
                                <input
                                    className="crud-form-input"
                                    type="date"
                                    value={expiresAt}
                                    min={addDays(1)}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                                <span className="crud-form-hint">{t("newSimulationPage", "expirationHint").replace("{{days}}", defaultDays)}</span>
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
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </CrudPageLayout>
    );
}
