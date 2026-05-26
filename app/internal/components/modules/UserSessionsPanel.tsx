"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Collapse,
    CircularProgress,
    FormControlLabel,
    IconButton,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type { SessionState } from "../../lib/authSession";
import {
    forceLogoutAllSessions,
    forceLogoutAllUserSessions,
    forceLogoutSession,
    listSessions,
    updateUser,
    type UserSessionItem,
} from "../../lib/internalApi";
import { useI18n } from "../../../../src/lib/i18n-context";

interface UserSessionsPanelProps {
    session: SessionState;
    userId?: string;
    initialPageSize?: number;
    allowGlobalLogoutAll?: boolean;
    allowUserLogoutAll?: boolean;
    showUserColumn?: boolean;
    maxActiveDevices?: number;
    maxActiveDevicesLimit?: number;
    onMaxActiveDevicesChange?: (value: number) => void;
    showSessionsList?: boolean;
    onNotify?: (message: string, tone: "success" | "error") => void;
}

const formatDate = (value?: string | null): string => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const ONLINE_THRESHOLD_MINUTES = 30;

const isRecentlyActive = (lastActivityAt?: string | null): boolean => {
    if (!lastActivityAt) return false;
    const activityTime = new Date(lastActivityAt).getTime();
    if (Number.isNaN(activityTime)) return false;
    const thresholdMs = ONLINE_THRESHOLD_MINUTES * 60 * 1000;
    return Date.now() - activityTime <= thresholdMs;
};

