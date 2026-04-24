"use client";

import { Button, Box, Tabs, Tab } from "@mui/material";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { useAgencies } from "../../../components/hooks/useAgencies";
import { useUsers } from "../../../components/hooks/useUsers";
import { UserForm, type UserFormData } from "../../../components/modules/UserForm";
import { CrudPageLayout, LoadingState, PinResultDialog, useAlerts } from "../../../components/shared";
import { UserPreferencesForm } from "../../../components/ui/UserPreferencesForm";
import type { UserItem } from "../../../lib/internalApi";

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess: alertSuccess, showError: alertError } = useAlerts();
    const { t } = useI18n();

    const usersActions = useUsers(session);
    const { loading: loadingUsers } = usersActions;
    const agenciesActions = useAgencies(session);
    const { loading: loadingAgencies } = agenciesActions;

    const [user, setUser] = useState<UserItem | null>(null);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [newPin, setNewPin] = useState<string | null>(null);
    const [isRegeneratingPin, setIsRegeneratingPin] = useState(false);
    const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
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
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    const isEditingSelf = user?.id === session?.user.id;

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;
        usersActions.refresh();
        agenciesActions.refresh();
    }, [session]);

    useEffect(() => {
        if (usersActions.users.length > 0) {
            const foundUser = usersActions.users.find((u) => u.id === id);
            if (foundUser) {
                setUser(foundUser);
                setFormData({
                    fullName: foundUser.fullName,
                    email: foundUser.email,
                    mobilePhone: foundUser.mobilePhone || "",
                    commercialPhone: foundUser.commercialPhone || "",
                    commercialEmail: foundUser.commercialEmail || "",
                    otherDetails: foundUser.otherDetails || "",
                    password: "",
                    currentPassword: "",
                    role: foundUser.role,
                    agencyId: foundUser.agencyId,
                    isActive: foundUser.isActive,
                });
            } else {
                alertError(t("userFormPage", "notFound"));
                router.push("/internal/users");
            }
        }
    }, [usersActions.users, id]);

    useEffect(() => {
        if (usersActions.successText) {
            // Don't show alert or redirect for PIN rotation - we handle it with the dialog
            if (!isRegeneratingPin) {
                alertSuccess(usersActions.successText);
                usersActions.clearFeedback();
                router.push("/internal/users");
            } else {
                // Clear the success message for PIN rotation
                usersActions.clearFeedback();
                setIsRegeneratingPin(false);
            }
        }
    }, [usersActions.successText, isRegeneratingPin]);

    useEffect(() => {
        if (usersActions.errorText) {
            alertError(usersActions.errorText);
        }
    }, [usersActions.errorText]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) return;

        await usersActions.handleUpdateUser(e, {
            userId: user.id,
            name: formData.fullName,
            email: formData.email,
            mobilePhone: formData.mobilePhone,
            commercialPhone: formData.commercialPhone,
            commercialEmail: formData.commercialEmail,
            otherDetails: formData.otherDetails,
            password: formData.password || "",
            currentPassword: formData.currentPassword || "",
            role: formData.role,
            agencyId: formData.agencyId,
            isActive: formData.isActive,
        } as Parameters<typeof usersActions.handleUpdateUser>[1]);
    };

    const handleRegeneratePin = async () => {
        if (!user) return;
        setIsRegeneratingPin(true);
        const result = await usersActions.handleRotateUserPin(user);
        if (result) {
            setNewPin(result.newPin);
            setShowPinDialog(true);
        } else {
            setIsRegeneratingPin(false);
        }
    };

    const handleSendPasswordReset = async () => {
        if (!user) return;
        setIsSendingPasswordReset(true);
        try {
            await usersActions.handleRequestPasswordReset(user);
        } finally {
            setIsSendingPasswordReset(false);
        }
    };

    if (!session || !user) {
        return (
            <CrudPageLayout
                title={t("userFormPage", "editTitle")}
                backHref="/internal/users"
                maxWidth={undefined}
            >
                <LoadingState message={t("userFormPage", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    return (
        <>
            <CrudPageLayout
                title={t("userFormPage", "editTitle")}
                subtitle={t("userFormPage", "editSubtitle", { name: user.fullName })}
                backHref="/internal/users"
                maxWidth={undefined}
                actions={
                    <>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleSendPasswordReset}
                            disabled={usersActions.busyAction !== null || isSendingPasswordReset}
                        >
                            {isSendingPasswordReset ? t("common", "loading") : t("userFormPage", "sendPasswordReset")}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleRegeneratePin}
                            disabled={usersActions.busyAction !== null || isRegeneratingPin}
                        >
                            {isRegeneratingPin ? t("common", "loading") : t("userFormPage", "regeneratePin")}
                        </Button>
                        {formActions}

                    </>
                }
            >
                <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                    <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                        <Tab label={t("userFormPage", "tabDetails")} />
                        <Tab label={t("userPreferences", "tabPreferences")} />
                    </Tabs>
                </Box>

                {activeTab === 0 && (
                    <UserForm
                        session={session}
                        agencies={agenciesActions.agencies}
                        data={formData}
                        onChange={setFormData}
                        onSubmit={handleSubmit}
                        errorMessage={usersActions.errorText}
                        isSubmitting={usersActions.busyAction === "update-user"}
                        submitLabel={t("userFormPage", "submitLabel")}
                        cancelLabel={t("actions", "cancel")}
                        onCancel={() => router.push("/internal/users")}
                        mode="edit"
                        isEditingSelf={isEditingSelf}
                        onRenderActions={setFormActions}
                    />
                )}

                {activeTab === 1 && session && (
                    <UserPreferencesForm
                        userId={id}
                        token={session.token}
                        onNotify={(msg, tone) => tone === "error" ? alertError(msg) : alertSuccess(msg)}
                    />
                )}
            </CrudPageLayout>

            {showPinDialog && newPin && (
                <PinResultDialog
                    pin={newPin}
                    onClose={() => {
                        setShowPinDialog(false);
                        setNewPin(null);
                    }}
                />
            )}
        </>
    );
}
