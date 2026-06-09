"use client";

import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, UserRole } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { CrudFormContainer, CrudFormRow } from "../shared";
import { FormAutocomplete, FormInput, FormSelect, PhoneInput } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";

export interface UserFormData {
    fullName: string;
    email: string;
    maxActiveDevices?: number;
    mobilePhone: string;
    commercialPhone: string;
    commercialEmail: string;
    otherDetails?: string;
    role?: UserRole;
    agencyId?: string;
    isActive?: boolean;
}

interface ValidationErrors {
    fullName?: string;
    email?: string;
    maxActiveDevices?: string;
    mobilePhone?: string;
    commercialPhone?: string;
    commercialEmail?: string;
    role?: string;
    agencyId?: string;
}

export interface UserFormProps {
    session: SessionState;
    agencies: AgencyItem[];
    data: UserFormData;
    onChange: (data: UserFormData) => void;
    onSubmit: (e: React.FormEvent) => void;
    errorMessage?: string | null;
    successMessage?: string | null;
    isSubmitting?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    mode: "create" | "edit";
    isEditingSelf?: boolean;
    originalRole?: UserRole;
    onRenderActions?: (actions: React.ReactNode) => void;
}

/**
 * Reusable form for creating/editing users
 * Handles both create and edit modes with proper field visibility
 */
