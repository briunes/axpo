"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getClient, isAdmin, listAgencies, updateClient, type ClientItem } from "../../../lib/internalApi";
import { CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { ClientForm, type ClientFormData } from "../../../components/modules/ClientForm";
import { AuditLogsModal } from "../../../components/ui/AuditLogsModal";
import type { AgencyItem } from "../../../lib/internalApi";
import { useActionButtons, useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();
    const onActionButtons = useActionButtons();

    const [client, setClient] = useState<ClientItem | null>(null);
    const [agencies, setAgencies] = useState<AgencyItem[]>([]);
    const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
    const [formData, setFormData] = useState<ClientFormData>({
        name: "",
        cif: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        otherDetails: "",
        agencyId: "",
        address: {},
        language: undefined,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);
    const breadcrumbs = useMemo(
        () => client ? [{ label: client.name, href: `/internal/clients/${client.id}/edit` }] : null,
        [client],
    );
    useTopBarBreadcrumbs(breadcrumbs);

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
                    address: {
                        street: c.street ?? "",
                        city: c.city ?? "",
                        postalCode: c.postalCode ?? "",
                        province: c.province ?? "",
                        country: c.country ?? "",
                    },
                    language: c.language ?? undefined,
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
                language: formData.language || undefined,
                street: formData.address.street?.trim() || undefined,
                city: formData.address.city?.trim() || undefined,
                postalCode: formData.address.postalCode?.trim() || undefined,
                province: formData.address.province?.trim() || undefined,
                country: formData.address.country?.trim() || undefined,
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

    useEffect(() => {
        if (!session || !client) {
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
                {formActions}
            </>,
        );

        return () => onActionButtons?.(null);
    }, [client, formActions, onActionButtons, session, t]);

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
            hideHeader
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

            {session && (
                <AuditLogsModal
                    open={showAuditLogsModal}
                    onClose={() => setShowAuditLogsModal(false)}
                    targetType="CLIENT"
                    targetId={client.id}
                    token={session.token}
                    title={`${t("auditLogsModal", "title")} - ${client.name}`}
                />
            )}
        </CrudPageLayout>
    );
}
