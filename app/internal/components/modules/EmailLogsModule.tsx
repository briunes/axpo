"use client";

import {
    Box,
    Button,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    TextField,
    Chip,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { FormSelect } from "../ui/FormSelect";
import { DateRangePicker } from "../ui/DateRangePicker";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";

interface EmailLog {
    id: string;
    sentAt: string;
    recipientEmail: string;
    templateId?: string;
    templateName?: string;
    subject: string;
    htmlBody: string;
    triggeredBy?: string;
    triggeredByUserId?: string;
    triggeredByUser?: {
        id: string;
        email: string;
        fullName: string;
    };
    variables?: Record<string, string>;
    status: string;
    errorMessage?: string;
    errorStack?: string;
    relatedUserId?: string;
    relatedSimulationId?: string;
    // SMTP delivery details
    smtpHost?: string;
    smtpPort?: number;
    fromEmail?: string;
    fromName?: string;
    messageId?: string;
    smtpResponse?: string;
    durationMs?: number;
    hasAttachments?: boolean;
    attachmentsCount?: number;
}

interface EmailLogsModuleProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

function TriggerBadge({ trigger }: { trigger?: string }) {
    if (!trigger) return <Typography component="span" variant="body2" sx={{ color: "#94a3b8" }}>—</Typography>;

    const toneMap: Record<string, "brand" | "accent" | "success" | "neutral"> = {
        "user-creation": "brand",
        "simulation-share": "accent",
        "test-email": "success",
    };

    return <StatusBadge label={trigger} tone={toneMap[trigger] || "neutral"} />;
}

export function EmailLogsModule({ session, onNotify }: EmailLogsModuleProps) {
    const cachePolicy = useRequestCachePolicy("logs");
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

    // Applied filters (sent to the API)
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [triggerFilter, setTriggerFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Local (pending) filter state
    const [localStatus, setLocalStatus] = useState<string>("all");
    const [localTrigger, setLocalTrigger] = useState<string>("all");
    const [localSearch, setLocalSearch] = useState("");
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(null);
    const [localDateTo, setLocalDateTo] = useState<Date | null>(null);

    const formatDate = useCallback((dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const formatted = formatDisplayDate(date, preferences.dateFormat);
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            const ss = String(date.getSeconds()).padStart(2, "0");
            return `${formatted} ${hh}:${mm}:${ss}`;
        } catch { return dateStr; }
    }, [preferences.dateFormat]);

    const toDateOnly = (d: Date | null) => {
        if (!d) return "";
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const handleSearch = () => {
        setStatusFilter(localStatus);
        setTriggerFilter(localTrigger);
        setSearchTerm(localSearch);
        setDateFrom(toDateOnly(localDateFrom));
        setDateTo(toDateOnly(localDateTo));
        setPage(1);
    };

    const resetFilters = () => {
        setLocalStatus("all"); setLocalTrigger("all"); setLocalSearch(""); setLocalDateFrom(null); setLocalDateTo(null);
        setStatusFilter("all"); setTriggerFilter("all"); setSearchTerm(""); setDateFrom(""); setDateTo("");
        setPage(1);
    };

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Sorting
    const [sortColumn, setSortColumn] = useState("sentAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const { data, isFetching, error } = useQuery({
        queryKey: [
            "email-logs",
            session.token,
            page,
            pageSize,
            sortColumn,
            sortDir,
            statusFilter,
            triggerFilter,
            searchTerm,
            dateFrom,
            dateTo,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });

            if (statusFilter !== "all") params.append("status", statusFilter);
            if (triggerFilter !== "all") params.append("triggeredBy", triggerFilter);
            if (searchTerm) params.append("search", searchTerm);
            if (dateFrom) params.append("dateFrom", dateFrom);
            if (dateTo) params.append("dateTo", dateTo);

            const response = await fetch(`/api/v1/internal/email-logs?${params}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch email logs");

            const result = await response.json();
            const data = result.data || result; // Handle both wrapped and unwrapped responses
            return {
                logs: (data.logs || []) as EmailLog[],
                total: data.pagination?.total || 0,
            };
        },
        placeholderData: keepPreviousData,
        ...cachePolicy,
    });

    const {
        data: selectedLog,
        error: selectedLogError,
    } = useQuery({
        queryKey: ["email-log", session.token, selectedLogId],
        queryFn: async () => {
            const response = await fetch(`/api/v1/internal/email-logs/${selectedLogId}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch email log details");

            const result = await response.json();
            return (result.data || result) as EmailLog;
        },
        enabled: !!selectedLogId,
        ...cachePolicy,
    });

    useEffect(() => {
        if (error) {
            onNotify?.(t("logs", "loadEmailLogsFailed"), "error");
        }
    }, [error, onNotify]);

    useEffect(() => {
        if (selectedLogError) {
            onNotify?.(t("logs", "loadEmailDetailsFailed"), "error");
        }
    }, [selectedLogError, onNotify]);

    const logs = data?.logs ?? [];
    const total = data?.total ?? 0;
    const loading = isFetching;

    const viewDetails = async (logId: string) => {
        setSelectedLogId(logId);
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDir("desc");
        }
    };

    const columns: ColumnDef<EmailLog>[] = [
        {
            key: "sentAt",
            label: t("logs", "date"),
            sortable: true,
            width: "180",
            renderCell: (log) => (
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                    {formatDate(log.sentAt)}
                </Typography>
            ),
        },
        {
            key: "recipientEmail",
            label: t("logs", "recipient"),
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {log.recipientEmail}
                </Typography>
            ),
        },
        {
            key: "subject",
            label: t("logs", "subject"),
            renderCell: (log) => (
                <Typography variant="body2">
                    {log.subject}
                </Typography>
            ),
        },
        {
            key: "triggeredBy",
            label: t("logs", "triggeredBy"),
            renderCell: (log) => <TriggerBadge trigger={log.triggeredBy} />,
        },
        {
            key: "status",
            label: t("logs", "status"),
            renderCell: (log) => (
                <StatusBadge
                    label={log.status}
                    tone={log.status === "sent" ? "success" : "danger"}
                />
            ),
        },
    ];



    return (
        <>
            <DataTable
                columns={columns}
                rows={logs}
                loading={loading}
                sortState={{ column: sortColumn, direction: sortDir }}
                onSort={handleSort}
                onApplyFilters={handleSearch}
                onClearFilters={resetFilters}
                renderCustomSearch={() => (
                    <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                        <Box sx={{ flex: 1, }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "all", label: t("logs", "allStatuses") },
                                    { value: "sent", label: t("logs", "sent") },
                                    { value: "failed", label: t("logs", "failed") },
                                ]}
                                value={localStatus}
                                onChange={(v) => setLocalStatus(String(v ?? "all"))}
                                placeholder={t("logs", "status")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ flex: 1, }}>
                            <FormSelect
                                label=""
                                options={[
                                    { value: "all", label: t("logs", "allTriggers") },
                                    { value: "user-creation", label: t("auditEvents", "created") },
                                    { value: "simulation-share", label: t("auditEvents", "shared") },
                                    { value: "test-email", label: t("logs", "promptTest") },
                                ]}
                                value={localTrigger}
                                onChange={(v) => setLocalTrigger(String(v ?? "all"))}
                                placeholder={t("logs", "triggeredBy")}
                                textFieldProps={{ size: "small" }}
                            />
                        </Box>
                        <Box sx={{ flex: 1, }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder={t("logs", "searchEmail")}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                sx={{ "& .MuiInputBase-root": { } }}
                            />
                        </Box>
                        <Box sx={{ flex: 2, }}>
                            <DateRangePicker
                                variant="inline"
                                label={t("logs", "date")}
                                startDate={localDateFrom}
                                endDate={localDateTo}
                                onChange={(s, e) => { setLocalDateFrom(s); setLocalDateTo(e); }}
                            />
                        </Box>
                    </Box>
                )}
                pagination={{
                    page,
                    pageSize,
                    total,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    },
                }}
                t={t}
                rowActions={(log) => (
                    <Button
                        startIcon={<VisibilityIcon />}
                        onClick={() => viewDetails(log.id)}
                        variant="outlined"
                        size="small"
                    >
                        {t("logs", "view")}
                    </Button>
                )}
                emptyMessage={t("logs", "noEmailLogs")}
            />

            {/* Detail Dialog */}
            <Dialog
                open={!!selectedLog}
                onClose={() => setSelectedLogId(null)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>{t("logs", "details")}</DialogTitle>
                <DialogContent dividers>
                    {selectedLog && (
                        <Stack spacing={3}>
                            <Box sx={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t("logs", "sentAt")}
                                </Typography>
                                <Typography variant="body2">{formatDate(selectedLog.sentAt)}</Typography>

                                <Typography variant="body2" color="text.secondary">
                                    {t("logs", "status")}
                                </Typography>
                                <Box>
                                    <StatusBadge
                                        label={selectedLog.status}
                                        tone={selectedLog.status === "sent" ? "success" : "danger"}
                                    />
                                </Box>

                                <Typography variant="body2" color="text.secondary">
                                    {t("logs", "recipient")}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                    {selectedLog.recipientEmail}
                                </Typography>

                                <Typography variant="body2" color="text.secondary">
                                    {t("logs", "triggeredBy")}
                                </Typography>
                                <Box>
                                    {selectedLog.triggeredByUser ? (
                                        <Typography variant="body2">
                                            {selectedLog.triggeredByUser.fullName} ({selectedLog.triggeredByUser.email})
                                        </Typography>
                                    ) : (
                                        <TriggerBadge trigger={selectedLog.triggeredBy} />
                                    )}
                                </Box>

                                {selectedLog.templateName && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "template")}
                                        </Typography>
                                        <Typography variant="body2">{selectedLog.templateName}</Typography>
                                    </>
                                )}

                                <Typography variant="body2" color="text.secondary">
                                    {t("logs", "subject")}
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedLog.subject}
                                </Typography>

                                {/* SMTP delivery info */}
                                {selectedLog.fromEmail && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "from")}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                            {selectedLog.fromName ? `"${selectedLog.fromName}" <${selectedLog.fromEmail}>` : selectedLog.fromEmail}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.smtpHost && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "smtpServer")}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                            {selectedLog.smtpHost}:{selectedLog.smtpPort ?? "—"}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.messageId && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "messageId")}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                                            {selectedLog.messageId}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.smtpResponse && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "smtpResponse")}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                                            {selectedLog.smtpResponse}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.durationMs !== undefined && selectedLog.durationMs !== null && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "duration")}
                                        </Typography>
                                        <Typography variant="body2">
                                            {selectedLog.durationMs} ms
                                        </Typography>
                                    </>
                                )}

                                {(selectedLog.hasAttachments || (selectedLog.attachmentsCount ?? 0) > 0) && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("logs", "attachments")}
                                        </Typography>
                                        <Typography variant="body2">
                                            {t("logs", "fileCount", { count: selectedLog.attachmentsCount ?? 0 })}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.errorMessage && (
                                    <>
                                        <Typography variant="body2" color="error">
                                            {t("logs", "errorMessage")}
                                        </Typography>
                                        <Typography variant="body2" color="error" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                            {selectedLog.errorMessage}
                                        </Typography>
                                    </>
                                )}

                                {selectedLog.errorStack && (
                                    <>
                                        <Typography variant="body2" color="error">
                                            {t("logs", "errorStack")}
                                        </Typography>
                                        <Box
                                            sx={{
                                                bgcolor: "#fff5f5",
                                                border: "1px solid",
                                                borderColor: "error.light",
                                                borderRadius: 1,
                                                p: 1.5,
                                                fontFamily: "monospace",
                                                fontSize: 11,
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-all",
                                                maxHeight: 200,
                                                overflow: "auto",
                                                gridColumn: "2",
                                            }}
                                        >
                                            {selectedLog.errorStack}
                                        </Box>
                                    </>
                                )}
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {t("logs", "preview")}
                                </Typography>
                                <Box
                                    sx={{
                                        bgcolor: "white",
                                        border: 1,
                                        borderColor: "grey.300",
                                        borderRadius: 1,
                                        p: 2.5,
                                        overflow: "auto",
                                        maxHeight: 500,
                                    }}
                                >
                                    <div dangerouslySetInnerHTML={{ __html: selectedLog.htmlBody }} />
                                </Box>
                            </Box>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedLogId(null)}>{t("logs", "close")}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
