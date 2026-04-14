"use client";

import { Button, Stack } from "@mui/material";

export interface CrudFormContainerProps {
    children: React.ReactNode;
    onSubmit?: (e: React.FormEvent) => void;
    errorMessage?: string | null;
    successMessage?: string | null;
    // Footer
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    isSubmitting?: boolean;
}

/**
 * Reusable form container with error/success messaging and built-in footer actions.
 */
export function CrudFormContainer({
    children,
    onSubmit,
    errorMessage,
    successMessage,
    submitLabel = "Save",
    cancelLabel = "Cancel",
    onCancel,
    isSubmitting,
}: CrudFormContainerProps) {
    return (
        <Stack spacing={3}>
            {/* Error/Success messages */}
            {errorMessage && (
                <div className="crud-alert crud-alert--error">
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className="crud-alert crud-alert--success">
                    {successMessage}
                </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="crud-form" noValidate>
                <Stack spacing={2.5}>
                    {children}
                </Stack>

                {/* Footer actions */}
                <div className="crud-form-footer">
                    {onCancel && (
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            {cancelLabel}
                        </Button>
                    )}
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    >
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Stack>
    );
}
