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
        }}
        type="button"
        aria-label={collapsed ? t("common", "expandSidebar") : undefined}
      >
        <div className="app-sidebar-logo-mark">
          <img src="/axpo-mark.svg" alt="AXPO" width={20} height={20} style={{ display: "block" }} />
        </div>
        <div className="app-sidebar-logo-text">
          <Typography component="div" variant="body2" className="sidebar-logo-title" sx={{ fontWeight: 700 }}>
            AXPO
          </Typography>
          <Typography component="div" variant="caption" className="sidebar-logo-sub">
            Simulator
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
