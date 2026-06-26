"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import type { SessionState } from "../../lib/authSession";
import {
    listRolePermissions,
    updateRolePermissions,
    type RolePermissionItem,
} from "../../lib/internalApi";
import {
    LOG_PERMISSION_KEYS,
    PERMISSION_GROUPS,
    ROLE_PERMISSION_DEFAULTS,
    type PermissionKey,
} from "../../lib/permissionsDefinitions";

interface RolePermissionsEditorProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type PermState = Record<string, Record<string, boolean>>;

const EDITABLE_ROLES = ["AGENT", "COMMERCIAL"] as const;
const SAVE_ROLES = ["ADMIN", "AGENT", "COMMERCIAL"] as const;
const SESSION_PERMISSION_KEY = "users.sessions.manage" as const;
const isLogPermission = (permissionKey: PermissionKey) =>
    LOG_PERMISSION_KEYS.includes(permissionKey);

const isSessionPermissionLocked = (role: string, permissionKey: PermissionKey) => {
    if (permissionKey !== SESSION_PERMISSION_KEY) return false;
    return role === "AGENT" || role === "COMMERCIAL" || role === "AGENT_MASTER";
};

const isPermissionLocked = (
    role: string,
    permissionKey: PermissionKey,
    adminOnly?: boolean,
) => {
    if (role === "SYS_ADMIN") return true;
    if (role === "ADMIN") return !isLogPermission(permissionKey);
    if (adminOnly && (role === "AGENT" || role === "COMMERCIAL" || role === "AGENT_MASTER")) {
        return true;
    }
    return isSessionPermissionLocked(role, permissionKey);
};

function buildState(items: RolePermissionItem[]): PermState {
    const state: PermState = {
        ADMIN: { ...ROLE_PERMISSION_DEFAULTS.ADMIN },
        AGENT: { ...ROLE_PERMISSION_DEFAULTS.AGENT },
        COMMERCIAL: { ...ROLE_PERMISSION_DEFAULTS.COMMERCIAL },
    };
    for (const item of items) {
        if (!state[item.role]) state[item.role] = {};
        state[item.role][item.permissionKey] = item.allowed;
    }

    if (state.AGENT) {
        state.AGENT[SESSION_PERMISSION_KEY] = false;
    }

    if (state.COMMERCIAL) {
        state.COMMERCIAL[SESSION_PERMISSION_KEY] = false;
    }

    return state;
}

