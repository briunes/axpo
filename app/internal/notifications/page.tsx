"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CategoryIcon from "@mui/icons-material/Category";
import SourceIcon from "@mui/icons-material/Source";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useI18n } from "../../../src/lib/i18n-context";
import { loadSession } from "../lib/authSession";
import {
  listNotifications,
  markNotifications,
  type NotificationItem,
  type NotificationSeverity,
  type NotificationStatusFilter,
} from "../lib/internalApi";
import { useActionButtons, useRegisterRefresh } from "../components/InternalWorkspace";
import { useRequestCachePolicy } from "../components/hooks/useRequestCachePolicy";

const severityOptions: Array<NotificationSeverity | "all"> = [
  "all",
  "CRITICAL",
  "ERROR",
  "WARNING",
  "INFO",
  "SUCCESS",
];

const typeOptions = [
  "all",
  "app_errors.recent_5xx",
  "cron.failed",
  "email.failed_recent",
  "ocr.failed_recent",
  "ocr.issues_open",
  "invoice_provider.prompt_config_needed",
  "system.maintenance_active",
];

const categoryOptions = [
  "all",
  "system_health",
  "automation",
  "communications",
  "integrations",
  "operations",
  "configuration",
];

const sourceTypeOptions = [
  "all",
  "app_error_logs",
  "cron_logs",
  "email_logs",
  "ocr_logs",
  "invoice_provider_prompts",
  "system_config",
];

const statusOptions: NotificationStatusFilter[] = ["all", "unread", "read", "dismissed"];

const statusTone: Record<NotificationStatusFilter, { accent: string; soft: string }> = {
  all: { accent: "var(--scheme-brand-600)", soft: "rgba(255,50,84,0.08)" },
  unread: { accent: "var(--scheme-brand-600)", soft: "rgba(255,50,84,0.08)" },
  read: { accent: "#1570ef", soft: "rgba(21,112,239,0.08)" },
  dismissed: { accent: "#9ca3af", soft: "rgba(156,163,175,0.11)" },
};

const severityColor: Record<NotificationSeverity, "info" | "success" | "warning" | "error"> = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "error",
};

const severityTone: Record<NotificationSeverity, { accent: string; bg: string; soft: string; text: string }> = {
  CRITICAL: {
    accent: "#d92d20",
    bg: "linear-gradient(135deg, rgba(217,45,32,0.18), rgba(255,50,84,0.08))",
    soft: "rgba(217,45,32,0.12)",
    text: "#b42318",
  },
  ERROR: {
    accent: "#ff3254",
    bg: "linear-gradient(135deg, rgba(255,50,84,0.16), rgba(255,98,121,0.08))",
    soft: "rgba(255,50,84,0.12)",
    text: "#c01036",
  },
  WARNING: {
    accent: "#f79009",
    bg: "linear-gradient(135deg, rgba(247,144,9,0.18), rgba(255,237,87,0.10))",
    soft: "rgba(247,144,9,0.14)",
    text: "#b54708",
  },
  INFO: {
    accent: "#1570ef",
    bg: "linear-gradient(135deg, rgba(21,112,239,0.14), rgba(69,69,207,0.08))",
    soft: "rgba(21,112,239,0.12)",
    text: "#175cd3",
  },
  SUCCESS: {
    accent: "#12b76a",
    bg: "linear-gradient(135deg, rgba(18,183,106,0.16), rgba(34,197,94,0.08))",
    soft: "rgba(18,183,106,0.12)",
    text: "#027a48",
  },
};

const categoryTone: Record<string, { bg: string; color: string; border: string }> = {
  system_health: { bg: "rgba(255,50,84,0.10)", color: "#c01036", border: "rgba(255,50,84,0.22)" },
  automation: { bg: "rgba(143,67,167,0.12)", color: "#7a328f", border: "rgba(143,67,167,0.24)" },
  communications: { bg: "rgba(21,112,239,0.10)", color: "#175cd3", border: "rgba(21,112,239,0.22)" },
  integrations: { bg: "rgba(18,183,106,0.11)", color: "#027a48", border: "rgba(18,183,106,0.24)" },
  operations: { bg: "rgba(247,144,9,0.12)", color: "#b54708", border: "rgba(247,144,9,0.24)" },
  configuration: { bg: "rgba(69,69,207,0.10)", color: "#3538cd", border: "rgba(69,69,207,0.22)" },
};

