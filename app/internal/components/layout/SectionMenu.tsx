"use client";

import {
  Tooltip,
  Button,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import type { SessionState } from "../../lib/authSession";
import {
  SimulationsIcon,
  UsersIcon,
  AgenciesIcon,
  ClientsIcon,
  BaseValuesIcon,
  AuditLogsIcon,
  EmailLogsIcon,
  AnalyticsIcon,
  LogoutIcon,
  ConfigurationsIcon,
} from "../ui/icons";
import { useI18n } from "../../../../src/lib/i18n-context";

export type AppSection = "simulations" | "users" | "agencies" | "clients" | "base-values" | "logs" | "analytics" | "configurations";

// Static English labels kept for non-UI uses (routes, test-ids, etc.)
export const sectionLabel: Record<AppSection, string> = {
  simulations: "Simulations",
  users: "Users",
  agencies: "Agencies",
  clients: "Clients",
  "base-values": "Base Values",
  logs: "System Logs",
  analytics: "Analytics",
  configurations: "Configurations",
};

// Maps kebab-case AppSection keys to camelCase nav translation keys
const sectionNavKey: Record<AppSection, string> = {
  simulations: "simulations",
  users: "users",
  agencies: "agencies",
  clients: "clients",
  "base-values": "baseValues",
  logs: "logs",
  analytics: "analytics",
  configurations: "configurations",
};

export const sectionDescription: Record<AppSection, string> = {
  simulations: "Create, update, share and archive simulation records with expiration control.",
  users: "Manage user identities, roles and PIN rotation under strict RBAC boundaries.",
  agencies: "Control agency activation and ownership scope for operational teams.",
  clients: "Manage client accounts linked to agencies for simulation assignment.",
  "base-values": "Manage base value sets, item payloads and active versions used in simulation calculations.",
  logs: "Review audit logs, email logs, and cron job execution logs for governance and compliance monitoring.",
  analytics: "Track simulation performance and access metrics for operational decisions.",
  configurations: "Manage system settings, PDF templates, email templates and other configurable definitions.",
};

export const sectionRoute: Record<AppSection, string> = {
  simulations: "/internal/simulations",
  users: "/internal/users",
  agencies: "/internal/agencies",
  clients: "/internal/clients",
  "base-values": "/internal/base-values",
  logs: "/internal/logs",
  analytics: "/internal/analytics",
  configurations: "/internal/configurations",
};

export const sectionPrimaryAction: Record<AppSection, { label: string; targetId: string }> = {
  simulations: { label: "New Simulation", targetId: "simulations-create-form" },
  users: { label: "New User", targetId: "users-create-form" },
  agencies: { label: "New Agency", targetId: "agencies-create-form" },
  clients: { label: "New Client", targetId: "clients-create-form" },
  "base-values": { label: "New Base Value Set", targetId: "base-values-create-form" },
  logs: { label: "View System Logs", targetId: "system-logs-table" },
  analytics: { label: "Refresh Metrics", targetId: "analytics-panel" },
  configurations: { label: "System Settings", targetId: "configurations-panel" },
};

export const sectionIcon: Record<AppSection, React.FC<{ className?: string }>> = {
  simulations: SimulationsIcon,
  users: UsersIcon,
  agencies: AgenciesIcon,
  clients: ClientsIcon,
  "base-values": BaseValuesIcon,
  logs: AuditLogsIcon,
  analytics: AnalyticsIcon,
  configurations: ConfigurationsIcon,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function SectionMenu({
  section,
  canSeeUsersSection,
  canSeeAgenciesSection,
  canSeeClientsSection,
  canSeeBaseValuesSection,
  canSeeLogsSection,
  canViewAnalytics,
  canSeeConfigurationsSection,
  onNavigate,
  onLogout,
  session,
  collapsed,
}: {
  section: AppSection;
  canSeeUsersSection: boolean;
  canSeeAgenciesSection: boolean;
  canSeeClientsSection: boolean;
  canSeeBaseValuesSection: boolean;
  canSeeLogsSection: boolean;
  canViewAnalytics: boolean;
  canSeeConfigurationsSection: boolean;
  onNavigate: (section: AppSection) => void;
  onLogout: () => void;
  session: SessionState;
  collapsed: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();

  const items = (Object.keys(sectionLabel) as AppSection[])
    .filter((item) => item !== "configurations")
    .filter((item) => {
      if (item === "users" && !canSeeUsersSection) return false;
      if (item === "agencies" && !canSeeAgenciesSection) return false;
      if (item === "clients" && !canSeeClientsSection) return false;
      if (item === "base-values" && !canSeeBaseValuesSection) return false;
      if (item === "logs" && !canSeeLogsSection) return false;
      if (item === "analytics" && !canViewAnalytics) return false;
      return true;
    });

  const ConfigIcon = sectionIcon["configurations"];
  const isConfigurationsActive = section === "configurations";

  return (
    <>
      <Box
        component="nav"
        role="navigation"
        aria-label="Internal app sections"
        sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--scheme-neutral-600)",
            px: 2,
            py: 0.75,
            opacity: collapsed ? 0 : 1,
            height: collapsed ? 0 : "auto",
            overflow: "hidden",
            transition: "opacity 180ms ease, height 220ms ease",
          }}
        >
          Menu
        </Typography>
        <List sx={{ flex: 1, px: 1, py: 0, overflowY: "auto", overflowX: "hidden" }}>
          {items.map((item) => {
            const Icon = sectionIcon[item];
            const isActive = section === item;
            const label = t("nav", sectionNavKey[item]);
            return (
              <ListItem key={item} disablePadding sx={{ mb: 0.25 }}>
                <Tooltip
                  title={label}
                  placement="right"
                  disableHoverListener={!collapsed}
                  arrow
                >
                  <ListItemButton
                    data-testid={`nav-${item}`}
                    onClick={() => onNavigate(item)}
                    selected={isActive}
                    sx={{
                      borderRadius: 1.5,
                      gap: 1.25,
                      py: 1.125,
                      px: 1,
                      borderLeft: "3px solid transparent",
                      borderLeftColor: isActive ? "primary.main" : "transparent",
                      justifyContent: collapsed ? "center" : "flex-start",
                      "&.Mui-selected": {
                        bgcolor: "rgba(255, 50, 84, 0.08)",
                        color: "var(--scheme-brand-600)",
                        fontWeight: 600,
                        "&:hover": {
                          bgcolor: "rgba(255, 50, 84, 0.12)",
                        },
                      },
                      "&:hover": {
                        bgcolor: "var(--scheme-neutral-1100)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: "auto",
                        opacity: isActive ? 1 : 0.65,
                        color: isActive ? "var(--scheme-brand-600)" : "var(--scheme-neutral-400)",
                        transition: "opacity 150ms",
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    <ListItemText
                      primary={label}
                      sx={{
                        m: 0,
                        opacity: collapsed ? 0 : 1,
                        maxWidth: collapsed ? 0 : 180,
                        overflow: "hidden",
                        transition: "opacity 180ms ease, max-width 220ms ease",
                        "& .MuiListItemText-primary": {
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "var(--scheme-brand-600)" : "var(--scheme-neutral-400)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <div className="app-user-card">
        {/* Configurations menu item — ADMIN only */}
        {canSeeConfigurationsSection && (
          <List sx={{ px: 1, py: 0, mb: 0.25 }}>
            <ListItem disablePadding>
              <Tooltip
                title={t("nav", "configurations")}
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <ListItemButton
                  data-testid="nav-configurations"
                  onClick={() => onNavigate("configurations")}
                  selected={isConfigurationsActive}
                  sx={{
                    borderRadius: 1.5,
                    gap: 1.25,
                    py: 1.125,
                    px: 1,
                    borderLeft: "3px solid transparent",
                    borderLeftColor: isConfigurationsActive ? "primary.main" : "transparent",
                    justifyContent: collapsed ? "center" : "flex-start",
                    "&.Mui-selected": {
                      bgcolor: "rgba(255, 50, 84, 0.08)",
                      color: "var(--scheme-brand-600)",
                      fontWeight: 600,
                      "&:hover": {
                        bgcolor: "rgba(255, 50, 84, 0.12)",
                      },
                    },
                    "&:hover": {
                      bgcolor: "var(--scheme-neutral-1100)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: "auto",
                      opacity: isConfigurationsActive ? 1 : 0.65,
                      color: isConfigurationsActive
                        ? "var(--scheme-brand-600)"
                        : "var(--scheme-neutral-400)",
                      transition: "opacity 150ms",
                    }}
                  >
                    <ConfigIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={t("nav", "configurations")}
                    sx={{
                      m: 0,
                      opacity: collapsed ? 0 : 1,
                      maxWidth: collapsed ? 0 : 180,
                      overflow: "hidden",
                      transition: "opacity 180ms ease, max-width 220ms ease",
                      "& .MuiListItemText-primary": {
                        fontSize: 14,
                        fontWeight: isConfigurationsActive ? 600 : 500,
                        color: isConfigurationsActive
                          ? "var(--scheme-brand-600)"
                          : "var(--scheme-neutral-400)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </List>
        )}

        {/* Language toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0.5 : 0.75,
            px: collapsed ? 1 : 1.5,
            py: 0.75,
            mb: 0.5,
            justifyContent: "center",
            flexDirection: collapsed ? "column" : "row",
          }}
        >
          {!collapsed && (
            <Box component="span" sx={{ fontSize: 11, color: "var(--scheme-neutral-500)", mr: 0.25 }}>
              Lang
            </Box>
          )}
          <Tooltip title="English" placement="right">
            <Button
              onClick={() => setLocale("en")}
              variant={locale === "en" ? "contained" : "outlined"}
              size="small"
              sx={{
                minWidth: collapsed ? 32 : 36,
                minHeight: collapsed ? 32 : 36,
                width: collapsed ? 32 : 36,
                height: collapsed ? 32 : 36,
                p: 0.5,
                fontSize: collapsed ? 16 : 18,
                lineHeight: 1,
                borderRadius: 1.5,
                borderWidth: 2,
                borderColor: locale === "en" ? "primary.main" : "transparent",
                bgcolor: locale === "en" ? "rgba(255, 50, 84, 0.08)" : "var(--scheme-neutral-1100)",
                opacity: locale === "en" ? 1 : 0.5,
                transform: locale === "en" ? "scale(1.05)" : "scale(1)",
                transition: "all 0.2s ease",
                boxShadow: locale === "en" ? 1 : 0,
                "&:hover": {
                  opacity: 0.8,
                  transform: "scale(1.05)",
                  borderColor: locale === "en" ? "primary.main" : "var(--scheme-neutral-800)",
                  bgcolor: locale === "en" ? "rgba(255, 50, 84, 0.12)" : "var(--scheme-neutral-1000)",
                },
              }}
            >
              🇬🇧
            </Button>
          </Tooltip>
          <Tooltip title="Español" placement="right">
            <Button
              onClick={() => setLocale("es")}
              variant={locale === "es" ? "contained" : "outlined"}
              size="small"
              sx={{
                minWidth: collapsed ? 32 : 36,
                minHeight: collapsed ? 32 : 36,
                width: collapsed ? 32 : 36,
                height: collapsed ? 32 : 36,
                p: 0.5,
                fontSize: collapsed ? 16 : 18,
                lineHeight: 1,
                borderRadius: 1.5,
                borderWidth: 2,
                borderColor: locale === "es" ? "primary.main" : "transparent",
                bgcolor: locale === "es" ? "rgba(255, 50, 84, 0.08)" : "var(--scheme-neutral-1100)",
                opacity: locale === "es" ? 1 : 0.5,
                transform: locale === "es" ? "scale(1.05)" : "scale(1)",
                transition: "all 0.2s ease",
                boxShadow: locale === "es" ? 1 : 0,
                "&:hover": {
                  opacity: 0.8,
                  transform: "scale(1.05)",
                  borderColor: locale === "es" ? "primary.main" : "var(--scheme-neutral-800)",
                  bgcolor: locale === "es" ? "rgba(255, 50, 84, 0.12)" : "var(--scheme-neutral-1000)",
                },
              }}
            >
              🇪🇸
            </Button>
          </Tooltip>
        </Box>

        <Box sx={{ display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center", gap: collapsed ? 1 : 0.5, px: collapsed ? 1 : 0 }}>
          <Tooltip
            title="My Profile"
            placement="right"
            disableHoverListener={!collapsed}
            arrow
          >
            <Box
              component="button"
              onClick={() => router.push("/internal/profile")}
              data-testid="nav-profile"
              sx={{
                background: "none",
                border: "none",
                padding: collapsed ? 0.5 : "6px 4px",
                cursor: "pointer",
                flex: collapsed ? "0" : 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
                textAlign: "left",
                borderRadius: 1.5,
                transition: "background 0.15s",
                width: collapsed ? "auto" : "100%",
                justifyContent: collapsed ? "center" : "flex-start",
                "&:hover": {
                  bgcolor: "var(--scheme-neutral-1100)",
                },
              }}
            >
              <Box
                className="app-user-avatar"
                aria-hidden="true"
                sx={{
                  width: collapsed ? 32 : 30,
                  height: collapsed ? 32 : 30,
                  flexShrink: 0,
                }}
              >
                {getInitials(session.user.fullName)}
              </Box>
              {!collapsed && (
                <Box className="app-user-detail" sx={{ flex: 1, overflow: "hidden" }}>
                  <Box className="app-user-name">{session.user.fullName}</Box>
                  <Box className="app-user-role">{session.user.role}</Box>
                </Box>
              )}
            </Box>
          </Tooltip>
          <Tooltip
            title={t("actions", "signOut")}
            placement="right"
            arrow
          >
            <Box
              component="button"
              onClick={onLogout}
              data-testid="logout-button"
              sx={{
                background: "none",
                border: "none",
                p: collapsed ? 1 : 0.75,
                cursor: "pointer",
                color: "var(--scheme-neutral-500)",
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
                minWidth: collapsed ? 32 : "auto",
                minHeight: collapsed ? 32 : "auto",
                "&:hover": {
                  bgcolor: "var(--scheme-neutral-1100)",
                  color: "var(--scheme-neutral-200)",
                },
              }}
            >
              <Box className="nav-icon" sx={{ display: "flex" }}>
                <LogoutIcon />
              </Box>
            </Box>
          </Tooltip>
        </Box>
      </div>
    </>
  );
}