export function RolePermissionsEditor({
    session,
    onNotify,
}: RolePermissionsEditorProps) {
    const { t } = useI18n();
    const getRoleLabel = (role: string) => {
        if (role === "AGENT") return t("rolePermissionsModule", "roleLabelAgent");
        if (role === "COMMERCIAL") return t("rolePermissionsModule", "roleLabelCommercial");
        if (role === "SYS_ADMIN") return t("rolePermissionsModule", "roleLabelSysAdmin");
        return t("rolePermissionsModule", "roleLabelAdmin");
    };
    const getPermLabel = (key: PermissionKey) =>
        t("rolePermissionsModule", `perm_label_${key.replace(/[.\-]/g, "_")}`);
    const getPermDesc = (key: PermissionKey) =>
        t("rolePermissionsModule", `perm_desc_${key.replace(/[.\-]/g, "_")}`);
    const getGroupLabel = (groupId: string) => {
        if (groupId === "sections") return t("rolePermissionsModule", "groupSections");
        if (groupId === "logs") return t("rolePermissionsModule", "groupLogs");
        if (groupId === "simulations") return t("rolePermissionsModule", "groupSimulations");
        if (groupId === "clients") return t("rolePermissionsModule", "groupClients");
        if (groupId === "users") return t("rolePermissionsModule", "groupUsers");
        if (groupId === "agencies") return t("rolePermissionsModule", "groupAgencies");
        return groupId;
    };
    const [state, setState] = useState<PermState>({
        ADMIN: { ...ROLE_PERMISSION_DEFAULTS.ADMIN },
        AGENT: { ...ROLE_PERMISSION_DEFAULTS.AGENT },
        COMMERCIAL: { ...ROLE_PERMISSION_DEFAULTS.COMMERCIAL },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listRolePermissions(session.token)
            .then((items) => {
                if (!cancelled) {
                    setState(buildState(items));
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLoading(false);
                    onNotify(t("rolePermissionsModule", "loadError"), "error");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [session.token]);

    const handleToggle = (role: string, key: PermissionKey, value: boolean) => {
        if (isPermissionLocked(role, key)) {
            return;
        }

        setState((prev) => ({
            ...prev,
            [role]: { ...prev[role], [key]: value },
        }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const updates: Array<{ role: string; permissionKey: string; allowed: boolean }> = [];
        for (const role of SAVE_ROLES) {
            for (const group of PERMISSION_GROUPS) {
                for (const perm of group.permissions) {
                    if (role === "ADMIN" && !isLogPermission(perm.key)) continue;
                    updates.push({
                        role,
                        permissionKey: perm.key,
                        allowed: isPermissionLocked(role, perm.key, perm.adminOnly)
                            ? false
                            : (state[role]?.[perm.key] ?? false),
                    });
                }
            }
        }
        try {
            await updateRolePermissions(session.token, updates);
            setDirty(false);
            onNotify(t("rolePermissionsModule", "savedSuccess"), "success");
        } catch {
            onNotify(t("rolePermissionsModule", "savedError"), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rpe-container">
            {/* Header bar */}
            <div className="rpe-topbar">
                <div>
                    <p className="rpe-description">
                        {t("rolePermissionsModule", "description", { adminRole: t("rolePermissionsModule", "roleLabelAdmin") })}
                    </p>
                </div>
                <div className="configuration-page-actions">
                    <button
                        className={`rpe-save-btn${dirty ? " rpe-save-btn--active" : ""}`}
                        onClick={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving ? (
                            <>
                                <CircularProgress size={14} sx={{ color: "inherit", mr: "6px" }} />
                                {t("rolePermissionsModule", "btnSaving")}
                            </>
                        ) : dirty ? (
                            t("rolePermissionsModule", "btnSave")
                        ) : (
                            t("rolePermissionsModule", "btnSaved")
                        )}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="rpe-loading">
                    <CircularProgress size={28} />
                    <span>{t("rolePermissionsModule", "loading")}</span>
                </div>
            ) : (
                <div className="rpe-matrix">
                    {/* Column headers */}
                    <div className="rpe-matrix-header">
                        <div className="rpe-col-perm-label" />
                        <div className="rpe-col-role rpe-col-role--admin">
                            <span className="rpe-role-chip rpe-role-chip--sys-admin">{t("rolePermissionsModule", "roleLabelSysAdmin")}</span>
                            <span className="rpe-role-locked">{t("rolePermissionsModule", "alwaysGranted")}</span>
                        </div>
                        <div className="rpe-col-role rpe-col-role--admin">
                            <span className="rpe-role-chip rpe-role-chip--admin">{t("rolePermissionsModule", "roleLabelAdmin")}</span>
                            <span className="rpe-role-locked">{t("rolePermissionsModule", "adminLogsConfigurable")}</span>
                        </div>
                        {EDITABLE_ROLES.map((role) => (
                            <div key={role} className="rpe-col-role">
                                <span className={`rpe-role-chip rpe-role-chip--${role.toLowerCase()}`}>
                                    {getRoleLabel(role)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Permission groups */}
                    {PERMISSION_GROUPS.map((group) => (
                        <div key={group.id} className="rpe-group">
                            <div className="rpe-group-title">{getGroupLabel(group.id)}</div>
                            {group.permissions.map((perm) => (
                                <div key={perm.key} className="rpe-row">
                                    {/* Permission label */}
                                    <Tooltip title={getPermDesc(perm.key)} placement="right" arrow>
                                        <div className="rpe-col-perm-label">
                                            <span className="rpe-perm-name">{getPermLabel(perm.key)}</span>
                                        </div>
                                    </Tooltip>

                                    {/* SYS_ADMIN column — always ON, not editable */}
                                    <div className="rpe-col-role rpe-col-role--admin">
                                        <Switch
                                            checked
                                            disabled
                                            size="small"
                                            sx={{ opacity: 0.5 }}
                                        />
                                    </div>

                                    {/* Admin column — configurable for logs only */}
                                    {(() => {
                                        const role = "ADMIN";
                                        const locked = isPermissionLocked(role, perm.key, perm.adminOnly);
                                        const checked = locked ? true : (state[role]?.[perm.key] ?? true);
                                        return (
                                            <div className="rpe-col-role rpe-col-role--admin">
                                                <Switch
                                                    checked={checked}
                                                    disabled={locked}
                                                    size="small"
                                                    color="primary"
                                                    onChange={(_, val) => handleToggle(role, perm.key, val)}
                                                    sx={locked ? { opacity: 0.5 } : undefined}
                                                />
                                            </div>
                                        );
                                    })()}

                                    {/* Editable role columns */}
                                    {EDITABLE_ROLES.map((role) => {
                                        const locked = isPermissionLocked(role, perm.key, perm.adminOnly);
                                        const checked = locked ? false : (state[role]?.[perm.key] ?? false);
                                        return (
                                            <div key={role} className="rpe-col-role">
                                                <Switch
                                                    checked={checked}
                                                    size="small"
                                                    color="primary"
                                                    onChange={(_, val) => handleToggle(role, perm.key, val)}
                                                    disabled={locked}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
        .rpe-container {
          padding: 24px 0 40px;
        }
        .rpe-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .rpe-description {
          font-size: 14px;
                    color: var(--scheme-neutral-500);
          margin: 0;
          line-height: 1.6;
          max-width: 560px;
        }
        .rpe-save-btn {
          padding: 9px 22px;
          border-radius: 8px;
                    border: 1px solid var(--scheme-neutral-900);
                    background: var(--scheme-neutral-1100);
                    color: var(--scheme-neutral-500);
          font-size: 14px;
          font-weight: 600;
          cursor: default;
          display: flex;
          align-items: center;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .rpe-save-btn--active {
                    background: var(--scheme-brand-600);
                    border-color: var(--scheme-brand-600);
          color: #fff;
          cursor: pointer;
        }
        .rpe-save-btn--active:hover:not(:disabled) {
                    background: var(--scheme-brand-700);
        }
        .rpe-save-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .rpe-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 40px 0;
          color: var(--scheme-neutral-500);
          font-size: 14px;
        }
        .rpe-matrix {
                    border: 1px solid var(--scheme-neutral-900);
          border-radius: 12px;
          overflow: hidden;
                    background: var(--scheme-neutral-1200);
        }
        .rpe-matrix-header {
          display: grid;
          grid-template-columns: 1fr 120px 120px 120px 120px;
                    background: var(--scheme-neutral-1100);
                    border-bottom: 1px solid var(--scheme-neutral-900);
          padding: 12px 20px;
          align-items: center;
          gap: 8px;
        }
        .rpe-col-perm-label {
          padding-right: 16px;
          min-width: 0;
        }
        .rpe-col-role {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-align: center;
        }
        .rpe-col-role--admin {
          opacity: 0.7;
        }
        .rpe-role-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .rpe-role-chip--sys-admin {
                    background: rgba(239, 68, 68, 0.16);
                    color: #f87171;
        }
        .rpe-role-chip--admin {
                    background: rgba(245, 158, 11, 0.16);
                    color: #fbbf24;
        }
        .rpe-role-chip--agent {
                    background: rgba(59, 130, 246, 0.16);
                    color: #60a5fa;
        }
        .rpe-role-chip--commercial {
                    background: rgba(168, 85, 247, 0.16);
                    color: #c084fc;
        }
        .rpe-role-locked {
          font-size: 10px;
                    color: var(--scheme-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rpe-group {
                    border-bottom: 1px solid var(--scheme-neutral-900);
        }
        .rpe-group:last-child {
          border-bottom: none;
        }
        .rpe-group-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
                    color: var(--scheme-neutral-600);
          padding: 12px 20px 6px;
                    background: var(--scheme-neutral-1100);
                    border-bottom: 1px solid var(--scheme-neutral-900);
        }
        .rpe-row {
          display: grid;
          grid-template-columns: 1fr 120px 120px 120px 120px;
          align-items: center;
          padding: 4px 20px;
          gap: 8px;
                    border-bottom: 1px solid var(--scheme-neutral-900);
          transition: background 0.1s;
        }
        .rpe-row:last-child {
          border-bottom: none;
        }
        .rpe-row:hover {
                    background: var(--scheme-neutral-1100);
        }
        .rpe-perm-name {
          font-size: 14px;
          font-weight: 500;
                    color: var(--scheme-neutral-300);
        }
        .rpe-admin-badge {
          display: inline-flex;
          margin-left: 8px;
          padding: 1px 7px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          vertical-align: middle;
        }
      `}</style>
        </div>
    );
}
