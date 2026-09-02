"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import ImageIcon from "@mui/icons-material/Image";
import CodeIcon from "@mui/icons-material/Code";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Avatar, Box, Chip, CircularProgress, Divider, Link, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n-context";
import { downloadSimulationIssueFile, getSimulationIssue, updateSimulationIssueStatus, type SimulationIssueItem } from "../../../lib/internalApi";
import { loadSession } from "../../../lib/authSession";
import { CrudFormContainer, CrudFormField, CrudPageLayout, useAlerts } from "../../../components/shared";
import { FormInput, FormSelect } from "../../../components/ui";
import { useActionButtons, useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

const STATUSES: SimulationIssueItem["status"][] = ["NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"];

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function getFilePresentation(fileName: string, mimeType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || extension === "pdf") return { label: "PDF", color: "#dc2626", Icon: PictureAsPdfIcon };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || ["xls", "xlsx", "xlsm", "csv"].includes(extension)) return { label: "Excel", color: "#059669", Icon: TableChartIcon };
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return { label: "Image", color: "#7c3aed", Icon: ImageIcon };
  if (mimeType.includes("html") || ["html", "htm", "json", "xml"].includes(extension)) return { label: extension.toUpperCase() || "Code", color: "#2563eb", Icon: CodeIcon };
  return { label: extension.toUpperCase() || "File", color: "#64748b", Icon: InsertDriveFileIcon };
}

