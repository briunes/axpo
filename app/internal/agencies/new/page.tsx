"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stack } from "@mui/material";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createAgency } from "../../lib/internalApi";
import { AddressForm, CrudFormContainer, CrudPageLayout, useAlerts, type AddressData } from "../../components/shared";
import { FormInput } from "../../components/ui";

interface ValidationErrors {
    name?: string;
}

export default function NewAgencyPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [name, setName] = useState("");
    const [address, setAddress] = useState<AddressData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [formActions, setFormActions] = useState<React.ReactNode>(null);

    if (!session) return null;

    const clearError = (field: keyof ValidationErrors) => {
        if (validationErrors[field]) {
            setValidationErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateForm = (): boolean => {
        const errors: ValidationErrors = {};
        if (!name.trim()) {
            errors.name = t("agencyFormPage", "validNameRequired");
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
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
            actions={formActions}
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("agencyFormPage", "createSubmit")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/agencies")}
                isSubmitting={isSubmitting}
                onRenderActions={setFormActions}
            >
                <Stack spacing={2}>
                    <FormInput
                        label={t("agencyFormPage", "nameLabel")}
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName((e.target as HTMLInputElement).value);
                            clearError("name");
                        }}
                        placeholder="e.g. Energía Sur S.L."
                        autoFocus
                        required
                        disabled={isSubmitting}
                        error={!!validationErrors.name}
                        helperText={validationErrors.name}
                    />
                    <AddressForm value={address} onChange={setAddress} disabled={isSubmitting} />
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
