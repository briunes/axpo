"use client";

import { Button, Column } from "@once-ui-system/core";
import { useEffect, useState, useLayoutEffect } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogItem } from "../../lib/internalApi";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AuditLogsModuleProps {
  session: SessionState;
  actions: AuditLogsActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

// ─── Event registry ──────────────────────────────────────────────────────────

type EventMeta = { labelKey: string; color: string; bg: string; group: string };
type AuditEventLabelKey =
  | "created"
  | "updated"
  | "deleted"
  | "calculated"
  | "shared"
  | "cloned"
  | "pinRotated"
  | "statusChanged"
  | "activated"
  | "setCreated"
  | "ocrApplied"
  | "login"
  | "logout"
  | "accessAttempt";

const EVENT_REGISTRY: Record<string, EventMeta> = {
  SIMULATION_CREATED: { group: "Sim", labelKey: "created", color: "#60a5fa", bg: "rgba(96,165,250,.13)" },
  SIMULATION_UPDATED: { group: "Sim", labelKey: "updated", color: "#60a5fa", bg: "rgba(96,165,250,.13)" },
  SIMULATION_CALCULATED: { group: "Sim", labelKey: "calculated", color: "#38bdf8", bg: "rgba(56,189,248,.13)" },
  SIMULATION_SHARED: { group: "Sim", labelKey: "shared", color: "#34d399", bg: "rgba(52,211,153,.13)" },
  SIMULATION_CLONED: { group: "Sim", labelKey: "cloned", color: "#a78bfa", bg: "rgba(167,139,250,.13)" },
  SIMULATION_DELETED: { group: "Sim", labelKey: "deleted", color: "#f87171", bg: "rgba(248,113,113,.13)" },
  SIMULATION_PIN_ROTATED: { group: "Sim", labelKey: "pinRotated", color: "#fbbf24", bg: "rgba(251,191,36,.13)" },
  SIMULATION_OCR_APPLIED: { group: "Sim", labelKey: "ocrApplied", color: "#a78bfa", bg: "rgba(167,139,250,.13)" },
  USER_CREATED: { group: "User", labelKey: "created", color: "#c084fc", bg: "rgba(192,132,252,.13)" },
  USER_UPDATED: { group: "User", labelKey: "updated", color: "#c084fc", bg: "rgba(192,132,252,.13)" },
  USER_STATUS_CHANGED: { group: "User", labelKey: "statusChanged", color: "#e879f9", bg: "rgba(232,121,249,.13)" },
  USER_PIN_ROTATED: { group: "User", labelKey: "pinRotated", color: "#fbbf24", bg: "rgba(251,191,36,.13)" },
  AGENCY_CREATED: { group: "Agency", labelKey: "created", color: "#fb923c", bg: "rgba(251,146,60,.13)" },
  AGENCY_UPDATED: { group: "Agency", labelKey: "updated", color: "#fb923c", bg: "rgba(251,146,60,.13)" },
  CLIENT_CREATED: { group: "Client", labelKey: "created", color: "#f472b6", bg: "rgba(244,114,182,.13)" },
  CLIENT_UPDATED: { group: "Client", labelKey: "updated", color: "#f472b6", bg: "rgba(244,114,182,.13)" },
  CLIENT_DELETED: { group: "Client", labelKey: "deleted", color: "#f87171", bg: "rgba(248,113,113,.13)" },
  BASE_VALUE_SET_CREATED: { group: "BV", labelKey: "setCreated", color: "#2dd4bf", bg: "rgba(45,212,191,.13)" },
  BASE_VALUE_SET_ACTIVATED: { group: "BV", labelKey: "activated", color: "#2dd4bf", bg: "rgba(45,212,191,.13)" },
  AUTH_LOGIN: { group: "Auth", labelKey: "login", color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
  AUTH_LOGOUT: { group: "Auth", labelKey: "logout", color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
  PUBLIC_ACCESS_ATTEMPT: { group: "Pub", labelKey: "accessAttempt", color: "#facc15", bg: "rgba(250,204,21,.10)" },
};

const GROUP_ORDER = ["Simulation", "User", "Agency", "Client", "Base Values", "Auth", "Public"];
const EVENT_TYPES = Object.keys(EVENT_REGISTRY);

function getEvent(eventType: string): EventMeta {
  return EVENT_REGISTRY[eventType] ?? { group: "", labelKey: "", color: "#94a3b8", bg: "rgba(148,163,184,.10)" };
}

function getEventLabel(eventType: string, t: ReturnType<typeof useI18n>["t"]): string {
  const labelKey = getEvent(eventType).labelKey as AuditEventLabelKey | "";
  return labelKey ? t("auditEvents", labelKey) : eventType;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function EventBadge({ eventType }: { eventType: string }) {
  const { t } = useI18n();
  const ev = getEvent(eventType);
  const label = getEventLabel(eventType, t);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 5,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      color: ev.color, background: ev.bg, border: `1px solid ${ev.color}28`,
      whiteSpace: "nowrap",
    }}>
      {ev.group && (
        <span style={{ opacity: 0.5, fontSize: 10, fontWeight: 600 }}>{ev.group}</span>
      )}
      {label}
    </span>
  );
}

// ─── Detail diff table ────────────────────────────────────────────────────────

function formatFieldName(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^[a-z]/, (c) => c.toUpperCase());
}

