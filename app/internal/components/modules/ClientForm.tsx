"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { CrudFormContainer, CrudFormRow } from "../shared";
import { FormInput, FormSelect } from "../ui";
import { MenuItem } from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

export interface ClientFormData {
    name: string;
    cif: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    otherDetails: string;
    agencyId?: string;
}

interface ValidationErrors {
    name?: string;
    contactEmail?: string;
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
        if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
            errors.contactEmail = t("clientFormPage", "validContactEmailInvalid");
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
                <FormInput
                    label={t("clientFormPage", "fieldContactPhone")}
                    type="tel"
                    value={data.contactPhone}
                    onChange={(e) => onChange({ ...data, contactPhone: e.target.value })}
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
            </CrudFormRow>

            {/* Agency (admin only) */}
            {canManageAgency && agencies.length > 0 && (
                <FormSelect
                    label={t("clientFormPage", "fieldAgency")}
                    value={data.agencyId || ""}
                    onChange={(e) => onChange({ ...data, agencyId: e.target.value as string })}
                    disabled={isSubmitting}
                >
                    {mode === "create" && <MenuItem value="">{t("clientFormPage", "selectAgencyPlaceholder")}</MenuItem>}
                    {agencies.map((a) => (
                        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                    ))}
                </FormSelect>
            )}

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
