"use client";

import { IconButton, Tooltip, Typography } from "@mui/material";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { useI18n } from "../../../../src/lib/i18n-context";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SidebarHeader({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarHeaderProps) {
  const { t } = useI18n();

  const handleToggle = () => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
      return;
    }

    onToggle();
  };

  return (
    <div className="app-sidebar-header">
      <button
        className="app-sidebar-logo"
        onClick={collapsed ? onToggle : undefined}
        style={{
          cursor: collapsed ? 'pointer' : 'default',
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: '100%',
        }}
        type="button"
        aria-label={collapsed ? t("common", "expandSidebar") : undefined}
      >
        <div className="app-sidebar-logo-mark">
          <img
            src={collapsed ? "/axpo-mark.svg" : "/axpo-logo.svg"}
            alt="AXPO"
            width={collapsed ? 20 : 88}
            height={collapsed ? 42 : 42}
            style={{
              display: "block",
              width: collapsed ? 42 : 88,
              height: "auto",
              maxWidth: "none",
            }}
          />
        </div>
        <div className="app-sidebar-logo-text">
          <Typography component="div" variant="caption" className="sidebar-logo-sub">
            {t("common", "simulator")}
          </Typography>
        </div>
      </button>
      <Tooltip title={mobileOpen ? t("common", "close") : collapsed ? t("common", "expandSidebar") : t("common", "minimizeSidebar")}>
        <IconButton
          className="app-toggle-btn"
          size="small"
          onClick={handleToggle}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Tooltip>
    </div>
  );
}
