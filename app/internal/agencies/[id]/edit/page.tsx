"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Box, Stack, Tabs, Tab } from "@mui/material";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getAgency, updateAgency, listUsers, type AgencyItem, type UserItem } from "../../../lib/internalApi";
import { AddressForm, CrudFormContainer, CrudPageLayout, LoadingState, useAlerts, type AddressData } from "../../../components/shared";
import { FormInput, DataTable, StatusBadge } from "../../../components/ui";
import { AgencyTariffConfig } from "../../../components/ui/AgencyTariffConfig";

export default function EditAgencyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [agency, setAgency] = useState<AgencyItem | null>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState<AddressData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    useEffect(() => {
        if (!session) return;
        getAgency(session.token, id)
            .then((a) => {
                setAgency(a);
                setName(a.name);
                setAddress({
                    street: a.street || "",
                    city: a.city || "",
                    postalCode: a.postalCode || "",
                    province: a.province || "",
                    country: a.country || "",
                });
                // Load users for this agency
                setLoadingUsers(true);
                listUsers(session.token, { agencyId: a.id, pageSize: 100 })
                    .then((result) => setUsers(result.items))
                    .catch((err) => console.error("Failed to load users:", err))
                    .finally(() => setLoadingUsers(false));
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("agencyFormPage", "notFound"));
                router.push("/internal/agencies");
            });
    }, [session, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !agency) return;
        if (!name.trim()) {
            setErrorMessage(t("agencyFormPage", "nameRequired"));
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await updateAgency(session.token, agency.id, {
                name: name.trim(),
                street: address.street?.trim() || undefined,
                city: address.city?.trim() || undefined,
                postalCode: address.postalCode?.trim() || undefined,
                province: address.province?.trim() || undefined,
                country: address.country?.trim() || undefined,
            });
            showSuccess(t("agencyFormPage", "updated"));
            router.push("/internal/agencies");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("agencyFormPage", "updateFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session || !agency) {
        return (
            <CrudPageLayout title={t("agencyFormPage", "editTitle")} backHref="/internal/agencies">
                <LoadingState message={t("agencyFormPage", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    const userColumns = [
        {
            key: "fullName",
            label: t("columns", "name"),
            sortable: false,
            renderCell: (row: UserItem) => row.fullName,
        },
        {
            key: "email",
            label: t("columns", "email"),
            sortable: false,
            renderCell: (row: UserItem) => row.email,
        },
        {
            key: "role",
            label: t("columns", "role"),
            sortable: false,
            renderCell: (row: UserItem) => (
                <StatusBadge
                    label={row.role}
                    tone={row.role === "ADMIN" ? "brand" : row.role === "AGENT" ? "accent" : "neutral"}
                />
            ),
        },
        {
            key: "status",
            label: t("columns", "status"),
            sortable: false,
            renderCell: (row: UserItem) => (
                <StatusBadge
                    label={row.isActive ? t("status", "active") : t("status", "inactive")}
                    tone={row.isActive ? "success" : "neutral"}
                />
            ),
        },
    ];

    return (
        <CrudPageLayout
            title={t("agencyFormPage", "editTitle")}
            subtitle={t("agencyFormPage", "editSubtitle", { name: agency.name })}
            backHref="/internal/agencies"
            actions={formActions}
        >
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                    <Tab label={t("agencyFormPage", "tabDetails")} />
                    <Tab label={t("agencyFormPage", "tabUsers")} />
                    <Tab label={t("agencyFormPage", "tabTariffs")} />
                </Tabs>
            </Box>

            {activeTab === 0 && (
                <CrudFormContainer
                    onSubmit={handleSubmit}
                    errorMessage={errorMessage}
                    submitLabel={t("actions", "saveChanges")}
                    cancelLabel={t("actions", "cancel")}
                    onCancel={() => router.push("/internal/agencies")}
                    isSubmitting={isSubmitting}
                    onRenderActions={setFormActions}
                >
                    <Stack spacing={2}>
                        <FormInput
                            label={t("agencyFormPage", "nameLabel")}
                            type="text"
                            value={name}
                            onChange={(e) => setName((e.target as HTMLInputElement).value)}
                            autoFocus
                        />
                        <AddressForm value={address} onChange={setAddress} />
                    </Stack>
                </CrudFormContainer>
            )}

            {activeTab === 1 && (
                <Box>
                    <Box sx={{ mb: 2 }}>
                        <h3 style={{ margin: 0, marginBottom: "4px", fontSize: "1.1rem" }}>
                            {t("agencyFormPage", "assignedUsers")}
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
                            {t("agencyFormPage", "assignedUsersSubtitle")}
                        </p>
                    </Box>
                    <DataTable<UserItem>
                        columns={userColumns}
                        rows={users}
                        loading={loadingUsers}
                        emptyMessage={t("agencyFormPage", "noUsers")}
                        t={t}
                    />
                </Box>
            )}

            {activeTab === 2 && (
                <AgencyTariffConfig
                    agencyId={agency.id}
                    token={session.token}
                    onNotify={(msg, type) => type === "error" ? showError(msg) : showSuccess(msg)}
                />
            )}
        </CrudPageLayout>
    );
}
