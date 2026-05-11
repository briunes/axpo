"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createClient, isAdmin } from "../../lib/internalApi";
import { useAgencies } from "../../components/hooks/useAgencies";
import { ClientForm, type ClientFormData } from "../../components/modules/ClientForm";
import { CrudPageLayout, useAlerts } from "../../components/shared";

export default function NewClientPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const agenciesActions = useAgencies(session, 1000);

    const [formData, setFormData] = useState<ClientFormData>({
        name: "",
        cif: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        otherDetails: "",
        agencyId: session?.user.agencyId ?? "",
        address: {},
        language: undefined,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    useEffect(() => {
        if (agenciesActions.agencies.length > 0 && !formData.agencyId) {
            setFormData((prev) => ({
                ...prev,
                agencyId: session?.user.agencyId || agenciesActions.agencies[0].id,
            }));
        }
    }, [agenciesActions.agencies, formData.agencyId, session]);

    if (!session) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await createClient(session.token, {
                name: formData.name.trim(),
                agencyId: formData.agencyId || undefined,
                cif: formData.cif.trim() || undefined,
                contactName: formData.contactName.trim() || undefined,
                contactEmail: formData.contactEmail.trim() || undefined,
                contactPhone: formData.contactPhone.trim() || undefined,
                otherDetails: formData.otherDetails.trim() || undefined,
                language: formData.language || undefined,
                street: formData.address.street?.trim() || undefined,
                city: formData.address.city?.trim() || undefined,
                postalCode: formData.address.postalCode?.trim() || undefined,
                province: formData.address.province?.trim() || undefined,
                country: formData.address.country?.trim() || undefined,
            });
            showSuccess(t("clientFormPage", "created"));
            router.push("/internal/clients");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("clientFormPage", "createFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CrudPageLayout
            title={t("clientFormPage", "newTitle")}
            subtitle={t("clientFormPage", "newSubtitle")}
            backHref="/internal/clients"
            actions={formActions}
        >
            <ClientForm
                session={session}
                agencies={agenciesActions.agencies}
                data={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                submitLabel={t("clientFormPage", "createSubmit")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/clients")}
                mode="create"
                onRenderActions={setFormActions}
            />
        </CrudPageLayout>
    );
}
