"use client";

import { Autocomplete, TextField, Box, type AutocompleteProps, type TextFieldProps } from "@mui/material";
import { SyntheticEvent, ReactNode } from "react";

export interface FormSelectOption {
    value: string | number;
    label: string;
    secondaryLabel?: string;
    icon?: ReactNode;
}

export interface FormSelectProps extends Omit<AutocompleteProps<FormSelectOption, false, false, false>, 'options' | 'renderInput' | 'onChange' | 'value'> {
    label: string;
    labelId?: string;
    required?: boolean;
    fullWidth?: boolean;
    helperText?: string;
    options: FormSelectOption[];
    value?: string | number;
    onChange?: (value: string | number | null) => void;
    error?: boolean;
    placeholder?: string;
    textFieldProps?: Partial<TextFieldProps>;
}

/**
 * Reusable autocomplete component with filtering and limited visible options
 */
export function FormSelect({
    label,
    labelId,
    required,
    fullWidth = true,
    helperText,
    options,
    value,
    onChange,
    error,
    placeholder,
    textFieldProps,
    disabled,
    ...autocompleteProps
}: FormSelectProps) {
    const generatedLabelId = labelId || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const selectedOption = options.find(opt => opt.value === value) || null;

    const handleChange = (_event: SyntheticEvent, newValue: FormSelectOption | null) => {
        if (onChange) {
            onChange(newValue?.value ?? null);
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            {label && (
                <label
                    htmlFor={generatedLabelId}
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: disabled ? '#999' : '#333',
                    }}
                >
                    {label}
                    {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                </label>
            )}
            <Autocomplete
                id={generatedLabelId}
                options={options}
                value={selectedOption}
                onChange={handleChange}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                filterOptions={(options, state) => {
                    const inputValue = state.inputValue.toLowerCase();
                    return options.filter((option) => {
                        const labelMatch = option.label.toLowerCase().includes(inputValue);
                        const secondaryMatch = option.secondaryLabel?.toLowerCase().includes(inputValue);
                        return labelMatch || secondaryMatch;
                    });
                }}
                fullWidth={fullWidth}
                disabled={disabled}
                ListboxProps={{
                    style: {
                        maxHeight: '240px', // Show ~6 options at a time
                    }
                }}
                renderOption={(props, option) => (
                    <li {...props} key={option.value}>
                        {option.icon ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {option.icon}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>{option.label}</span>
                                    {option.secondaryLabel && (
                                        <span style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                                            {option.secondaryLabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{option.label}</span>
                                {option.secondaryLabel && (
                                    <span style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                                        {option.secondaryLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </li>
                )}
                {...autocompleteProps}
                renderInput={(params) => {
                    const { InputProps, ...restParams } = params;
                    return (
                        <TextField
                            {...restParams}
                            placeholder={placeholder}
                            size="small"
                            required={required}
                            error={error}
                            helperText={helperText}
                            {...textFieldProps}
                            InputProps={{
                                ...InputProps,
                                startAdornment: selectedOption?.icon ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                                        {selectedOption.icon}
                                    </Box>
                                ) : null,
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#fafafa',
                                    borderRadius: '6px',
                                    '& fieldset': {
                                        borderWidth: '1px',
                                        borderColor: error ? 'error.main' : 'rgba(0, 0, 0, 0.23)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: error ? 'error.main' : 'rgba(0, 0, 0, 0.4)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderWidth: '1px',
                                        borderColor: error ? 'error.main' : 'primary.main',
                                    },
                                },
                                ...textFieldProps?.sx,
                            }}
                        />
                    );
                }}
            />
        </Box>
    );
}
