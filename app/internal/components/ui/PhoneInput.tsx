"use client";

import { Box } from "@mui/material";
import {
    PhoneInput as BasePhoneInput,
    defaultCountries,
    parseCountry,
} from "react-international-phone";
import "react-international-phone/style.css";

interface PhoneInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    /** Default country ISO2 code, e.g. "pt". Defaults to "es". */
    defaultCountry?: string;
}

/**
 * International phone input: flag selector + dial code + number in one field,
 * styled to match the rest of the form inputs.
 */
export function PhoneInput({
    label,
    value,
    onChange,
    required,
    disabled,
    error,
    helperText,
    defaultCountry = "es",
}: PhoneInputProps) {
    // Only show countries that have a phone code (filter none out)
    const countries = defaultCountries.filter((c) => {
        const parsed = parseCountry(c);
        return !!parsed.dialCode;
    });

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

            <BasePhoneInput
                defaultCountry={defaultCountry}
                value={value}
                onChange={onChange}
                disabled={disabled}
                countries={countries}
                style={
                    {
                        "--react-international-phone-height": "40px",
                        "--react-international-phone-border-radius": "6px",
                        "--react-international-phone-border-color": error
                            ? "#d32f2f"
                            : "rgba(0, 0, 0, 0.23)",
                        "--react-international-phone-background-color": disabled
                            ? "rgba(0,0,0,0.04)"
                            : "#fff",
                        "--react-international-phone-text-color": "#333",
                        "--react-international-phone-selected-dropdown-item-background-color": "#f5f5f5",
                        "--react-international-phone-font-size": "14px",
                        width: "100%",
                    } as React.CSSProperties
                }
                inputStyle={{
                    width: "100%",
                    fontSize: "14px",
                    borderColor: error ? "#d32f2f" : "rgba(0, 0, 0, 0.23)",
                    borderRadius: "0 6px 6px 0",
                    outline: "none",
                    transition: "border-color 0.2s",
                }}
                countrySelectorStyleProps={{
                    buttonStyle: {
                        borderRadius: "6px 0 0 6px",
                        borderColor: error ? "#d32f2f" : "rgba(0, 0, 0, 0.23)",
                        backgroundColor: "transparent",
                        padding: "0 8px",
                    },
                }}
            />

            {helperText && (
                <Box
                    component="p"
                    sx={{
                        margin: "4px 14px 0",
                        fontSize: "12px",
                        color: error ? "error.main" : "text.secondary",
                        lineHeight: 1.4,
                    }}
                >
                    {helperText}
                </Box>
            )}
        </Box>
    );
}
