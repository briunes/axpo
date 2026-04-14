"use client";

import { Chip, Divider, Stack, Box } from "@mui/material";
import { useEffect, useState } from "react";
import { loadSession } from "../lib/authSession";
import { getUser, updateUser, isAdmin, type UserItem } from "../lib/internalApi";
import { useAgencies } from "../components/hooks/useAgencies";
import { UserForm, type UserFormData } from "../components/modules/UserForm";
import { CrudPageLayout, LoadingState, useAlerts } from "../components/shared";

export default function ProfilePage() {
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const agenciesActions = useAgencies(session);

    const [user, setUser] = useState<UserItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [successText, setSuccessText] = useState<string | null>(null);

    const [formData, setFormData] = useState<UserFormData>({
        fullName: "",
        email: "",
        mobilePhone: "",
        commercialPhone: "",
        commercialEmail: "",
        otherDetails: "",
        password: "",
        currentPassword: "",
    });

    useEffect(() => {
        if (!session) return;
        agenciesActions.refresh();
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
                    password: "",
                    currentPassword: "",
                    role: u.role,
                    agencyId: u.agencyId || "",
                });
            })
            .catch(() => showError("Failed to load profile."))
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
                ...(formData.password ? {
                    password: formData.password,
                    currentPassword: formData.currentPassword,
                } : {}),
            });
            setSuccessText("Profile updated successfully.");
            showSuccess("Profile updated successfully.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to update profile.";
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
            title="My Profile"
            subtitle="View and edit your personal details and security settings"
        >
            {loading ? (
                <LoadingState message="Loading profile..." size={100} />
            ) : (
                <Stack spacing={3}>
                    {/* Read-only identity row — visible to all roles */}
                    <Stack direction="row" spacing={3} alignItems="flex-end" flexWrap="wrap">
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                                Role
                            </span>
                            <Chip
                                label={user?.role}
                                size="small"
                                color={roleTone[user?.role ?? "COMMERCIAL"]}
                                sx={{ fontWeight: 600, fontSize: 12, width: "fit-content" }}
                            />
                        </Box>
                        {agencyName && (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                                    Agency
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
                        submitLabel="Save Changes"
                        mode="edit"
                        isEditingSelf={true}
                    />
                </Stack>
            )}
        </CrudPageLayout>
    );
}
