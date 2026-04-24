"use client";

import { useEffect, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { DataTable, type ColumnDef, StatusBadge } from "../ui";
import { formatDistanceToNow } from "date-fns";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface CronLogEntry {
    id: string;
    executedAt: string;
    jobName: string;
    jobType: string;
    status: string;
    duration?: number;
    totalProcessed: number;
    totalAffected: number;
    metadata?: {
        expiredIds?: string[];
        schedule?: string;
        timezone?: string;
        source?: string;
    };
    errorMessage?: string;
}

export interface CronLogsPanelProps {
    session: SessionState;
    onNotify?: (text: string, tone: "success" | "error") => void;
}

export function CronLogsPanel({ session, onNotify }: CronLogsPanelProps) {
    const [logs, setLogs] = useState<CronLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchLogs();
    }, [page, pageSize]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });

            const response = await fetch(`/api/v1/internal/cron-logs?${params}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch cron logs");

            const data = await response.json();
            console.log("[CronLogsPanel] Response data:", data);
            console.log("[CronLogsPanel] Items:", data.data?.items);
            console.log("[CronLogsPanel] Total:", data.data?.pagination?.total);

            setLogs(data.data?.items || []);
            setTotal(data.data?.pagination?.total || 0);
        } catch (error) {
            console.error("Error fetching cron logs:", error);
            onNotify?.("Failed to load cron logs", "error");
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<CronLogEntry>[] = [
        {
            key: "executedAt",
            label: "Timestamp",
            renderCell: (log) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600 }}>
                        {new Date(log.executedAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                        {formatDistanceToNow(new Date(log.executedAt), { addSuffix: true })}
                    </Typography>
                </Box>
            ),
        },
        {
            key: "status",
            label: "Status",
            renderCell: (log) => {
                const isSuccess = log.status === "SUCCESS";
                return (
                    <Chip
                        icon={isSuccess ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ErrorIcon sx={{ fontSize: 16 }} />}
                        label={isSuccess ? "Success" : "Failed"}
                        size="small"
                        sx={{
                            fontWeight: 600,
                            fontSize: 12,
                            height: 26,
                            color: isSuccess ? "#059669" : "#dc2626",
                            backgroundColor: isSuccess ? "#d1fae5" : "#fee2e2",
                            "& .MuiChip-icon": {
                                color: isSuccess ? "#059669" : "#dc2626",
                            },
                        }}
                    />
                );
            },
        },
        {
            key: "totalAffected",
            label: "Simulations Expired",
            renderCell: (log) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: log.totalAffected > 0 ? "primary.main" : "text.secondary",
                        }}
                    >
                        {log.totalAffected}
                    </Typography>
                    {log.totalAffected > 0 && (
                        <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                            expired
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            key: "duration",
            label: "Duration",
            renderCell: (log) => (
                <Chip
                    label={log.duration ? `${log.duration}ms` : "—"}
                    size="small"
                    variant="outlined"
                    sx={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        fontWeight: 600,
                        height: 24,
                        borderColor: "divider",
                        color: "text.secondary",
                    }}
                />
            ),
        },
        {
            key: "schedule",
            label: "Trigger Source",
            renderCell: (log) => {
                const source = log.metadata?.source || "scheduled";
                const isApi = source === "api";
                return (
                    <Chip
                        label={isApi ? "Manual (API)" : "Scheduled"}
                        size="small"
                        sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            height: 24,
                            backgroundColor: isApi ? "#fef3c7" : "#dbeafe",
                            color: isApi ? "#92400e" : "#1e40af",
                        }}
                    />
                );
            },
        },
        {
            key: "details",
            label: "Details",
            renderCell: (log) => {
                if (log.errorMessage) {
                    return (
                        <Typography variant="body2" sx={{ fontSize: 12, color: "error.main", fontWeight: 500 }}>
                            Error: {log.errorMessage}
                        </Typography>
                    );
                }
                if (log.metadata?.expiredIds && log.metadata.expiredIds.length > 0) {
                    return (
                        <Typography variant="body2" sx={{ fontSize: 12, color: "success.main" }}>
                            ✓ {log.metadata.expiredIds.length} simulation(s) processed
                        </Typography>
                    );
                }
                return (
                    <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary", fontStyle: "italic" }}>
                        No simulations to expire
                    </Typography>
                );
            },
        },
    ];

    return (
        <div style={{ padding: "24px" }}>
            <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                    Simulation Expiration Jobs
                </h2>
                <p style={{ fontSize: "14px", color: "var(--scheme-neutral-600)" }}>
                    Track automatic simulation expiration cron job executions and their results.
                </p>
            </div>

            <DataTable
                columns={columns}
                rows={logs}
                loading={loading}
                pagination={{
                    page,
                    pageSize,
                    total,
                    onPageChange: setPage,
                    onPageSizeChange: (size: number) => {
                        setPageSize(size);
                        setPage(1);
                    },
                }}
                emptyMessage="No cron job executions found"
            />
        </div>
    );
}
