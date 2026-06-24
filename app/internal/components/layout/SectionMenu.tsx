"use client";

import {
  Tooltip,
  Button,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
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
import { useThemeMode } from "../../lib/ThemeModeContext";

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
  const { mode, toggleMode } = useThemeMode();
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

        <List sx={{ flex: 1, px: collapsed ? 1.25 : 1, py: 0, pt: 2, overflowY: "auto", overflowX: "hidden" }}>
          {items.map((item) => {
            const Icon = sectionIcon[item];
            const isActive = section === item;
            const label = t("nav", sectionNavKey[item]);
            return (
              <ListItem key={item} disablePadding sx={{ mb: 0.25, justifyContent: collapsed ? "center" : "stretch" }}>
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
                      borderRadius: collapsed ? "50%" : 1.5,
                      gap: collapsed ? 0 : 1.25,
                      py: collapsed ? 0 : 1.125,
                      px: collapsed ? 0 : 1,
                      width: collapsed ? 36 : "100%",
                      minWidth: collapsed ? 36 : "auto",
                      height: collapsed ? 36 : 36,
                      minHeight: collapsed ? 36 : 36,
                      flex: collapsed ? "0 0 36px" : "1 1 auto",
                      boxSizing: "border-box",
                      justifyContent: collapsed ? "center" : "flex-start",
                      "&.Mui-selected": {
                        bgcolor: "rgba(255, 50, 84, 0.08)",
                        color: "var(--scheme-brand-600)",
                        fontWeight: 600,
                        boxShadow: "inset 2px 0 0 var(--scheme-brand-600)",
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
                        width: collapsed ? 18 : "auto",
                        justifyContent: "center",
                        opacity: isActive ? 1 : 0.65,
                        color: isActive ? "var(--scheme-brand-600)" : "var(--scheme-neutral-400)",
                        transition: "opacity 150ms",
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        opacity: collapsed ? 0 : 1,
                        maxWidth: collapsed ? 0 : 180,
                        overflow: "hidden",
                        fontWeight: isActive ? 600 : 'inherit',
                        color: isActive ? "var(--scheme-brand-600)" : "var(--scheme-neutral-400)",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        transition: "opacity 180ms ease, max-width 220ms ease",
                      }}
                    >
                      {label}
                    </Typography>
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
          <List sx={{ px: collapsed ? 1.25 : 1, py: 0, mb: 0.25 }}>
            <ListItem disablePadding sx={{ justifyContent: collapsed ? "center" : "stretch" }}>
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
                    borderRadius: collapsed ? "50%" : 1.5,
                    gap: collapsed ? 0 : 1.25,
                    py: collapsed ? 0 : 1.125,
                    px: collapsed ? 0 : 1,
                    width: collapsed ? 36 : "100%",
                    minWidth: collapsed ? 36 : "auto",
                    height: collapsed ? 36 : "auto",
                    minHeight: collapsed ? 36 : "auto",
                    flex: collapsed ? "0 0 36px" : "1 1 auto",
                    boxSizing: "border-box",
                    justifyContent: collapsed ? "center" : "flex-start",
                    "&.Mui-selected": {
                      bgcolor: "rgba(255, 50, 84, 0.08)",
                      color: "var(--scheme-brand-600)",
                      fontWeight: 600,
                      boxShadow: "inset 2px 0 0 var(--scheme-brand-600)",
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
                      width: collapsed ? 18 : "auto",
                      justifyContent: "center",
                      opacity: isConfigurationsActive ? 1 : 0.65,
                      color: isConfigurationsActive
                        ? "var(--scheme-brand-600)"
                        : "var(--scheme-neutral-400)",
                      transition: "opacity 150ms",
                    }}
                  >
                    <ConfigIcon />
                  </ListItemIcon>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      opacity: collapsed ? 0 : 1,
                      maxWidth: collapsed ? 0 : 180,
                      overflow: "hidden",
                      fontWeight: isConfigurationsActive ? 600 : 500,
                      color: isConfigurationsActive
                        ? "var(--scheme-brand-600)"
                        : "var(--scheme-neutral-400)",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      transition: "opacity 180ms ease, max-width 220ms ease",
                    }}
                  >
                    {t("nav", "configurations")}
                  </Typography>
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
            <Typography component="span" variant="caption" sx={{ color: "var(--scheme-neutral-500)", mr: 0.25 }}>
              Lang
            </Typography>
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
                borderRadius: collapsed ? "50%" : 1.5,
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
                borderRadius: collapsed ? "50%" : 1.5,
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
          <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"} placement="right">
            <Button
              onClick={toggleMode}
              variant="outlined"
              size="small"
              sx={{
                minWidth: collapsed ? 32 : 36,
                minHeight: collapsed ? 32 : 36,
                width: collapsed ? 32 : 36,
                height: collapsed ? 32 : 36,
                p: 0.5,
                fontSize: collapsed ? 16 : 18,
                lineHeight: 1,
                borderRadius: collapsed ? "50%" : 1.5,
                borderWidth: 2,
                borderColor: "transparent",
                bgcolor: "var(--scheme-neutral-1100)",
                opacity: 0.7,
                transition: "all 0.2s ease",
                "&:hover": {
                  opacity: 1,
                  transform: "scale(1.05)",
                  borderColor: "var(--scheme-neutral-800)",
                  bgcolor: "var(--scheme-neutral-1000)",
                },
              }}
            >
              {mode === "dark" ? "☀️" : "🌙"}
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
                padding: collapsed ? 0 : "6px 4px",
                cursor: "pointer",
                flex: collapsed ? "0" : 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
                textAlign: "left",
                width: collapsed ? 36 : "auto",
                height: collapsed ? 36 : "auto",
                justifyContent: "center",
                borderRadius: collapsed ? "50%" : 1.5,
                color: "var(--scheme-neutral-300)",
                "&:hover": {
                  bgcolor: "var(--scheme-neutral-1100)",
                  color: "var(--scheme-neutral-100)",
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
                  <Typography component="div" variant="body2" className="app-user-name" sx={{ color: "var(--scheme-neutral-100)", fontWeight: 600 }}>{session.user.fullName}</Typography>
                  <Typography component="div" variant="caption" className="app-user-role">{session.user.role === "SYS_ADMIN" ? t("userFormPage", "roleSysAdmin") : session.user.role === "ADMIN" ? t("userFormPage", "roleAdmin") : session.user.role === "AGENT" ? t("userFormPage", "roleAgent") : t("userFormPage", "roleCommercial")}</Typography>
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
                p: collapsed ? 0 : 0.75,
                cursor: "pointer",
                color: "var(--scheme-neutral-500)",
                borderRadius: collapsed ? "50%" : 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
                width: collapsed ? 36 : "auto",
                height: collapsed ? 36 : "auto",
                minWidth: collapsed ? 36 : "auto",
                minHeight: collapsed ? 36 : "auto",
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
