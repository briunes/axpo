"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Stack } from "@mui/material";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getAgency, updateAgency, type AgencyItem } from "../../../lib/internalApi";
import { AddressForm, CrudFormContainer, CrudPageLayout, LoadingState, useAlerts, type AddressData } from "../../../components/shared";
import { FormInput } from "../../../components/ui";

export default function EditAgencyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [agency, setAgency] = useState<AgencyItem | null>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState<AddressData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!session) return;
        getAgency(session.token, id)
            .then((a) => {
                setAgency(a);
                setName(a.name);
                setAddress({
                    street: a.street || "",
                    city: a.city || "",
                    postalCode: a.postalCode || "",
                    province: a.province || "",
                    country: a.country || "",
                });
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("agencyFormPage", "notFound"));
                router.push("/internal/agencies");
            });
    }, [session, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !agency) return;
        if (!name.trim()) {
            setErrorMessage(t("agencyFormPage", "nameRequired"));
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await updateAgency(session.token, agency.id, {
                name: name.trim(),
                street: address.street?.trim() || undefined,
                city: address.city?.trim() || undefined,
                postalCode: address.postalCode?.trim() || undefined,
                province: address.province?.trim() || undefined,
                country: address.country?.trim() || undefined,
            });
            showSuccess(t("agencyFormPage", "updated"));
            router.push("/internal/agencies");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("agencyFormPage", "updateFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session || !agency) {
        return (
            <CrudPageLayout title={t("agencyFormPage", "editTitle")} backHref="/internal/agencies">
                <LoadingState message={t("agencyFormPage", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("agencyFormPage", "editTitle")}
            subtitle={t("agencyFormPage", "editSubtitle", { name: agency.name })}
            backHref="/internal/agencies"
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("actions", "saveChanges")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/agencies")}
                isSubmitting={isSubmitting}
            >
                <Stack spacing={2}>
                    <FormInput
                        label={t("agencyFormPage", "nameLabel")}
                        type="text"
                        value={name}
                        onChange={(e) => setName((e.target as HTMLInputElement).value)}
                        autoFocus
                    />
                    <AddressForm value={address} onChange={setAddress} />
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
