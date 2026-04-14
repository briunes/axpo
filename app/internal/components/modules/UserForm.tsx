"use client";

import { MenuItem } from "@mui/material";
import { useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, UserRole } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import { CrudFormContainer, CrudFormRow } from "../shared";
import { FormInput, FormSelect } from "../ui";
import { useI18n } from "../../../../src/lib/i18n-context";

export interface UserFormData {
    fullName: string;
    email: string;
    mobilePhone: string;
    commercialPhone: string;
    commercialEmail: string;
    otherDetails?: string;
    password?: string;
    currentPassword?: string;
    role?: UserRole;
    agencyId?: string;
}

interface ValidationErrors {
    fullName?: string;
    email?: string;
    mobilePhone?: string;
    commercialPhone?: string;
    commercialEmail?: string;
    password?: string;
    currentPassword?: string;
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
}: UserFormProps) {
    const { t } = useI18n();
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    const canManageRole = mode === "create" || isAdmin(session.user.role);
    const canManageAgency = isAdmin(session.user.role);
    const requirePassword = mode === "create";

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

        if (mode === "create" && (!data.password || data.password === "")) {
            errors.password = t("userFormPage", "validPasswordRequired");
        } else if (data.password && data.password.length > 0) {
            if (data.password.length < 12) {
                errors.password = t("userFormPage", "validPasswordMinLength");
            } else if (!/(?=.*[a-z])/.test(data.password)) {
                errors.password = t("userFormPage", "validPasswordLowercase");
            } else if (!/(?=.*[A-Z])/.test(data.password)) {
                errors.password = t("userFormPage", "validPasswordUppercase");
            } else if (!/(?=.*\d)/.test(data.password)) {
                errors.password = t("userFormPage", "validPasswordNumber");
            } else if (!/(?=.*[@$!%*?&#])/.test(data.password)) {
                errors.password = t("userFormPage", "validPasswordSpecial");
            }
        }

        if (mode === "edit" && isEditingSelf && data.password && !data.currentPassword) {
            errors.currentPassword = t("userFormPage", "validCurrentPasswordRequired");
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
                        onChange({ ...data, email: e.target.value });
                        clearError('email');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.email}
                    helperText={validationErrors.email}
                />
            </CrudFormRow>

            <CrudFormRow>
                <FormInput
                    label={t("userFormPage", "fieldMobilePhone")}
                    type="text"
                    value={data.mobilePhone}
                    onChange={(e) => {
                        onChange({ ...data, mobilePhone: e.target.value });
                        clearError('mobilePhone');
                    }}
                    required
                    disabled={isSubmitting}
                    error={!!validationErrors.mobilePhone}
                    helperText={validationErrors.mobilePhone}
                />

                <FormInput
                    label={t("userFormPage", "fieldCommercialPhone")}
                    type="text"
                    value={data.commercialPhone}
                    onChange={(e) => {
                        onChange({ ...data, commercialPhone: e.target.value });
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

                <FormInput
                    label={t("userFormPage", "fieldOtherDetails")}
                    type="text"
                    value={data.otherDetails || ""}
                    onChange={(e) => onChange({ ...data, otherDetails: e.target.value })}
                    disabled={isSubmitting}
                    helperText={t("userFormPage", "fieldOtherDetailsHint")}
                />
            </CrudFormRow>

            {mode === "edit" && isEditingSelf && (
                <FormInput
                    label={t("userFormPage", "fieldCurrentPassword")}
                    type="password"
                    helperText={validationErrors.currentPassword || t("userFormPage", "fieldCurrentPasswordHint")}
                    value={data.currentPassword || ""}
                    onChange={(e) => {
                        onChange({ ...data, currentPassword: e.target.value });
                        clearError('currentPassword');
                    }}
                    disabled={isSubmitting}
                    error={!!validationErrors.currentPassword}
                />
            )}

            <FormInput
                label={mode === "create" ? t("userFormPage", "fieldPassword") : t("userFormPage", "fieldNewPassword")}
                type="password"
                helperText={
                    validationErrors.password ||
                    (mode === "create"
                        ? t("userFormPage", "fieldPasswordHintCreate")
                        : t("userFormPage", "fieldPasswordHintEdit"))
                }
                value={data.password || ""}
                onChange={(e) => {
                    onChange({ ...data, password: e.target.value });
                    clearError('password');
                }}
                required={requirePassword}
                disabled={isSubmitting}
                error={!!validationErrors.password}
            />

            {canManageRole && (
                <CrudFormRow>
                    <FormSelect
                        label={t("userFormPage", "fieldRole")}
                        value={data.role || "COMMERCIAL"}
                        onChange={(e) => {
                            onChange({ ...data, role: e.target.value as UserRole });
                            clearError('role');
                        }}
                        required={mode === "create"}
                        disabled={isSubmitting || (mode === "edit" && data.role === "ADMIN")}
                        error={!!validationErrors.role}
                        helperText={validationErrors.role || (mode === "edit" && data.role === "ADMIN" ? t("userFormPage", "adminRoleCannotBeChanged") : undefined)}
                    >
                        <MenuItem value="COMMERCIAL">{t("userFormPage", "roleCommercial")}</MenuItem>
                        <MenuItem value="AGENT">{t("userFormPage", "roleAgent")}</MenuItem>
                        {isAdmin(session.user.role) && <MenuItem value="ADMIN">{t("userFormPage", "roleAdmin")}</MenuItem>}
                    </FormSelect>

                    {canManageAgency && (
                        <FormSelect
                            label={t("userFormPage", "fieldAgency")}
                            value={data.agencyId || ""}
                            onChange={(e) => {
                                onChange({ ...data, agencyId: e.target.value as string });
                                clearError('agencyId');
                            }}
                            required={mode === "create"}
                            disabled={isSubmitting}
                            error={!!validationErrors.agencyId}
                            helperText={validationErrors.agencyId}
                        >
                            {mode === "edit" ? null : <MenuItem value="">{t("userFormPage", "selectAgencyPlaceholder")}</MenuItem>}
                            {agencies.map((a) => (
                                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                            ))}
                        </FormSelect>
                    )}
                </CrudFormRow>
            )}
        </CrudFormContainer>
    );
}
