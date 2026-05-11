"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import Skeleton from "@mui/material/Skeleton";
import type { SessionState } from "../../lib/authSession";
import type { AnalyticsActions } from "../hooks/useAnalytics";
import { isAdmin, fetchAnalyticsForAgency, listAgencies } from "../../lib/internalApi";
import type { AnalyticsOverview } from "../../lib/internalApi";
import { EmptyState, LoadingState } from "../shared";
import { FormSelect } from "../ui/FormSelect";
import type { FormSelectOption } from "../ui/FormSelect";
import { useI18n } from "../../../../src/lib/i18n-context";
import { AdminAnalyticsView } from "./AdminAnalyticsView";
import { AgentAnalyticsView } from "./AgentAnalyticsView";
import { RefreshIcon } from "../ui/icons";
import { Button } from "@mui/material";

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
        <Button
          key={d}
          onClick={() => onChange(d)}
          disabled={loading}
          size="small"
          variant={selected === d ? "contained" : "outlined"}
          style={{
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {d}d
        </Button>
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

  // ── Per-agency drill-down (admin only) ────────────────────────────────────
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agencyAnalytics, setAgencyAnalytics] = useState<AnalyticsOverview | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [allAgencies, setAllAgencies] = useState<FormSelectOption[]>([]);

  useEffect(() => { refresh(30); }, []);

  // Fetch all agencies once for the selector
  useEffect(() => {
    if (!isAdminView) return;
    listAgencies(session.token, { pageSize: 500 })
      .then((res) =>
        setAllAgencies(res.items.map((a) => ({ value: a.id, label: a.name })))
      )
      .catch(() => { });
  }, [isAdminView]);

  useEffect(() => {
    if (!selectedAgencyId) { setAgencyAnalytics(null); return; }
    setAgencyLoading(true);
    fetchAnalyticsForAgency(session.token, selectedAgencyId, selectedDays)
      .then(setAgencyAnalytics)
      .catch(() => setAgencyAnalytics(null))
      .finally(() => setAgencyLoading(false));
  }, [selectedAgencyId, selectedDays]);

  const handleDaysChange = (d: number) => {
    setSelectedDays(d);
    refresh(d);
  };

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        {isAdminView && allAgencies.length > 0 && (
          <div style={{ minWidth: 200 }}>
            <FormSelect
              label=""
              options={[{ value: "", label: t("analyticsModule", "allAgencies") || "All agencies" }, ...allAgencies]}
              value={selectedAgencyId ?? ""}
              onChange={(v) => setSelectedAgencyId(v === "" || v === null ? null : String(v))}
              fullWidth
              size="small"
              textFieldProps={{ size: "small" }}
            />
          </div>
        )}
        <DaysFilter selected={selectedDays} onChange={handleDaysChange} loading={loading} />
        <Button
          variant="contained"
          size="small"
          onClick={() => refresh(selectedDays)}
          disabled={loading}
        >
          {loading ? t("common", "loading") : <><RefreshIcon fontSize="small" /> {t("actions", "refresh")}</>}
        </Button>
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, selectedDays, handleDaysChange, loading, t, refresh, selectedAgencyId, isAdminView, allAgencies]);

  // Determine what to render
  const showAgencyDrillDown = isAdminView && selectedAgencyId !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {errorText && <div className="sp-panel-error">{errorText}</div>}

      {showAgencyDrillDown ? (
        agencyLoading ? (
          <AgentAnalyticsViewSkeleton />
        ) : !agencyAnalytics ? (
          <EmptyState message={t("analyticsModule", "noData")} />
        ) :
          <AgentAnalyticsView analytics={agencyAnalytics} selectedDays={selectedDays} />
      ) : loading ? (
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
