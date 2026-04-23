"use client";

import { Button, Stack } from "@mui/material";
import { useLayoutEffect, useMemo, useRef, useId } from "react";

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
    onRenderActions?: (actions: React.ReactNode) => void;
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
    onRenderActions,
}: CrudFormContainerProps) {
    const onRenderActionsRef = useRef(onRenderActions);
    const formId = useId();

    useLayoutEffect(() => {
        onRenderActionsRef.current = onRenderActions;
    });

    const actionButtons = useMemo(() => (
        <>
            {onCancel && (
                <Button
                    variant="outlined"
                    size="small"
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    {cancelLabel}
                </Button>
            )}
            <Button
                type="submit"
                form={formId}
                variant="contained"
                size="small"
                disabled={isSubmitting}
                loading={isSubmitting}
            >
                {submitLabel}
            </Button>
        </>
    ), [submitLabel, cancelLabel, isSubmitting, onCancel, formId]);

    useLayoutEffect(() => {
        if (onRenderActionsRef.current) {
            onRenderActionsRef.current(actionButtons);
        }
        return () => {
            if (onRenderActionsRef.current) {
                onRenderActionsRef.current(null);
            }
        };
    }, [submitLabel, cancelLabel, isSubmitting]);

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
            <form id={formId} onSubmit={onSubmit} className="crud-form" noValidate>
                <Stack spacing={2.5}>
                    {children}
                </Stack>
            </form>

            {/* Render action buttons directly if onRenderActions is not provided */}
            {!onRenderActions && (
                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                    {actionButtons}
                </Stack>
            )}
        </Stack>
    );
}
