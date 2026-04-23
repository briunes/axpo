"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import Skeleton from "@mui/material/Skeleton";
import type { SessionState } from "../../lib/authSession";
import type { AnalyticsActions } from "../hooks/useAnalytics";
import { isAdmin } from "../../lib/internalApi";
import { EmptyState, LoadingState } from "../shared";
import { useI18n } from "../../../../src/lib/i18n-context";
import { AdminAnalyticsView } from "./AdminAnalyticsView";
import { AgentAnalyticsView } from "./AgentAnalyticsView";

// ─── Skeleton components ──────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div
      className="panel-card"
      style={{
        flex: "1 1 160px",
        borderRadius: 12,
        padding: "18px 20px",
        minWidth: 160,
      }}
    >
      <Skeleton
        variant="text"
        width="60%"
        height={12}
        sx={{ marginBottom: 1, bgcolor: "var(--scheme-neutral-800)" }}
      />
      <Skeleton
        variant="text"
        width="80%"
        height={32}
        sx={{ marginBottom: 1, bgcolor: "var(--scheme-neutral-800)" }}
      />
      <Skeleton
        variant="text"
        width="50%"
        height={10}
        sx={{ bgcolor: "var(--scheme-neutral-800)" }}
      />
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="panel-card"
      style={{
        borderRadius: 10,
        padding: "18px 20px",
      }}
    >
      <Skeleton
        variant="text"
        width="40%"
        height={12}
        sx={{ marginBottom: 2, bgcolor: "var(--scheme-neutral-800)" }}
      />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={height}
        sx={{ borderRadius: 1, bgcolor: "var(--scheme-neutral-800)" }}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      className="panel-card"
      style={{
        borderRadius: 10,
        padding: "18px 20px",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Skeleton
          variant="text"
          width="30%"
          height={16}
          sx={{ marginBottom: 0.5, bgcolor: "var(--scheme-neutral-800)" }}
        />
        <Skeleton
          variant="text"
          width="60%"
          height={12}
          sx={{ bgcolor: "var(--scheme-neutral-800)" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            width="100%"
            height={40}
            sx={{ borderRadius: 1, bgcolor: "var(--scheme-neutral-800)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function AdminAnalyticsViewSkeleton() {
  return (
    <>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Funnel */}
      <ChartSkeleton height={180} />

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Table */}
      <TableSkeleton />

      {/* Alerts */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="panel-card"
            style={{ padding: "16px", borderRadius: 8 }}
          >
            <Skeleton
              variant="text"
              width="60%"
              height={10}
              sx={{ marginBottom: 0.5, bgcolor: "var(--scheme-neutral-800)" }}
            />
            <Skeleton
              variant="text"
              width="40%"
              height={24}
              sx={{ marginBottom: 0.5, bgcolor: "var(--scheme-neutral-800)" }}
            />
            <Skeleton
              variant="text"
              width="80%"
              height={10}
              sx={{ bgcolor: "var(--scheme-neutral-800)" }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export function AgentAnalyticsViewSkeleton() {
  return (
    <>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Funnel */}
      <ChartSkeleton height={180} />

      {/* Activity Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartSkeleton height={220} />
        <ChartSkeleton height={220} />
      </div>

      {/* Follow-ups */}
      <div
        className="panel-card"
        style={{
          padding: "20px",
          borderRadius: 12,
        }}
      >
        <Skeleton
          variant="text"
          width="40%"
          height={16}
          sx={{ marginBottom: 2, bgcolor: "var(--scheme-neutral-800)" }}
        />
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: "16px",
                background: "var(--scheme-neutral-950)",
                borderRadius: 8,
              }}
            >
              <Skeleton
                variant="text"
                width="60%"
                height={10}
                sx={{ marginBottom: 0.5, bgcolor: "var(--scheme-neutral-800)" }}
              />
              <Skeleton
                variant="text"
                width="40%"
                height={28}
                sx={{ marginBottom: 0.5, bgcolor: "var(--scheme-neutral-800)" }}
              />
              <Skeleton
                variant="text"
                width="50%"
                height={10}
                sx={{ bgcolor: "var(--scheme-neutral-800)" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <TableSkeleton />

      {/* Trend Chart */}
      <ChartSkeleton />
    </>
  );
}

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
  onActionButtons?: (buttons: React.ReactNode) => void;
}

export function AnalyticsModule({ session, actions, onNotify, onActionButtons }: AnalyticsModuleProps) {
  const { t } = useI18n();
  const { analytics, loading, errorText, refresh } = actions;
  const [selectedDays, setSelectedDays] = useState(30);
  const isAdminView = isAdmin(session.user.role);

  useEffect(() => { refresh(30); }, []);

  const handleDaysChange = (d: number) => {
    setSelectedDays(d);
    refresh(d);
  };

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
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
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, selectedDays, handleDaysChange, loading, t, refresh]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {errorText && <div className="sp-panel-error">{errorText}</div>}

      {loading ? (
        isAdminView ? <AdminAnalyticsViewSkeleton /> : <AgentAnalyticsViewSkeleton />
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