function DetailTable({ meta }: { meta: Record<string, unknown> }) {
  const hasDiff =
    "before" in meta && "after" in meta &&
    typeof meta.before === "object" && meta.before !== null &&
    typeof meta.after === "object" && meta.after !== null;

  const extraEntries = hasDiff
    ? Object.entries(meta).filter(([k]) => k !== "before" && k !== "after")
    : [];

  const renderValue = (v: unknown): React.ReactNode => {
    if (v === null || v === undefined)
      return <em style={{ color: "var(--scheme-neutral-700)" }}>—</em>;
    if (typeof v === "boolean")
      return <span style={{ color: v ? "#34d399" : "#f87171", fontWeight: 600 }}>{String(v)}</span>;
    if (typeof v === "object")
      return <span style={{ fontSize: 11, color: "var(--scheme-neutral-400)" }}>{JSON.stringify(v)}</span>;
    const s = String(v);
    const isId = s.length > 18 && /^[a-z0-9_-]+$/i.test(s);
    return (
      <span style={{ fontFamily: isId ? "'JetBrains Mono','Fira Code',monospace" : "inherit", fontSize: isId ? 11 : 12 }}>
        {s}
      </span>
    );
  };

  const rowBase: React.CSSProperties = {
    display: "grid",
    padding: "6px 14px",
    borderBottom: "1px solid rgba(148,163,184,.06)",
    alignItems: "center",
    gap: 12,
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--scheme-neutral-300)",
    letterSpacing: "0.03em",
  };

  if (hasDiff) {
    const before = meta.before as Record<string, unknown>;
    const after = meta.after as Record<string, unknown>;
    const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return (
      <div>
        <div style={{ ...rowBase, gridTemplateColumns: "160px 1fr 1fr", background: "rgba(148,163,184,.03)", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
          <span style={fieldLabel}>Field</span>
          <span style={fieldLabel}>Old value</span>
          <span style={fieldLabel}>New value</span>
        </div>
        {fields.map((f) => {
          const oldVal = before[f];
          const newVal = after[f];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          return (
            <div key={f} style={{ ...rowBase, gridTemplateColumns: "160px 1fr 1fr", background: changed ? "rgba(251,191,36,.04)" : undefined }}>
              <span style={fieldLabel}>{formatFieldName(f)}</span>
              <span style={{ fontSize: 12, color: "var(--scheme-neutral-400)" }}>{renderValue(oldVal)}</span>
              <span style={{ fontSize: 12, color: changed ? "#fbbf24" : "var(--scheme-neutral-200)", fontWeight: changed ? 600 : 400 }}>{renderValue(newVal)}</span>
            </div>
          );
        })}
        {extraEntries.map(([k, v]) => (
          <div key={k} style={{ ...rowBase, gridTemplateColumns: "160px 1fr" }}>
            <span style={fieldLabel}>{formatFieldName(k)}</span>
            <span style={{ fontSize: 12, color: "var(--scheme-neutral-100)" }}>{renderValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Flat key-value — no header
  return (
    <div>
      {Object.entries(meta).map(([k, v]) => (
        <div key={k} style={{ ...rowBase, gridTemplateColumns: "180px 1fr" }}>
          <span style={fieldLabel}>{formatFieldName(k)}</span>
          <span style={{ fontSize: 12, color: "var(--scheme-neutral-100)" }}>{renderValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Custom log table ─────────────────────────────────────────────────────────

const COL_WIDTHS = ["160px", "1fr", "120px", "140px", "40px", "155px"];
const COL_LABELS = ["Event", "Actor", "Target", "Target ID", "", "Timestamp"];

function LogTable({ rows, expandedId, onToggle }: {
  rows: AuditLogItem[];
  expandedId: string | null;
  onToggle: (id: string, hasMeta: boolean) => void;
}) {
  const gridCols = COL_WIDTHS.join(" ");
  const headerCell: React.CSSProperties = {
    padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--scheme-neutral-500)",
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{
        display: "grid", gridTemplateColumns: gridCols,
        borderBottom: "1px solid rgba(148,163,184,.1)",
        background: "rgba(148,163,184,.04)",
      }}>
        {COL_LABELS.map((l, i) => (
          <div key={i} style={headerCell}>{l}</div>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--scheme-neutral-600)", fontSize: 13 }}>
          No audit log entries found.
        </div>
      )}
      {rows.map((log) => {
        const name = (log as AuditLogItem & { actorName?: string | null }).actorName;
        const hasMeta = !!(log.metadataJson && Object.keys(log.metadataJson).length > 0);
        const isExpanded = expandedId === log.id;

        const rowStyle: React.CSSProperties = {
          display: "grid", gridTemplateColumns: gridCols, alignItems: "center",
          borderBottom: isExpanded ? "none" : "1px solid rgba(148,163,184,.07)",
          cursor: hasMeta ? "pointer" : "default",
          background: isExpanded ? "rgba(148,163,184,.06)" : undefined,
          transition: "background .1s",
        };

        return (
          <div key={log.id}>
            <div
              style={rowStyle}
              onClick={() => onToggle(log.id, hasMeta)}
              onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(148,163,184,.04)"; }}
              onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = ""; }}
            >
              {/* Event */}
              <div style={{ padding: "10px 12px" }}>
                <EventBadge eventType={log.eventType} />
              </div>

              {/* Actor */}
              <div style={{ padding: "10px 12px" }}>
                {name ? (
                  <span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                    {log.actorEmail && (
                      <span style={{ fontSize: 11, color: "var(--scheme-neutral-500)", marginLeft: 6 }}>{log.actorEmail}</span>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--scheme-neutral-400)" }}>
                    {log.actorEmail ?? <em style={{ color: "var(--scheme-neutral-600)" }}>system</em>}
                  </span>
                )}
              </div>

              {/* Target */}
              <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--scheme-neutral-400)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {log.targetType}
              </div>

              {/* Target ID */}
              <div style={{ padding: "10px 12px" }}>
                <span title={log.targetId ?? undefined} style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 11, color: "var(--scheme-neutral-500)", cursor: "default" }}>
                  {log.targetId ? log.targetId.slice(0, 10) + "…" : "—"}
                </span>
              </div>

              {/* Expand toggle */}
              <div style={{ padding: "10px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {hasMeta && (
                  <span style={{ fontSize: 10, color: "var(--scheme-neutral-500)", transition: "transform .15s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                )}
              </div>

              {/* Timestamp */}
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--scheme-neutral-500)", whiteSpace: "nowrap" }}>
                {new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>

            {/* Expanded detail row */}
            {isExpanded && hasMeta && (
              <div style={{
                borderBottom: "1px solid rgba(148,163,184,.1)",
                borderTop: "1px solid rgba(148,163,184,.1)",
                background: "rgba(148,163,184,.08)",
              }}>
                <DetailTable meta={log.metadataJson!} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────

export function AuditLogsModule({ session: _session, actions, onNotify: _onNotify, onActionButtons }: AuditLogsModuleProps) {
  const { t } = useI18n();
  const {
    logs,
    total,
    page,
    totalPages,
    setPage,
    loading, errorText, refresh,
    searchQuery, setSearchQuery,
    filterEventType, setFilterEventType,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filteredLogs, handleExportCsv,
  } = actions;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(null);
  }, [page, searchQuery, filterEventType, filterDateFrom, filterDateTo]);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        <Button variant="secondary" size="s" onClick={handleExportCsv} label={t("auditLogsModule", "exportCsv")} disabled={filteredLogs.length === 0} />
        <Button variant="secondary" size="s" onClick={() => refresh()} label={t("actions", "refresh")} loading={loading} />
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, handleExportCsv, t, filteredLogs.length, refresh, loading]);

  const safePage = Math.min(page, Math.max(totalPages, 1));

  const handleToggle = (id: string, hasMeta: boolean) => {
    if (!hasMeta) return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Column gap="24">
      {errorText && <div className="sp-panel-error" style={{ marginBottom: 0 }}>{errorText}</div>}

      {/* Toolbar */}
      <div
        className="panel-card"
        style={{
          padding: 0,
          overflow: "hidden",
          background: "var(--scheme-neutral-1200)",
          border: "1px solid var(--scheme-neutral-900)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(148,163,184,.1)", gap: 12, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--scheme-neutral-600)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
              <input
                style={{
                  background: "var(--scheme-neutral-1100)", border: "1px solid var(--scheme-neutral-900)",
                  borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 13,
                  color: "var(--scheme-neutral-100)", outline: "none", width: 220,
                }}
                placeholder={t("search", "auditLogs")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="dt-filter-label">Event</span>
            <select
              className="dt-filter-select"
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
            >
              <option value="">{t("auditLogsModule", "allEvents")}</option>
              {GROUP_ORDER.map((group) => {
                const items = EVENT_TYPES.filter((t) => EVENT_REGISTRY[t]?.group === group.slice(0, 3) || EVENT_REGISTRY[t]?.group === group || (group === "Base Values" && EVENT_REGISTRY[t]?.group === "BV") || (group === "Public" && EVENT_REGISTRY[t]?.group === "Pub") || (group === "Simulation" && EVENT_REGISTRY[t]?.group === "Sim"));
                if (!items.length) return null;
                return (
                  <optgroup key={group} label={group}>
                    {items.map((eventType) => <option key={eventType} value={eventType}>{getEventLabel(eventType, t)}</option>)}
                  </optgroup>
                );
              })}
            </select>

            <span className="dt-filter-label">From</span>
            <input className="dt-filter-input" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            <span className="dt-filter-label">To</span>
            <input className="dt-filter-input" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />

            {(filterEventType || filterDateFrom || filterDateTo) && (
              <button className="dt-filter-clear" onClick={() => { setFilterEventType(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                Clear
              </button>
            )}
          </div>

          <span className="dt-meta-pill">{total} entries</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--scheme-neutral-600)", fontSize: 13 }}>Loading…</div>
        ) : (
          <LogTable rows={logs} expandedId={expandedId} onToggle={handleToggle} />
        )}

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid rgba(148,163,184,.1)", fontSize: 13, color: "var(--scheme-neutral-500)" }}>
          <span>Page {safePage} of {totalPages}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setPage(Math.max(1, safePage - 1)); setExpandedId(null); }}
              disabled={safePage <= 1}
              style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(148,163,184,.18)", background: "transparent", color: "var(--scheme-neutral-300)", cursor: safePage <= 1 ? "default" : "pointer", opacity: safePage <= 1 ? 0.4 : 1, fontSize: 12 }}
            >← Prev</button>
            <button
              onClick={() => { setPage(Math.min(totalPages, safePage + 1)); setExpandedId(null); }}
              disabled={safePage >= totalPages}
              style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(148,163,184,.18)", background: "transparent", color: "var(--scheme-neutral-300)", cursor: safePage >= totalPages ? "default" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1, fontSize: 12 }}
            >Next →</button>
          </div>
        </div>
      </div>
    </Column>
  );
}
