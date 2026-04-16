/**
 * Central registry of all permission keys, their labels, and default values
 * per role. ADMIN is always granted all permissions and cannot be changed.
 */

export type PermissionKey =
  // ── Section access ──────────────────────────────────────────────────────
  | "section.simulations"
  | "section.users"
  | "section.agencies"
  | "section.clients"
  | "section.base-values"
  | "section.audit-logs"
  | "section.email-logs"
  | "section.analytics"
  | "section.configurations"
  // ── Simulation actions ───────────────────────────────────────────────────
  | "simulations.create"
  | "simulations.share"
  | "simulations.duplicate"
  | "simulations.archive"
  | "simulations.delete"
  | "simulations.edit_payload"
  // ── Client actions ────────────────────────────────────────────────────────
  | "clients.view"
  | "clients.create"
  | "clients.edit"
  | "clients.delete"
  // ── User management ───────────────────────────────────────────────────────
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.deactivate"
  // ── Agency management ─────────────────────────────────────────────────────
  | "agencies.view"
  | "agencies.create"
  | "agencies.edit"
  | "agencies.deactivate";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  /** If true, always admin-only — toggle is shown but locked */
  adminOnly?: boolean;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "sections",
    label: "Section Access",
    permissions: [
      {
        key: "section.simulations",
        label: "Simulations",
        description: "Access the simulations section",
      },
      {
        key: "section.clients",
        label: "Clients",
        description: "Access the clients management section",
      },
      {
        key: "section.base-values",
        label: "Base Values",
        description: "Access price base value sets",
      },
      {
        key: "section.audit-logs",
        label: "Audit Logs",
        description: "View system audit log entries",
      },
      {
        key: "section.email-logs",
        label: "Email Logs",
        description: "View email delivery logs and status (admin only)",
        adminOnly: true,
      },
      {
        key: "section.analytics",
        label: "Analytics & Reports",
        description: "Access analytics dashboard and reports",
      },
      {
        key: "section.users",
        label: "Users",
        description: "Access users management (admin only)",
        adminOnly: true,
      },
      {
        key: "section.agencies",
        label: "Agencies",
        description: "Access agencies management (admin only)",
        adminOnly: true,
      },
      {
        key: "section.configurations",
        label: "Configurations",
        description: "Access system configurations (admin only)",
        adminOnly: true,
      },
    ],
  },
  {
    id: "simulations",
    label: "Simulation Actions",
    permissions: [
      {
        key: "simulations.create",
        label: "Create simulations",
        description: "Create new simulations from scratch or via OCR",
      },
      {
        key: "simulations.share",
        label: "Share simulations",
        description: "Generate and share public simulation links",
      },
      {
        key: "simulations.duplicate",
        label: "Duplicate simulations",
        description: "Clone existing simulations",
      },
      {
        key: "simulations.archive",
        label: "Archive simulations",
        description: "Soft-archive (hide) simulations",
      },
      {
        key: "simulations.edit_payload",
        label: "Edit simulation data",
        description: "Modify simulation payload and calculation inputs",
      },
      {
        key: "simulations.delete",
        label: "Hard delete simulations",
        description: "Permanently delete simulations (admin only)",
        adminOnly: true,
      },
    ],
  },
  {
    id: "clients",
    label: "Client Actions",
    permissions: [
      {
        key: "clients.view",
        label: "View clients",
        description: "View the client list and client details",
      },
      {
        key: "clients.create",
        label: "Create clients",
        description: "Create new client records",
      },
      {
        key: "clients.edit",
        label: "Edit clients",
        description: "Edit existing client details",
      },
      {
        key: "clients.delete",
        label: "Delete clients",
        description: "Permanently delete client records",
      },
    ],
  },
  {
    id: "users",
    label: "User Management",
    permissions: [
      {
        key: "users.view",
        label: "View users",
        description: "View the user list and user profiles (admin only)",
        adminOnly: true,
      },
      {
        key: "users.create",
        label: "Create users",
        description: "Create new user accounts (admin only)",
        adminOnly: true,
      },
      {
        key: "users.edit",
        label: "Edit users",
        description: "Edit user details and passwords (admin only)",
        adminOnly: true,
      },
      {
        key: "users.deactivate",
        label: "Deactivate users",
        description: "Activate or deactivate user accounts (admin only)",
        adminOnly: true,
      },
    ],
  },
  {
    id: "agencies",
    label: "Agency Management",
    permissions: [
      {
        key: "agencies.view",
        label: "View agencies",
        description: "View the agency list and agency details (admin only)",
        adminOnly: true,
      },
      {
        key: "agencies.create",
        label: "Create agencies",
        description: "Create new agency records (admin only)",
        adminOnly: true,
      },
      {
        key: "agencies.edit",
        label: "Edit agencies",
        description: "Edit existing agency details (admin only)",
        adminOnly: true,
      },
      {
        key: "agencies.deactivate",
        label: "Deactivate agencies",
        description: "Activate or deactivate agencies (admin only)",
        adminOnly: true,
      },
    ],
  },
];

/**
 * Fallback defaults used while permissions are loading from the API,
 * and as the source of truth for the initial DB seed.
 */
export const ROLE_PERMISSION_DEFAULTS: Record<
  string,
  Record<PermissionKey, boolean>
> = {
  ADMIN: {
    "section.simulations": true,
    "section.users": true,
    "section.agencies": true,
    "section.clients": true,
    "section.base-values": true,
    "section.audit-logs": true,
    "section.email-logs": true,
    "section.analytics": true,
    "section.configurations": true,
    "simulations.create": true,
    "simulations.share": true,
    "simulations.duplicate": true,
    "simulations.archive": true,
    "simulations.delete": true,
    "simulations.edit_payload": true,
    "clients.view": true,
    "clients.create": true,
    "clients.edit": true,
    "clients.delete": true,
    "users.view": true,
    "users.create": true,
    "users.edit": true,
    "users.deactivate": true,
    "agencies.view": true,
    "agencies.create": true,
    "agencies.edit": true,
    "agencies.deactivate": true,
  },
  AGENT: {
    "section.simulations": true,
    "section.users": false,
    "section.agencies": false,
    "section.clients": true,
    "section.base-values": true,
    "section.audit-logs": true,
    "section.email-logs": false,
    "section.analytics": true,
    "section.configurations": false,
    "simulations.create": true,
    "simulations.share": true,
    "simulations.duplicate": true,
    "simulations.archive": true,
    "simulations.delete": false,
    "simulations.edit_payload": true,
    "clients.view": true,
    "clients.create": true,
    "clients.edit": true,
    "clients.delete": false,
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.deactivate": false,
    "agencies.view": false,
    "agencies.create": false,
    "agencies.edit": false,
    "agencies.deactivate": false,
  },
  COMMERCIAL: {
    "section.simulations": true,
    "section.users": false,
    "section.agencies": false,
    "section.clients": false,
    "section.base-values": false,
    "section.audit-logs": false,
    "section.email-logs": false,
    "section.analytics": false,
    "section.configurations": false,
    "simulations.create": true,
    "simulations.share": true,
    "simulations.duplicate": true,
    "simulations.archive": true,
    "simulations.delete": false,
    "simulations.edit_payload": true,
    "clients.view": true,
    "clients.create": false,
    "clients.edit": false,
    "clients.delete": false,
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.deactivate": false,
    "agencies.view": false,
    "agencies.create": false,
    "agencies.edit": false,
    "agencies.deactivate": false,
  },
};
