"use client";

import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { Box, Button, Tabs, Tab, Alert, Typography } from "@mui/material";
import { FormSelect } from "../../components/ui/FormSelect";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useAgencies } from "../../components/hooks/useAgencies";
import { useUsers } from "../../components/hooks/useUsers";
import { UserForm, type UserFormData } from "../../components/modules/UserForm";
import { UserSessionsPanel } from "../../components/modules/UserSessionsPanel";
import { BoneyardFormSkeleton, CrudPageLayout, useAlerts } from "../../components/shared";
import { useActionButtons, useTopBarBreadcrumbs } from "../../components/InternalWorkspace";
import { isAdmin, type UserRole } from "../../lib/internalApi";
import { getSystemConfig } from "../../lib/configApi";
import { getLanguageOptions } from "../../../../src/lib/supportedLanguages";

interface LocalPreferences {
    language: string | null;
    dateFormat: string;
    timeFormat: string;
    timezone: string;
    numberFormat: string;
    itemsPerPage: number;
}

export default function NewUserPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();
    const onActionButtons = useActionButtons();
    const isBoneyardBuild =
        typeof window !== "undefined" &&
        (window as typeof window & { __BONEYARD_BUILD?: boolean }).__BONEYARD_BUILD === true;
    const breadcrumbs = useMemo(() => [{ label: t("userFormPage", "newTitle") }], [t]);
    useTopBarBreadcrumbs(breadcrumbs);

    const usersActions = useUsers(session, 25, { queryEnabled: false });
    const agenciesActions = useAgencies(session, 1000, { minimal: true, queryEnabled: !isBoneyardBuild });

    const [activeTab, setActiveTab] = useState(0);
    const [hasVisitedPreferences, setHasVisitedPreferences] = useState(false);
    const [defaultMaxActiveDevices, setDefaultMaxActiveDevices] = useState(3);

    const [localPreferences, setLocalPreferences] = useState<LocalPreferences>({
        language: null,
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        timezone: "Europe/Madrid",
        numberFormat: "eu",
        itemsPerPage: 10,
    });

    useEffect(() => {
        getSystemConfig().then((config) => {
            const maxDevices = config.defaultMaxActiveDevices ?? 3;
            setDefaultMaxActiveDevices(maxDevices);
            setFormData((prev) => ({
                ...prev,
                maxActiveDevices: maxDevices,
            }));

            setLocalPreferences({
                language: config.defaultLanguage ?? null,
                dateFormat: config.defaultDateFormat ?? "DD/MM/YYYY",
                timeFormat: config.defaultTimeFormat ?? "24h",
                timezone: config.defaultTimezone ?? "Europe/Madrid",
                numberFormat: config.defaultNumberFormat ?? "eu",
                itemsPerPage: config.defaultItemsPerPage ?? 10,
            });
        }).catch(() => { /* use defaults on error */ });
    }, []);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
        if (newValue === 1) setHasVisitedPreferences(true);
    };

    const [formData, setFormData] = useState<UserFormData>({
        fullName: "",
        email: "",
        maxActiveDevices: defaultMaxActiveDevices,
        mobilePhone: "",
        commercialPhone: "",
        commercialEmail: "",
        otherDetails: "",
        role: "COMMERCIAL",
        agencyId: session && !isAdmin(session.user.role) ? session.user.agencyId || "" : "",
    });

    const [newlyCreated, setNewlyCreated] = useState<{
        email: string;
        pin: string;
    } | null>(null);
    const [copiedPin, setCopiedPin] = useState(false);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hasVisitedPreferences) {
            showError(t("userFormPage", "mustVisitPreferences"));
            return;
        }

        const result = await usersActions.handleCreateUser(e, {
            name: formData.fullName,
            email: formData.email,
            maxActiveDevices: formData.maxActiveDevices,
            mobilePhone: formData.mobilePhone,
            commercialPhone: formData.commercialPhone,
            commercialEmail: formData.commercialEmail,
            otherDetails: formData.otherDetails,
            role: (formData.role || "COMMERCIAL") as UserRole,
            agencyId: formData.agencyId || "",
        });

        if (result) {
            // Save preferences for the newly created user
            try {
                await fetch(`/api/v1/internal/users/${result.user.id}/preferences`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${session?.token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        language: localPreferences.language,
                        dateFormat: localPreferences.dateFormat,
                        timeFormat: localPreferences.timeFormat,
                        timezone: localPreferences.timezone,
                        numberFormat: localPreferences.numberFormat,
                        itemsPerPage: localPreferences.itemsPerPage,
                    }),
                });
            } catch {
                // non-blocking — preferences can be updated later
            }

            setNewlyCreated({
                email: result.user.email,
                pin: result.generatedPin || "",
            });
            setCopiedPin(false);

            if (result.generatedPin) {
                showSuccess(t("userFormPage", "createdWithPin"));
            } else {
                showSuccess(t("userFormPage", "created"));
                router.push("/internal/users");
            }
        } else if (usersActions.errorText) {
            showError(usersActions.errorText);
        }
    };

    const handleDismissPin = () => {
        router.push("/internal/users");
    };

    const handleCopyPin = async () => {
        if (!newlyCreated?.pin) return;

        try {
            await navigator.clipboard.writeText(newlyCreated.pin);
            setCopiedPin(true);
            window.setTimeout(() => setCopiedPin(false), 2500);
        } catch {
            // Clipboard access can fail in restricted browser contexts.
        }
    };

    useEffect(() => {
        onActionButtons?.(!newlyCreated?.pin ? formActions : null);
        return () => onActionButtons?.(null);
    }, [formActions, newlyCreated?.pin, onActionButtons]);

    if (!session) {
        return null;
    }

    if (agenciesActions.loading) {
        return (
            <CrudPageLayout
                title={t("userFormPage", "newTitle")}
                subtitle={t("userFormPage", "newSubtitle")}
                backHref="/internal/users"
                hideHeader
            >
                <BoneyardFormSkeleton name="new-user-form" shape="user" tabs={3} />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("userFormPage", "newTitle")}
            subtitle={t("userFormPage", "newSubtitle")}
            backHref="/internal/users"
            hideHeader
        >
            {newlyCreated?.pin && (
                <Box
                    className="crud-form-panel"
                    sx={{
                        display: "grid",
                        gap: 3,
                        maxWidth: 920,
                        margin: "0 auto",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 2,
                            p: { xs: 2, sm: 2.5 },
                            borderRadius: 3,
                            border: "1px solid",
                            borderColor: "success.light",
                            bgcolor: "success.50",
                        }}
                    >
                        <CheckCircleOutlineOutlinedIcon color="success" sx={{ mt: 0.25 }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {t("userFormPage", "pinCallout")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                {t("userFormPage", "createdWithPin")}
                            </Typography>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.4fr) minmax(240px, 0.8fr)" },
                            gap: 2,
                        }}
                    >
                        <Box
                            sx={{
                                p: { xs: 2, sm: 2.5 },
                                borderRadius: 3,
                                bgcolor: "var(--scheme-surface-raised-muted)",
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Typography variant="overline" color="text.secondary">
                                {t("userFormPage", "userLabel")}
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, overflowWrap: "anywhere" }}>
                                {newlyCreated.email}
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                p: { xs: 2, sm: 2.5 },
                                borderRadius: 3,
                                bgcolor: "var(--scheme-surface-raised-muted)",
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Typography variant="overline" color="text.secondary">
                                {t("userFormPage", "pinLabel")}
                            </Typography>
                            <Typography
                                variant="h4"
                                sx={{
                                    mt: 0.5,
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    overflowWrap: "anywhere",
                                }}
                            >
                                {newlyCreated.pin}
                            </Typography>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1.5,
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                        }}
                    >
                        <Button
                            variant="outlined"
                            onClick={handleCopyPin}
                            startIcon={copiedPin ? <CheckIcon /> : <ContentCopyIcon />}
                            color={copiedPin ? "success" : "primary"}
                        >
                            {copiedPin ? t("common", "copied") : t("common", "copyPin")}
                        </Button>
                        <Button variant="contained" onClick={handleDismissPin}>
                            {t("actions", "done")}
                        </Button>
                    </Box>
                </Box>
            )}

            {!newlyCreated?.pin && (
                <Box className="crud-tab-panel">
                    <Box className="crud-tab-panel__tabs">
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label={t("userFormPage", "tabDetails")} />
                            <Tab label={t("userFormPage", "tabPreferences")} />
                            <Tab label={t("userFormPage", "tabSessions")} />
                        </Tabs>
                    </Box>

                    <Box sx={{ display: activeTab === 0 ? "block" : "none" }}>
                        {!hasVisitedPreferences && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {t("userFormPage", "mustVisitPreferences")}
                            </Alert>
                        )}
                        <UserForm
                            session={session}
                            agencies={agenciesActions.agencies}
                            data={formData}
                            onChange={setFormData}
                            onSubmit={handleSubmit}
                            errorMessage={usersActions.errorText}
                            isSubmitting={usersActions.busyAction === "create-user"}
                            submitLabel={t("userFormPage", "createSubmitLabel")}
                            cancelLabel={t("actions", "cancel")}
                            onCancel={() => router.push("/internal/users")}
                            mode="create"
                            onRenderActions={setFormActions}
                        />
                    </Box>

                    {activeTab === 1 && (
                        <Box>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    {t("userPreferences", "title")}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t("userPreferences", "description")}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "1fr 1fr",
                                        md: "1fr 1fr 1fr",
                                    },
                                    gap: 3,
                                }}
                            >
                                <FormSelect
                                    label={t("userPreferences", "fieldLanguage")}
                                    value={localPreferences.language ?? "en"}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, language: (value as string) || null }))}
                                    options={getLanguageOptions()}
                                />
                                <FormSelect
                                    label={t("systemSettings", "fieldDateFormat")}
                                    value={localPreferences.dateFormat}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, dateFormat: value as string }))}
                                    options={[
                                        { value: "DD/MM/YYYY", label: "DD/MM/YYYY (17/04/2026)" },
                                        { value: "MM/DD/YYYY", label: "MM/DD/YYYY (04/17/2026)" },
                                        { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-04-17)" },
                                    ]}
                                />
                                <FormSelect
                                    label={t("systemSettings", "fieldTimeFormat")}
                                    value={localPreferences.timeFormat}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, timeFormat: value as string }))}
                                    options={[
                                        { value: "24h", label: "24-hour (14:30)" },
                                        { value: "12h", label: "12-hour (2:30 PM)" },
                                    ]}
                                />
                                <FormSelect
                                    label={t("systemSettings", "fieldTimezone")}
                                    value={localPreferences.timezone}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, timezone: value as string }))}
                                    options={[
                                        { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
                                        { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                                        { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
                                        { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
                                        { value: "America/New_York", label: "America/New York (EST/EDT)" },
                                        { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
                                        { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
                                        { value: "UTC", label: "UTC" },
                                    ]}
                                />
                                <FormSelect
                                    label={t("systemSettings", "fieldNumberFormat")}
                                    value={localPreferences.numberFormat}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, numberFormat: value as string }))}
                                    options={[
                                        { value: "eu", label: "European (1.234,56)" },
                                        { value: "us", label: "US/UK (1,234.56)" },
                                    ]}
                                />
                                <FormSelect
                                    label={t("systemSettings", "fieldItemsPerPage")}
                                    value={localPreferences.itemsPerPage}
                                    onChange={(value) => setLocalPreferences((p) => ({ ...p, itemsPerPage: Number(value) }))}
                                    options={[
                                        { value: 10, label: "10" },
                                        { value: 25, label: "25" },
                                        { value: 50, label: "50" },
                                        { value: 100, label: "100" },
                                    ]}
                                />
                            </Box>
                        </Box>
                    )}

                    {activeTab === 2 && (
                        <UserSessionsPanel
                            session={session}
                            maxActiveDevices={formData.maxActiveDevices ?? defaultMaxActiveDevices}
                            maxActiveDevicesLimit={defaultMaxActiveDevices}
                            onMaxActiveDevicesChange={(value) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    maxActiveDevices: value,
                                }));
                            }}
                            showSessionsList={false}
                        />
                    )}
                </Box>
            )}
        </CrudPageLayout>
    );
}
