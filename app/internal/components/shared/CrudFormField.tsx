"use client";

export interface CrudFormFieldProps {
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}

/**
 * Reusable form field with label, hint text, and error display
 */
export function CrudFormField({
    label,
    hint,
    error,
    required,
    children,
}: CrudFormFieldProps) {
    return (
        <div className="crud-form-field">
            <label className="crud-form-label">
                {label}
                {required && <span className="crud-form-required">*</span>}
            </label>
            {children}
            {hint && !error && <span className="crud-form-hint">{hint}</span>}
            {error && <span className="crud-form-error">{error}</span>}
        </div>
    );
}
