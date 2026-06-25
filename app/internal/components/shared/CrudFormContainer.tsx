"use client";

import { Button, Stack } from "@mui/material";
import { useLayoutEffect, useMemo, useRef, useId } from "react";

export interface CrudFormContainerProps {
    children: React.ReactNode;
    onSubmit?: (e: React.FormEvent) => void;
    errorMessage?: string | null;
    successMessage?: string | null;
    variant?: "card" | "plain";
    // Footer
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    isSubmitting?: boolean;
    hideSubmit?: boolean;
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
    hideSubmit,
    onRenderActions,
    variant = "card",
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
                    className={onRenderActions ? "topbar-action topbar-action--compact" : undefined}
                    variant="outlined"
                    size="small"
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    {cancelLabel}
                </Button>
            )}
            {!hideSubmit && (
                <Button
                    className={onRenderActions ? "topbar-action topbar-action--compact" : undefined}
                    type="submit"
                    form={formId}
                    variant="contained"
                    size="small"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                >
                    {submitLabel}
                </Button>
            )}
        </>
    ), [submitLabel, cancelLabel, isSubmitting, onCancel, formId, hideSubmit]);

    useLayoutEffect(() => {
        if (onRenderActionsRef.current) {
            onRenderActionsRef.current(actionButtons);
        }
    }, [submitLabel, cancelLabel, isSubmitting, hideSubmit]);

    return (
        <Stack spacing={3} className={variant === "plain" ? "crud-form-panel crud-form-panel--plain" : "crud-form-panel"}>
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
