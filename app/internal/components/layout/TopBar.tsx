"use client";

import { sectionIcon } from "./SectionMenu";
import type { AppSection } from "./SectionMenu";
import { useI18n } from "../../../../src/lib/i18n-context";
import { MenuIcon } from "../ui/icons";

const sectionNavKey: Record<AppSection, string> = {
  simulations: "simulations",
  users: "users",
  agencies: "agencies",
  clients: "clients",
  "base-values": "baseValues",
  "audit-logs": "auditLogs",
  "email-logs": "emailLogs",
  analytics: "analytics",
  configurations: "configurations",
};

export function TopBar({
  section,
  onRefresh,
  onMobileMenuToggle,
}: {
  section: AppSection;
  onRefresh: () => void;
  onMobileMenuToggle: () => void;
}) {
  const { t } = useI18n();
  const Icon = sectionIcon[section];

  return (
    <div className="app-topbar">
      <div className="topbar-left">
        <button
          className="topbar-icon-btn topbar-hamburger"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <MenuIcon />
        </button>
        <span className="topbar-section-icon">
          <Icon />
        </span>
        <span className="topbar-section-title">{t("nav", sectionNavKey[section])}</span>
      </div>
      <div className="topbar-right">
      </div>
    </div>
  );
}
