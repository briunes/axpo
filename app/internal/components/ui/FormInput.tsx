"use client";

import { useState } from "react";
import { TextField, type TextFieldProps, Box, IconButton, InputAdornment } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

/**
 * Reusable styled input component with consistent border radius and styling.
 * When type="password", a toggle button is shown to reveal/hide the value.
 */
export function FormInput({ label, required, helperText, type, ...props }: TextFieldProps) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
        <Box sx={{ width: '100%' }}>
            {label && (
                <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'inherit',
                }}>
                    {label}
                    {required && <Box component={'span'} sx={{ color: 'error.main', marginLeft: '4px' }}>*</Box>}
                </label>
            )}
            <TextField
                {...props}
                type={isPassword ? (showPassword ? "text" : "password") : type}
                required={required}
                helperText={helperText}
                size="small"
                fullWidth
                onChange={props.onChange ? (e) => {
                    if (type === "number") {
                        e.target.value = String(parseFloat(e.target.value));
                    }
                    props.onChange!(e);
                } : undefined}
                slotProps={{
                    input: isPassword ? {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    edge="end"
                                    onClick={() => setShowPassword((v) => !v)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showPassword
                                        ? <VisibilityOffIcon fontSize="small" />
                                        : <VisibilityIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    } : undefined,
                }}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: '6px',
                        fontSize: '14px',
                    },
                    '& .MuiFormHelperText-root': {
                        marginLeft: 0,
                        marginTop: '4px',
                        fontSize: '12px',
                    },
                    '& .MuiInputBase-input': {
                        padding: '8.5px 14px',
                    },
                    ...props.sx,
                }}
            />
        </Box>
    );
}
