"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AnalyticsActions } from "../hooks/useAnalytics";
import { isAdmin } from "../../lib/internalApi";
import { EmptyState, LoadingState } from "../shared";
import { useI18n } from "../../../../src/lib/i18n-context";
import { AdminAnalyticsView } from "./AdminAnalyticsView";
import { AgentAnalyticsView } from "./AgentAnalyticsView";

// ─── Helper components ────────────────────────────────────────────────────────

function DaysFilter({
  selected,
  onChange,
  loading,
}: {
  selected: number;
  onChange: (d: number) => void;
  loading: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          disabled={loading}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: `1px solid ${selected === d ? "var(--scheme-brand-600, #4ade80)" : "var(--scheme-neutral-800)"}`,
            background: selected === d ? "rgba(74,222,128,0.1)" : "transparent",
            color: selected === d ? "var(--scheme-neutral-100)" : "var(--scheme-neutral-500)",
            fontSize: 12,
            fontWeight: selected === d ? 600 : 400,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────

interface AnalyticsModuleProps {
  session: SessionState;
  actions: AnalyticsActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
}

export function AnalyticsModule({ session, actions }: AnalyticsModuleProps) {
  const { t } = useI18n();
  const { analytics, loading, errorText, refresh } = actions;
  const [selectedDays, setSelectedDays] = useState(30);
  const isAdminView = isAdmin(session.user.role);

  useEffect(() => { refresh(30); }, []);

  const handleDaysChange = (d: number) => {
    setSelectedDays(d);
    refresh(d);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            {isAdminView
              ? t("analyticsModule", "titleAdmin") || t("nav", "analytics")
              : t("analyticsModule", "titleAgent") || t("nav", "analytics")}
          </h2>
          <p className="section-subtitle">
            {isAdminView
              ? t("analyticsModule", "subtitleAdmin") || "Overview of all agencies and platform performance"
              : t("analyticsModule", "subtitleAgent") || "Your agency's performance and team activity"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <DaysFilter selected={selectedDays} onChange={handleDaysChange} loading={loading} />
          <button
            type="button"
            className="sp-btn-secondary"
            onClick={() => refresh(selectedDays)}
            disabled={loading}
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            {loading ? t("common", "loading") : `↺ ${t("actions", "refresh")}`}
          </button>
        </div>
      </div>

      {errorText && <div className="sp-panel-error">{errorText}</div>}

      {loading && !analytics ? (
        <LoadingState message={t("analyticsModule", "loadingMessage")} />
      ) : !analytics ? (
        <EmptyState message={t("analyticsModule", "noData")} />
      ) : (
        <>
          {isAdminView ? (
            <AdminAnalyticsView analytics={analytics} selectedDays={selectedDays} />
          ) : (
            <AgentAnalyticsView analytics={analytics} selectedDays={selectedDays} />
          )}
        </>
      )}
    </div>
  );
}
