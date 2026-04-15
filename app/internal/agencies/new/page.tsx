"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stack } from "@mui/material";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createAgency } from "../../lib/internalApi";
import { AddressForm, CrudFormContainer, CrudPageLayout, useAlerts, type AddressData } from "../../components/shared";
import { FormInput } from "../../components/ui";

export default function NewAgencyPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [name, setName] = useState("");
    const [address, setAddress] = useState<AddressData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!session) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage(t("agencyFormPage", "nameRequired"));
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await createAgency(session.token, {
                name: name.trim(),
                street: address.street?.trim() || undefined,
                city: address.city?.trim() || undefined,
                postalCode: address.postalCode?.trim() || undefined,
                province: address.province?.trim() || undefined,
                country: address.country?.trim() || undefined,
            });
            showSuccess(t("agencyFormPage", "created"));
            router.push("/internal/agencies");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("agencyFormPage", "createFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CrudPageLayout
            title={t("agencyFormPage", "newTitle")}
            subtitle={t("agencyFormPage", "newSubtitle")}
            backHref="/internal/agencies"
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("agencyFormPage", "createSubmit")}
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
                        placeholder="e.g. Energía Sur S.L."
                        autoFocus
                    />
                    <AddressForm value={address} onChange={setAddress} />
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
