"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";
import {
  listNotifications,
  markNotifications,
  type NotificationItem,
  type NotificationSeverity,
} from "../../lib/internalApi";
import { useRequestCachePolicy } from "../hooks/useRequestCachePolicy";

const severityTone: Record<NotificationSeverity, { color: "default" | "info" | "success" | "warning" | "error"; accent: string }> = {
  INFO: { color: "info", accent: "#2F80ED" },
  SUCCESS: { color: "success", accent: "#219653" },
  WARNING: { color: "warning", accent: "#F2C94C" },
  ERROR: { color: "error", accent: "#EB5757" },
  CRITICAL: { color: "error", accent: "#9B1C31" },
};

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(Math.floor(diffMs / 60_000), 0);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationBell({
  token,
  role,
  surface = "topbar",
  collapsed = false,
}: {
  token: string;
  role: string;
  surface?: "topbar" | "sidebar";
  collapsed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("notifications");
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const isVisible =
    role === "SYS_ADMIN" && (surface === "sidebar" || !pathname.startsWith("/internal/notifications"));
  const queryKey = useMemo(() => ["notifications", token, { limit: 10 }] as const, [token]);

  const { data, error: queryError, isFetching, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => listNotifications(token, { limit: 10 }),
    enabled: isVisible,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const loading = isLoading || (isFetching && !data);
  const error = data?.unavailable
    ? t("notifications", "migrationPending")
    : queryError
      ? queryError instanceof Error
        ? queryError.message
        : t("notifications", "loadFailed")
      : null;

  const refreshNotifications = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications", token] });
    await refetch();
  }, [queryClient, refetch, token]);

  const sortedItems = useMemo(() => {
    const rank: Record<NotificationSeverity, number> = {
      CRITICAL: 5,
      ERROR: 4,
      WARNING: 3,
      INFO: 2,
      SUCCESS: 1,
    };
    return [...items].sort((a, b) => {
      const severityDiff = rank[b.severity] - rank[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
  }, [items]);

  const handleMark = async (
    notification: NotificationItem,
    action: "read" | "dismiss",
  ) => {
    await markNotifications(token, [notification.id], action);
    await refreshNotifications();
  };

  const handleOpen = async (notification: NotificationItem) => {
    if (!notification.readAt) {
      await markNotifications(token, [notification.id], "read").catch(() => undefined);
    }
    if (notification.actionUrl) {
      void queryClient.invalidateQueries({ queryKey: ["notifications", token] });
      router.push(notification.actionUrl);
      setAnchorEl(null);
    } else {
      await refreshNotifications();
    }
  };

  const handleSeeAll = () => {
    router.push("/internal/notifications");
    setAnchorEl(null);
  };

  if (!isVisible) return null;

  const open = Boolean(anchorEl);
  const popoverAnchorOrigin =
    surface === "sidebar"
      ? ({ vertical: "top", horizontal: collapsed ? "right" : "left" } as const)
      : ({ vertical: "bottom", horizontal: "right" } as const);
  const popoverTransformOrigin =
    surface === "sidebar"
      ? ({ vertical: "bottom", horizontal: collapsed ? "left" : "left" } as const)
      : ({ vertical: "top", horizontal: "right" } as const);

  return (
    <Box className={`notification-bell ${surface}${collapsed ? " collapsed" : ""}`}>
      <IconButton
        size="small"
        aria-label={t("notifications", "title")}
        aria-expanded={open}
        onClick={(event) => {
          setAnchorEl(open ? null : event.currentTarget);
          if (!open) void refetch();
        }}
        sx={{
          width: 36,
          height: 36,
          color: "var(--scheme-neutral-500)",
          backgroundColor: "transparent",
          transition: "background-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
          "&:hover": {
            color: "var(--scheme-neutral-300)",
            backgroundColor: "var(--scheme-neutral-1000)",
            boxShadow: "none",
          },
        }}
      >
        <Badge color="error" badgeContent={unreadCount} max={9}>
          <NotificationsIcon color="primary" />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={popoverAnchorOrigin}
        transformOrigin={popoverTransformOrigin}
        slotProps={{ paper: { sx: { overflow: "visible", borderRadius: 2 } } }}
      >
        <Paper
          role="dialog"
          aria-label={t("notifications", "title")}
          elevation={8}
          sx={{
            width: 392,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "min(580px, calc(100vh - 86px))",
            overflow: "hidden",
            border: "1px solid color-mix(in srgb, var(--scheme-neutral-800) 82%, transparent)",
            backgroundColor: "var(--scheme-neutral-1200)",
            boxShadow: "0 22px 70px rgba(15, 23, 42, 0.22), 0 2px 10px rgba(15, 23, 42, 0.08)",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: "1px solid var(--scheme-neutral-900)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--scheme-brand-600) 5%, transparent), transparent)",
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: 0 }}>
                {t("notifications", "title")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("notifications", "summary", { unread: unreadCount, total: items.length })}
              </Typography>
            </Box>
            <IconButton
              aria-label={t("notifications", "refresh")}
              size="small"
              onClick={() => void refreshNotifications()}
              sx={{
                color: "primary.main",
                border: "1px solid var(--scheme-neutral-900)",
                width: 32,
                height: 32,
              }}
            >
              <RefreshIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Stack>

          {error && (
            <Typography sx={{ px: 2, py: 2.5, color: "text.secondary", fontSize: 13, textAlign: "center" }}>
              {error}
            </Typography>
          )}
          {!error && loading && items.length === 0 && (
            <Typography sx={{ px: 2, py: 2.5, color: "text.secondary", fontSize: 13, textAlign: "center" }}>
              {t("notifications", "loading")}
            </Typography>
          )}
          {!error && !loading && sortedItems.length === 0 && (
            <Typography sx={{ px: 2, py: 2.5, color: "text.secondary", fontSize: 13, textAlign: "center" }}>
              {t("notifications", "emptyActive")}
            </Typography>
          )}

          {!error && sortedItems.length > 0 && (
            <Stack sx={{ maxHeight: 418, overflowY: "auto" }}>
              {sortedItems.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  gap={1}
                  sx={{
                    position: "relative",
                    px: 1.75,
                    py: 1.35,
                    pl: 2.25,
                    borderBottom: "1px solid var(--scheme-neutral-1000)",
                    backgroundColor: item.readAt
                      ? "var(--scheme-neutral-1100)"
                      : "color-mix(in srgb, var(--scheme-brand-600) 4%, var(--scheme-neutral-1200))",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: severityTone[item.severity].accent,
                    },
                    "&:hover": {
                      backgroundColor: "var(--scheme-neutral-1000)",
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 0.75 }}>
                      <Chip
                        size="small"
                        label={t("notifications", `severity${item.severity}`)}
                        color={severityTone[item.severity].color}
                        sx={{ height: 20, fontSize: 11, fontWeight: 800, borderRadius: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeTime(item.lastSeenAt)}
                      </Typography>
                    </Stack>
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => void handleOpen(item)}
                      sx={{
                        width: "100%",
                        border: 0,
                        background: "transparent",
                        color: "text.primary",
                        cursor: "pointer",
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.35,
                        p: 0,
                        textAlign: "left",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {item.title}
                    </Typography>
                    {item.body && (
                      <Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 12, lineHeight: 1.45 }}>
                        {item.body}
                      </Typography>
                    )}
                  </Box>
                  <Stack gap={0.5}>
                    {item.actionUrl && (
                      <IconButton size="small" aria-label={t("notifications", "openTarget")} onClick={() => void handleOpen(item)}>
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                    {!item.readAt && (
                      <IconButton size="small" aria-label={t("notifications", "markRead")} onClick={() => void handleMark(item, "read")}>
                        <CheckIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                    <IconButton size="small" aria-label={t("notifications", "dismiss")} onClick={() => void handleMark(item, "dismiss")}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              px: 1.5,
              py: 1.25,
              borderTop: "1px solid var(--scheme-neutral-900)",
              backgroundColor: "var(--scheme-neutral-1100)",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {t("notifications", "showingLatest", { count: items.length })}
            </Typography>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              onClick={handleSeeAll}
              sx={{ fontWeight: 800 }}
            >
              {t("notifications", "seeAll")}
            </Button>
          </Stack>
        </Paper>
      </Popover>
    </Box>
  );
}
