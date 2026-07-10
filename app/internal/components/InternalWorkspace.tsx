"use client";

import { useCallback, useEffect, useState, createContext, useContext, useRef, isValidElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, loadSession, type SessionState } from "../lib/authSession";
import { listRolePermissions, logout } from "../lib/internalApi";
import {
  PermissionsContext,
  buildPermissionMap,
  type RolePermissionItem,
} from "../lib/permissionsContext";
import {
  LOG_PERMISSION_KEYS,
  ROLE_PERMISSION_DEFAULTS,
  type PermissionKey,
} from "../lib/permissionsDefinitions";
import { CommandPalette, TopBar, SectionMenu, SidebarHeader, type AppSection } from "./layout";
import type { GlobalSearchRecentItem } from "./layout/CommandPalette";
import { NotificationBell } from "./layout/NotificationBell";
import { useUserPreferences } from "./providers/UserPreferencesProvider";
import { ForbiddenState, LoadingState } from "./shared";
import { Toast, useToast } from "./ui";

export type { AppSection };

const isElevatedRole = (role: string) => role === "ADMIN" || role === "SYS_ADMIN";
const GLOBAL_SEARCH_RECENTS_STORAGE_KEY = "axpo_global_search_recents";
const SECTION_LABELS: Record<AppSection, string> = {
  simulations: "Simulaciones",
  users: "Usuarios",
  agencies: "Agencias",
  clients: "Clientes",
  "base-values": "Valores base",
  logs: "Logs",
  analytics: "Analytics",
  configurations: "Configuraciones",
  notifications: "Notificaciones",
};

function rememberRecentPage(item: GlobalSearchRecentItem) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(GLOBAL_SEARCH_RECENTS_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as GlobalSearchRecentItem[]) : [];
    const next = [item, ...current.filter((recent) => recent.id !== item.id)].slice(0, 8);
    localStorage.setItem(GLOBAL_SEARCH_RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // recent pages are best-effort only
  }
}

function textFromNode(node: React.ReactNode): string | null {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim() || null;
  }
  if (Array.isArray(node)) {
    const text = node.map(textFromNode).filter(Boolean).join(" ").trim();
    return text || null;
  }
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }
  return null;
}

function getRouteFallbackLabel(pathname: string, section: AppSection, sectionLabel: string) {
  if (pathname === "/internal/simulations/new") return "Nueva simulación";
  if (/^\/internal\/simulations\/[^/]+\/share$/.test(pathname)) return "Compartir simulación";
  if (/^\/internal\/simulations\/[^/]+\/view$/.test(pathname)) return "Simulación compartida";
  if (/^\/internal\/simulations\/[^/]+$/.test(pathname)) return "Simulación";

  if (pathname === "/internal/users/new") return "Nuevo usuario";
  if (/^\/internal\/users\/[^/]+\/edit$/.test(pathname)) return "Usuario";

  if (pathname === "/internal/agencies/new") return "Nueva agencia";
  if (/^\/internal\/agencies\/[^/]+\/edit$/.test(pathname)) return "Agencia";

  if (pathname === "/internal/clients/new") return "Nuevo cliente";
  if (/^\/internal\/clients\/[^/]+\/edit$/.test(pathname)) return "Cliente";

  if (pathname === "/internal/base-values/new") return "Nuevo valor base";
  if (/^\/internal\/base-values\/[^/]+\/edit$/.test(pathname)) return "Valor base";

  return SECTION_LABELS[section] ?? sectionLabel;
}

function buildRecentPageItem(
  pathname: string,
  section: AppSection,
  breadcrumbs: TopBarBreadcrumb[] | null,
): GlobalSearchRecentItem {
  const sectionLabel = SECTION_LABELS[section];
  const breadcrumbLabels = breadcrumbs?.map((breadcrumb) => textFromNode(breadcrumb.label)).filter(Boolean) ?? [];
  const shouldPreferEntityBreadcrumb =
    /^\/internal\/simulations\/[^/]+\/(share|view)$/.test(pathname) && Boolean(breadcrumbLabels[0]);
  const label =
    (shouldPreferEntityBreadcrumb ? breadcrumbLabels[0] : breadcrumbLabels.at(-1)) ??
    getRouteFallbackLabel(pathname, section, sectionLabel);
  const breadcrumbTrail = [sectionLabel, ...breadcrumbLabels].filter(Boolean).join(" / ");

  return {
    id: `page-${pathname}`,
    kind: "page",
    label,
    description: breadcrumbTrail && breadcrumbTrail !== label ? breadcrumbTrail : pathname,
    href: pathname,
  };
}

