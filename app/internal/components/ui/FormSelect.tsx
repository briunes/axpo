"use client";

import { FormControl, FormHelperText, Select as MuiSelect, type SelectProps, type FormControlProps, Box } from "@mui/material";
import { ReactNode } from "react";

export interface FormSelectProps extends Omit<SelectProps, 'label'> {
    label: string;
    labelId?: string;
    required?: boolean;
    fullWidth?: boolean;
    helperText?: string;
    formControlProps?: Omit<FormControlProps, 'children'>;
}

/**
 * Reusable styled select component with consistent border radius and styling
 */
export function FormSelect({
    label,
    labelId,
    required,
    fullWidth = true,
    helperText,
    formControlProps,
    children,
    ...selectProps
}: FormSelectProps) {
    const generatedLabelId = labelId || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <Box sx={{ width: '100%' }}>
            <label
                htmlFor={generatedLabelId}
                style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#333',
                }}
            >
                {label}
                {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
            </label>
            <FormControl
                fullWidth={fullWidth}
                size="small"
                required={required}
                error={selectProps.error}
                {...formControlProps}
            >
                <MuiSelect
                    id={generatedLabelId}
                    {...selectProps}
                    sx={{
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: selectProps.error ? 'error.main' : 'rgba(0, 0, 0, 0.23)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: selectProps.error ? 'error.main' : 'rgba(0, 0, 0, 0.4)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: selectProps.error ? 'error.main' : 'primary.main',
                        },
                        ...selectProps.sx,
                    }}
                >
                    {children}
                </MuiSelect>
                {helperText && (
                    <FormHelperText>{helperText}</FormHelperText>
                )}
            </FormControl>
        </Box>
    );
}
