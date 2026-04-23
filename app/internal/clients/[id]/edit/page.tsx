"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getClient, isAdmin, listAgencies, updateClient, type ClientItem } from "../../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { ClientForm, type ClientFormData } from "../../../components/modules/ClientForm";
import type { AgencyItem } from "../../../lib/internalApi";

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [client, setClient] = useState<ClientItem | null>(null);
    const [agencies, setAgencies] = useState<AgencyItem[]>([]);
    const [formData, setFormData] = useState<ClientFormData>({
        name: "",
        cif: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        otherDetails: "",
        agencyId: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    const fetchedRef = useRef(false);
    useEffect(() => {
        if (!session || fetchedRef.current) return;
        fetchedRef.current = true;

        getClient(session.token, id)
            .then((c) => {
                setClient(c);
                setFormData({
                    name: c.name,
                    cif: c.cif ?? "",
                    contactName: c.contactName ?? "",
                    contactEmail: c.contactEmail ?? "",
                    contactPhone: c.contactPhone ?? "",
                    otherDetails: c.otherDetails ?? "",
                    agencyId: c.agencyId ?? "",
                });
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("clientFormPage", "notFound"));
                router.push("/internal/clients");
            });

        if (isAdmin(session.user.role)) {
            listAgencies(session.token, {}).then((res) => setAgencies(res.items)).catch(() => { });
        }
    }, [session, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !client) return;
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await updateClient(session.token, client.id, {
                name: formData.name.trim(),
                cif: formData.cif.trim() || undefined,
                contactName: formData.contactName.trim() || undefined,
                contactEmail: formData.contactEmail.trim() || undefined,
                contactPhone: formData.contactPhone.trim() || undefined,
                otherDetails: formData.otherDetails.trim() || undefined,
                agencyId: formData.agencyId || undefined,
            });
            showSuccess(t("clientFormPage", "updated"));
            router.push("/internal/clients");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("clientFormPage", "updateFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session || !client) {
        return (
            <CrudPageLayout title={t("clientFormPage", "editTitle")} backHref="/internal/clients">
                <LoadingState message={t("clientFormPage", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("clientFormPage", "editTitle")}
            subtitle={t("clientFormPage", "editSubtitle", { name: client.name })}
            backHref="/internal/clients"
            actions={formActions}
        >
            <ClientForm
                session={session}
                agencies={agencies}
                data={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                submitLabel={t("actions", "saveChanges")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/clients")}
                mode="edit"
                onRenderActions={setFormActions}
            />
        </CrudPageLayout>
    );
}