const isBoneyardBuildMode = () =>
  typeof window !== "undefined" &&
  ((window as typeof window & { __BONEYARD_BUILD?: boolean }).__BONEYARD_BUILD === true ||
    (
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) &&
      window.location.pathname.includes("boneyard-fixture")
    ));

const createBoneyardSession = (): SessionState => ({
  token: "boneyard-fixture-token",
  user: {
    id: "user-skeleton-admin",
    agencyId: "agency-skeleton-primary",
    role: "SYS_ADMIN",
    fullName: "System Admin",
    email: "admin@example.com",
  },
});

// Context for action buttons
const ActionButtonsContext = createContext<((buttons: React.ReactNode) => void) | null>(null);

export function useActionButtons() {
  return useContext(ActionButtonsContext);
}

export interface TopBarBreadcrumb {
  label: React.ReactNode;
  href?: string;
  icon?: React.ElementType<{ className?: string }>;
}

const BreadcrumbsContext = createContext<((breadcrumbs: TopBarBreadcrumb[] | null) => void) | null>(null);

export function useTopBarBreadcrumbs(breadcrumbs: TopBarBreadcrumb[] | null) {
  const setBreadcrumbs = useContext(BreadcrumbsContext);

  useEffect(() => {
    if (!setBreadcrumbs) return;
    setBreadcrumbs(breadcrumbs);
    return () => setBreadcrumbs(null);
  }, [breadcrumbs, setBreadcrumbs]);
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

function WorkspaceLoader({ message }: { message?: string }) {
  return (
    <div className="app-shell">
      <main className="app-content" style={{ width: "100%", display: "grid", placeItems: "center" }}>
        <div style={{ width: "min(420px, 100%)" }}>
          <LoadingState message={message} />
        </div>
      </main>
    </div>
  );
}

export function InternalWorkspace({ section, children }: { section: AppSection | null; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [permItems, setPermItems] = useState<RolePermissionItem[]>([]);
  const [permLoaded, setPermLoaded] = useState(false);
  const [actionButtons, setActionButtons] = useState<React.ReactNode>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<TopBarBreadcrumb[] | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const handleActionButtons = useCallback((buttons: React.ReactNode) => {
    setActionButtons(buttons);
  }, []);

  useEffect(() => {
    setMounted(true);
    const s = loadSession() ?? (isBoneyardBuildMode() ? createBoneyardSession() : null);
    if (s && isBoneyardBuildMode()) {
      localStorage.setItem("axpo.internal.auth.token", s.token);
      localStorage.setItem("axpo.internal.auth.user", JSON.stringify(s.user));
    }
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await logout(session.token);
      } catch {
        // ignore logout API failures, local cleanup still applies
      }
    }

    clearSession();
    router.replace("/internal/login");
  };

  const handleNavigate = (target: AppSection) => {
    setMobileMenuOpen(false);

    const routes: Record<AppSection, string> = {
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
    router.push(routes[target]);
  };

  // Build a canDo helper backed by DB permissions (with fallback to defaults).
  // Must be defined before any early returns to satisfy Rules of Hooks.
  const permMap = buildPermissionMap(permItems);
  const canDo = useCallback(
    (userRole: string, key: PermissionKey): boolean => {
      if (userRole === "SYS_ADMIN") return true;
      if (userRole === "ADMIN" && !LOG_PERMISSION_KEYS.includes(key)) return true;
      const dbKey = `${userRole}::${key}`;
      if (permMap.has(dbKey)) return permMap.get(dbKey) === true;
      return ROLE_PERMISSION_DEFAULTS[userRole]?.[key] ?? false;
    },
    [permItems], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const role = session?.user.role ?? "";

  const canSeeAnyLogs =
    isElevatedRole(role) && LOG_PERMISSION_KEYS.some((key) => canDo(role, key));
  const sectionAllowed: Record<AppSection, boolean> = {
    simulations: canDo(role, "section.simulations"),
    users: canDo(role, "section.users"),
    agencies: canDo(role, "section.agencies"),
    clients: canDo(role, "section.clients"),
    "base-values": canDo(role, "section.base-values"),
    logs: canSeeAnyLogs,
    analytics: canDo(role, "section.analytics"),
    configurations: canDo(role, "section.configurations"),
    notifications: role === "SYS_ADMIN",
  };
  const availableSections = (Object.keys(sectionAllowed) as AppSection[]).filter(
    (key) => sectionAllowed[key],
  );

  useEffect(() => {
    if (!session || !section || !sectionAllowed[section]) return;
    rememberRecentPage(buildRecentPageItem(pathname, section, breadcrumbs));
  }, [breadcrumbs, pathname, section, session?.token, sectionAllowed[section ?? "simulations"]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !sessionChecked) return <WorkspaceLoader />;
  if (!session) return <WorkspaceLoader />;

  // Wait for DB permissions to load before rendering the menu.
  // SYS_ADMIN skips this gate — canDo always returns true for it.
  if (role !== "SYS_ADMIN" && !permLoaded) return <WorkspaceLoader />;

  if (section && !sectionAllowed[section]) {
    return (
      <div className="app-shell">
        {mobileMenuOpen && (
          <div
            className="app-sidebar-overlay visible"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside className={`app-sidebar${collapsed ? " collapsed" : ""}${mobileMenuOpen ? " mobile-open" : ""}`}>
          <SidebarHeader
            collapsed={collapsed}
            onToggle={handleToggle}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
          <SectionMenu
            section={section}
            canSeeUsersSection={canDo(role, "section.users")}
            canSeeAgenciesSection={canDo(role, "section.agencies")}
            canSeeClientsSection={canDo(role, "section.clients")}
            canSeeBaseValuesSection={canDo(role, "section.base-values")}
            canSeeLogsSection={canSeeAnyLogs}
            canViewAnalytics={canDo(role, "section.analytics")}
            canSeeConfigurationsSection={canDo(role, "section.configurations")}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            session={session}
            collapsed={collapsed}
            notificationBell={<NotificationBell token={session.token} role={role} surface="sidebar" collapsed={collapsed} />}
          />
        </aside>
        <div className="app-main">
          <TopBar
            section={section}
            onRefresh={() => { }}
            onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
            actionButtons={null}
            onCommandOpen={() => setCommandOpen(true)}
          />
          <main className="app-content">
            <ForbiddenState section={section} />
          </main>
        </div>
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          availableSections={availableSections}
          token={session.token}
        />
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
          <BreadcrumbsContext.Provider value={setBreadcrumbs}>
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
              <SidebarHeader
                collapsed={collapsed}
                onToggle={handleToggle}
                mobileOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
              />
              <SectionMenu
                section={section}
                canSeeUsersSection={canDo(role, "section.users")}
                canSeeAgenciesSection={canDo(role, "section.agencies")}
                canSeeClientsSection={canDo(role, "section.clients")}
                canSeeBaseValuesSection={canDo(role, "section.base-values")}
                canSeeLogsSection={canSeeAnyLogs}
                canViewAnalytics={canDo(role, "section.analytics")}
                canSeeConfigurationsSection={canDo(role, "section.configurations")}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                session={session}
                collapsed={collapsed}
                notificationBell={<NotificationBell token={session.token} role={role} surface="sidebar" collapsed={collapsed} />}
              />
            </aside>

            <div className="app-main">
              <TopBar
                section={section}
                onRefresh={() => refreshHandler?.()}
                onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
                actionButtons={actionButtons}
                breadcrumbs={breadcrumbs}
                onCommandOpen={() => setCommandOpen(true)}
              />
              <main className="app-content" style={{ marginBottom: '2.4rem' }}>
                {children}
              </main>
            </div>
            <CommandPalette
              open={commandOpen}
              onClose={() => setCommandOpen(false)}
              availableSections={availableSections}
              token={session.token}
            />
          </div>
        </BreadcrumbsContext.Provider>
        </ActionButtonsContext.Provider>
      </RefreshContext.Provider>
    </PermissionsContext.Provider>
  );
}
