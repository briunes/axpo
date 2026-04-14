"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
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
        aria-label={collapsed ? "Expand sidebar" : undefined}
      >
        <div className="app-sidebar-logo-mark">
          <img src="/axpo-mark.svg" alt="AXPO" width={20} height={20} style={{ display: "block" }} />
        </div>
        <div className="app-sidebar-logo-text">
          <div className="sidebar-logo-title">AXPO</div>
          <div className="sidebar-logo-sub">Simulator</div>
        </div>
      </button>
      <button
        className="app-toggle-btn"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        type="button"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>
    </div>
  );
}
