"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { AddressForm, CrudFormContainer, CrudFormRow } from "../shared";
import type { AddressData } from "../shared";
import { FormAutocomplete, FormInput, FormSelect, PhoneInput } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getLanguageOptions } from "../../../../src/lib/supportedLanguages";

export interface ClientFormData {
    name: string;
    cif: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    otherDetails: string;
    agencyId?: string;
    address: AddressData;
    language?: string;
}

interface ValidationErrors {
    name?: string;
    contactEmail?: string;
    country?: string;
}

export interface ClientFormProps {
    session: SessionState;
    agencies?: AgencyItem[];
    data: ClientFormData;
    onChange: (data: ClientFormData) => void;
    onSubmit: (e: React.FormEvent) => void;
    errorMessage?: string | null;
    successMessage?: string | null;
    isSubmitting?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    mode: "create" | "edit";
    onRenderActions?: (actions: React.ReactNode) => void;
}

export function ClientForm({
    session,
    agencies = [],
    data,
    onChange,
    onSubmit,
    errorMessage,
    successMessage,
    isSubmitting,
    submitLabel = "Save",
    cancelLabel = "Cancel",
    onCancel,
    mode,
    onRenderActions,
}: ClientFormProps) {
    const { t } = useI18n();
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    const canManageAgency = isAdmin(session.user.role);

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
        if (!data.name || data.name.trim() === "") {
            errors.name = t("clientFormPage", "validNameRequired");
        }
        if (data.contactEmail && data.contactEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
            errors.contactEmail = t("clientFormPage", "validContactEmailInvalid");
        }
        if (!data.address.country) {
            errors.country = t("clientFormPage", "validCountryRequired");
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(e);
        }
    };

    return (
        <CrudFormContainer
            onSubmit={handleSubmit}
            errorMessage={errorMessage}
            successMessage={successMessage}
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            onRenderActions={onRenderActions}
        >
            {/* Company info */}
            <CrudFormRow>
                <FormInput
                    label={t("clientFormPage", "fieldCompanyName")}
                    type="text"
                    value={data.name}
                    onChange={(e) => {
                        onChange({ ...data, name: e.target.value });
                        clearError("name");
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.name}
                    helperText={validationErrors.name}
                    autoFocus={mode === "create"}
                />
                <FormInput
                    label={t("clientFormPage", "fieldCif")}
                    type="text"
                    value={data.cif}
                    onChange={(e) => onChange({ ...data, cif: e.target.value })}
                    disabled={isSubmitting}
                    helperText={t("clientFormPage", "fieldCifHint")}
                />
            </CrudFormRow>

            {/* Contact person */}
            <CrudFormRow>
                <FormInput
                    label={t("clientFormPage", "fieldContactName")}
                    type="text"
                    value={data.contactName}
                    onChange={(e) => onChange({ ...data, contactName: e.target.value })}
                    disabled={isSubmitting}
                />
                <PhoneInput
                    label={t("clientFormPage", "fieldContactPhone")}
                    value={data.contactPhone}
                    onChange={(phone) => onChange({ ...data, contactPhone: phone })}
                    disabled={isSubmitting}
                />
            </CrudFormRow>

            <CrudFormRow>
                <FormInput
                    label={t("clientFormPage", "fieldContactEmail")}
                    type="email"
                    value={data.contactEmail}
                    onChange={(e) => {
                        onChange({ ...data, contactEmail: e.target.value });
                        clearError("contactEmail");
                    }}
                    disabled={isSubmitting}
                    error={!!validationErrors.contactEmail}
                    helperText={validationErrors.contactEmail}
                />
                {/* Agency (admin only) */}
                <FormAutocomplete
                    label={t("clientFormPage", "fieldAgency")}
                    options={agencies.map((a) => ({ value: a.id, label: a.name }))}
                    value={data.agencyId || ""}
                    onChange={(val) => onChange({ ...data, agencyId: val })}
                    placeholder={t("clientFormPage", "selectAgencyPlaceholder")}
                    disabled={isSubmitting || (!canManageAgency && agencies.length > 0)}
                    disableClearable={mode === "edit"}
                />

            </CrudFormRow>


            {/* Address */}
            <AddressForm
                value={data.address}
                onChange={(addr) => {
                    onChange({ ...data, address: addr });
                    if (addr.country) {
                        setValidationErrors((prev) => { const n = { ...prev }; delete n.country; return n; });
                    }
                }}
                disabled={isSubmitting}
                countryRequired
                countryError={validationErrors.country}
            />

            {/* Language preference */}
            <FormSelect
                label={t("clientFormPage", "fieldLanguage")}
                value={data.language ?? ""}
                onChange={(val) => onChange({ ...data, language: (val as string) || undefined })}
                options={getLanguageOptions()}
                disabled={isSubmitting}
            />

            {/* Other details */}
            <FormInput
                label={t("clientFormPage", "fieldOtherDetails")}
                type="text"
                value={data.otherDetails}
                onChange={(e) => onChange({ ...data, otherDetails: e.target.value })}
                disabled={isSubmitting}
                helperText={t("clientFormPage", "fieldOtherDetailsHint")}
                multiline
                rows={3}
            />
        </CrudFormContainer>
    );
}
