"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Button,
  Typography,
} from "@mui/material";

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  countdownSeconds?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  countdownSeconds,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const hasCountdown = typeof countdownSeconds === "number" && countdownSeconds > 0;
  const [secondsRemaining, setSecondsRemaining] = useState(countdownSeconds ?? 0);
  const confirmDisabled = busy || (hasCountdown && secondsRemaining > 0);

  useEffect(() => {
    if (!hasCountdown) return;

    setSecondsRemaining(countdownSeconds);
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [countdownSeconds, hasCountdown]);

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1.5 }}>{title}</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, pb: 2.5 }}>
        <Typography>{message}</Typography>
        {hasCountdown && (
          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600 }}>
            {secondsRemaining > 0
              ? `Permanent delete available in ${secondsRemaining} second${secondsRemaining === 1 ? "" : "s"}.`
              : "Permanent delete is now available."}
          </Typography>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={busy} variant="outlined">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} disabled={confirmDisabled} variant="contained" autoFocus>
          {hasCountdown && secondsRemaining > 0
            ? `${confirmLabel} (${secondsRemaining})`
            : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
