"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Tooltip,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  SpeedDial,
  SpeedDialAction,
  Typography,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
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
  NotificationsNavIcon,
} from "../ui/icons";
import { useI18n } from "../../../../src/lib/i18n-context";
import { LanguageFlag } from "../../../../src/lib/LanguageFlag";
import { UI_LANGUAGES } from "../../../../src/lib/uiLanguages";
import { useThemeMode } from "../../lib/ThemeModeContext";
import { WhatsNewButton } from "./WhatsNewButton";

export type AppSection = "simulations" | "users" | "agencies" | "clients" | "base-values" | "logs" | "analytics" | "configurations" | "notifications";

const SECTION_KEYS: AppSection[] = [
  "simulations",
  "users",
  "agencies",
  "clients",
  "base-values",
  "logs",
  "analytics",
  "configurations",
  "notifications",
];

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
  notifications: "notifications",
};

export const sectionDescriptionKey: Record<AppSection, string> = {
  simulations: "simulations",
  users: "users",
  agencies: "agencies",
  clients: "clients",
  "base-values": "baseValues",
  logs: "auditLogs",
  analytics: "analytics",
  configurations: "configurations",
  notifications: "notifications",
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
  notifications: "/internal/notifications",
};

export const sectionPrimaryAction: Record<AppSection, { labelKey: string; targetId: string }> = {
  simulations: { labelKey: "newSimulation", targetId: "simulations-create-form" },
  users: { labelKey: "newUser", targetId: "users-create-form" },
  agencies: { labelKey: "newAgency", targetId: "agencies-create-form" },
  clients: { labelKey: "newClient", targetId: "clients-create-form" },
  "base-values": { labelKey: "newBaseValueSet", targetId: "base-values-create-form" },
  logs: { labelKey: "viewSystemLogs", targetId: "system-logs-table" },
  analytics: { labelKey: "refreshMetrics", targetId: "analytics-panel" },
  configurations: { labelKey: "systemSettings", targetId: "configurations-panel" },
  notifications: { labelKey: "refreshNotifications", targetId: "notifications-table" },
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
  notifications: NotificationsNavIcon,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

const LANGUAGE_OPTIONS = UI_LANGUAGES
  .map((language) => ({
    locale: language.code,
    label: language.label,
    shortLabel: language.code.toUpperCase(),
  }));

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
  notificationBell,
}: {
  section: AppSection | null;
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
  notificationBell?: ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const { mode, toggleMode } = useThemeMode();
  const router = useRouter();
  const [languageDialOpen, setLanguageDialOpen] = useState(false);

  const items = SECTION_KEYS
    .filter((item) => item !== "configurations")
    .filter((item) => item !== "notifications")
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
  const activeLanguage = LANGUAGE_OPTIONS.find((option) => option.locale === locale) ?? LANGUAGE_OPTIONS[0];
  const openLanguageDial = () => setLanguageDialOpen(true);
  const closeLanguageDial = () => setLanguageDialOpen(false);
  const quickActionButtonSx = {
    width: 36,
    height: 36,
    minHeight: 36,
    p: 0,
    color: "var(--scheme-neutral-500)",
    backgroundColor: "transparent",
    boxShadow: "none",
    transition: "background-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
    "&:hover": {
      color: "var(--scheme-neutral-300)",
      backgroundColor: "var(--scheme-neutral-1000)",
      boxShadow: "none",
    },
  };

  return (
    <>
      <Box
        component="nav"
        role="navigation"
        aria-label={t("nav", "sectionsLabel")}
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
                        fontWeight: isActive ? 600 : 500,
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

        <Box className={`sidebar-quick-actions${collapsed ? " collapsed" : ""}`}>
          <WhatsNewButton buttonClassName="" buttonSx={quickActionButtonSx} />

          <Tooltip title={mode === "dark" ? t("theme", "lightMode") : t("theme", "darkMode")} placement="right" arrow>
            <IconButton
              size="small"
              onClick={toggleMode}
              aria-label={mode === "dark" ? t("theme", "switchToLight") : t("theme", "switchToDark")}
              sx={quickActionButtonSx}
            >
              {mode === "dark" ? <LightModeIcon color="warning" /> : <DarkModeIcon sx={{ fontSize: 19 }} />}
            </IconButton>
          </Tooltip>

          <Box
            sx={{
              position: "relative",
              width: collapsed ? 130 : 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
            }}
          >
            <SpeedDial
              ariaLabel={t("nav", "languageSelector")}
              icon={
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    width: "100%",
                    height: "100%",
                    fontSize: 21,
                    lineHeight: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LanguageFlag code={activeLanguage.locale} label={activeLanguage.label} width={22} height={15} />
                </Box>
              }
              direction={collapsed ? "right" : "up"}
              open={languageDialOpen}
              onOpen={openLanguageDial}
              onClose={closeLanguageDial}
              FabProps={{
                size: "small",
                sx: {
                  ...quickActionButtonSx,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0,
                },
              }}
              sx={{
                inset: 0,
                width: collapsed ? 36 : 36,
                height: 36,
                overflow: "visible",
                "& .MuiSpeedDial-fab": {
                  position: "absolute",
                  top: 0,
                  left: collapsed ? 47 : 0,
                },
                "& .MuiSpeedDial-actions": {
                  gap: 1,
                  alignItems: "center",
                  ...(collapsed
                    ? {
                        marginLeft: 0,
                      }
                    : {
                        marginBottom: 0,
                      }),
                },
              }}
            >
              {LANGUAGE_OPTIONS.filter((option) => option.locale !== locale).map((option) => (
                <SpeedDialAction
                  key={option.locale}
                  icon={
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        width: "100%",
                        height: "100%",
                        fontSize: 20,
                        lineHeight: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LanguageFlag code={option.locale} label={option.label} width={22} height={15} />
                    </Box>
                  }
                  tooltipTitle={option.label}
                  tooltipPlacement={collapsed ? "top" : "right"}
                  onClick={() => {
                    setLocale(option.locale);
                    closeLanguageDial();
                  }}
                  slotProps={{
                    fab: {
                      sx: {
                        minHeight: 36,
                        p: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 0,
                        boxShadow: "0 5px 14px rgba(16, 24, 40, 0.2)",
                        color: "var(--scheme-neutral-300)",
                        backgroundColor: "var(--scheme-neutral-1200)",
                        border: "1px solid var(--scheme-neutral-800)",
                        transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                        "&:hover": {
                          backgroundColor: "var(--scheme-neutral-1000)",
                          borderColor: "var(--scheme-neutral-700)",
                          boxShadow: "0 7px 18px rgba(16, 24, 40, 0.24)",
                        },
                      },
                    },

                  }}
                />
              ))}
            </SpeedDial>
          </Box>

          {notificationBell}
        </Box>

        <Box sx={{ display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center", gap: collapsed ? 1 : 0.5, px: collapsed ? 1 : 0 }}>
          <Tooltip
            title={t("nav", "myProfile")}
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