export function UserSessionsPanel({
    session,
    userId,
    initialPageSize = 25,
    allowGlobalLogoutAll = false,
    allowUserLogoutAll = false,
    showUserColumn = false,
    maxActiveDevices: initialMaxActiveDevices,
    maxActiveDevicesLimit,
    onMaxActiveDevicesChange,
    showSessionsList = true,
    onNotify,
}: UserSessionsPanelProps) {
    const { t } = useI18n();
    const [items, setItems] = useState<UserSessionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeOnly, setActiveOnly] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [total, setTotal] = useState(0);
    const [busySessionId, setBusySessionId] = useState<string | null>(null);
    const [busyGlobalAction, setBusyGlobalAction] = useState<
        null | "user-all" | "global-all"
    >(null);
    const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
    const [pastSessionsByUser, setPastSessionsByUser] = useState<Record<string, UserSessionItem[]>>({});
    const [loadingPastByUser, setLoadingPastByUser] = useState<Record<string, boolean>>({});
    const [pastPageByUser, setPastPageByUser] = useState<Record<string, number>>({});
    const [pastTotalByUser, setPastTotalByUser] = useState<Record<string, number>>({});
    const groupedMode = showUserColumn && !userId;
    const onNotifyRef = useRef(onNotify);
    const [maxDevices, setMaxDevices] = useState<number>(initialMaxActiveDevices ?? 3);
    const [isSavingMaxDevices, setIsSavingMaxDevices] = useState(false);
    const effectiveMaxDevicesLimit = Math.max(1, maxActiveDevicesLimit ?? initialMaxActiveDevices ?? 3);
    const canManageMaxDevices = Boolean(userId) || typeof onMaxActiveDevicesChange === "function";
    const canPersistMaxDevices = Boolean(userId) && typeof onMaxActiveDevicesChange !== "function";
    const shouldLoadSessions = showSessionsList && (Boolean(userId) || groupedMode);

    const clampMaxDevices = useCallback((value: number) => {
        if (Number.isNaN(value)) {
            return 1;
        }

        return Math.min(effectiveMaxDevicesLimit, Math.max(1, value));
    }, [effectiveMaxDevicesLimit]);

    useEffect(() => {
        if (initialMaxActiveDevices !== undefined) {
            setMaxDevices(initialMaxActiveDevices);
        }
    }, [initialMaxActiveDevices]);

    const handleMaxDevicesChange = useCallback((value: number) => {
        const nextValue = clampMaxDevices(value);
        setMaxDevices(nextValue);
        onMaxActiveDevicesChange?.(nextValue);
    }, [clampMaxDevices, onMaxActiveDevicesChange]);

    const handleSaveMaxDevices = async () => {
        if (!userId) return;
        setIsSavingMaxDevices(true);
        try {
            await updateUser(session.token, userId, { maxActiveDevices: maxDevices });
            onNotify?.("Max active sessions updated.", "success");
        } catch (error) {
            onNotify?.(error instanceof Error ? error.message : "Failed to update max sessions.", "error");
        } finally {
            setIsSavingMaxDevices(false);
        }
    };
    const lastRequestRef = useRef<{ key: string; at: number } | null>(null);
    const pendingRequestKeyRef = useRef<string | null>(null);
    const pendingPastRequestKeyRef = useRef<Record<string, string>>({});

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

    useEffect(() => {
        setPageSize(initialPageSize);
        setPage(1);
    }, [initialPageSize]);

    useEffect(() => {
        onNotifyRef.current = onNotify;
    }, [onNotify]);

    const groupedActiveUsers = useMemo(() => {
        if (!groupedMode) return [];

        const groups = new Map<string, {
            userId: string;
            userName: string;
            userEmail: string;
            sessions: UserSessionItem[];
            latestActivityAt: string | null;
            latestLoginAt: string | null;
        }>();

        for (const item of items) {
            const existing = groups.get(item.userId);
            if (!existing) {
                groups.set(item.userId, {
                    userId: item.userId,
                    userName: item.user?.fullName ?? "—",
                    userEmail: item.user?.email ?? item.userId,
                    sessions: [item],
                    latestActivityAt: item.lastActivityAt ?? null,
                    latestLoginAt: item.loginAt ?? null,
                });
                continue;
            }

            existing.sessions.push(item);
            if (
                item.lastActivityAt &&
                (!existing.latestActivityAt || item.lastActivityAt > existing.latestActivityAt)
            ) {
                existing.latestActivityAt = item.lastActivityAt;
            }
            if (item.loginAt && (!existing.latestLoginAt || item.loginAt > existing.latestLoginAt)) {
                existing.latestLoginAt = item.loginAt;
            }
        }

        return Array.from(groups.values()).sort((a, b) => {
            const left = a.latestActivityAt ?? "";
            const right = b.latestActivityAt ?? "";
            return right.localeCompare(left);
        });
    }, [groupedMode, items]);

    const fetchSessions = useCallback(async (options?: { force?: boolean }) => {
        const requestKey = `${page}|${pageSize}|${userId ?? ""}|${groupedMode ? "1" : "0"}|${activeOnly ? "1" : "0"}`;
        const now = Date.now();
        const lastRequest = lastRequestRef.current;
        const isDuplicateBurst =
            !options?.force &&
            ((pendingRequestKeyRef.current === requestKey) ||
                (lastRequest?.key === requestKey && now - lastRequest.at < 1500));

        if (isDuplicateBurst) {
            return;
        }

        lastRequestRef.current = { key: requestKey, at: now };
        pendingRequestKeyRef.current = requestKey;
        setLoading(true);
        try {
            const result = await listSessions(session.token, {
                page,
                pageSize,
                userId,
                activeOnly: groupedMode ? true : activeOnly,
            });
            setItems(result.items);
            setTotal(result.total);
        } catch (error) {
            onNotifyRef.current?.(
                error instanceof Error ? error.message : "Failed to load sessions",
                "error",
            );
        } finally {
            if (pendingRequestKeyRef.current === requestKey) {
                pendingRequestKeyRef.current = null;
            }
            setLoading(false);
        }
    }, [activeOnly, groupedMode, page, pageSize, session.token, userId]);

    const fetchPastSessionsForUser = useCallback(
        async (targetUserId: string, targetPage = 1) => {
            const requestKey = `${targetUserId}|${targetPage}|${pageSize}`;
            if (pendingPastRequestKeyRef.current[targetUserId] === requestKey) {
                return;
            }

            pendingPastRequestKeyRef.current[targetUserId] = requestKey;
            setLoadingPastByUser((curr) => ({ ...curr, [targetUserId]: true }));
            try {
                const result = await listSessions(session.token, {
                    page: targetPage,
                    pageSize,
                    userId: targetUserId,
                    inactiveOnly: true,
                });

                setPastSessionsByUser((curr) => ({
                    ...curr,
                    [targetUserId]: result.items,
                }));
                setPastTotalByUser((curr) => ({ ...curr, [targetUserId]: result.total }));
                setPastPageByUser((curr) => ({ ...curr, [targetUserId]: targetPage }));
            } catch (error) {
                onNotifyRef.current?.(
                    error instanceof Error ? error.message : "Failed to load sessions",
                    "error",
                );
            } finally {
                if (pendingPastRequestKeyRef.current[targetUserId] === requestKey) {
                    delete pendingPastRequestKeyRef.current[targetUserId];
                }
                setLoadingPastByUser((curr) => ({ ...curr, [targetUserId]: false }));
            }
        },
        [pageSize, session.token],
    );

    useEffect(() => {
        if (!shouldLoadSessions) {
            return;
        }

        void fetchSessions();
    }, [fetchSessions, shouldLoadSessions]);

    useEffect(() => {
        if (!shouldLoadSessions) {
            return;
        }

        const interval = setInterval(() => {
            void fetchSessions({ force: true });
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchSessions, shouldLoadSessions]);

    const toggleUserDetails = (targetUserId: string) => {
        const nextOpen = !expandedUsers[targetUserId];
        setExpandedUsers((curr) => ({ ...curr, [targetUserId]: nextOpen }));

        if (
            nextOpen &&
            typeof pastSessionsByUser[targetUserId] === "undefined" &&
            !loadingPastByUser[targetUserId]
        ) {
            void fetchPastSessionsForUser(targetUserId, 1);
        }
    };

    const handleForceLogoutSession = async (sessionId: string, affectedUserId?: string) => {
        setBusySessionId(sessionId);
        try {
            await forceLogoutSession(session.token, sessionId);
            onNotify?.(t("userSessions", "sessionTerminated"), "success");
            await fetchSessions();
            if (affectedUserId && expandedUsers[affectedUserId]) {
                await fetchPastSessionsForUser(
                    affectedUserId,
                    pastPageByUser[affectedUserId] ?? 1,
                );
            }
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("userSessions", "failedToTerminateSession"),
                "error",
            );
        } finally {
            setBusySessionId(null);
        }
    };

    const handleForceLogoutAllForUser = async () => {
        if (!userId) return;

        setBusyGlobalAction("user-all");
        try {
            const result = await forceLogoutAllUserSessions(session.token, userId);
            onNotify?.(t("userSessions", "terminatedActiveSessions", { count: result.revokedCount }), "success");
            await fetchSessions();
            if (expandedUsers[userId]) {
                await fetchPastSessionsForUser(userId, pastPageByUser[userId] ?? 1);
            }
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("userSessions", "failedToTerminateUserSessions"),
                "error",
            );
        } finally {
            setBusyGlobalAction(null);
        }
    };

    const handleEmergencyLogoutAll = async () => {
        setBusyGlobalAction("global-all");
        try {
            const result = await forceLogoutAllSessions(session.token);
            onNotify?.(t("userSessions", "emergencyLogoutCompleted", { count: result.revokedCount }), "success");
            await fetchSessions();
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("userSessions", "failedEmergencyLogout"),
                "error",
            );
        } finally {
            setBusyGlobalAction(null);
        }
    };

    const renderStatus = (isActive: boolean, lastActivityAt?: string | null) => {
        if (!isActive) {
            return <Chip size="small" label={t("userSessions", "closed")} variant="outlined" />;
        }

        const online = isRecentlyActive(lastActivityAt);
        return (
            <Chip
                size="small"
                color={online ? "success" : "warning"}
                label={online ? t("userSessions", "onlineNow") : t("userSessions", "idle")}
            />
        );
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {canManageMaxDevices && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, bgcolor: "action.hover", borderRadius: 2, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 200 }}>
                        {t("userSessions", "maxAllowedActiveSessions")}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <input
                            type="number"
                            min={1}
                            max={effectiveMaxDevicesLimit}
                            value={maxDevices}
                            onChange={(e) => handleMaxDevicesChange(Number(e.target.value))}
                            style={{ width: 64, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14 }}
                        />
                        {canPersistMaxDevices && (
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={handleSaveMaxDevices}
                                disabled={isSavingMaxDevices || maxDevices === initialMaxActiveDevices}
                            >
                                {isSavingMaxDevices ? "Saving…" : "Save"}
                            </Button>
                        )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {showSessionsList
                            ? t("userSessions", "maxAllowedActiveSessionsHint", { count: effectiveMaxDevicesLimit })
                            : t("userSessions", "maxAllowedActiveSessionsCreateHint", { count: effectiveMaxDevicesLimit })}
                    </Typography>
                </Box>
            )}
            {!showSessionsList && (
                <Typography variant="body2" color="text.secondary">
                    {t("userSessions", "historyAvailableAfterFirstLogin")}
                </Typography>
            )}
            {showSessionsList && (
                <>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                        {!groupedMode ? (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={activeOnly}
                                        onChange={(event) => {
                                            setActiveOnly(event.target.checked);
                                            setPage(1);
                                        }}
                                    />
                                }
                                label={t("userSessions", "activeOnly")}
                            />
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t("userSessions", "activeUsersCount", { count: groupedActiveUsers.length })}
                            </Typography>
                        )}

                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            {allowUserLogoutAll && userId && (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    onClick={handleForceLogoutAllForUser}
                                    disabled={busyGlobalAction !== null}
                                >
                                    {busyGlobalAction === "user-all" ? t("userSessions", "processing") : t("userSessions", "logoutAllUserSessions")}
                                </Button>
                            )}

                            {allowGlobalLogoutAll && (
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={handleEmergencyLogoutAll}
                                    disabled={busyGlobalAction !== null}
                                >
                                    {busyGlobalAction === "global-all" ? t("userSessions", "processing") : t("userSessions", "emergencyLogoutAllUsers")}
                                </Button>
                            )}

                            <Button variant="outlined" onClick={() => void fetchSessions({ force: true })} disabled={loading}>
                                {t("actions", "refresh")}
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    {groupedMode ? (
                                        <>
                                            <TableCell>{t("auditLogsModal", "actor")}</TableCell>
                                            <TableCell>{t("columns", "status")}</TableCell>
                                            <TableCell>{t("userSessions", "activeSessions")}</TableCell>
                                            <TableCell>{t("userSessions", "login")}</TableCell>
                                            <TableCell>{t("userSessions", "lastActivity")}</TableCell>
                                            <TableCell align="right">{t("columns", "actions")}</TableCell>
                                        </>
                                    ) : (
                                        <>
                                            {showUserColumn && <TableCell>{t("auditLogsModal", "actor")}</TableCell>}
                                            <TableCell>{t("columns", "status")}</TableCell>
                                            <TableCell>{t("userSessions", "login")}</TableCell>
                                            <TableCell>{t("userSessions", "lastActivity")}</TableCell>
                                            <TableCell>{t("userSessions", "logout")}</TableCell>
                                            <TableCell>{t("userSessions", "auth")}</TableCell>
                                            <TableCell>{t("userSessions", "device")}</TableCell>
                                            <TableCell>IP</TableCell>
                                            <TableCell>{t("userSessions", "reason")}</TableCell>
                                            <TableCell align="right">{t("columns", "actions")}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(groupedMode ? groupedActiveUsers.length === 0 : items.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={groupedMode ? 6 : showUserColumn ? 10 : 9}>
                                            {loading ? (
                                                <Box sx={{ py: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t("userSessions", "loading")}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                                    {t("userSessions", "noSessions")}
                                                </Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}

                                {groupedMode
                                    ? groupedActiveUsers.map((group) => {
                                        const isOpen = Boolean(expandedUsers[group.userId]);
                                        const pastSessions = pastSessionsByUser[group.userId] ?? [];
                                        const loadingPast = Boolean(loadingPastByUser[group.userId]);
                                        const pastPage = pastPageByUser[group.userId] ?? 1;
                                        const pastTotal = pastTotalByUser[group.userId] ?? 0;
                                        const pastTotalPages = Math.max(1, Math.ceil(pastTotal / pageSize));

                                        return (
                                            <Fragment key={group.userId}>
                                                <TableRow hover>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {group.userName}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {group.userEmail}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{renderStatus(true, group.latestActivityAt)}</TableCell>
                                                    <TableCell>{group.sessions.length}</TableCell>
                                                    <TableCell>{formatDate(group.latestLoginAt)}</TableCell>
                                                    <TableCell>{formatDate(group.latestActivityAt)}</TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={
                                                                isOpen
                                                                    ? t("userSessions", "collapseSessions")
                                                                    : t("userSessions", "expandSessions")
                                                            }
                                                            onClick={() => toggleUserDetails(group.userId)}
                                                        >
                                                            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell colSpan={6} sx={{ p: 0 }}>
                                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                            <Box sx={{ p: 2, backgroundColor: "background.default" }}>
                                                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                                    {t("userSessions", "activeSessions")}
                                                                </Typography>
                                                                <Table size="small" sx={{ mb: 2 }}>
                                                                    <TableHead>
                                                                        <TableRow>
                                                                            <TableCell>{t("userSessions", "login")}</TableCell>
                                                                            <TableCell>{t("userSessions", "lastActivity")}</TableCell>
                                                                            <TableCell>{t("userSessions", "auth")}</TableCell>
                                                                            <TableCell>{t("userSessions", "device")}</TableCell>
                                                                            <TableCell>IP</TableCell>
                                                                            <TableCell align="right">{t("columns", "actions")}</TableCell>
                                                                        </TableRow>
                                                                    </TableHead>
                                                                    <TableBody>
                                                                        {group.sessions.map((activeSession) => (
                                                                            <TableRow key={activeSession.id}>
                                                                                <TableCell>{formatDate(activeSession.loginAt)}</TableCell>
                                                                                <TableCell>{formatDate(activeSession.lastActivityAt)}</TableCell>
                                                                                <TableCell>{activeSession.authMethod}</TableCell>
                                                                                <TableCell>
                                                                                    {[activeSession.browser, activeSession.os].filter(Boolean).join(" / ") || "—"}
                                                                                </TableCell>
                                                                                <TableCell>{activeSession.ipAddress || "—"}</TableCell>
                                                                                <TableCell align="right">
                                                                                    <Button
                                                                                        size="small"
                                                                                        color="warning"
                                                                                        disabled={busySessionId !== null}
                                                                                        onClick={() => void handleForceLogoutSession(activeSession.id, group.userId)}
                                                                                    >
                                                                                        {busySessionId === activeSession.id
                                                                                            ? t("userSessions", "processing")
                                                                                            : t("userSessions", "forceLogout")}
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>

                                                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                                    {t("userSessions", "pastSessions")}
                                                                </Typography>
                                                                {loadingPast ? (
                                                                    <Box sx={{ py: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                                                        <CircularProgress size={20} />
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {t("userSessions", "loading")}
                                                                        </Typography>
                                                                    </Box>
                                                                ) : pastSessions.length === 0 ? (
                                                                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                                        {t("userSessions", "noPastSessions")}
                                                                    </Typography>
                                                                ) : (
                                                                    <Table size="small">
                                                                        <TableHead>
                                                                            <TableRow>
                                                                                <TableCell>{t("userSessions", "login")}</TableCell>
                                                                                <TableCell>{t("userSessions", "lastActivity")}</TableCell>
                                                                                <TableCell>{t("userSessions", "logout")}</TableCell>
                                                                                <TableCell>{t("userSessions", "auth")}</TableCell>
                                                                                <TableCell>{t("userSessions", "device")}</TableCell>
                                                                                <TableCell>IP</TableCell>
                                                                                <TableCell>{t("userSessions", "reason")}</TableCell>
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {pastSessions.map((pastSession) => (
                                                                                <TableRow key={pastSession.id}>
                                                                                    <TableCell>{formatDate(pastSession.loginAt)}</TableCell>
                                                                                    <TableCell>{formatDate(pastSession.lastActivityAt)}</TableCell>
                                                                                    <TableCell>{formatDate(pastSession.logoutAt)}</TableCell>
                                                                                    <TableCell>{pastSession.authMethod}</TableCell>
                                                                                    <TableCell>
                                                                                        {[pastSession.browser, pastSession.os].filter(Boolean).join(" / ") || "—"}
                                                                                    </TableCell>
                                                                                    <TableCell>{pastSession.ipAddress || "—"}</TableCell>
                                                                                    <TableCell>{pastSession.terminationReason || "—"}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                )}

                                                                <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, mt: 1 }}>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        disabled={loadingPast || pastPage <= 1}
                                                                        onClick={() => void fetchPastSessionsForUser(group.userId, Math.max(1, pastPage - 1))}
                                                                    >
                                                                        {t("userSessions", "prev")}
                                                                    </Button>
                                                                    <Typography variant="body2">
                                                                        {pastPage} / {pastTotalPages}
                                                                    </Typography>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        disabled={loadingPast || pastPage >= pastTotalPages}
                                                                        onClick={() => void fetchPastSessionsForUser(group.userId, Math.min(pastTotalPages, pastPage + 1))}
                                                                    >
                                                                        {t("userSessions", "next")}
                                                                    </Button>
                                                                </Box>
                                                            </Box>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            </Fragment>
                                        );
                                    })
                                    : items.map((item) => (
                                        <TableRow key={item.id} hover>
                                            {showUserColumn && (
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {item.user?.fullName ?? "—"}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {item.user?.email ?? item.userId}
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            <TableCell>{renderStatus(item.isActive, item.lastActivityAt)}</TableCell>
                                            <TableCell>{formatDate(item.loginAt)}</TableCell>
                                            <TableCell>{formatDate(item.lastActivityAt)}</TableCell>
                                            <TableCell>{formatDate(item.logoutAt)}</TableCell>
                                            <TableCell>{item.authMethod}</TableCell>
                                            <TableCell>{[item.browser, item.os].filter(Boolean).join(" / ") || "—"}</TableCell>
                                            <TableCell>{item.ipAddress || "—"}</TableCell>
                                            <TableCell>{item.terminationReason || "—"}</TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    color="warning"
                                                    disabled={!item.isActive || busySessionId !== null}
                                                    onClick={() => void handleForceLogoutSession(item.id)}
                                                >
                                                    {busySessionId === item.id ? t("userSessions", "processing") : t("userSessions", "forceLogout")}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                            {t("userSessions", "sessionsCount", { count: total })}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                {t("userSessions", "prev")}
                            </Button>
                            <Typography variant="body2" sx={{ alignSelf: "center" }}>
                                {page} / {totalPages}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                {t("userSessions", "next")}
                            </Button>
                        </Box>
                    </Box>
                </>
            )}
        </Box>
    );
}
