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
        return t("rolePermissionsModule", "roleLabelAdmin");
    };
    const getPermLabel = (key: PermissionKey) =>
        t("rolePermissionsModule", `perm_label_${key.replace(/[.\-]/g, "_")}`);
    const getPermDesc = (key: PermissionKey) =>
        t("rolePermissionsModule", `perm_desc_${key.replace(/[.\-]/g, "_")}`);
    const getGroupLabel = (groupId: string) => {
        if (groupId === "sections") return t("rolePermissionsModule", "groupSections");
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
        setState((prev) => ({
            ...prev,
            [role]: { ...prev[role], [key]: value },
        }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const updates: Array<{ role: string; permissionKey: string; allowed: boolean }> = [];
        for (const role of EDITABLE_ROLES) {
            for (const group of PERMISSION_GROUPS) {
                for (const perm of group.permissions) {
                    updates.push({
                        role,
                        permissionKey: perm.key,
                        allowed: state[role]?.[perm.key] ?? false,
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
                            <span className="rpe-role-chip rpe-role-chip--admin">{t("rolePermissionsModule", "roleLabelAdmin")}</span>
                            <span className="rpe-role-locked">{t("rolePermissionsModule", "alwaysGranted")}</span>
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

                                    {/* Admin column — always ON, not editable */}
                                    <div className="rpe-col-role rpe-col-role--admin">
                                        <Switch
                                            checked
                                            disabled
                                            size="small"
                                            sx={{ opacity: 0.5 }}
                                        />
                                    </div>

                                    {/* Editable role columns */}
                                    {EDITABLE_ROLES.map((role) => {
                                        const checked = state[role]?.[perm.key] ?? false;
                                        return (
                                            <div key={role} className="rpe-col-role">
                                                <Switch
                                                    checked={checked}
                                                    size="small"
                                                    color="primary"
                                                    onChange={(_, val) => handleToggle(role, perm.key, val)}
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
          color: #6b7280;
          margin: 0;
          line-height: 1.6;
          max-width: 560px;
        }
        .rpe-save-btn {
          padding: 9px 22px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          color: #6b7280;
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
          background: #1d4ed8;
          border-color: #1d4ed8;
          color: #fff;
          cursor: pointer;
        }
        .rpe-save-btn--active:hover:not(:disabled) {
          background: #1e40af;
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
          color: #6b7280;
          font-size: 14px;
        }
        .rpe-matrix {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }
        .rpe-matrix-header {
          display: grid;
          grid-template-columns: 1fr 120px 120px 120px;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
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
        .rpe-role-chip--admin {
          background: #fef3c7;
          color: #92400e;
        }
        .rpe-role-chip--agent {
          background: #dbeafe;
          color: #1e40af;
        }
        .rpe-role-chip--commercial {
          background: #f3e8ff;
          color: #6b21a8;
        }
        .rpe-role-locked {
          font-size: 10px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rpe-group {
          border-bottom: 1px solid #f3f4f6;
        }
        .rpe-group:last-child {
          border-bottom: none;
        }
        .rpe-group-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #9ca3af;
          padding: 12px 20px 6px;
          background: #fafafa;
          border-bottom: 1px solid #f3f4f6;
        }
        .rpe-row {
          display: grid;
          grid-template-columns: 1fr 120px 120px 120px;
          align-items: center;
          padding: 4px 20px;
          gap: 8px;
          border-bottom: 1px solid #f9fafb;
          transition: background 0.1s;
        }
        .rpe-row:last-child {
          border-bottom: none;
        }
        .rpe-row:hover {
          background: #f9fafb;
        }
        .rpe-perm-name {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
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
