"use client";

import { createContext, useContext } from "react";
import type { PermissionKey } from "./permissionsDefinitions";
import { ROLE_PERMISSION_DEFAULTS } from "./permissionsDefinitions";

export interface RolePermissionItem {
  role: string;
  permissionKey: string;
  allowed: boolean;
}

/**
 * Builds a lookup map from a flat list of DB permission records.
 * Key format: "ROLE::permissionKey"
 */
export function buildPermissionMap(
  items: RolePermissionItem[],
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const item of items) {
    map.set(`${item.role}::${item.permissionKey}`, item.allowed);
  }
  return map;
}

interface PermissionsContextValue {
  /**
   * Returns true if the given role is allowed the given permission.
   * ADMIN is always granted. Falls back to ROLE_PERMISSION_DEFAULTS if
   * permissions haven't loaded yet.
   */
  canDo: (role: string, key: PermissionKey) => boolean;
  /** True once the first API fetch has completed */
  loaded: boolean;
  /** Raw items from the API (used by the editor UI) */
  rawItems: RolePermissionItem[];
}

const PermissionsContext = createContext<PermissionsContextValue>({
  canDo: (role, key) => {
    if (role === "ADMIN") return true;
    return ROLE_PERMISSION_DEFAULTS[role]?.[key] ?? false;
  },
  loaded: false,
  rawItems: [],
});

export const usePermissions = () => useContext(PermissionsContext);

export { PermissionsContext };
