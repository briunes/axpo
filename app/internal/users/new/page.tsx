"use client";

import { Button } from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { useAgencies } from "../../components/hooks/useAgencies";
import { useUsers } from "../../components/hooks/useUsers";
import { UserForm, type UserFormData } from "../../components/modules/UserForm";
import { CrudPageLayout, useAlerts } from "../../components/shared";
import type { UserRole } from "../../lib/internalApi";

export default function NewUserPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const usersActions = useUsers(session);
    const agenciesActions = useAgencies(session);

    const [formData, setFormData] = useState<UserFormData>({
        fullName: "",
        email: "",
        mobilePhone: "",
        commercialPhone: "",
        commercialEmail: "",
        otherDetails: "",
        password: "",
        role: "COMMERCIAL",
        agencyId: session?.user.agencyId || "",
    });

    const [newlyCreated, setNewlyCreated] = useState<{
        email: string;
        pin: string;
    } | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;
        agenciesActions.refresh();
    }, [session]);

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

        const result = await usersActions.handleCreateUser(e, {
            name: formData.fullName,
            email: formData.email,
            mobilePhone: formData.mobilePhone,
            commercialPhone: formData.commercialPhone,
            commercialEmail: formData.commercialEmail,
            otherDetails: formData.otherDetails,
            password: formData.password || "",
            role: (formData.role || "COMMERCIAL") as UserRole,
            agencyId: formData.agencyId || "",
        });

        if (result) {
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
            )}
        </CrudPageLayout>
    );
}
