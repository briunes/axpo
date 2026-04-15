"use client";

import { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Button,
    Typography,
    Box,
    IconButton,
    Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

interface PinResultDialogProps {
    pin: string;
    onClose: () => void;
}

export function PinResultDialog({ pin, onClose }: PinResultDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(pin);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // fallback for environments without clipboard API
        }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pb: 1.5 }}>PIN rotated successfully</DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 3, pb: 3 }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        px: 2.5,
                        py: 1.5,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Typography
                        variant="h4"
                        component="span"
                        sx={{ fontFamily: "monospace", letterSpacing: "0.25em", fontWeight: 700 }}
                    >
                        {pin}
                    </Typography>
                    <Tooltip title={copied ? "Copied!" : "Copy PIN"} placement="top">
                        <IconButton size="small" onClick={handleCopy} color={copied ? "success" : "default"} aria-label="Copy PIN">
                            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Box>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleCopy} variant="outlined" startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}>
                    {copied ? "Copied!" : "Copy PIN"}
                </Button>
                <Button onClick={onClose} variant="contained" autoFocus>
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}
