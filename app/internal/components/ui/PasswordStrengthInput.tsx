"use client";

import { useState } from "react";
import { Box, Button, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useI18n } from "../../../../src/lib/i18n-context";

// ─── Password generator ───────────────────────────────────────────────────────
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGIT = "0123456789";
const SPECIAL = "@$!%*?&#";
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

function generateStrongPassword(length = 16): string {
    const required = [
        UPPER[Math.floor(Math.random() * UPPER.length)],
        LOWER[Math.floor(Math.random() * LOWER.length)],
        DIGIT[Math.floor(Math.random() * DIGIT.length)],
        SPECIAL[Math.floor(Math.random() * SPECIAL.length)],
    ];
    const rest = Array.from({ length: length - 4 }, () =>
        ALL[Math.floor(Math.random() * ALL.length)]
    );
    return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

// ─── Strength score 0–4 ──────────────────────────────────────────────────────
function getScore(password: string): 0 | 1 | 2 | 3 | 4 {
    if (!password) return 0;
    const passed = [
        password.length >= 8,
        password.length >= 12,
        /[a-z]/.test(password) && /[A-Z]/.test(password),
        /\d/.test(password),
        /[@$!%*?&#]/.test(password),
    ].filter(Boolean).length;
    if (passed <= 1) return 1;
    if (passed === 2) return 2;
    if (passed === 3) return 3;
    return 4;
}

const STRENGTH_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"] as const;

// ─── Component ────────────────────────────────────────────────────────────────
interface PasswordStrengthInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    /** Show the "Generate password" button (default: false) */
    showGenerator?: boolean;
}

export function PasswordStrengthInput({
    label,
    value,
    onChange,
    required,
    disabled,
    error,
    helperText,
    showGenerator = false,
}: PasswordStrengthInputProps) {
    const { t } = useI18n();
    const [showPassword, setShowPassword] = useState(false);
    const score = getScore(value);

    const strengthLabel: Record<1 | 2 | 3 | 4, string> = {
        1: t("userFormPage", "passwordStrengthWeak"),
        2: t("userFormPage", "passwordStrengthFair"),
        3: t("userFormPage", "passwordStrengthGood"),
        4: t("userFormPage", "passwordStrengthStrong"),
    };

    return (
        <Box sx={{ width: "100%" }}>
            {/* Label row */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#333" }}>
                    {label}
                    {required && (
                        <Box component="span" sx={{ color: "error.main", ml: "4px" }}>
                            *
                        </Box>
                    )}
                </label>
                {showGenerator && (
                    <Button
                        size="small"
                        variant="text"
                        disabled={disabled}
                        onClick={() => {
                            onChange(generateStrongPassword());
                            setShowPassword(true);
                        }}
                        startIcon={<AutorenewIcon sx={{ fontSize: "14px !important" }} />}
                        sx={{ fontSize: "12px", py: 0, minHeight: 0, textTransform: "none" }}
                    >
                        {t("userFormPage", "generatePassword")}
                    </Button>
                )}
            </Box>

            {/* Input */}
            <TextField
                type={showPassword ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                size="small"
                fullWidth
                required={required}
                disabled={disabled}
                error={error}
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    edge="end"
                                    tabIndex={-1}
                                    onClick={() => setShowPassword((v) => !v)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword
                                        ? <VisibilityOffIcon fontSize="small" />
                                        : <VisibilityIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
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

            {/* Strength bar — only shown when there is content */}
            {score > 0 && (
                <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {([1, 2, 3, 4] as const).map((s) => (
                            <Box
                                key={s}
                                sx={{
                                    flex: 1,
                                    height: 4,
                                    borderRadius: 1,
                                    bgcolor: s <= score ? STRENGTH_COLOR[score] : "grey.200",
                                    transition: "background-color 0.25s",
                                }}
                            />
                        ))}
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{ color: STRENGTH_COLOR[score], fontWeight: 600, display: "block", mt: 0.25 }}
                    >
                        {strengthLabel[score as 1 | 2 | 3 | 4]}
                    </Typography>
                </Box>
            )}

            {/* Helper text */}
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
