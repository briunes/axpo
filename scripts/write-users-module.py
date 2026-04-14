#!/usr/bin/env python3
"""Rewrites UsersModule.tsx with proper CRUD UX (onNotify + in-panel errors)."""
import os

TARGET = os.path.join(os.path.dirname(__file__), "../app/internal/components/modules/UsersModule.tsx")

CONTENT = '''\
"use client";

import {
  Button,
  Column,
  Select,
} from "@once-ui-system/core";
import { useEffect, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, CreateUserResult, RotatePinResult } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { UsersActions } from "../hooks/useUsers";
import { ConfirmDialog } from "../shared";
import { DataTable, SlidePanel, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";

interface UsersModuleProps {
  session: SessionState;
  actions: UsersActions;
  agencies: AgencyItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
}

type UserItem = UsersActions["users"] extends (infer T)[] ? T : never;

export function UsersModule({ session, actions, agencies, onNotify }: UsersModuleProps) {
  const {
    users, loading, busyAction, errorText, successText, clearFeedback, refresh,
    newUserName, setNewUserName, newUserEmail, setNewUserEmail,
    newUserPassword, setNewUserPassword, newUserRole, setNewUserRole,
    newUserAgencyId, setNewUserAgencyId, handleCreateUser,
    selectedUserId, editUserName, setEditUserName, editUserEmail, setEditUserEmail,
    editUserPassword, setEditUserPassword, editUserCurrentPassword, setEditUserCurrentPassword,
    openUserEditor, closeUserEditor, handleUpdateUser,
    handleToggleUserStatus, handleRotateUserPin,
  } = actions;

  const [searchQuery, setSearchQuery] = useState("");
  const [newlyCreated, setNewlyCreated] = useState<CreateUserResult | null>(null);
  const [lastPinResult, setLastPinResult] = useState<RotatePinResult | null>(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState<UserItem | null>(null);
  const [confirmPinRotateUser, setConfirmPinRotateUser] = useState<UserItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { refresh(); }, []);

  // Bubble success up to toast and close create panel
  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
      // Note: create panel is closed explicitly after receiving result
    }
  }, [successText]);

  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const canCreateUsers = isAdmin(session.user.role) || session.user.role === "AGENT";
  const editingOwnUser = selectedUserId === session.user.id;

  const handleCreate = async (e: React.FormEvent) => {
    const result = await handleCreateUser(e);
    if (result) {
      setNewlyCreated(result);
      setShowCreate(false);
    }
  };

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      renderCell: (u) => (
        <div>
          <div className="dt-cell-primary">{u.fullName}</div>
          <div className="dt-cell-secondary">{u.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      renderCell: (u) => (
        <StatusBadge
          label={u.role}
          tone={u.role === "ADMIN" ? "brand" : u.role === "AGENT" ? "accent" : "neutral"}
        />
      ),
    },
    {
      key: "agency",
      label: "Agency",
      renderCell: (u) => (
        <span className="dt-cell-secondary">
          {agencies.find((a) => a.id === u.agencyId)?.name ?? u.agencyId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      renderCell: (u) => (
        <StatusBadge label={u.isActive ? "Active" : "Inactive"} tone={u.isActive ? "success" : "neutral"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      renderCell: (u) => (
        <div className="dt-row-actions">
          <button className="dt-action-btn" onClick={() => openUserEditor(u)}>Edit</button>
          <button className="dt-action-btn" onClick={() => setConfirmToggleUser(u)}>
            {u.isActive ? "Deactivate" : "Activate"}
          </button>
          <button className="dt-action-btn" onClick={() => setConfirmPinRotateUser(u)}>Rotate PIN</button>
        </div>
      ),
    },
  ];

  return (
    <Column gap="24">
      <div className="section-header">
        <div>
          <h2 className="section-title">Users</h2>
          <p className="section-subtitle">Manage user accounts and access levels.</p>
        </div>
        <div className="section-actions">
          <Button variant="secondary" size="s" onClick={refresh} label="Refresh" loading={loading} />
          {canCreateUsers && (
            <Button variant="primary" size="s" onClick={() => setShowCreate(true)} label="New user" />
          )}
        </div>
      </div>

      {newlyCreated?.generatedPin && (
        <div className="sp-callout sp-callout--brand">
          <span className="sp-callout-label">User created \u2014 save this PIN now, it will not be shown again</span>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <div>
              <div className="dt-cell-secondary">User</div>
              <div className="dt-cell-primary">{newlyCreated.user.email}</div>
            </div>
            <div>
              <div className="dt-cell-secondary">PIN</div>
              <div className="sp-callout-value">{newlyCreated.generatedPin}</div>
            </div>
            <button className="sp-btn-secondary" onClick={() => setNewlyCreated(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {lastPinResult && (
        <div className="sp-callout sp-callout--brand">
          <span className="sp-callout-label">PIN rotated \u2014 save this new PIN now</span>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <div className="sp-callout-value">{lastPinResult.newPin}</div>
            <button className="sp-btn-secondary" onClick={() => setLastPinResult(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <DataTable<UserItem>
        columns={columns}
        rows={filtered}
        loading={loading && !users.length}
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder="Search users\u2026"
        emptyMessage="No users found."
        headerRight={<span className="dt-meta-pill">{users.length} total</span>}
      />

      {canCreateUsers && (
        <SlidePanel
          open={showCreate}
          onClose={() => { setShowCreate(false); clearFeedback(); }}
          title="New user"
          subtitle="Create a new user account."
          footer={
            <>
              <button className="sp-btn-secondary" onClick={() => { setShowCreate(false); clearFeedback(); }}>Cancel</button>
              <button
                className="sp-btn-primary"
                disabled={busyAction === "create-user"}
                onClick={handleCreate as unknown as React.MouseEventHandler<HTMLButtonElement>}
              >
                {busyAction === "create-user" ? "Creating\u2026" : "Create user"}
              </button>
            </>
          }
        >
          {errorText && <div className="sp-panel-error">{errorText}</div>}
          <form onSubmit={handleCreate} id="create-user-form">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="sp-rows-2">
                <div className="sp-form-group">
                  <label className="sp-form-label">Full name</label>
                  <input className="sp-form-input" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Email</label>
                  <input className="sp-form-input" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                </div>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Password</label>
                <input className="sp-form-input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                <span className="sp-form-hint">Min 12 chars, uppercase, lowercase, number, special character</span>
              </div>
              <div className="sp-rows-2">
                <div className="sp-form-group">
                  <label className="sp-form-label">Role</label>
                  <Select
                    id="new-user-role"
                    label=""
                    value={newUserRole}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewUserRole(e.target.value as typeof newUserRole)
                    }
                    options={[
                      { value: "COMMERCIAL", label: "Commercial" },
                      { value: "AGENT", label: "Agent" },
                      ...(isAdmin(session.user.role) ? [{ value: "ADMIN", label: "Admin" }] : []),
                    ]}
                  />
                </div>
                {isAdmin(session.user.role) && (
                  <div className="sp-form-group">
                    <label className="sp-form-label">Agency</label>
                    <Select
                      id="new-user-agency"
                      label=""
                      value={newUserAgencyId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserAgencyId(e.target.value)}
                      options={[
                        { value: "", label: "\u2014 select \u2014" },
                        ...agencies.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          </form>
        </SlidePanel>
      )}

      <SlidePanel
        open={!!selectedUserId}
        onClose={() => { closeUserEditor(); clearFeedback(); }}
        title="Edit user"
        footer={
          <>
            <button className="sp-btn-secondary" onClick={() => { closeUserEditor(); clearFeedback(); }}>Cancel</button>
            <button
              className="sp-btn-primary"
              disabled={busyAction === "update-user"}
              onClick={(e) => handleUpdateUser(e as unknown as React.FormEvent)}
            >
              {busyAction === "update-user" ? "Saving\u2026" : "Save changes"}
            </button>
          </>
        }
      >
        {errorText && <div className="sp-panel-error">{errorText}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="sp-form-group">
            <label className="sp-form-label">Full name</label>
            <input className="sp-form-input" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">Email</label>
            <input className="sp-form-input" type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} />
          </div>
          {editingOwnUser && (
            <div className="sp-form-group">
              <label className="sp-form-label">Current password</label>
              <input className="sp-form-input" type="password" value={editUserCurrentPassword} onChange={(e) => setEditUserCurrentPassword(e.target.value)} />
              <span className="sp-form-hint">Required when changing your own password</span>
            </div>
          )}
          <div className="sp-form-group">
            <label className="sp-form-label">New password (optional)</label>
            <input className="sp-form-input" type="password" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} />
            <span className="sp-form-hint">Leave blank to keep current password</span>
          </div>
        </div>
      </SlidePanel>

      {confirmToggleUser && (
        <ConfirmDialog
          title="Toggle user status"
          message={`Are you sure you want to ${confirmToggleUser.isActive ? "deactivate" : "activate"} ${confirmToggleUser.fullName}?`}
          confirmLabel="Confirm"
          busy={busyAction === `toggle-user-${confirmToggleUser.id}`}
          onConfirm={async () => {
            await handleToggleUserStatus(confirmToggleUser);
            setConfirmToggleUser(null);
          }}
          onCancel={() => setConfirmToggleUser(null)}
        />
      )}

      {confirmPinRotateUser && (
        <ConfirmDialog
          title="Rotate user PIN"
          message={`Generate a new PIN for ${confirmPinRotateUser.fullName}? The old PIN will immediately stop working.`}
          confirmLabel="Rotate PIN"
          busy={busyAction === `rotate-user-${confirmPinRotateUser.id}`}
          onConfirm={async () => {
            const result = await handleRotateUserPin(confirmPinRotateUser);
            if (result) setLastPinResult(result);
            setConfirmPinRotateUser(null);
          }}
          onCancel={() => setConfirmPinRotateUser(null)}
        />
      )}
    </Column>
  );
}
'''

with open(TARGET, 'w') as f:
    f.write(CONTENT)
print(f"Written: {TARGET}")
