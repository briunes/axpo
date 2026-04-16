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
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Chip,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import VisibilityIcon from "@mui/icons-material/Visibility";

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
    relatedUserId?: string;
    relatedSimulationId?: string;
}

interface EmailLogsModuleProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

function TriggerBadge({ trigger }: { trigger?: string }) {
    if (!trigger) return <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>;

    const toneMap: Record<string, "brand" | "accent" | "success" | "neutral"> = {
        "user-creation": "brand",
        "simulation-share": "accent",
        "test-email": "success",
    };

    return <StatusBadge label={trigger} tone={toneMap[trigger] || "neutral"} />;
}

export function EmailLogsModule({ session, onNotify }: EmailLogsModuleProps) {
    const { t } = useI18n();
    const [logs, setLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [triggerFilter, setTriggerFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    // Sorting
    const [sortColumn, setSortColumn] = useState("sentAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const paramsRef = useRef("");
    useEffect(() => {
        const key = `${page}|${pageSize}|${sortColumn}|${sortDir}|${statusFilter}|${triggerFilter}|${searchTerm}|${dateFrom}|${dateTo}`;
        if (paramsRef.current === key) return;
        paramsRef.current = key;
        fetchLogs();
    }, [page, pageSize, sortColumn, sortDir, statusFilter, triggerFilter, searchTerm, dateFrom, dateTo]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
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
            setLogs(data.logs || []);
            setTotal(data.pagination?.total || 0);
        } catch (error) {
            console.error("Error fetching email logs:", error);
            onNotify?.("Failed to load email logs", "error");
        } finally {
            setLoading(false);
        }
    };

    const viewDetails = async (logId: string) => {
        try {
            const response = await fetch(`/api/v1/internal/email-logs/${logId}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch email log details");

            const result = await response.json();
            const log = result.data || result; // Handle both wrapped and unwrapped responses
            setSelectedLog(log);
        } catch (error) {
            console.error("Error fetching email log details:", error);
            onNotify?.("Failed to load email details", "error");
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(date);
    };

    const resetFilters = () => {
        setStatusFilter("all");
        setTriggerFilter("all");
        setSearchTerm("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
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
            label: t("columns", "date") || "Date",
            sortable: true,
            width: "180",
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(log.sentAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                    })}{" "}
                    {new Date(log.sentAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </Typography>
            ),
        },
        {
            key: "recipientEmail",
            label: t("columns", "recipient") || "Recipient",
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {log.recipientEmail}
                </Typography>
            ),
        },
        {
            key: "subject",
            label: t("columns", "subject") || "Subject",
            renderCell: (log) => (
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {log.subject}
                </Typography>
            ),
        },
        {
            key: "triggeredBy",
            label: "Triggered By",
            renderCell: (log) => <TriggerBadge trigger={log.triggeredBy} />,
        },
        {
            key: "status",
            label: t("columns", "status") || "Status",
            renderCell: (log) => (
                <StatusBadge
                    label={log.status}
                    tone={log.status === "sent" ? "success" : "danger"}
                />
            ),
        },
    ];

    const filterBar = (
        <Stack spacing={2} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        label="Status"
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="sent">Sent</MenuItem>
                        <MenuItem value="failed">Failed</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Triggered By</InputLabel>
                    <Select
                        value={triggerFilter}
                        onChange={(e) => {
                            setTriggerFilter(e.target.value);
                            setPage(1);
                        }}
                        label="Triggered By"
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="user-creation">User Creation</MenuItem>
                        <MenuItem value="simulation-share">Simulation Share</MenuItem>
                        <MenuItem value="test-email">Test Email</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    label="From Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={dateFrom}
                    onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                    }}
                    sx={{ width: 180 }}
                />

                <TextField
                    size="small"
                    label="To Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={dateTo}
                    onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                    }}
                    sx={{ width: 180 }}
                />

                <Button onClick={resetFilters} variant="outlined" size="small">
                    Reset Filters
                </Button>
            </Stack>
        </Stack>
    );

    return (
        <>
            <DataTable
                columns={columns}
                rows={logs}
                loading={loading}
                searchValue={searchTerm}
                onSearch={(value) => {
                    setSearchTerm(value);
                    setPage(1);
                }}
                searchPlaceholder="Search by recipient, subject, or template..."
                sortState={{ column: sortColumn, direction: sortDir }}
                onSort={handleSort}
                filterBar={filterBar}
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
                rowActions={(log) => (
                    <Button
                        startIcon={<VisibilityIcon />}
                        onClick={() => viewDetails(log.id)}
                        variant="outlined"
                        size="small"
                    >
                        View
                    </Button>
                )}
                emptyMessage="No email logs found"
            />

            {/* Detail Dialog */}
            <Dialog
                open={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Email Log Details</DialogTitle>
                <DialogContent dividers>
                    {selectedLog && (
                        <Stack spacing={3}>
                            <Box sx={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Sent At
                                </Typography>
                                <Typography variant="body2">{formatDate(selectedLog.sentAt)}</Typography>

                                <Typography variant="body2" color="text.secondary">
                                    Status
                                </Typography>
                                <Box>
                                    <StatusBadge
                                        label={selectedLog.status}
                                        tone={selectedLog.status === "sent" ? "success" : "danger"}
                                    />
                                </Box>

                                <Typography variant="body2" color="text.secondary">
                                    Recipient
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                    {selectedLog.recipientEmail}
                                </Typography>

                                <Typography variant="body2" color="text.secondary">
                                    Triggered By
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
                                            Template
                                        </Typography>
                                        <Typography variant="body2">{selectedLog.templateName}</Typography>
                                    </>
                                )}

                                <Typography variant="body2" color="text.secondary">
                                    Subject
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {selectedLog.subject}
                                </Typography>

                                {selectedLog.errorMessage && (
                                    <>
                                        <Typography variant="body2" color="error">
                                            Error Message
                                        </Typography>
                                        <Typography variant="body2" color="error" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                            {selectedLog.errorMessage}
                                        </Typography>
                                    </>
                                )}
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Preview
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
                    <Button onClick={() => setSelectedLog(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