export default function SimulationIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showSuccess, showError } = useAlerts();
  const onActionButtons = useActionButtons();
  const [session] = useState(loadSession());
  const [activeTab, setActiveTab] = useState(0);
  const [draftStatus, setDraftStatus] = useState<SimulationIssueItem["status"] | null>(null);
  const [notes, setNotes] = useState("");
  const [formActions, setFormActions] = useState<React.ReactNode>(null);
  const labels = useMemo(() => ({
    NEW: t("simulationIssues", "statusNew"), IN_REVIEW: t("simulationIssues", "statusInReview"),
    RESOLVED: t("simulationIssues", "statusResolved"), DISMISSED: t("simulationIssues", "statusDismissed"),
  }), [t]);
  const query = useQuery({
    queryKey: ["simulation-issue", session?.token, id],
    queryFn: () => getSimulationIssue(session!.token, id),
    enabled: Boolean(session && id),
  });
  const issue = query.data;
  const breadcrumbs = useMemo(() => issue ? [{ label: issue.simulationReference || t("simulationIssues", "issueDetails"), href: `/internal/simulations/issues/${issue.id}` }] : null, [issue, t]);
  useTopBarBreadcrumbs(breadcrumbs);

  const selectedStatus = draftStatus ?? issue?.status ?? "NEW";
  const isChangingToResolved = selectedStatus === "RESOLVED" && issue?.status !== "RESOLVED";
  const terminalNeedsNotes = isChangingToResolved && !notes.trim();
  const hasChanges = Boolean(issue && (selectedStatus !== issue.status || notes.trim()));
  const mutation = useMutation({
    mutationFn: () => updateSimulationIssueStatus(session!.token, id, selectedStatus, notes),
    onSuccess: (updated) => {
      queryClient.setQueryData(["simulation-issue", session?.token, id], updated);
      void queryClient.invalidateQueries({ queryKey: ["simulation-issues"] });
      setDraftStatus(null); setNotes(""); showSuccess(t("simulationIssues", "updateSuccess"));
    },
    onError: (error) => showError(error instanceof Error ? error.message : t("common", "actionFailed")),
  });

  useEffect(() => {
    if (!issue) { onActionButtons?.(null); return; }
    onActionButtons?.(<>{formActions}</>);
    return () => onActionButtons?.(null);
  }, [formActions, issue, labels, onActionButtons]);

  if (!session) return null;
  if (query.isLoading) return <CrudPageLayout title={t("simulationIssues", "issueDetails")} hideHeader><Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box></CrudPageLayout>;
  if (!issue) return <CrudPageLayout title={t("simulationIssues", "issueDetails")} hideHeader><Typography color="error">{query.error instanceof Error ? query.error.message : t("simulationIssues", "loadError")}</Typography></CrudPageLayout>;

  const statusColor = issue.status === "NEW" ? "error" : issue.status === "IN_REVIEW" ? "warning" : issue.status === "RESOLVED" ? "success" : "default";
  const issueFiles = [
    { id: "snapshot", fileName: issue.snapshotFileName, mimeType: issue.snapshotMimeType, fileSize: issue.snapshotFileSize },
    ...issue.attachments,
  ];
  const savedStatusNotes = issue.statusChanges?.filter((change) => Boolean(change.notes)) ?? [];
  const visibleStatusNotes = savedStatusNotes.slice(0, 5);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!terminalNeedsNotes && hasChanges) mutation.mutate();
  };

  return <CrudPageLayout title={t("simulationIssues", "issueDetails")} backHref="/internal/simulations/issues" maxWidth={undefined} hideHeader>
    <Box className="crud-tab-panel" data-tour="simulation-issue-detail-page" sx={{ position: "relative", p: { xs: 2, md: 2 } }}>
      <Chip size="small" label={labels[issue.status]} color={statusColor} sx={{ position: "absolute", top: 18, right: 20, zIndex: 1, fontWeight: 600 }} />
      <Box className="crud-tab-panel__tabs" sx={{ pr: 10, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label={t("simulationIssues", "issueDetails")} />
          <Tab label={`${t("simulationIssues", "files")} (${issue.attachments.length + 1})`} />
          <Tab label={t("simulationIssues", "history")} />
        </Tabs>
      </Box>

      <Box sx={{ display: activeTab === 0 ? "block" : "none" }}>
        <CrudFormContainer variant="plain" onSubmit={handleSubmit} submitLabel={t("simulationIssues", "saveChanges")} cancelLabel={t("actions", "cancel")} onCancel={() => router.push("/internal/simulations/issues")} isSubmitting={mutation.isPending} disableSubmit={terminalNeedsNotes || !hasChanges} onRenderActions={setFormActions}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, alignItems: "start" }}>
            <CrudFormField label={t("simulationDetail", "title")}>
              {issue.simulationId ? <Link component={NextLink} href={`/internal/simulations/${issue.simulationId}`} target="_blank" rel="noopener noreferrer" color="primary.main" sx={{ display: "inline-flex", alignItems: "center", gap: .5 }}>{issue.simulationReference || issue.simulationId}<OpenInNewIcon sx={{ fontSize: 14 }} /></Link> : <Typography>{t("simulationIssues", "deletedSimulation")}</Typography>}
            </CrudFormField>
            <CrudFormField label={t("logs", "user")}><Link component={NextLink} href={`/internal/users/${issue.reportedByUser.id}/edit`} target="_blank" rel="noopener noreferrer" color="primary.main" sx={{ display: "inline-flex", alignItems: "center", gap: .5 }}>{issue.reportedByUser.fullName}<OpenInNewIcon sx={{ fontSize: 14 }} /></Link><Typography variant="body2" color="text.secondary">{issue.reportedByUser.email}</Typography></CrudFormField>
            <CrudFormField label={t("logs", "timestamp")}><Typography>{new Date(issue.createdAt).toLocaleString()}</Typography></CrudFormField>
            <FormSelect label={t("simulationIssues", "changeStatus")} options={STATUSES.map((status) => ({ value: status, label: labels[status] }))} value={selectedStatus} onChange={(value) => setDraftStatus(value as SimulationIssueItem["status"])} disabled={mutation.isPending} />
          </Box>
          <CrudFormField label={t("simulationIssues", "description")}>
            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{issue.description}</Typography>
          </CrudFormField>
          {issue.resolutionNotes && <CrudFormField label={t("simulationIssues", "savedResolution")}><Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "action.hover" }}><Typography sx={{ whiteSpace: "pre-wrap" }}>{issue.resolutionNotes}</Typography></Box></CrudFormField>}
          <Box sx={{ display: "grid", gridTemplateColumns: savedStatusNotes.length ? { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" } : "1fr", gap: 2, alignItems: "start" }}>
            <FormInput label={isChangingToResolved ? t("simulationIssues", "resolutionNotesRequired") : t("simulationIssues", "statusNotes")} value={notes} onChange={(event) => setNotes(event.target.value)} multiline required={isChangingToResolved} error={terminalNeedsNotes} helperText={terminalNeedsNotes ? t("simulationIssues", "resolutionNotesHelp") : undefined} disabled={mutation.isPending} sx={{ "& .MuiInputBase-root.MuiInputBase-multiline": { height: 360, alignItems: "flex-start" }, "& textarea": { height: "100% !important", maxHeight: "100% !important", overflowY: "auto !important", resize: "none" } }} />
            {savedStatusNotes.length > 0 && <Box sx={{ width: "100%" }}>
              <Typography component="div" sx={{ mb: 1, fontSize: 14, fontWeight: 500, lineHeight: "normal" }}>{t("simulationIssues", "savedStatusNotes")}</Typography>
              <Stack spacing={1.25} sx={{ height: 360, overflowY: "auto", p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.default", scrollbarGutter: "stable" }}>
                {visibleStatusNotes.map((change) => <Box key={change.id} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper", boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)" }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Avatar sx={{ width: 30, height: 30, flex: "0 0 auto", bgcolor: "primary.main", fontSize: 12, fontWeight: 700 }}>{change.changedByUser.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" gap={.5}>
                        <Link component={NextLink} href={`/internal/users/${change.changedByUser.id}/edit`} target="_blank" rel="noopener noreferrer" color="primary.main" variant="body2" fontWeight={600} sx={{ display: "inline-flex", alignItems: "center", gap: .4 }}>{change.changedByUser.fullName}<OpenInNewIcon sx={{ fontSize: 13 }} /></Link>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{new Date(change.createdAt).toLocaleString()}</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: .75, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}>{change.notes}</Typography>
                    </Box>
                  </Stack>
                </Box>)}
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ py: .5, px: .25 }}>
                  <Stack direction="row" alignItems="center" spacing={.75} sx={{ color: "text.disabled" }}>
                    <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption">{savedStatusNotes.length} {t("simulationIssues", savedStatusNotes.length === 1 ? "noteCountSingle" : "noteCountPlural")}</Typography>
                  </Stack>
                  {savedStatusNotes.length > 5 && <Link component="button" type="button" onClick={() => setActiveTab(2)} underline="hover" color="primary.main" variant="body2" sx={{ fontWeight: 600 }}>{t("simulationIssues", "seeAllNotes")}</Link>}
                </Stack>
              </Stack>
            </Box>}
          </Box>
        </CrudFormContainer>
      </Box>

      <Box sx={{ display: activeTab === 1 ? "block" : "none" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1.5 }}>
          {issueFiles.map((file) => {
            const presentation = getFilePresentation(file.fileName, file.mimeType);
            const FileIcon = presentation.Icon;
            return <Box
              component="button"
              type="button"
              key={file.id}
              onClick={() => downloadSimulationIssueFile(session.token, issue.id, file.id, file.fileName)}
              sx={{
                appearance: "none", width: "100%", minWidth: 0, p: 1.5, display: "flex", alignItems: "center", gap: 1.5,
                textAlign: "left", color: "text.primary", bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
                borderRadius: 2, cursor: "pointer", transition: "border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
                "&:hover": { borderColor: "primary.main", boxShadow: 2, transform: "translateY(-1px)" },
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
              }}
            >
              <Box sx={{ width: 42, height: 42, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 1.5, color: presentation.color, bgcolor: `${presentation.color}14` }}>
                <FileIcon fontSize="medium" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap title={file.fileName}>{file.fileName}</Typography>
                <Stack direction="row" alignItems="center" spacing={.75} mt={.25}>
                  <Typography variant="caption" color="text.secondary">{presentation.label}</Typography>
                  <Box component="span" sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "text.disabled" }} />
                  <Typography variant="caption" color="text.secondary">{formatFileSize(file.fileSize)}</Typography>
                </Stack>
              </Box>
              <DownloadIcon fontSize="small" sx={{ flex: "0 0 auto", color: "primary.main" }} />
            </Box>;
          })}
        </Box>
      </Box>

      <Box sx={{ display: activeTab === 2 ? "block" : "none" }}>
        {!issue.statusChanges?.length ? <Typography color="text.secondary">{t("simulationIssues", "noHistory")}</Typography> : <Stack divider={<Divider flexItem />} spacing={1.5}>{issue.statusChanges.map((change) => <Box key={change.id}><Typography variant="body2">{change.fromStatus === change.toStatus ? <>{t("simulationIssues", "noteAdded")} · <strong>{labels[change.toStatus]}</strong></> : <><strong>{labels[change.fromStatus]}</strong> → <strong>{labels[change.toStatus]}</strong></>}</Typography><Typography variant="caption" color="text.secondary">{change.changedByUser.fullName} · {new Date(change.createdAt).toLocaleString()}</Typography>{change.notes && <Typography sx={{ mt: .5, whiteSpace: "pre-wrap" }}>{change.notes}</Typography>}</Box>)}</Stack>}
      </Box>
    </Box>
  </CrudPageLayout>;
}
