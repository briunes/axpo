"use client";

import { useEffect, useState, useLayoutEffect, useMemo, useCallback } from "react";
import { DateRangePicker } from "../ui/DateRangePicker";
import { format } from "date-fns";
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
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Table */}
      <TableSkeleton />

      {/* Alerts */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
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
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}
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

// ─── Main module ──────────────────────────────────────────────────────────────

interface AnalyticsModuleProps {
  session: SessionState;
  actions: AnalyticsActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

export function AnalyticsModule({ session, actions, onNotify, onActionButtons }: AnalyticsModuleProps) {
  const { t, locale } = useI18n();
  const { analytics, loading, errorText, refresh, energyType, setEnergyType, days: selectedDays, setDays, dateRange, setDateRange } = actions;
  const pickerStart = useMemo(() => dateRange ? new Date(`${dateRange.startDate}T00:00:00`) : null, [dateRange]);
  const pickerEnd = useMemo(() => dateRange ? new Date(`${dateRange.endDate}T00:00:00`) : null, [dateRange]);
  const periodLabel = pickerStart && pickerEnd
    ? `${pickerStart.toLocaleDateString(locale)} – ${pickerEnd.toLocaleDateString(locale)}`
    : undefined;
  const [refreshVersion, setRefreshVersion] = useState(0);
  const isAdminView = isAdmin(session.user.role);

  // ── Per-agency drill-down (admin only) ────────────────────────────────────
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agencyAnalytics, setAgencyAnalytics] = useState<AnalyticsOverview | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [allAgencies, setAllAgencies] = useState<FormSelectOption[]>([]);


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
    let cancelled = false;
    setAgencyLoading(true);
    fetchAnalyticsForAgency(session.token, selectedAgencyId, selectedDays, energyType || undefined, dateRange)
      .then((data) => { if (!cancelled) setAgencyAnalytics(data); })
      .catch(() => { if (!cancelled) setAgencyAnalytics(null); })
      .finally(() => { if (!cancelled) setAgencyLoading(false); });
    return () => { cancelled = true; };
  }, [session.token, selectedAgencyId, selectedDays, energyType, dateRange, refreshVersion]);

  const handleDaysChange = useCallback((d: number) => {
    setDateRange(null);
    setDays(d);
  }, [setDateRange, setDays]);

  const energyOptions: Array<{ value: string; label: string; icon: React.ReactNode }> = [
    { value: "", label: t("analyticsModule", "energyTypeAll") || "All", icon: <AppsOutlinedIcon sx={{ fontSize: 16 }} /> },
    { value: "ELECTRICITY", label: t("analyticsModule", "energyTypeElectricity") || "Electricity", icon: <BoltIcon sx={{ fontSize: 17 }} /> },
    { value: "GAS", label: t("analyticsModule", "energyTypeGas") || "Gas", icon: <LocalFireDepartmentIcon sx={{ fontSize: 16 }} /> },
  ];

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        {/* Energy type toggle */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {energyOptions.map((opt) => (
            <Button
              key={opt.value}
              size="small"
              variant={energyType === opt.value ? "contained" : "outlined"}
              onClick={() => setEnergyType(opt.value)}
              disabled={loading}
              style={{ cursor: loading ? "not-allowed" : "pointer", minWidth: 0 }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{opt.icon}{opt.label}</span>
            </Button>
          ))}
        </div>
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
        <div style={{ width: 280, maxWidth: "100%" }}>
          <DateRangePicker
            months={2}
            closeOnSelect
            startDate={pickerStart}
            endDate={pickerEnd}
            label={t("datePicker", "selectRange")}
            displayValue={!dateRange ? t("analyticsModule", "lastDays").replace("{days}", String(selectedDays)) : undefined}
            shortcuts={[7, 30, 90].map((days) => ({
              label: t("analyticsModule", "lastDays").replace("{days}", String(days)),
              selected: !dateRange && selectedDays === days,
              onSelect: () => handleDaysChange(days),
            }))}
            disabled={loading}
            onChange={(start, end) => {
              if (!start && !end) handleDaysChange(30);
              if (start && end) {
                const [first, last] = start <= end ? [start, end] : [end, start];
                setDateRange({ startDate: format(first, "yyyy-MM-dd"), endDate: format(last, "yyyy-MM-dd") });
              }
            }}
          />
        </div>
        <Button
          variant="contained"
          size="small"
          onClick={() => { void refresh(); setRefreshVersion((value) => value + 1); }}
          disabled={loading}
        >
          {loading ? t("common", "loading") : <><RefreshIcon fontSize="small" /> {t("actions", "refresh")}</>}
        </Button>
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, selectedDays, handleDaysChange, loading, t, refresh, selectedAgencyId, isAdminView, allAgencies, energyType, setEnergyType, dateRange, pickerStart, pickerEnd, setDateRange]);

  // Determine what to render
  const showAgencyDrillDown = isAdminView && selectedAgencyId !== null;

  return (
    <div className="analytics-dashboard" data-tour="analytics-dashboard" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {errorText && <div className="sp-panel-error">{errorText}</div>}

      {showAgencyDrillDown ? (
        agencyLoading ? (
          <AgentAnalyticsViewSkeleton />
        ) : !agencyAnalytics ? (
          <EmptyState message={t("analyticsModule", "noData")} />
        ) :
          <AgentAnalyticsView analytics={agencyAnalytics} selectedDays={selectedDays} periodLabel={periodLabel} />
      ) : loading ? (
        isAdminView ? <AdminAnalyticsViewSkeleton /> : <AgentAnalyticsViewSkeleton />
      ) : !analytics ? (
        <EmptyState message={t("analyticsModule", "noData")} />
      ) : (
        <>
          {isAdminView ? (
            <AdminAnalyticsView analytics={analytics} selectedDays={selectedDays} periodLabel={periodLabel} />
          ) : (
            <AgentAnalyticsView analytics={analytics} selectedDays={selectedDays} periodLabel={periodLabel} />
          )}
        </>
      )}
    </div>
  );
}