function labelize(value: string): string {
  if (value === "all") return "All";
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function compactDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function FilterPanelSkeleton() {
  return (
    <Stack gap={2}>
      <Box>
        <Skeleton variant="text" width={64} height={18} sx={{ mb: 1 }} />
        <Stack gap={0.5}>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} variant="rounded" height={34} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
        <Skeleton variant="text" width={130} height={18} sx={{ mt: 1.25, ml: 1 }} />
      </Box>

      <Divider />

      <Box>
        <Skeleton variant="text" width={74} height={20} sx={{ mb: 1 }} />
        <Stack gap={0.5}>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} variant="rounded" height={34} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      </Box>

      <Divider />

      <Stack gap={1.6}>
        {[0, 1, 2].map((row) => (
          <Box key={row}>
            <Skeleton variant="text" width={row === 0 ? 42 : row === 1 ? 72 : 58} height={20} sx={{ mb: 0.75 }} />
            <Skeleton variant="rounded" height={40} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Stack>

      <Skeleton variant="text" width={112} height={18} sx={{ alignSelf: "center", mt: 2 }} />
    </Stack>
  );
}

function NotificationHeaderSkeleton() {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} minWidth={0}>
      <Skeleton variant="rounded" width={22} height={22} sx={{ borderRadius: 0.75 }} />
      <Box minWidth={0} sx={{ flex: 1 }}>
        <Skeleton variant="text" width={150} height={22} />
        <Skeleton variant="text" width={220} height={20} />
      </Box>
    </Stack>
  );
}

function NotificationCardsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((row) => (
        <Paper
          key={row}
          variant="outlined"
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 2,
            bgcolor: "var(--scheme-surface-raised)",
            boxShadow: "var(--scheme-shadow-soft)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "0 auto 0 0",
              width: 4,
              bgcolor: "var(--scheme-surface-raised-muted)",
            },
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" },
              gap: 1.25,
              px: { xs: 1.25, md: 1.5 },
              py: { xs: 1.25, md: 1.35 },
              pl: { xs: 1.75, md: 2 },
            }}
          >
            <Skeleton variant="rounded" width={22} height={22} sx={{ borderRadius: 0.75 }} />
            <Stack gap={0.9} minWidth={0}>
              <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
                <Skeleton variant="rounded" width={58} height={20} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width={76} height={20} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width={row % 2 === 0 ? 136 : 104} height={20} sx={{ borderRadius: 1 }} />
              </Stack>
              <Skeleton variant="text" width={row % 2 === 0 ? "56%" : "44%"} height={24} />
              <Skeleton variant="text" width={row % 2 === 0 ? "72%" : "64%"} height={22} />
              <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                <Skeleton variant="rounded" width={132} height={20} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width={112} height={20} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width={96} height={20} sx={{ borderRadius: 1 }} />
              </Stack>
            </Stack>
            <Stack
              gap={0.75}
              alignItems={{ xs: "center", md: "flex-end" }}
              justifyContent="space-between"
              sx={{ gridColumn: { xs: "2 / 3", md: "auto" } }}
            >
              <Skeleton variant="text" width={120} height={20} />
              <Skeleton variant="circular" width={30} height={30} />
            </Stack>
          </Box>
        </Paper>
      ))}
    </>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const onActionButtons = useActionButtons();
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("notifications");
  const [session] = useState(loadSession());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<NotificationStatusFilter>("all");
  const [severity, setSeverity] = useState<NotificationSeverity | "all">("all");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const limit = 50;

  const queryParams = useMemo(
    () => ({
      limit,
      status,
      includeDismissed: status === "dismissed",
      severity,
      type,
      category,
      sourceType,
    }),
    [category, severity, sourceType, status, type],
  );

  const queryKey = useMemo(
    () => ["notifications", session?.token ?? "", queryParams] as const,
    [queryParams, session?.token],
  );

  const { data, error: queryError, isFetching, isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey,
    queryFn: () => listNotifications(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const items = data?.items ?? [];
  const loading = isLoading || isPlaceholderData || (isFetching && !data);
  const error = data?.unavailable
    ? t("notifications", "migrationPending")
    : queryError
      ? queryError instanceof Error
        ? queryError.message
        : t("notifications", "loadFailed")
      : null;

  const refreshNotifications = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications", session?.token ?? ""] });
    await refetch();
  }, [queryClient, refetch, session?.token]);

  useRegisterRefresh(() => {
    void refreshNotifications();
  });

  useEffect(() => {
    setSelectedIds([]);
  }, [queryKey]);

  const allVisibleSelected = items.length > 0 && selectedIds.length === items.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const unreadCount = useMemo(() => items.filter((item) => !item.readAt && !item.dismissedAt).length, [items]);
  const readCount = useMemo(() => items.filter((item) => Boolean(item.readAt) && !item.dismissedAt).length, [items]);
  const dismissedCount = useMemo(() => items.filter((item) => Boolean(item.dismissedAt)).length, [items]);
  const statusCounts = useMemo<Record<NotificationStatusFilter, number>>(
    () => ({
      all: items.length,
      unread: unreadCount,
      read: readCount,
      dismissed: dismissedCount,
    }),
    [dismissedCount, items.length, readCount, unreadCount],
  );
  const severityCounts = useMemo(() => {
    return items.reduce<Record<NotificationSeverity, number>>(
      (counts, item) => {
        counts[item.severity] += 1;
        return counts;
      },
      { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0, SUCCESS: 0 },
    );
  }, [items]);

  const resetFilters = () => {
    setStatus("all");
    setSeverity("all");
    setType("all");
    setCategory("all");
    setSourceType("all");
  };

  const toggleAll = () => {
    setSelectedIds(allVisibleSelected ? [] : items.map((item) => item.id));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const markSelected = async (action: "read" | "dismiss") => {
    if (!session || selectedIds.length === 0) return;
    await markNotifications(session.token, selectedIds, action);
    await refreshNotifications();
  };

  const openNotification = async (item: NotificationItem) => {
    if (!session) return;
    if (!item.readAt) {
      await markNotifications(session.token, [item.id], "read").catch(() => undefined);
    }
    if (item.actionUrl) {
      void queryClient.invalidateQueries({ queryKey: ["notifications", session.token] });
      router.push(item.actionUrl);
      return;
    }
    await refreshNotifications();
  };

  useEffect(() => {
    onActionButtons?.(
      <>
        <Tooltip title={t("notifications", "refresh")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={() => void refreshNotifications()}
              disabled={loading}
              aria-label={t("notifications", "refresh")}
            >
              <span className="topbar-action-label">{t("notifications", "refresh")}</span>
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={t("notifications", "markRead")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              startIcon={<MarkEmailReadIcon fontSize="small" />}
              disabled={selectedIds.length === 0}
              onClick={() => void markSelected("read")}
              aria-label={t("notifications", "markRead")}
            >
              <span className="topbar-action-label">{t("notifications", "markRead")}</span>
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={t("notifications", "dismiss")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              color="error"
              variant="outlined"
              size="small"
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              disabled={selectedIds.length === 0}
              onClick={() => void markSelected("dismiss")}
              aria-label={t("notifications", "dismiss")}
            >
              <span className="topbar-action-label">{t("notifications", "dismiss")}</span>
            </Button>
          </span>
        </Tooltip>
      </>,
    );

    return () => onActionButtons?.(null);
  }, [loading, onActionButtons, refreshNotifications, selectedIds, t]);

  if (!session) return null;

  return (
    <Stack gap={2.25} id="notifications-table">
      {error && <Alert severity="warning">{error}</Alert>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "300px minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            position: { lg: "sticky" },
            top: { lg: 0 },
            bgcolor: "var(--scheme-surface-raised)",
            boxShadow: "var(--scheme-shadow-soft)",
            p: 2,
          }}
        >
          <Stack gap={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Stack direction="row" alignItems="center" gap={1}>
                <TuneIcon sx={{ fontSize: 19, color: "text.secondary" }} />
                <Typography sx={{ fontWeight: 900 }}>{t("notifications", "filters")}</Typography>
              </Stack>
              <Button
                variant="text"
                size="small"
                onClick={resetFilters}
                disabled={loading}
                sx={{ minWidth: 0, px: 0.5, fontWeight: 900, textTransform: "none" }}
              >
                {t("notifications", "clearAll")}
              </Button>
            </Stack>

            {loading ? (
              <FilterPanelSkeleton />
            ) : (
              <>
            <Box>
              <Typography sx={{ mb: 1, fontSize: 11, fontWeight: 900, color: "text.secondary", textTransform: "uppercase" }}>
                {t("notifications", "status")}
              </Typography>
              <Stack gap={0.5}>
                {statusOptions.map((option) => {
                  const active = status === option;
                  const tone = statusTone[option];
                  return (
                    <Button
                      key={option}
                      fullWidth
                      variant="text"
                      onClick={() => setStatus(option)}
                      sx={{
                        position: "relative",
                        justifyContent: "space-between",
                        minHeight: 34,
                        borderRadius: 1,
                        px: 1,
                        py: 0.75,
                        textTransform: "none",
                        fontWeight: 800,
                        color: "text.primary",
                        bgcolor: active ? tone.soft : "transparent",
                        borderLeft: "3px solid",
                        borderLeftColor: active ? tone.accent : "transparent",
                        "&:hover": { bgcolor: active ? tone.soft : "var(--scheme-surface-raised-muted)" },
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={1}>
                        <FiberManualRecordIcon sx={{ fontSize: 10, color: tone.accent }} />
                        <Typography component="span" sx={{  fontWeight: active ? 500 : 400 }}>
                          {t("notifications", `status${option}`)}
                        </Typography>
                      </Stack>
                      <Typography component="span" sx={{ }}>
                        {statusCounts[option]}
                      </Typography>
                    </Button>
                  );
                })}
              </Stack>
             
            </Box>

            <Divider />

            <Box>
              <Typography sx={{ mb: 1, color: "text.secondary" }}>
                {t("notifications", "severity")}
              </Typography>
              <Stack gap={0.5}>
                <Button
                  fullWidth
                  variant="text"
                  onClick={() => setSeverity("all")}
                  sx={{
                    justifyContent: "space-between",
                    minHeight: 34,
                    borderRadius: 1,
                    px: 1,
                    py: 0.75,
                    textTransform: "none",
                    color: "text.primary",
                    bgcolor: severity === "all" ? "var(--scheme-surface-raised-muted)" : "transparent",
                    borderLeft: "3px solid",
                    borderLeftColor: severity === "all" ? "var(--scheme-neutral-500)" : "transparent",
                    "&:hover": { bgcolor: "var(--scheme-surface-raised-muted)" },
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    <FiberManualRecordIcon sx={{ fontSize: 10, color: "var(--scheme-neutral-500)" }} />
                    <Typography component="span" sx={{  fontWeight: severity === "all" ? 500 : 400 }}>
                      {t("notifications", "all")}
                    </Typography>
                  </Stack>
                  <Typography component="span" >
                    {items.length}
                  </Typography>
                </Button>
                {severityOptions.filter((option) => option !== "all").map((option) => {
                  const active = severity === option;
                  const tone = severityTone[option];
                  return (
                    <Button
                      key={option}
                      fullWidth
                      variant="text"
                      onClick={() => setSeverity(option)}
                      sx={{
                        justifyContent: "space-between",
                        minHeight: 34,
                        borderRadius: 1,
                        px: 1,
                        py: 0.75,
                        textTransform: "none",
                        color: active ? tone.text : "text.primary",
                        bgcolor: active ? tone.soft : "transparent",
                        borderLeft: "3px solid",
                        borderLeftColor: active ? tone.accent : "transparent",
                        "&:hover": { bgcolor: active ? tone.soft : "var(--scheme-surface-raised-muted)" },
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={1}>
                        <FiberManualRecordIcon sx={{ fontSize: 10, color: tone.accent }} />
                        <Typography component="span" sx={{  fontWeight: active ? 600 : 400 }}>
                          {t("notifications", `severity${option}`)}
                        </Typography>
                      </Stack>
                      <Typography component="span" >
                        {severityCounts[option]}
                      </Typography>
                    </Button>
                  );
                })}

              </Stack>
            </Box>

            <Divider />

            <Stack gap={1.6}>
              <Box>
                <Typography sx={{ mb: 0.75, color: "text.secondary" }}>
                  {t("notifications", "type")}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: 1,
                      bgcolor: type === "all" ? "transparent" : "var(--scheme-surface-raised-muted)",
                      "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: 1, py: 1 },
                    }}
                    renderValue={(selected) => (
                      <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
                        <CategoryIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography sx={{  fontWeight: selected === "all" ? 700 : 900 }} noWrap>
                          {labelize(String(selected))}
                        </Typography>
                      </Stack>
                    )}
                  >
                    {typeOptions.map((option) => (
                      <MenuItem key={option} value={option}>{labelize(option)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <Typography sx={{ mb: 0.75, color: "text.secondary" }}>
                  {t("notifications", "category")}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: 1,
                      bgcolor: category === "all" ? "transparent" : "var(--scheme-surface-raised-muted)",
                      "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: 1, py: 1 },
                    }}
                    renderValue={(selected) => (
                      <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
                        <CategoryIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography sx={{  fontWeight: selected === "all" ? 700 : 900 }} noWrap>
                          {labelize(String(selected))}
                        </Typography>
                      </Stack>
                    )}
                  >
                    {categoryOptions.map((option) => (
                      <MenuItem key={option} value={option}>{labelize(option)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <Typography sx={{ mb: 0.75, color: "text.secondary" }}>
                  {t("notifications", "source")}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: 1,
                      bgcolor: sourceType === "all" ? "transparent" : "var(--scheme-surface-raised-muted)",
                      "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: 1, py: 1 },
                    }}
                    renderValue={(selected) => (
                      <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
                        <SourceIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography sx={{  fontWeight: selected === "all" ? 700 : 900 }} noWrap>
                          {labelize(String(selected))}
                        </Typography>
                      </Stack>
                    )}
                  >
                    {sourceTypeOptions.map((option) => (
                      <MenuItem key={option} value={option}>{labelize(option)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>

              </>
            )}
          </Stack>
        </Paper>

        <Stack gap={1} minWidth={0}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 1.5,
              py: 1.25,
              bgcolor: "var(--scheme-surface-raised)",
              boxShadow: "var(--scheme-shadow-soft)",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={1.25}>
              {loading ? (
                <NotificationHeaderSkeleton />
              ) : (
                <Stack direction="row" alignItems="center" gap={1.25} minWidth={0}>
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={selectedIds.length > 0 && !allVisibleSelected}
                    onChange={toggleAll}
                    inputProps={{ "aria-label": t("notifications", "selectVisible") }}
                    sx={{ p: 0.5 }}
                  />
                  <Box minWidth={0}>
                    <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {selectedIds.length > 0 ? t("notifications", "selectedCount", { count: selectedIds.length }) : t("notifications", "title")}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {t("notifications", "pageSummary", { unread: unreadCount, total: items.length })}
                    </Typography>
                  </Box>
                </Stack>
              )}
           
            </Stack>
          </Paper>

          {loading ? (
            <NotificationCardsSkeleton />
          ) : (
            <>
          {items.length === 0 && (
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: "center", bgcolor: "var(--scheme-surface-raised)" }}>
                <NotificationsActiveIcon sx={{ fontSize: 38, color: "text.disabled", mb: 1 }} />
                <Typography sx={{ fontWeight: 900 }}>{t("notifications", "emptyFiltered")}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
                  {t("notifications", "emptyHint")}
                </Typography>
              </Paper>
            )}

          {items.map((item) => {
            const tone = severityTone[item.severity];
            const categoryStyle = categoryTone[item.category] ?? {
              bg: "var(--scheme-surface-raised-muted)",
              color: "var(--scheme-neutral-300)",
              border: "var(--scheme-neutral-800)",
            };
            const selected = selectedSet.has(item.id);
            return (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 2,
                  bgcolor: "var(--scheme-surface-raised)",
                  borderColor: selected ? tone.accent : item.readAt ? "divider" : "color-mix(in srgb, var(--scheme-brand-600) 34%, var(--scheme-neutral-800))",
                  boxShadow: selected ? "var(--scheme-shadow-medium)" : "var(--scheme-shadow-soft)",
                  opacity: item.dismissedAt ? 0.68 : 1,
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: "var(--scheme-shadow-medium)",
                  },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: "0 auto 0 0",
                    width: 4,
                    bgcolor: tone.accent,
                  },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" },
                    gap: 1.25,
                    px: { xs: 1.25, md: 1.5 },
                    py: { xs: 1.25, md: 1.35 },
                    pl: { xs: 1.75, md: 2 },
                    background: item.readAt ? "transparent" : tone.soft,
                  }}
                >
                  <Checkbox
                    checked={selected}
                    onChange={() => toggleOne(item.id)}
                    inputProps={{ "aria-label": t("notifications", "selectNotification", { title: item.title }) }}
                    sx={{ alignSelf: "start", mt: -0.5 }}
                  />

                  <Stack gap={0.9} minWidth={0}>
                    <Stack direction="row" gap={1} alignItems="flex-start" justifyContent="space-between">
                      <Box minWidth={0}>
                        <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mb: 0.45 }}>
                          {!item.readAt && (
                            <Chip
                              size="small"
                              label={t("notifications", "statusunread")}
                              sx={{
                                height: 20,
                                borderRadius: 1,
                                fontWeight: 600,
                                color: "var(--scheme-brand-600)",
                                bgcolor: "var(--scheme-brand-600-15)",
                                "& .MuiChip-label": { px: 0.9 },
                              }}
                            />
                          )}
                          <Chip
                            size="small"
                            color={severityColor[item.severity]}
                            label={t("notifications", `severity${item.severity}`)}
                            sx={{ height: 20, fontWeight: 600, borderRadius: 1, "& .MuiChip-label": { px: 0.9 } }}
                          />
                          <Chip
                            size="small"
                            icon={<CategoryIcon sx={{ fontSize: "15px !important" }} />}
                            label={labelize(item.category)}
                            sx={{
                              height: 20,
                              borderRadius: 1,
                              fontWeight: 500,
                              bgcolor: categoryStyle.bg,
                              color: categoryStyle.color,
                              border: `1px solid ${categoryStyle.border}`,
                              "& .MuiChip-icon": { color: categoryStyle.color },
                              "& .MuiChip-label": { px: 0.9 },
                            }}
                          />
                        </Stack>
                        <Typography sx={{ fontWeight: item.readAt ? 500 : 600, lineHeight: 1.3 }} variant="subtitle2">
                          {item.title}
                        </Typography>
                      </Box>
                    </Stack>

                    {item.body && (
                      <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.45 }}>
                        {item.body}
                      </Typography>
                    )}

                    <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                      <Chip
                        size="small"
                        label={labelize(item.type)}
                        sx={{ height: 20, borderRadius: 1, bgcolor: "var(--scheme-surface-raised-muted)", fontWeight: 500, maxWidth: "100%", "& .MuiChip-label": { px: 0.9 } }}
                      />
                      <Chip
                        size="small"
                        icon={<SourceIcon sx={{ fontSize: "15px !important" }} />}
                        label={labelize(item.sourceType ?? "unknown")}
                        sx={{ height: 20, borderRadius: 1, bgcolor: "rgba(143,67,167,0.10)", color: "var(--scheme-accent-600)", fontWeight: 500, "& .MuiChip-label": { px: 0.9 } }}
                      />
                      <Chip
                        size="small"
                        icon={<AccessTimeIcon sx={{ fontSize: "15px !important" }} />}
                        label={compactDate(item.lastSeenAt)}
                        title={formatDate(item.lastSeenAt)}
                        sx={{ height: 20, borderRadius: 1, bgcolor: "var(--scheme-surface-raised-muted)", fontWeight: 500, "& .MuiChip-label": { px: 0.9 } }}
                      />
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: "row", md: "column" }}
                    gap={0.75}
                    alignItems={{ xs: "center", md: "flex-end" }}
                    justifyContent="space-between"
                    sx={{ gridColumn: { xs: "2 / 3", md: "auto" } }}
                  >
                    <Typography color="text.secondary" variant="caption" sx={{ whiteSpace: "nowrap" }}>
                      {formatDate(item.lastSeenAt)}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={t("notifications", "openTarget")}
                      disabled={!item.actionUrl}
                      onClick={() => void openNotification(item)}
                      sx={{
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "var(--scheme-surface-raised)",
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Stack>
                </Box>
              </Paper>
            );
          })}
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
