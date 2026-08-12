"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { useI18n } from "@/lib/i18n-context";

export function ReportIssueDialog({ open, onClose, onSubmit, maxUploadMb }: {
  open: boolean; onClose: () => void; maxUploadMb?: number;
  onSubmit: (description: string, files: File[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formatFileSize = (bytes: number) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  const submit = async () => {
    if (!description.trim()) return setError(t("simulationIssues", "descriptionRequired"));
    setSubmitting(true); setError(null);
    try { await onSubmit(description.trim(), files); setDescription(""); setFiles([]); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : t("simulationIssues", "submitError")); }
    finally { setSubmitting(false); }
  };
  return <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="md"
    PaperProps={{ sx: { width: "min(760px, calc(100vw - 32px))", borderRadius: 2.5, overflow: "hidden" } }}>
    <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>{t("simulationIssues", "title")}</DialogTitle>
    <DialogContent sx={{ px: 3, pb: 1.5 }}><Stack spacing={1.5} sx={{ pt: 1 }}>
      <Typography variant="body2" color="text.secondary">{t("simulationIssues", "snapshotNotice")}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField required multiline minRows={3} maxRows={5} label={t("simulationIssues", "description")} value={description} onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 10000 }} />
      <input ref={inputRef} hidden type="file" multiple onChange={(e) => { setFiles((current) => [...current, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => inputRef.current?.click()}
        sx={{ minHeight: 42, borderStyle: "dashed", bgcolor: "action.hover" }}>{t("simulationIssues", "attachFiles")}</Button>
      {maxUploadMb && <Typography variant="caption" color="text.secondary">{t("simulationIssues", "maxFileSize", { size: maxUploadMb })}</Typography>}
      {files.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, maxHeight: 150, overflowY: "auto", pr: 0.5 }}>
        {files.map((file, index) => <Stack key={`${file.name}-${file.size}-${index}`} direction="row" alignItems="center" spacing={1.25}
          sx={{ minWidth: 0, p: 1.25, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1, display: "grid", placeItems: "center", bgcolor: "action.selected", color: "primary.main", flexShrink: 0 }}>
            <InsertDriveFileOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={file.name}>{file.name}</Typography>
            <Typography variant="caption" color="text.secondary">{formatFileSize(file.size)}</Typography>
          </Box>
          <Tooltip title={t("simulationIssues", "remove")}>
            <IconButton size="small" color="error" aria-label={t("simulationIssues", "remove")} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>)}
      </Box>}
    </Stack></DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={onClose} disabled={submitting}>{t("simulationIssues", "cancel")}</Button><Button variant="contained" onClick={submit} disabled={submitting || !description.trim()}>{submitting ? t("simulationIssues", "submitting") : t("simulationIssues", "submit")}</Button></DialogActions>
  </Dialog>;
}
