"use client";

import { Chip, Divider, Stack, Box, Tabs, Tab } from "@mui/material";
import { useEffect, useState } from "react";
import { loadSession } from "../lib/authSession";
import { getUser, updateUser, isAdmin, type UserItem } from "../lib/internalApi";
import { useAgencies } from "../components/hooks/useAgencies";
import { UserForm, type UserFormData } from "../components/modules/UserForm";
import { CrudPageLayout, LoadingState, useAlerts } from "../components/shared";
import { UserPreferencesForm } from "../components/ui/UserPreferencesForm";
import { useI18n } from "../../../src/lib/i18n-context";

export default function ProfilePage() {
    const { t } = useI18n();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const agenciesActions = useAgencies(session, 1000);

    const [user, setUser] = useState<UserItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [successText, setSuccessText] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0);

    const [formData, setFormData] = useState<UserFormData>({
        fullName: "",
        email: "",
        mobilePhone: "",
        commercialPhone: "",
        commercialEmail: "",
        otherDetails: "",
    });

    useEffect(() => {
        if (!session) return;
        getUser(session.token, session.user.id)
            .then((u) => {
                setUser(u);
                setFormData({
                    fullName: u.fullName,
                    email: u.email,
                    mobilePhone: u.mobilePhone || "",
                    commercialPhone: u.commercialPhone || "",
                    commercialEmail: u.commercialEmail || "",
                    otherDetails: u.otherDetails || "",
                    role: u.role,
                    agencyId: u.agencyId || "",
                });
            })
            .catch(() => showError(t("profilePage", "loadFailed")))
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !user) return;
        setSubmitting(true);
        setErrorText(null);
        setSuccessText(null);
        try {
            await updateUser(session.token, session.user.id, {
                fullName: formData.fullName.trim(),
                email: formData.email.trim(),
                mobilePhone: formData.mobilePhone.trim(),
                commercialPhone: formData.commercialPhone.trim(),
                commercialEmail: formData.commercialEmail.trim(),
                otherDetails: formData.otherDetails?.trim() || "",
                // Only admins can change role and agency
                ...(isAdmin(session.user.role) && formData.role ? { role: formData.role } : {}),
                ...(isAdmin(session.user.role) && formData.agencyId ? { agencyId: formData.agencyId } : {}),
                // Password change requires currentPassword

            });
            setSuccessText(t("profilePage", "updated"));
            showSuccess(t("profilePage", "updated"));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("profilePage", "updateFailed");
            setErrorText(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!session) return null;

    const agencyName = user
        ? agenciesActions.agencies.find((a) => a.id === user.agencyId)?.name ?? user.agencyId ?? null
        : null;

    const roleTone: Record<string, "default" | "primary" | "secondary"> = {
        ADMIN: "primary",
        AGENT: "secondary",
        COMMERCIAL: "default",
    };

    return (
        <CrudPageLayout
            title={t("profilePage", "title")}
            subtitle={t("profilePage", "subtitle")}
        >
            {loading ? (
                <LoadingState message={t("profilePage", "loading")} size={100} />
            ) : (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                            <Tab label={t("profilePage", "tabDetails")} />
                            <Tab label={t("userPreferences", "tabPreferences")} />
                        </Tabs>
                    </Box>

                    {activeTab === 0 && (
                        <Stack spacing={3}>
                            {/* Read-only identity row — visible to all roles */}
                            <Stack direction="row" spacing={3} alignItems="flex-end" flexWrap="wrap">
                                <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                                        {t("profilePage", "role")}
                                    </span>
                                    <Chip
                                        label={user?.role === "ADMIN" ? t("userFormPage", "roleAdmin") : user?.role === "AGENT" ? t("userFormPage", "roleAgent") : t("userFormPage", "roleCommercial")}
                                        size="small"
                                        color={roleTone[user?.role ?? "COMMERCIAL"]}
                                        sx={{ fontWeight: 600, fontSize: 12, width: "fit-content" }}
                                    />
                                </Box>
                                {agencyName && (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                                            {t("profilePage", "agency")}
                                        </span>
                                        <Chip
                                            label={agencyName}
                                            size="small"
                                            sx={{ fontSize: 12, width: "fit-content" }}
                                        />
                                    </Box>
                                )}
                            </Stack>

                            <Divider />

                            {/* Edit form — role/agency selects visible to admins only, handled by UserForm */}
                            <UserForm
                                session={session}
                                agencies={agenciesActions.agencies}
                                data={formData}
                                onChange={setFormData}
                                onSubmit={handleSubmit}
                                errorMessage={errorText}
                                successMessage={successText}
                                isSubmitting={submitting}
                                submitLabel={t("profilePage", "saveChanges")}
                                mode="edit"
                                isEditingSelf
                            />
                        </Stack>
                    )}

                    {activeTab === 1 && session && (
                        <UserPreferencesForm
                            userId={session.user.id}
                            token={session.token}
                            onNotify={(msg, tone) => tone === "error" ? showError(msg) : showSuccess(msg)}
                        />
                    )}
                </>
            )}
        </CrudPageLayout>
    );
}
