"use client";

import { useCallback, useEffect, useState, createContext, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { Text } from "@once-ui-system/core";
import { clearSession, loadSession, type SessionState } from "../lib/authSession";
import { listRolePermissions } from "../lib/internalApi";
import {
  PermissionsContext,
  buildPermissionMap,
  type RolePermissionItem,
} from "../lib/permissionsContext";
import { ROLE_PERMISSION_DEFAULTS, type PermissionKey } from "../lib/permissionsDefinitions";
import { TopBar, SectionMenu, SidebarHeader, type AppSection } from "./layout";
import { useUserPreferences } from "./providers/UserPreferencesProvider";
import { ForbiddenState, LoadingState } from "./shared";
import { Toast, useToast } from "./ui";

export type { AppSection };

// Context for action buttons
const ActionButtonsContext = createContext<((buttons: React.ReactNode) => void) | null>(null);

export function useActionButtons() {
  return useContext(ActionButtonsContext);
}

// Context for the TopBar Refresh button — pages register their own refresh fn
const RefreshContext = createContext<((handler: () => void) => void) | null>(null);

/** Call this inside a page to wire its refresh handler to the TopBar Refresh button. */
export function useRegisterRefresh(handler: () => void) {
  const register = useContext(RefreshContext);
  // Use a ref so changes to handler don't cause re-registration loops
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!register) return;
    register(() => handlerRef.current());
  }, [register]);
}

export function InternalWorkspace({ section, children }: { section: AppSection; children?: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [permItems, setPermItems] = useState<RolePermissionItem[]>([]);
  const [permLoaded, setPermLoaded] = useState(false);
  const [actionButtons, setActionButtons] = useState<React.ReactNode>(null);

  const handleActionButtons = useCallback((buttons: React.ReactNode) => {
    console.log('Setting action buttons:', buttons);
    setActionButtons(buttons);
  }, []);

  useEffect(() => {
    setMounted(true);
    const s = loadSession();
    setSession(s);
    setSessionChecked(true);
    if (!s) router.replace("/internal/login");
  }, [router]);

  // Load role permissions from DB after session is confirmed
  useEffect(() => {
    if (!session) return;
    listRolePermissions(session.token)
      .then((items) => {
        setPermItems(items);
        setPermLoaded(true);
      })
      .catch(() => {
        // Fall back to hardcoded defaults silently
        setPermLoaded(true);
      });
  }, [session?.token]);

  useEffect(() => {
    if (mounted) {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored !== null) setCollapsed(stored === "true");
    }
  }, [mounted]);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const { preferences } = useUserPreferences();

  // Pages register their refresh handler via useRegisterRefresh so the TopBar
  // Refresh button delegates to the currently active page's data hook.
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(null);
  const handleRegisterRefresh = useCallback((handler: () => void) => {
    setRefreshHandler(() => handler);
  }, []);

  const { messages: toastMessages, dismissToast, showSuccess, showError } = useToast();

  const handleLogout = () => {
    clearSession();
    router.replace("/internal/login");
  };

  const handleNavigate = (target: AppSection) => {
    const routes: Record<AppSection, string> = {
      simulations: "/internal/simulations",
      users: "/internal/users",
      agencies: "/internal/agencies",
      clients: "/internal/clients",
      "base-values": "/internal/base-values",
      logs: "/internal/logs",
      analytics: "/internal/analytics",
      configurations: "/internal/configurations",
    };
    router.push(routes[target]);
  };

  // Build a canDo helper backed by DB permissions (with fallback to defaults).
  // Must be defined before any early returns to satisfy Rules of Hooks.
  const permMap = buildPermissionMap(permItems);
  const canDo = useCallback(
    (userRole: string, key: PermissionKey): boolean => {
      if (userRole === "ADMIN") return true;
      const dbKey = `${userRole}::${key}`;
      if (permMap.has(dbKey)) return permMap.get(dbKey) === true;
      return ROLE_PERMISSION_DEFAULTS[userRole]?.[key] ?? false;
    },
    [permItems], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!mounted || !sessionChecked) return null;
  if (!session) return null;

  const role = session.user.role;

  // Wait for DB permissions to load before rendering the menu.
  // ADMIN skips this gate — canDo always returns true for them.
  if (role !== "ADMIN" && !permLoaded) return null;

  // Section-level access guard — fully driven by DB permissions (canDo handles ADMIN)
  const sectionAllowed: Record<string, boolean> = {
    simulations: canDo(role, "section.simulations"),
    users: canDo(role, "section.users"),
    agencies: canDo(role, "section.agencies"),
    clients: canDo(role, "section.clients"),
    "base-values": canDo(role, "section.base-values"),
    logs: canDo(role, "section.audit-logs") || canDo(role, "section.email-logs"),
    analytics: canDo(role, "section.analytics"),
    configurations: canDo(role, "section.configurations"),
  };
  if (!sectionAllowed[section]) {
    return (
      <div className="app-shell">
        <aside className={`app-sidebar${collapsed ? " collapsed" : ""}`}>
          <SidebarHeader collapsed={collapsed} onToggle={handleToggle} />
          <SectionMenu
            section={section}
            canSeeUsersSection={canDo(role, "section.users")}
            canSeeAgenciesSection={canDo(role, "section.agencies")}
            canSeeClientsSection={canDo(role, "section.clients")}
            canSeeBaseValuesSection={canDo(role, "section.base-values")}
            canSeeLogsSection={canDo(role, "section.audit-logs") || canDo(role, "section.email-logs")}
            canViewAnalytics={canDo(role, "section.analytics")}
            canSeeConfigurationsSection={canDo(role, "section.configurations")}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            session={session}
            collapsed={collapsed}
          />
        </aside>
        <div className="app-main">
          <TopBar
            section={section}
            onRefresh={() => { }}
            onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
            actionButtons={null}
          />
          <main className="app-content">
            <ForbiddenState section={section} />
          </main>
        </div>
      </div>
    );
  }

  const permissionsContextValue = {
    canDo,
    loaded: permLoaded,
    rawItems: permItems,
  };

  return (
    <PermissionsContext.Provider value={permissionsContextValue}>
      <RefreshContext.Provider value={handleRegisterRefresh}>
        <ActionButtonsContext.Provider value={handleActionButtons}>
          <div className="app-shell">
            <Toast messages={toastMessages} onDismiss={dismissToast} />
            {mobileMenuOpen && (
              <div
                className="app-sidebar-overlay visible"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
            )}

            <aside className={`app-sidebar${collapsed ? " collapsed" : ""}${mobileMenuOpen ? " mobile-open" : ""}`}>
              <SidebarHeader collapsed={collapsed} onToggle={handleToggle} />
              <SectionMenu
                section={section}
                canSeeUsersSection={canDo(role, "section.users")}
                canSeeAgenciesSection={canDo(role, "section.agencies")}
                canSeeClientsSection={canDo(role, "section.clients")}
                canSeeBaseValuesSection={canDo(role, "section.base-values")}
                canSeeLogsSection={canDo(role, "section.audit-logs") || canDo(role, "section.email-logs")}
                canViewAnalytics={canDo(role, "section.analytics")}
                canSeeConfigurationsSection={canDo(role, "section.configurations")}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                session={session}
                collapsed={collapsed}
              />
            </aside>

            <div className="app-main">
              <TopBar
                section={section}
                onRefresh={() => refreshHandler?.()}
                onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
                actionButtons={actionButtons}
              />
              <main className="app-content">
                {children}
              </main>
            </div>
          </div>
        </ActionButtonsContext.Provider>
      </RefreshContext.Provider>
    </PermissionsContext.Provider>
  );
}
