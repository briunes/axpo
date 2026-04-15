"use client";

import { Autocomplete, Box, TextField } from "@mui/material";

export interface AutocompleteOption {
    value: string;
    label: string;
}

interface FormAutocompleteProps {
    label: string;
    options: AutocompleteOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    /** Prevent clearing the selection (default: false) */
    disableClearable?: boolean;
}

/**
 * Reusable searchable autocomplete select styled to match FormInput / FormSelect.
 * Accepts a flat {value, label}[] options list.
 */
export function FormAutocomplete({
    label,
    options,
    value,
    onChange,
    placeholder,
    required,
    disabled,
    error,
    helperText,
    disableClearable = false,
}: FormAutocompleteProps) {
    const selectedOption = options.find((o) => o.value === value) ?? null;

    return (
        <Box sx={{ width: "100%" }}>
            <label
                style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                }}
            >
                {label}
                {required && (
                    <Box component="span" sx={{ color: "error.main", marginLeft: "4px" }}>
                        *
                    </Box>
                )}
            </label>
            <Autocomplete
                options={options}
                getOptionLabel={(opt) => opt.label}
                value={selectedOption}
                disabled={disabled}
                disableClearable={disableClearable}
                onChange={(_e, newValue) => onChange(newValue?.value ?? "")}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder={placeholder}
                        error={error}
                        helperText={helperText}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "6px",
                                "& fieldset": {
                                    borderWidth: "1px",
                                    borderColor: error ? "error.main" : "rgba(0, 0, 0, 0.23)",
                                },
                                "&:hover fieldset": {
                                    borderColor: error ? "error.main" : "rgba(0, 0, 0, 0.4)",
                                },
                                "&.Mui-focused fieldset": {
                                    borderWidth: "1px",
                                    borderColor: error ? "error.main" : "primary.main",
                                },
                            },
                        }}
                    />
                )}
            />
        </Box>
    );
}
