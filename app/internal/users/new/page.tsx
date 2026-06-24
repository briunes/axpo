"use client";

import { Button } from "@once-ui-system/core";
import { Box, Tabs, Tab, Alert, Typography } from "@mui/material";
import { FormSelect } from "../../components/ui/FormSelect";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useAgencies } from "../../components/hooks/useAgencies";
import { useUsers } from "../../components/hooks/useUsers";
import { UserForm, type UserFormData } from "../../components/modules/UserForm";
import { UserSessionsPanel } from "../../components/modules/UserSessionsPanel";
import { CrudPageLayout, useAlerts } from "../../components/shared";
import { useTopBarBreadcrumbs } from "../../components/InternalWorkspace";
import type { UserRole } from "../../lib/internalApi";
import { getSystemConfig } from "../../lib/configApi";

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
    const breadcrumbs = useMemo(() => [{ label: t("userFormPage", "newTitle") }], [t]);
    useTopBarBreadcrumbs(breadcrumbs);

    const usersActions = useUsers(session, 25, { queryEnabled: false });
    const agenciesActions = useAgencies(session, 1000, { minimal: true });

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
        agencyId: session?.user.agencyId || "",
    });

    const [newlyCreated, setNewlyCreated] = useState<{
        email: string;
        pin: string;
    } | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    useEffect(() => {
        if (agenciesActions.agencies.length > 0 && !formData.agencyId) {
            setFormData((prev) => ({
                ...prev,
                agencyId: session?.user.agencyId || agenciesActions.agencies[0].id,
            }));
        }
    }, [agenciesActions.agencies, session]);

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

    if (!session) {
        return null;
    }

    return (
        <CrudPageLayout
            title={t("userFormPage", "newTitle")}
            subtitle={t("userFormPage", "newSubtitle")}
            backHref="/internal/users"
            actions={formActions}
        >
            {newlyCreated?.pin && (
                <div className="crud-callout" style={{ marginBottom: "24px" }}>
                    <span className="crud-callout-label">
                        {t("userFormPage", "pinCallout")}
                    </span>
                    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                        <div>
                            <div className="dt-cell-secondary">{t("userFormPage", "userLabel")}</div>
                            <div className="dt-cell-primary">{newlyCreated.email}</div>
                        </div>
                        <div>
                            <div className="dt-cell-secondary">{t("userFormPage", "pinLabel")}</div>
                            <div className="crud-callout-value">{newlyCreated.pin}</div>
                        </div>
                        <Button variant="secondary" size="s" onClick={handleDismissPin} label={t("actions", "done")} />
                    </div>
                </div>
            )}

            {!newlyCreated?.pin && (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
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
                                    options={[
                                        { value: "en", label: "🇬🇧 English" },
                                        { value: "es", label: "🇪🇸 Español" },
                                    ]}
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
                </>
            )}
        </CrudPageLayout>
    );
}