export function UserForm({
    session,
    agencies,
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
    isEditingSelf,
    originalRole,
    onRenderActions,
}: UserFormProps) {
    const { t } = useI18n();
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    const canManageRole = mode === "create" || isAdmin(session.user.role);
    const canManageAgency = isAdmin(session.user.role);
    const isSysAdminViewer = session.user.role === "SYS_ADMIN";
    const roleAtLoad = originalRole ?? data.role;
    // Lock rules in edit mode:
    //   - Any user with ADMIN role is locked unless the viewer is a SYS_ADMIN
    //     (only SYS_ADMINs can manage other admins)
    //   - A user who was already SYS_ADMIN when the form loaded is locked
    //     (selecting SYS_ADMIN for another user should not lock the field mid-edit)
    const isAdminTargetLocked = mode === "edit" && roleAtLoad === "ADMIN" && !isSysAdminViewer;
    const isSysAdminTargetLocked = mode === "edit" && roleAtLoad === "SYS_ADMIN";
    const isRoleLocked = isAdminTargetLocked || isSysAdminTargetLocked;

    const clearError = (field: keyof ValidationErrors) => {
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateForm = (): boolean => {
        const errors: ValidationErrors = {};

        if (!data.fullName || data.fullName.trim() === "") {
            errors.fullName = t("userFormPage", "validFullNameRequired");
        }

        if (!data.email || data.email.trim() === "") {
            errors.email = t("userFormPage", "validEmailRequired");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.email = t("userFormPage", "validEmailInvalid");
        }

        if (!data.mobilePhone || data.mobilePhone.trim() === "") {
            errors.mobilePhone = t("userFormPage", "validMobilePhoneRequired");
        }

        if (!data.commercialPhone || data.commercialPhone.trim() === "") {
            errors.commercialPhone = t("userFormPage", "validCommercialPhoneRequired");
        }

        if (!data.commercialEmail || data.commercialEmail.trim() === "") {
            errors.commercialEmail = t("userFormPage", "validCommercialEmailRequired");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.commercialEmail)) {
            errors.commercialEmail = t("userFormPage", "validCommercialEmailInvalid");
        }

        if (mode === "create" && canManageRole && !data.role) {
            errors.role = t("userFormPage", "validRoleRequired");
        }

        if (mode === "create" && canManageAgency && (!data.agencyId || data.agencyId === "")) {
            errors.agencyId = t("userFormPage", "validAgencyRequired");
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
            <CrudFormRow>
                <FormInput
                    label={t("userFormPage", "fieldFullName")}
                    type="text"
                    value={data.fullName}
                    onChange={(e) => {
                        onChange({ ...data, fullName: e.target.value });
                        clearError('fullName');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.fullName}
                    helperText={validationErrors.fullName}
                />

                <FormInput
                    label={t("userFormPage", "fieldEmail")}
                    type="email"
                    value={data.email}
                    onChange={(e) => {
                        onChange({ ...data, email: e.target.value.toLocaleLowerCase() });
                        clearError('email');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.email}
                    helperText={validationErrors.email}
                />
            </CrudFormRow>

            <CrudFormRow>
                <PhoneInput
                    label={t("userFormPage", "fieldMobilePhone")}
                    value={data.mobilePhone}
                    onChange={(phone) => {
                        onChange({ ...data, mobilePhone: phone });
                        clearError('mobilePhone');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.mobilePhone}
                    helperText={validationErrors.mobilePhone}
                />

                <PhoneInput
                    label={t("userFormPage", "fieldCommercialPhone")}
                    value={data.commercialPhone}
                    onChange={(phone) => {
                        onChange({ ...data, commercialPhone: phone });
                        clearError('commercialPhone');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.commercialPhone}
                    helperText={validationErrors.commercialPhone}
                />
            </CrudFormRow>

            <CrudFormRow>
                <FormInput
                    label={t("userFormPage", "fieldCommercialEmail")}
                    type="email"
                    value={data.commercialEmail}
                    onChange={(e) => {
                        onChange({ ...data, commercialEmail: e.target.value });
                        clearError('commercialEmail');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.commercialEmail}
                    helperText={validationErrors.commercialEmail}
                />

                {mode === "edit" && (
                    <FormSelect
                        label={t("userFormPage", "fieldIsActive")}
                        options={[
                            { value: "active", label: t("userFormPage", "statusActive") },
                            { value: "inactive", label: t("userFormPage", "statusInactive") }
                        ]}
                        value={data.isActive ? "active" : "inactive"}
                        onChange={(value) => onChange({ ...data, isActive: value === "active" })}
                        disabled={isSubmitting || isEditingSelf}
                        helperText={isEditingSelf ? t("userFormPage", "cannotDeactivateSelf") : undefined}
                    />
                )}
            </CrudFormRow>

            {canManageRole && (
                <CrudFormRow>
                    <FormSelect
                        label={t("userFormPage", "fieldRole")}
                        options={[
                            { value: "COMMERCIAL", label: t("userFormPage", "roleCommercial") },
                            { value: "AGENT", label: t("userFormPage", "roleAgent") },
                            ...(isAdmin(session.user.role) ? [{ value: "ADMIN", label: t("userFormPage", "roleAdmin") }] : []),
                            ...(session.user.role === "SYS_ADMIN" ? [{ value: "SYS_ADMIN", label: t("userFormPage", "roleSysAdmin") }] : []),
                        ]}
                        value={data.role || "COMMERCIAL"}
                        onChange={(value) => {
                            onChange({ ...data, role: value as UserRole });
                            clearError('role');
                        }}
                        required={mode === "create"}
                        disabled={isSubmitting || isRoleLocked}
                        error={!!validationErrors.role}
                        helperText={
                            validationErrors.role ||
                            (isAdminTargetLocked
                                ? t("userFormPage", "adminRoleCannotBeChanged")
                                : isSysAdminTargetLocked
                                    ? t("userFormPage", "sysAdminRoleCannotBeChanged")
                                    : undefined)
                        }
                    />

                    {canManageAgency && (
                        <FormAutocomplete
                            label={t("userFormPage", "fieldAgency")}
                            options={agencies.map((a) => ({ value: a.id, label: a.name }))}
                            value={data.agencyId || ""}
                            onChange={(val) => {
                                onChange({ ...data, agencyId: val });
                                clearError('agencyId');
                            }}
                            placeholder={t("userFormPage", "selectAgencyPlaceholder")}
                            required={mode === "create"}
                            disabled={isSubmitting}
                            error={!!validationErrors.agencyId}
                            helperText={validationErrors.agencyId}
                            disableClearable={mode === "edit"}
                        />
                    )}
                </CrudFormRow>
            )}

            <CrudFormRow>
                <FormInput
                    label={t("userFormPage", "fieldOtherDetails")}
                    value={data.otherDetails || ""}
                    onChange={(e) => onChange({ ...data, otherDetails: e.target.value })}
                    disabled={isSubmitting}
                    helperText={t("userFormPage", "fieldOtherDetailsHint")}
                    multiline
                    rows={3}
                />
            </CrudFormRow>
        </CrudFormContainer>
    );
}
