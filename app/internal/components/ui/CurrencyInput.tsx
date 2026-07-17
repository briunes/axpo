"use client";

import { useState, useRef, useCallback } from "react";
import { TextField, Box, InputAdornment, type TextFieldProps } from "@mui/material";
import { useUserPreferences } from "../providers/UserPreferencesProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the decimal separator for the given numberFormat. */
function getDecimalSep(numberFormat: string): string {
    return numberFormat === "us" ? "." : ",";
}

/** Returns the thousands separator for the given numberFormat. */
function getThousandSep(numberFormat: string): string {
    return numberFormat === "us" ? "," : ".";
}

/**
 * Strips all formatting and returns a plain numeric string (e.g. "1234.56").
 * Works for both EU and US formats.
 */
function stripFormatting(text: string, numberFormat: string): string {
    const thousandSep = getThousandSep(numberFormat);
    const decimalSep = getDecimalSep(numberFormat);
    // Remove thousands separators then normalise decimal sep to "."
    return text
        .replace(new RegExp(`\\${thousandSep}`, "g"), "")
        .replace(decimalSep, ".");
}

/**
 * Formats a numeric string (e.g. "1234.56") into a display string with the
 * correct separators and the requested number of decimal places.
 */
function applyFormat(
    raw: string,
    numberFormat: string,
    decimals: number,
): string {
    const num = parseFloat(raw);
    if (isNaN(num)) return "";
    const locale = numberFormat === "us" ? "en-US" : "de-DE";
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Parses the current display text into a number.
 * Returns NaN when the text is empty or invalid.
 */
function parseValue(text: string, numberFormat: string): number {
    const plain = stripFormatting(text, numberFormat);
    return parseFloat(plain);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrencyInputProps
    extends Omit<TextFieldProps, "value" | "onChange" | "type"> {
    /** Controlled numeric value (undefined / null = empty). */
    value?: number | null;
    /** Called with the parsed number, or NaN when the field is cleared. */
    onChange?: (value: number) => void;
    /** Currency symbol shown as start adornment. Defaults to "€". */
    currencySymbol?: string;
    /** Number of decimal places. Defaults to 2. */
    decimals?: number;
    /** Optional explicit number format. Defaults to the logged user's preference. */
    numberFormat?: string;
    label?: string;
    required?: boolean;
    helperText?: string;
    error?: boolean;
    disabled?: boolean;
    placeholder?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CurrencyInput({
    value,
    onChange,
    currencySymbol = "€",
    decimals = 2,
    numberFormat: numberFormatOverride,
    label,
    required,
    helperText,
    error,
    disabled,
    placeholder,
    ...rest
}: CurrencyInputProps) {
    const { preferences } = useUserPreferences();
    const numberFormat = numberFormatOverride ?? preferences.numberFormat;

    const decimalSep = getDecimalSep(numberFormat);

    // While focused we show the raw typed text; on blur we apply full formatting.
    const [isEditing, setIsEditing] = useState(false);
    const [rawText, setRawText] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Formatted display value shown when not editing
    const formattedValue =
        value != null && !isNaN(value)
            ? applyFormat(String(value), numberFormat, decimals)
            : "";

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleFocus = () => {
        // Seed the raw text from the current numeric value, using the correct decimal sep
        if (value != null && !isNaN(value)) {
            // Use locale-aware decimal sep for the raw editing string
            const raw = value.toFixed(decimals).replace(".", decimalSep);
            setRawText(raw);
        } else {
            setRawText("");
        }
        setIsEditing(true);
    };

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const input = e.target.value;
            // Auto-correct the "wrong" decimal separator to match the configured one.
            // e.g. configured EU format (",") + user types "1234.56" → becomes "1234,56"
            //      configured US format (".") + user types "1234,56" → becomes "1234.56"
            const oppositeSep = decimalSep === "," ? "." : ",";
            const corrected = input.replace(
                new RegExp(`\\${oppositeSep}`, "g"),
                decimalSep,
            );
            // Allow digits, the decimal separator, and an optional leading minus
            const allowedChars = new RegExp(
                `[^0-9\\-\\${decimalSep}]`,
                "g",
            );
            // Keep only valid chars; allow at most one decimal separator
            const cleaned = corrected.replace(allowedChars, "");
            const parts = cleaned.split(decimalSep);
            const normalised =
                parts.length > 2
                    ? parts[0] + decimalSep + parts.slice(1).join("")
                    : cleaned;
            setRawText(normalised);
        },
        [decimalSep],
    );

    const handleBlur = () => {
        setIsEditing(false);
        if (!rawText.trim()) {
            onChange?.(NaN);
            return;
        }
        const plain = stripFormatting(rawText, numberFormat);
        const parsed = parseFloat(plain);
        if (!isNaN(parsed)) {
            onChange?.(parsed);
        } else {
            onChange?.(NaN);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            inputRef.current?.blur();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const displayValue = isEditing ? rawText : formattedValue;
    const resolvedPlaceholder =
        placeholder ?? applyFormat("0", numberFormat, decimals);

    return (
        <Box sx={{ width: "100%" }}>
            {label && (
                <label
                    style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "inherit",
                    }}
                >
                    {label}
                    {required && (
                        <Box
                            component="span"
                            sx={{ color: "error.main", marginLeft: "4px" }}
                        >
                            *
                        </Box>
                    )}
                </label>
            )}
            <TextField
                {...rest}
                inputRef={inputRef}
                value={displayValue}
                placeholder={resolvedPlaceholder}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                required={required}
                error={error}
                helperText={helperText}
                size="small"
                fullWidth
                inputMode="decimal"
                slotProps={{
                    input: {
                        startAdornment: currencySymbol ? (
                            <InputAdornment position="start">
                                <Box
                                    component="span"
                                    sx={{
                                        fontSize: "14px",
                                        color: "text.secondary",
                                        userSelect: "none",
                                    }}
                                >
                                    {currencySymbol}
                                </Box>
                            </InputAdornment>
                        ) : undefined,
                    },
                }}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "6px",
                        fontSize: "14px",
                    },
                    "& .MuiFormHelperText-root": {
                        marginLeft: 0,
                        marginTop: "4px",
                        fontSize: "12px",
                    },
                    "& .MuiInputBase-input": {
                        padding: "8.5px 14px",
                        textAlign: "right",
                    },
                    ...rest.sx,
                }}
            />
        </Box>
    );
}
