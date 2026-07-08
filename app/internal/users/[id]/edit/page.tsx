"use client";

import { Button, Box, Tabs, Tab } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { useAgencies } from "../../../components/hooks/useAgencies";
import { useUsers } from "../../../components/hooks/useUsers";
import { usePermissions } from "../../../lib/permissionsContext";
import { UserForm, type UserFormData } from "../../../components/modules/UserForm";
import { UserSessionsPanel } from "../../../components/modules/UserSessionsPanel";
import { CrudPageLayout, FormSkeleton, PinResultDialog, useAlerts } from "../../../components/shared";
import { UserPreferencesForm, type UserPreferences } from "../../../components/ui/UserPreferencesForm";
import { AuditLogsModal } from "../../../components/ui/AuditLogsModal";
import { useUserPreferences } from "../../../components/providers/UserPreferencesProvider";
import { getUser, type ListUsersResponse, type UserItem } from "../../../lib/internalApi";
import { getSystemConfig } from "../../../lib/configApi";
import { useActionButtons, useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

const editUserSkeletonAgencies = [
    {
        id: "agency-skeleton-primary",
        name: "AXPO Madrid",
        isTlv: false,
        isActive: true,
        createdAt: "2026-01-10T09:00:00.000Z",
        updatedAt: "2026-06-20T12:00:00.000Z",
        createdByUser: { fullName: "System Admin" },
        updatedByUser: { fullName: "System Admin" },
    },
] satisfies Parameters<typeof UserForm>[0]["agencies"];

const editUserSkeletonSession = {
    token: "boneyard-fixture-token",
    user: {
        id: "user-skeleton-admin",
        agencyId: "agency-skeleton-primary",
        role: "SYS_ADMIN",
        fullName: "System Admin",
        email: "admin@example.com",
    },
} satisfies Parameters<typeof UserForm>[0]["session"];

const editUserSkeletonData = {
    fullName: "Mariana Costa",
    email: "mariana.costa@example.com",
    maxActiveDevices: 3,
    mobilePhone: "+34 600 123 456",
    commercialPhone: "+34 910 222 333",
    commercialEmail: "sales.madrid@example.com",
    otherDetails: "Regional account owner with access to commercial simulations.",
    role: "ADMIN",
    agencyId: "agency-skeleton-primary",
    isActive: true,
} satisfies UserFormData;

function EditUserFormSkeletonCapture({ tabs }: { tabs: number }) {
    const { t } = useI18n();

    return (
        <Box className="crud-tab-panel">
            <Box className="crud-tab-panel__tabs">
                <Tabs value={0}>
                    <Tab label={t("userFormPage", "tabDetails")} />
                    <Tab label={t("userPreferences", "tabPreferences")} />
                    {tabs > 2 && <Tab label={t("userFormPage", "tabSessions")} />}
                </Tabs>
            </Box>
            <Box>
                <UserForm
                    session={editUserSkeletonSession}
                    agencies={editUserSkeletonAgencies}
                    data={editUserSkeletonData}
                    onChange={() => undefined}
                    onSubmit={(event) => event.preventDefault()}
                    submitLabel={t("userFormPage", "submitLabel")}
                    cancelLabel={t("actions", "cancel")}
                    onCancel={() => undefined}
                    mode="edit"
                    originalRole="ADMIN"
                />
            </Box>
        </Box>
    );
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const isBoneyardFixture = id === "boneyard-fixture";
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess: alertSuccess, showError: alertError } = useAlerts();
    const { t } = useI18n();
    const { canDo } = usePermissions();
    const { preferences } = useUserPreferences();
    const queryClient = useQueryClient();
    const onActionButtons = useActionButtons();

    const usersActions = useUsers(session, 25, { queryEnabled: false });
    const agenciesActions = useAgencies(session, 1000, { minimal: true, queryEnabled: !isBoneyardFixture });
    const { loading: loadingAgencies } = agenciesActions;

    const [user, setUser] = useState<UserItem | null>(null);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [newPin, setNewPin] = useState<string | null>(null);
    const [isRegeneratingPin, setIsRegeneratingPin] = useState(false);
    const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
    const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [defaultMaxActiveDevices, setDefaultMaxActiveDevices] = useState(3);
    const [preferencesDraft, setPreferencesDraft] = useState<UserPreferences | null>(null);
    const [formData, setFormData] = useState<UserFormData>({
        fullName: "",
        email: "",
        maxActiveDevices: defaultMaxActiveDevices,
        mobilePhone: "",
        commercialPhone: "",
        commercialEmail: "",
        otherDetails: "",
    });
    const [formActions, setFormActions] = useState<React.ReactNode>(null);
    const breadcrumbs = useMemo(
        () => user ? [{ label: user.fullName, href: `/internal/users/${user.id}/edit` }] : null,
        [user],
    );
    useTopBarBreadcrumbs(breadcrumbs);

    const isEditingSelf = user?.id === session?.user.id;
    const canManageUserSessions = session ? canDo(session.user.role, "users.sessions.manage") : false;

    useEffect(() => {
        if (isBoneyardFixture) return;

        getSystemConfig()
            .then((config) => {
                setDefaultMaxActiveDevices(config.defaultMaxActiveDevices ?? 3);
            })
            .catch(() => {
                // keep fallback
            });
    }, [isBoneyardFixture]);

    useEffect(() => {
        if (!canManageUserSessions && activeTab === 2) {
            setActiveTab(0);
        }
    }, [activeTab, canManageUserSessions]);

    const cachedUser = useMemo(() => {
        if (!session) return null;
        const cachedQueries = queryClient.getQueriesData<ListUsersResponse>({
            queryKey: ["users", session.token],
        });

        for (const [, result] of cachedQueries) {
            const foundUser = result?.items.find((item) => item.id === id);
            if (foundUser) {
                return foundUser;
            }
        }

        return null;
    }, [id, queryClient, session]);

    useEffect(() => {
        if (!session || isBoneyardFixture) return;

        const applyUser = (foundUser: UserItem) => {
            setUser(foundUser);
            setFormData({
                fullName: foundUser.fullName,
                email: foundUser.email,
                maxActiveDevices: foundUser.maxActiveDevices ?? defaultMaxActiveDevices,
                mobilePhone: foundUser.mobilePhone || "",
                commercialPhone: foundUser.commercialPhone || "",
                commercialEmail: foundUser.commercialEmail || "",
                otherDetails: foundUser.otherDetails || "",
                role: foundUser.role,
                agencyId: foundUser.agencyId,
                isActive: foundUser.isActive,
            });
        };

        if (cachedUser) {
            applyUser(cachedUser);
            return;
        }

        getUser(session.token, id)
            .then(applyUser)
            .catch(() => {
                alertError(t("userFormPage", "notFound"));
                router.push("/internal/users");
            });
    }, [alertError, cachedUser, defaultMaxActiveDevices, id, isBoneyardFixture, router, session, t]);

    useEffect(() => {
        if (usersActions.successText) {
            // Keep user on edit view for PIN rotation and password reset actions
            if (isRegeneratingPin) {
                usersActions.clearFeedback();
                setIsRegeneratingPin(false);
            } else if (isSendingPasswordReset) {
                alertSuccess(usersActions.successText);
                usersActions.clearFeedback();
                setIsSendingPasswordReset(false);
            } else {
                alertSuccess(usersActions.successText);
                usersActions.clearFeedback();
                router.push("/internal/users");
            }
        }
    }, [alertSuccess, isRegeneratingPin, isSendingPasswordReset, router, usersActions.clearFeedback, usersActions.successText]);

    useEffect(() => {
        if (usersActions.errorText) {
            alertError(usersActions.errorText);
            setIsRegeneratingPin(false);
            setIsSendingPasswordReset(false);
        }
    }, [alertError, usersActions.errorText]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) return;

        await usersActions.handleUpdateUser(e, {
            userId: user.id,
            name: formData.fullName,
            email: formData.email,
            maxActiveDevices: formData.maxActiveDevices,
            mobilePhone: formData.mobilePhone,
            commercialPhone: formData.commercialPhone,
            commercialEmail: formData.commercialEmail,
            otherDetails: formData.otherDetails,
            role: formData.role,
            agencyId: formData.agencyId,
            isActive: formData.isActive,
            preferences: preferencesDraft
                ? {
                    language: preferencesDraft.language,
                    dateFormat: preferencesDraft.dateFormat,
                    timeFormat: preferencesDraft.timeFormat,
                    timezone: preferencesDraft.timezone,
                    numberFormat: preferencesDraft.numberFormat,
                    itemsPerPage: preferencesDraft.itemsPerPage,
                }
                : undefined,
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
        await usersActions.handleRequestPasswordReset(user);
    };

    useEffect(() => {
        if (!session || !user) {
            onActionButtons?.(null);
            return;
        }

        onActionButtons?.(
            <>
                <span className="topbar-action-wrap">
                    <Button
                        className="topbar-action topbar-action--compact"
                        variant="outlined"
                        size="small"
                        startIcon={<HistoryIcon />}
                        onClick={() => setShowAuditLogsModal(true)}
                    >
                        <span className="topbar-action-label">{t("auditLogsModal", "title")}</span>
                    </Button>
                </span>
                <span className="topbar-action-wrap">
                    <Button
                        className="topbar-action topbar-action--compact"
                        variant="outlined"
                        size="small"
                        onClick={handleSendPasswordReset}
                        disabled={usersActions.busyAction !== null || isSendingPasswordReset}
                    >
                        <span className="topbar-action-label">
                            {isSendingPasswordReset ? t("common", "loading") : t("userFormPage", "sendPasswordReset")}
                        </span>
                    </Button>
                </span>
                <span className="topbar-action-wrap">
                    <Button
                        className="topbar-action topbar-action--compact"
                        variant="outlined"
                        size="small"
                        onClick={handleRegeneratePin}
                        disabled={usersActions.busyAction !== null || isRegeneratingPin}
                    >
                        <span className="topbar-action-label">
                            {isRegeneratingPin ? t("common", "loading") : t("userFormPage", "regeneratePin")}
                        </span>
                    </Button>
                </span>
                {formActions}
            </>,
        );

        return () => onActionButtons?.(null);
    }, [
        formActions,
        isRegeneratingPin,
        isSendingPasswordReset,
        onActionButtons,
        session,
        t,
        user,
        usersActions.busyAction,
    ]);

    if (!session || !user ) {
        const skeletonTabs = canManageUserSessions ? 3 : 2;
        const skeletonFallback = <FormSkeleton variant="user" tabs={skeletonTabs} />;

        return (
            <CrudPageLayout
                title={t("userFormPage", "editTitle")}
                backHref="/internal/users"
                maxWidth={undefined}
                hideHeader
            >
                <BoneyardSkeleton
                    name="edit-user-form"
                    loading
                    fallback={skeletonFallback}
                    fixture={<EditUserFormSkeletonCapture tabs={skeletonTabs} />}
                    select="viewport"
                    animate="shimmer"
                    transition
                >
                    <EditUserFormSkeletonCapture tabs={skeletonTabs} />
                </BoneyardSkeleton>
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
                hideHeader
            >
                <Box className="crud-tab-panel">
                    <Box className="crud-tab-panel__tabs">
                        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                            <Tab label={t("userFormPage", "tabDetails")} />
                            <Tab label={t("userPreferences", "tabPreferences")} />
                            {canManageUserSessions && <Tab label={t("userFormPage", "tabSessions")} />}
                        </Tabs>
                    </Box>

                    <Box sx={{ display: activeTab === 0 ? "block" : "none" }}>
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
                            originalRole={user.role}
                            onRenderActions={setFormActions}
                        />
                    </Box>

                    <Box sx={{ display: activeTab === 1 ? "block" : "none" }}>
                        {session && (
                            <UserPreferencesForm
                                userId={id}
                                token={session.token}
                                hideSaveButton
                                onPreferencesChange={setPreferencesDraft}
                                onNotify={(msg, tone) => tone === "error" ? alertError(msg) : alertSuccess(msg)}
                            />
                        )}
                    </Box>

                    {canManageUserSessions && (
                        <Box sx={{ display: activeTab === 2 ? "block" : "none" }}>
                            {session && (
                                <UserSessionsPanel
                                    session={session}
                                    userId={id}
                                    initialPageSize={preferences.itemsPerPage}
                                    allowUserLogoutAll
                                    maxActiveDevices={formData.maxActiveDevices ?? defaultMaxActiveDevices}
                                    maxActiveDevicesLimit={defaultMaxActiveDevices}
                                    onMaxActiveDevicesChange={(value) => {
                                        setFormData((prev) => ({ ...prev, maxActiveDevices: value }));
                                    }}
                                    onNotify={(msg, tone) => tone === "error" ? alertError(msg) : alertSuccess(msg)}
                                />
                            )}
                        </Box>
                    )}
                </Box>
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

            {session && (
                <AuditLogsModal
                    open={showAuditLogsModal}
                    onClose={() => setShowAuditLogsModal(false)}
                    targetType="USER"
                    targetId={user.id}
                    token={session.token}
                    title={`${t("auditLogsModal", "title")} - ${user.fullName}`}
                />
            )}
        </>
    );
}
