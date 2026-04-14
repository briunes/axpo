"use client";

import { Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";
import type { SessionState } from "../../lib/authSession";
import {
  SimulationsIcon,
  UsersIcon,
  AgenciesIcon,
  ClientsIcon,
  BaseValuesIcon,
  AuditLogsIcon,
  AnalyticsIcon,
  LogoutIcon,
  ConfigurationsIcon,
} from "../ui/icons";
import { useI18n } from "../../../../src/lib/i18n-context";

export type AppSection = "simulations" | "users" | "agencies" | "clients" | "base-values" | "audit-logs" | "analytics" | "configurations";

// Static English labels kept for non-UI uses (routes, test-ids, etc.)
export const sectionLabel: Record<AppSection, string> = {
  simulations: "Simulations",
  users: "Users",
  agencies: "Agencies",
  clients: "Clients",
  "base-values": "Base Values",
  "audit-logs": "Audit Logs",
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
  "audit-logs": "auditLogs",
  analytics: "analytics",
  configurations: "configurations",
};

export const sectionDescription: Record<AppSection, string> = {
  simulations: "Create, update, share and archive simulation records with expiration control.",
  users: "Manage user identities, roles and PIN rotation under strict RBAC boundaries.",
  agencies: "Control agency activation and ownership scope for operational teams.",
  clients: "Manage client accounts linked to agencies for simulation assignment.",
  "base-values": "Manage base value sets, item payloads and active versions used in simulation calculations.",
  "audit-logs": "Review immutable events and access traces for governance and compliance monitoring.",
  analytics: "Track simulation performance and access metrics for operational decisions.",
  configurations: "Manage system settings, PDF templates, email templates and other configurable definitions.",
};

export const sectionRoute: Record<AppSection, string> = {
  simulations: "/internal/simulations",
  users: "/internal/users",
  agencies: "/internal/agencies",
  clients: "/internal/clients",
  "base-values": "/internal/base-values",
  "audit-logs": "/internal/audit-logs",
  analytics: "/internal/analytics",
  configurations: "/internal/configurations",
};

export const sectionPrimaryAction: Record<AppSection, { label: string; targetId: string }> = {
  simulations: { label: "New Simulation", targetId: "simulations-create-form" },
  users: { label: "New User", targetId: "users-create-form" },
  agencies: { label: "New Agency", targetId: "agencies-create-form" },
  clients: { label: "New Client", targetId: "clients-create-form" },
  "base-values": { label: "New Base Value Set", targetId: "base-values-create-form" },
  "audit-logs": { label: "Jump to Audit Table", targetId: "audit-logs-table" },
  analytics: { label: "Refresh Metrics", targetId: "analytics-panel" },
  configurations: { label: "System Settings", targetId: "configurations-panel" },
};

export const sectionIcon: Record<AppSection, React.FC<{ className?: string }>> = {
  simulations: SimulationsIcon,
  users: UsersIcon,
  agencies: AgenciesIcon,
  clients: ClientsIcon,
  "base-values": BaseValuesIcon,
  "audit-logs": AuditLogsIcon,
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
  canSeeAuditLogsSection,
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
  canSeeAuditLogsSection: boolean;
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
      if (item === "audit-logs" && !canSeeAuditLogsSection) return false;
      if (item === "analytics" && !canViewAnalytics) return false;
      return true;
    });

  const ConfigIcon = sectionIcon["configurations"];
  const isConfigurationsActive = section === "configurations";

  return (
    <>
      <nav className="app-nav" role="navigation" aria-label="Internal app sections">
        <span className="app-nav-section-title">Menu</span>
        {items.map((item) => {
          const Icon = sectionIcon[item];
          const isActive = section === item;
          const label = t("nav", sectionNavKey[item]);
          return (
            <Tooltip
              key={item}
              title={label}
              placement="right"
              disableHoverListener={!collapsed}
              arrow
            >
              <button
                className={`app-nav-item${isActive ? " active" : ""}`}
                data-testid={`nav-${item}`}
                onClick={() => onNavigate(item)}
              >
                <span className="nav-icon">
                  <Icon />
                </span>
                <span className="app-nav-label">{label}</span>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="app-user-card">
        {/* Configurations menu item — ADMIN only */}
        {canSeeConfigurationsSection && (
          <Tooltip
            title={t("nav", "configurations")}
            placement="right"
            disableHoverListener={!collapsed}
            arrow
          >
            <button
              className={`app-nav-item${isConfigurationsActive ? " active" : ""}`}
              data-testid="nav-configurations"
              onClick={() => onNavigate("configurations")}
              style={{ marginBottom: "8px" }}
            >
              <span className="nav-icon">
                <ConfigIcon />
              </span>
              <span className="app-nav-label">{t("nav", "configurations")}</span>
            </button>
          </Tooltip>
        )}

        {/* Language toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: collapsed ? "6px 0" : "6px 12px",
            marginBottom: 4,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginRight: 4 }}>
              Lang
            </span>
          )}
          <button
            onClick={() => setLocale("en")}
            style={{
              fontSize: 11,
              fontWeight: locale === "en" ? 700 : 400,
              padding: "2px 7px",
              borderRadius: 4,
              border: locale === "en" ? "1.5px solid var(--scheme-brand-500)" : "1px solid var(--scheme-neutral-300)",
              background: locale === "en" ? "var(--scheme-brand-100)" : "transparent",
              color: locale === "en" ? "var(--scheme-brand-600)" : "var(--scheme-neutral-500)",
              cursor: "pointer",
              lineHeight: "1.6",
            }}
            title="English"
          >
            {t("language", "en")}
          </button>
          <button
            onClick={() => setLocale("es")}
            style={{
              fontSize: 11,
              fontWeight: locale === "es" ? 700 : 400,
              padding: "2px 7px",
              borderRadius: 4,
              border: locale === "es" ? "1.5px solid var(--scheme-brand-500)" : "1px solid var(--scheme-neutral-300)",
              background: locale === "es" ? "var(--scheme-brand-100)" : "transparent",
              color: locale === "es" ? "var(--scheme-brand-600)" : "var(--scheme-neutral-500)",
              cursor: "pointer",
              lineHeight: "1.6",
            }}
            title="Español"
          >
            {t("language", "es")}
          </button>
        </div>

        <Tooltip
          title="My Profile"
          placement="right"
          disableHoverListener={!collapsed}
          arrow
        >
          <button
            className="app-user-inner"
            onClick={() => router.push("/internal/profile")}
            data-testid="nav-profile"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              borderRadius: 8,
              transition: "background 0.15s",
            }}
          >
            <div className="app-user-avatar" aria-hidden="true">
              {getInitials(session.user.fullName)}
            </div>
            <div className="app-user-detail">
              <div className="app-user-name">{session.user.fullName}</div>
              <div className="app-user-role">{session.user.role}</div>
            </div>
          </button>
        </Tooltip>
        <Tooltip
          title={t("actions", "signOut")}
          placement="right"
          disableHoverListener={!collapsed}
          arrow
        >
          <button
            className="app-nav-item"
            onClick={onLogout}
            data-testid="logout-button"
            style={{ color: "var(--scheme-neutral-500)" }}
          >
            <span className="nav-icon"><LogoutIcon /></span>
            <span className="app-nav-label">{t("actions", "signOut")}</span>
          </button>
        </Tooltip>
      </div>
    </>
  );
}
