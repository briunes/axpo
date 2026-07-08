"use client";

import { sectionIcon } from "./SectionMenu";
import { sectionRoute, type AppSection } from "./SectionMenu";
import { useI18n } from "../../../../src/lib/i18n-context";
import { MenuIcon } from "../ui/icons";
import { Box, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useRouter } from "next/navigation";
import type { TopBarBreadcrumb } from "../InternalWorkspace";

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

export function TopBar({
  section,
  onRefresh,
  onMobileMenuToggle,
  actionButtons,
  breadcrumbs,
}: {
  section: AppSection | null;
  onRefresh: () => void;
  onMobileMenuToggle: () => void;
  actionButtons?: React.ReactNode;
  breadcrumbs?: TopBarBreadcrumb[] | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const Icon = section ? sectionIcon[section] : null;
  const sectionLabel = section ? t("nav", sectionNavKey[section]) : "";
  const pathItems: TopBarBreadcrumb[] = breadcrumbs?.length
    ? [
        ...(section ? [{ label: sectionLabel, href: sectionRoute[section] }] : []),
        ...breadcrumbs,
      ]
    : [];

  const handleNavigate = (href?: string) => {
    if (!href) return;
    router.push(href);
  };

  return (
    <div className="app-topbar">
      <div className="topbar-left">
        <button
          className="topbar-icon-btn topbar-hamburger"
          onClick={onMobileMenuToggle}
          aria-label={t("common", "toggleMenu")}
        >
          <MenuIcon />
        </button>
        {Icon && (
          <span className="topbar-section-icon">
            <Icon />
          </span>
        )}
        {pathItems.length > 0 ? (
          <nav className="topbar-breadcrumbs" aria-label={t("nav", "breadcrumb")}>
            {pathItems.map((item, index) => {
              const isLast = index === pathItems.length - 1;
              return (
                <span className="topbar-breadcrumb-item" key={index}>
                  {index > 0 && <ChevronRightIcon className="topbar-breadcrumb-separator" fontSize="small" />}
                  <Box
                    component="button"
                    className={`topbar-breadcrumb-link${isLast ? " current" : ""}`}
                    onClick={() => handleNavigate(isLast ? undefined : item.href)}
                    disabled={isLast || !item.href}
                    aria-current={isLast ? "page" : undefined}
                    sx={{ color: !isLast ? "primary.main" : 'inherit' }}
                  >
                    <Typography component="span" variant="body2" sx={{ fontWeight: isLast ? 'inherit' : 500 }}>
                      {item.label}
                    </Typography>
                  </Box>
                </span>
              );
            })}
          </nav>
        ) : sectionLabel ? (
          <Typography component="span" variant="body2" className="topbar-section-title" sx={{ fontWeight: 500 }}>
            {sectionLabel}
          </Typography>
        ) : null}
      </div>
      <div className="topbar-right">
        {actionButtons}
      </div>
    </div>
  );
}
