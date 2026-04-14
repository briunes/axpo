#!/usr/bin/env python3
"""Rewrites AgenciesModule.tsx with proper CRUD UX (onNotify + in-panel errors)."""
import os

TARGET = os.path.join(os.path.dirname(__file__), "../app/internal/components/modules/AgenciesModule.tsx")

CONTENT = '''\
"use client";

import { Button, Column } from "@once-ui-system/core";
import { useEffect, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { AgenciesActions } from "../hooks/useAgencies";
import { ConfirmDialog } from "../shared";
import { DataTable, SlidePanel, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";

interface AgenciesModuleProps {
  session: SessionState;
  actions: AgenciesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
}

export function AgenciesModule({ session, actions, onNotify }: AgenciesModuleProps) {
  const {
    agencies, loading, busyAction, errorText, successText, clearFeedback, refresh,
    newAgencyName, setNewAgencyName, handleCreateAgency,
    selectedAgencyId, editAgencyName, setEditAgencyName,
    openAgencyEditor, closeAgencyEditor, handleUpdateAgency, handleToggleAgencyStatus,
  } = actions;

  const [searchQuery, setSearchQuery] = useState("");
  const [confirmToggle, setConfirmToggle] = useState<AgencyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { refresh(); }, []);

  // Bubble success up to toast and close create panel
  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
      setShowCreate(false);
    }
  }, [successText]);

  const filtered = agencies.filter((a) =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: ColumnDef<AgencyItem>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      renderCell: (a) => <span className="dt-cell-primary">{a.name}</span>,
    },
    {
      key: "status",
      label: "Status",
      renderCell: (a) => (
        <StatusBadge label={a.isActive ? "Active" : "Inactive"} tone={a.isActive ? "success" : "neutral"} />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      renderCell: (a) => (
        <span style={{ whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      renderCell: (a) => (
        <div className="dt-row-actions">
          <button className="dt-action-btn" onClick={() => openAgencyEditor(a)}>Edit</button>
          <button className="dt-action-btn" onClick={() => setConfirmToggle(a)}>
            {a.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  if (!isAdmin(session.user.role)) {
    return (
      <Column gap="16">
        <h2 className="section-title">Agencies</h2>
        <p className="section-subtitle">You do not have permission to manage agencies.</p>
      </Column>
    );
  }

  return (
    <Column gap="24">
      <div className="section-header">
        <div>
          <h2 className="section-title">Agencies</h2>
          <p className="section-subtitle">Create and manage agencies.</p>
        </div>
        <div className="section-actions">
          <Button variant="secondary" size="s" onClick={refresh} label="Refresh" loading={loading} />
          <Button variant="primary" size="s" onClick={() => setShowCreate(true)} label="New agency" />
        </div>
      </div>

      <DataTable<AgencyItem>
        columns={columns}
        rows={filtered}
        loading={loading && !agencies.length}
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder="Search agencies\u2026"
        emptyMessage="No agencies found."
        headerRight={<span className="dt-meta-pill">{agencies.length} total</span>}
      />

      <SlidePanel
        open={showCreate}
        onClose={() => { setShowCreate(false); setNewAgencyName(""); clearFeedback(); }}
        title="New agency"
        subtitle="Create a new agency in the system."
        footer={
          <>
            <button
              className="sp-btn-secondary"
              onClick={() => { setShowCreate(false); setNewAgencyName(""); clearFeedback(); }}
            >
              Cancel
            </button>
            <button
              className="sp-btn-primary"
              disabled={busyAction === "create-agency" || !newAgencyName.trim()}
              onClick={(e) => handleCreateAgency(e as unknown as React.FormEvent)}
            >
              {busyAction === "create-agency" ? "Creating\u2026" : "Create agency"}
            </button>
          </>
        }
      >
        {errorText && <div className="sp-panel-error">{errorText}</div>}
        <div className="sp-form-group">
          <label className="sp-form-label">Agency name</label>
          <input
            className="sp-form-input"
            value={newAgencyName}
            onChange={(e) => setNewAgencyName(e.target.value)}
            placeholder="e.g. Energ\u00eda Sur S.L."
          />
        </div>
      </SlidePanel>

      <SlidePanel
        open={!!selectedAgencyId}
        onClose={() => { closeAgencyEditor(); clearFeedback(); }}
        title="Edit agency"
        footer={
          <>
            <button className="sp-btn-secondary" onClick={() => { closeAgencyEditor(); clearFeedback(); }}>Cancel</button>
            <button
              className="sp-btn-primary"
              disabled={busyAction === "update-agency" || !editAgencyName.trim()}
              onClick={(e) => handleUpdateAgency(e as unknown as React.FormEvent)}
            >
              {busyAction === "update-agency" ? "Saving\u2026" : "Save changes"}
            </button>
          </>
        }
      >
        {errorText && <div className="sp-panel-error">{errorText}</div>}
        <div className="sp-form-group">
          <label className="sp-form-label">Agency name</label>
          <input
            className="sp-form-input"
            value={editAgencyName}
            onChange={(e) => setEditAgencyName(e.target.value)}
          />
        </div>
      </SlidePanel>

      {confirmToggle && (
        <ConfirmDialog
          title="Toggle agency status"
          message={`Are you sure you want to ${confirmToggle.isActive ? "deactivate" : "activate"} ${confirmToggle.name}?`}
          confirmLabel="Confirm"
          busy={busyAction === `toggle-agency-${confirmToggle.id}`}
          onConfirm={async () => {
            await handleToggleAgencyStatus(confirmToggle);
            setConfirmToggle(null);
          }}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </Column>
  );
}
'''

with open(TARGET, 'w') as f:
    f.write(CONTENT)
print(f"Written: {TARGET}")
