"use client";

import React, { useCallback, useEffect, useMemo, useLayoutEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import { FormSelect, type FormSelectOption } from "../ui/FormSelect";
import LaunchIcon from '@mui/icons-material/Launch';
import SyncIcon from "@mui/icons-material/Sync";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Country } from "country-state-city";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { AuditLogItem } from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDateTime } from "../../lib/formatPreferences";
import {
    AgencyValueResolver,
    FieldChangeDetails,
    formatFieldName,
    normalizeAuditFieldKey,
    makeGetAgencyName,
} from "../ui/AuditLogShared";
import { DataTable, DateInput, TableFilterButton, TableFiltersDialog, type ColumnDef } from "../ui";
import { useLogTableToolbar } from "./logTableToolbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogsModuleProps {
    session: SessionState;
    actions: AuditLogsActions;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onActionButtons?: (buttons: React.ReactNode) => void;
}

type AuditLogsViewState = {
    eventType: string;
    targetType: string;
    dateFrom: string;
    dateTo: string;
};

const AUDIT_LOG_VIEWS_STORAGE_KEY = "axpo_audit_log_saved_views";

// ─── Event registry ───────────────────────────────────────────────────────────

type EventMeta = { group: string; color: string; bg: string };

const EVENT_REGISTRY: Record<string, EventMeta> = {
    SIMULATION_CREATED: { group: "Sim", color: "#60a5fa", bg: "rgba(96,165,250,.13)" },
    SIMULATION_UPDATED: { group: "Sim", color: "#60a5fa", bg: "rgba(96,165,250,.13)" },
    SIMULATION_CALCULATED: { group: "Sim", color: "#38bdf8", bg: "rgba(56,189,248,.13)" },
    SIMULATION_SHARED: { group: "Sim", color: "#34d399", bg: "rgba(52,211,153,.13)" },
    SIMULATION_CLONED: { group: "Sim", color: "#a78bfa", bg: "rgba(167,139,250,.13)" },
    SIMULATION_DELETED: { group: "Sim", color: "#f87171", bg: "rgba(248,113,113,.13)" },
    SIMULATION_PIN_ROTATED: { group: "Sim", color: "#fbbf24", bg: "rgba(251,191,36,.13)" },
    SIMULATION_OCR_APPLIED: { group: "Sim", color: "#a78bfa", bg: "rgba(167,139,250,.13)" },
    USER_CREATED: { group: "User", color: "#c084fc", bg: "rgba(192,132,252,.13)" },
    USER_UPDATED: { group: "User", color: "#c084fc", bg: "rgba(192,132,252,.13)" },
    USER_STATUS_CHANGED: { group: "User", color: "#e879f9", bg: "rgba(232,121,249,.13)" },
    USER_PIN_ROTATED: { group: "User", color: "#fbbf24", bg: "rgba(251,191,36,.13)" },
    AGENCY_CREATED: { group: "Agency", color: "#fb923c", bg: "rgba(251,146,60,.13)" },
    AGENCY_UPDATED: { group: "Agency", color: "#fb923c", bg: "rgba(251,146,60,.13)" },
    CLIENT_CREATED: { group: "Client", color: "#f472b6", bg: "rgba(244,114,182,.13)" },
    CLIENT_UPDATED: { group: "Client", color: "#f472b6", bg: "rgba(244,114,182,.13)" },
    CLIENT_DELETED: { group: "Client", color: "#f87171", bg: "rgba(248,113,113,.13)" },
    BASE_VALUE_SET_CREATED: { group: "BV", color: "#2dd4bf", bg: "rgba(45,212,191,.13)" },
    BASE_VALUE_SET_ACTIVATED: { group: "BV", color: "#2dd4bf", bg: "rgba(45,212,191,.13)" },
    AUTH_LOGIN: { group: "Auth", color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
    AUTH_LOGOUT: { group: "Auth", color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
    AUTH_SESSION_AUTO_KEPT: { group: "Auth", color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
    AUTH_SESSION_AUTO_KICK: { group: "Auth", color: "#f87171", bg: "rgba(248,113,113,.10)" },
    PUBLIC_ACCESS_ATTEMPT: { group: "Pub", color: "#facc15", bg: "rgba(250,204,21,.10)" },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_REGISTRY).sort();

type GroupKey = "simulation" | "user" | "agency" | "client" | "baseValues" | "auth" | "public";

const GROUP_CONFIG: Array<{ key: GroupKey; groupIds: string[]; labelKey: string }> = [
    { key: "simulation", groupIds: ["Sim"], labelKey: "groupSimulation" },
    { key: "user", groupIds: ["User"], labelKey: "groupUser" },
    { key: "agency", groupIds: ["Agency"], labelKey: "groupAgency" },
    { key: "client", groupIds: ["Client"], labelKey: "groupClient" },
    { key: "baseValues", groupIds: ["BV"], labelKey: "groupBaseValues" },
    { key: "auth", groupIds: ["Auth"], labelKey: "groupAuth" },
    { key: "public", groupIds: ["Pub"], labelKey: "groupPublic" },
];

// ─── EventChip ────────────────────────────────────────────────────────────────

function getEventTypeLabel(eventType: string, t: ReturnType<typeof useI18n>["t"]): string {
    if (eventType.endsWith("_CREATED")) return t("auditEvents", "created");
    if (eventType.endsWith("_UPDATED")) return t("auditEvents", "updated");
    if (eventType.endsWith("_DELETED")) return t("auditEvents", "deleted");
    if (eventType.endsWith("_CALCULATED")) return t("auditEvents", "calculated");
    if (eventType.endsWith("_SHARED")) return t("auditEvents", "shared");
    if (eventType.endsWith("_CLONED")) return t("auditEvents", "cloned");
    if (eventType.endsWith("_PIN_ROTATED")) return t("auditEvents", "pinRotated");
    if (eventType.endsWith("_STATUS_CHANGED")) return t("auditEvents", "statusChanged");
    if (eventType.endsWith("_ACTIVATED")) return t("auditEvents", "activated");
    if (eventType.endsWith("_SET_CREATED")) return t("auditEvents", "setCreated");
    if (eventType.endsWith("_OCR_APPLIED")) return t("auditEvents", "ocrApplied");
    if (eventType === "AUTH_LOGIN") return t("auditEvents", "login");
    if (eventType === "AUTH_LOGOUT") return t("auditEvents", "logout");
    if (eventType === "AUTH_SESSION_AUTO_KEPT") return t("auditEvents", "sessionKept");
    if (eventType === "AUTH_SESSION_AUTO_KICK") return t("auditEvents", "sessionKicked");
    if (eventType === "PUBLIC_ACCESS_ATTEMPT") return t("auditEvents", "accessAttempt");
    return eventType;
}

function EventChip({ eventType, t }: { eventType: string; t: ReturnType<typeof useI18n>["t"] }) {
    const ev = EVENT_REGISTRY[eventType];
    const label = getEventTypeLabel(eventType, t);

    return (
        <Chip
            label={
                <span>
                    {ev?.group && (
                        <span style={{ opacity: 0.55, fontSize: 10, fontWeight: 600, marginRight: 4 }}>
                            {ev.group}
                        </span>
                    )}
                    {label}
                </span>
            }
            size="small"
            sx={{
                fontSize: 11,
                height: 22,
                fontWeight: 700,
                color: ev?.color ?? "var(--scheme-neutral-400)",
                backgroundColor: ev?.bg ?? "rgba(148,163,184,.10)",
                border: `1px solid ${ev?.color ?? "#94a3b8"}28`,
                "& .MuiChip-label": { px: "8px" },
            }}
        />
    );
}

// ─── Main module ──────────────────────────────────────────────────────────────

export function AuditLogsModule({ session, actions, onNotify: _onNotify, onActionButtons }: AuditLogsModuleProps) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();

    const getTargetRoute = useCallback((targetType: string, targetId: string): string | null => {
        switch (targetType) {
            case "USER": return `/internal/users/${targetId}/edit`;
            case "AGENCY": return `/internal/agencies/${targetId}/edit`;
            case "CLIENT": return `/internal/clients/${targetId}/edit`;
            case "SIMULATION": return `/internal/simulations/${targetId}`;
            case "BASE_VALUE_SET": return `/internal/base-values/${targetId}/edit`;
            default: return null;
        }
    }, []);

    const {
        logs,
        total,
        page,
        pageSize,
        totalPages,
        setPage,
        setPageSize,
        loading,
        errorText,
        refresh,
        searchQuery,
        setSearchQuery,
        filterEventType,
        setFilterEventType,
        filterDateFrom,
        setFilterDateFrom,
        filterDateTo,
        setFilterDateTo,
        filterTargetType,
        setFilterTargetType,
        filteredLogs,
        handleExportCsv,
    } = actions;

    // Local (pending) filter state — applied on Search click
    const [localEventType, setLocalEventType] = useState(filterEventType);
    const [localDateFrom, setLocalDateFrom] = useState<Date | null>(
        filterDateFrom ? new Date(filterDateFrom) : null
    );
    const [localDateTo, setLocalDateTo] = useState<Date | null>(
        filterDateTo ? new Date(filterDateTo) : null
    );
    const [localTargetType, setLocalTargetType] = useState(filterTargetType);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Agency name resolution cache
    const agenciesCacheRef = React.useRef<Map<string, string>>(new Map());
    const agenciesInFlightRef = React.useRef<Map<string, Promise<string | null>>>(new Map());

    const getAgencyName = useCallback(
        makeGetAgencyName(session.token, agenciesCacheRef, agenciesInFlightRef),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [session.token]
    );

    const getCountryName = useCallback((countryCode: string): string | null => {
        if (!countryCode) return null;
        try {
            return Country.getCountryByCode(countryCode)?.name ?? null;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!filtersOpen) return;
        setLocalEventType(filterEventType);
        setLocalTargetType(filterTargetType);
        setLocalDateFrom(filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null);
        setLocalDateTo(filterDateTo ? new Date(`${filterDateTo}T00:00:00`) : null);
    }, [filterDateFrom, filterDateTo, filterEventType, filterTargetType, filtersOpen]);

    // ── Action buttons ──────────────────────────────────────────────────────
    useLayoutEffect(() => {
        onActionButtons?.(
            <>
                <Tooltip title={t("actions", "refresh")} arrow>
                    <span className="topbar-action-wrap">
                        <Button
                            className="topbar-action topbar-action--compact"
                            variant="outlined"
                            size="small"
                            onClick={() => refresh()}
                            disabled={loading}
                            startIcon={<SyncIcon fontSize="small" />}
                            aria-label={t("actions", "refresh")}
                        >
                            <span className="topbar-action-label">{t("actions", "refresh")}</span>
                        </Button>
                    </span>
                </Tooltip>
                <Tooltip title={t("actions", "exportCsv")} arrow>
                    <span className="topbar-action-wrap">
                        <Button
                            className="topbar-action topbar-action--compact"
                            variant="outlined"
                            size="small"
                            onClick={() => handleExportCsv()}
                            disabled={loading || filteredLogs.length === 0}
                            startIcon={<FileDownloadIcon fontSize="small" />}
                            aria-label={t("actions", "exportCsv")}
                        >
                            <span className="topbar-action-label">{t("actions", "exportCsv")}</span>
                        </Button>
                    </span>
                </Tooltip>
            </>
        );
        return () => onActionButtons?.(null);
    }, [onActionButtons, handleExportCsv, t, filteredLogs.length, refresh, loading]);

    // ── Filter helpers ──────────────────────────────────────────────────────

    const toDateOnly = (date: Date | null): string => {
        if (!date) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const handleSearch = () => {
        setFilterEventType(localEventType);
        setFilterDateFrom(toDateOnly(localDateFrom));
        setFilterDateTo(toDateOnly(localDateTo));
        setFilterTargetType(localTargetType);
        setPage(1);
        setFiltersOpen(false);
    };

    const handleClear = () => {
        setLocalEventType("");
        setLocalDateFrom(null);
        setLocalDateTo(null);
        setLocalTargetType("");
        setFilterEventType("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterTargetType("");
        setSearchQuery("");
        setPage(1);
        setFiltersOpen(false);
    };
    const activeFilterCount = [
        filterEventType,
        filterTargetType,
        filterDateFrom || filterDateTo,
    ].filter(Boolean).length;

    const currentView = useMemo<AuditLogsViewState>(() => ({
        eventType: filterEventType,
        targetType: filterTargetType,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
    }), [filterDateFrom, filterDateTo, filterEventType, filterTargetType]);

    const applyView = useCallback((view: AuditLogsViewState) => {
        setFilterEventType(view.eventType ?? "");
        setFilterTargetType(view.targetType ?? "");
        setFilterDateFrom(view.dateFrom ?? "");
        setFilterDateTo(view.dateTo ?? "");
        setPage(1);
    }, [setFilterDateFrom, setFilterDateTo, setFilterEventType, setFilterTargetType, setPage]);

    const builtInViews = useMemo<Array<{ id: string; name: string; view: AuditLogsViewState }>>(() => [
        { id: "recent", name: t("simulationsModule", "presetRecent"), view: { eventType: "", targetType: "", dateFrom: "", dateTo: "" } },
        { id: "simulations", name: t("auditLogsModule", "groupSimulation"), view: { eventType: "", targetType: "SIMULATION", dateFrom: "", dateTo: "" } },
        { id: "users", name: t("auditLogsModule", "groupUser"), view: { eventType: "", targetType: "USER", dateFrom: "", dateTo: "" } },
        { id: "agencies", name: t("auditLogsModule", "groupAgency"), view: { eventType: "", targetType: "AGENCY", dateFrom: "", dateTo: "" } },
        { id: "clients", name: t("auditLogsModule", "groupClient"), view: { eventType: "", targetType: "CLIENT", dateFrom: "", dateTo: "" } },
        { id: "base-values", name: t("auditLogsModule", "groupBaseValues"), view: { eventType: "", targetType: "BASE_VALUE_SET", dateFrom: "", dateTo: "" } },
    ], [t]);

    const {
        activeViewPresetId,
        openSaveViewDialog,
        saveViewDialog,
        searchProps,
    } = useLogTableToolbar<AuditLogsViewState>({
        storageKey: AUDIT_LOG_VIEWS_STORAGE_KEY,
        currentView,
        presets: builtInViews,
        applyView,
        searchValue: searchQuery,
        onSearchChange: (value) => {
            setSearchQuery(value);
            setPage(1);
        },
        searchPlaceholder: t("search", "auditLogs"),
        t,
    });

    const toolbarFilterCount = activeViewPresetId ? 0 : activeFilterCount;

    // ── Field label resolution ──────────────────────────────────────────────

    const resolveSimulationFieldLabel = useCallback((rawKey: string): string | null => {
        const segments = rawKey.split(".");
        const last = segments[segments.length - 1] ?? rawKey;
        const normalizedPath = normalizeAuditFieldKey(rawKey);
        const normalizedLast = normalizeAuditFieldKey(last);

        const pick = (labelKey: "fieldAnnualConsumption" | "fieldCups" | "fieldCurrentInvoice" | "fieldConsumption" | "fieldReactiveEnergy" | "fieldMeterRental" | "fieldOtherCharges" | "sectionInvoiceData" | "sectionClientInfo" | "fieldCurrentSupplier" | "fieldSalesAgent" | "fieldAccessTariff" | "fieldVat" | "fieldIgic" | "fieldStartDate" | "fieldEndDate" | "fieldAddress" | "fieldClientName") =>
            t("simulationForm", labelKey);

        if (normalizedLast === "invoicedata") return pick("sectionInvoiceData");
        if (normalizedLast === "clientdata") return pick("sectionClientInfo");
        if (normalizedLast === "annualconsumption" || normalizedLast === "consumoanual" || normalizedLast === "consumoanualkwh" || normalizedPath.includes("annualconsumption") || normalizedPath.includes("consumoanual")) return pick("fieldAnnualConsumption");
        if (normalizedLast === "cups" || normalizedPath.endsWith("clientdatacups") || normalizedPath.includes("fieldcups")) return pick("fieldCups");
        if (normalizedLast === "currentinvoice" || normalizedPath.includes("currentinvoice")) return pick("fieldCurrentInvoice");
        if (normalizedLast === "cif") return t("clientFormPage", "fieldCif");
        if (normalizedLast === "ivatasa" || normalizedLast === "iva") return pick("fieldVat");
        if (normalizedLast === "igictasa" || normalizedLast === "igic") return pick("fieldIgic");
        if (normalizedLast === "fechaini" || normalizedLast === "startdate") return pick("fieldStartDate");
        if (normalizedLast === "fechafin" || normalizedLast === "enddate") return pick("fieldEndDate");
        if (normalizedLast === "direccion" || normalizedLast === "address") return pick("fieldAddress");
        if (normalizedLast === "clientename" || normalizedLast === "clientname") return pick("fieldClientName");

        const periodMatch = normalizedLast.match(/^(consumop|potenciap|precioenergiap|preciopotenciap)(\d+)$/);
        if (periodMatch) {
            const [, prefix, num] = periodMatch;
            const period = `P${num}`;
            if (prefix === "consumop") return `${pick("fieldConsumption")} ${period}`;
            if (prefix === "potenciap") return `Power ${period}`;
            if (prefix === "precioenergiap") return `Energy price ${period}`;
            if (prefix === "preciopotenciap") return `Power price ${period}`;
        }

        if (normalizedLast === "consumption" || normalizedLast === "consumo" || normalizedPath.includes("totalconsumption")) return pick("fieldConsumption");
        if (normalizedLast === "accesstariff" || normalizedLast === "tarifaacceso" || normalizedPath.includes("accesstariff") || normalizedPath.includes("tarifaacceso")) return pick("fieldAccessTariff");
        if (normalizedLast === "currentsupplier" || normalizedLast === "comercializadoraactual" || normalizedPath.includes("currentsupplier")) return pick("fieldCurrentSupplier");
        if (normalizedLast === "salesagent" || normalizedLast === "comercial" || normalizedPath.endsWith("gascomercial") || normalizedPath.includes("salesagent")) return pick("fieldSalesAgent");
        if (normalizedLast === "reactiveenergy" || normalizedPath.includes("energiareactiva")) return pick("fieldReactiveEnergy");
        if (normalizedLast === "meterrental" || normalizedPath.includes("alquilerequipo") || normalizedPath.includes("meterrental")) return pick("fieldMeterRental");
        if (normalizedLast === "othercharges" || normalizedPath.includes("otroscargos") || normalizedPath.includes("othercharges")) return pick("fieldOtherCharges");

        return null;
    }, [t]);

    const resolveFieldLabel = useCallback((key: string): string => {
        const simLabel = resolveSimulationFieldLabel(key);
        if (simLabel) return simLabel;

        const fallbackSegment = key.includes(".") ? (key.split(".").pop() ?? key) : key;

        switch (fallbackSegment) {
            case "id": return t("columns", "id");
            case "name": return t("columns", "name");
            case "role": return t("columns", "role");
            case "status": return t("columns", "status");
            case "agency":
            case "agencyId": return t("columns", "agency");
            case "isActive": return t("userFormPage", "fieldIsActive");
            case "fullName": return t("userFormPage", "fieldFullName");
            case "email": return t("userFormPage", "fieldEmail");
            case "mobilePhone": return t("userFormPage", "fieldMobilePhone");
            case "commercialPhone": return t("userFormPage", "fieldCommercialPhone");
            case "commercialEmail": return t("userFormPage", "fieldCommercialEmail");
            case "otherDetails": return t("userFormPage", "fieldOtherDetails");
            case "maxActiveDevices": return t("logs", "maxActiveDevices");
            case "cif": return t("clientFormPage", "fieldCif");
            case "contactName": return t("clientFormPage", "fieldContactName");
            case "contactPhone": return t("clientFormPage", "fieldContactPhone");
            case "contactEmail": return t("clientFormPage", "fieldContactEmail");
            case "street": return t("addressForm", "streetLabel");
            case "city": return t("addressForm", "cityLabel");
            case "postalCode": return t("addressForm", "postalCodeLabel");
            case "province": return t("addressForm", "provinceLabel");
            case "country": return t("addressForm", "countryLabel");
            default: return formatFieldName(fallbackSegment);
        }
    }, [t, resolveSimulationFieldLabel]);

    const renderValue = useCallback((v: unknown, fieldKey?: string): React.ReactNode => {
        if (v === null || v === undefined)
            return <em style={{ color: "var(--scheme-neutral-700)" }}>—</em>;
        if (typeof v === "boolean")
            return <span style={{ color: v ? "#34d399" : "#f87171", fontWeight: 600 }}>{String(v)}</span>;
        if (typeof v === "object") {
            const raw = JSON.stringify(v);
            const preview = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
            return (
                <span title={raw} style={{ display: "inline-block", maxWidth: "100%", fontSize: 11, color: "var(--scheme-neutral-400)", whiteSpace: "normal", wordBreak: "break-word" }}>
                    {preview}
                </span>
            );
        }

        const s = String(v);

        if (fieldKey) {
            const nk = fieldKey.toLowerCase();
            if (nk.includes("agency") && s.length > 18 && /^[a-z0-9_-]+$/i.test(s)) {
                return <AgencyValueResolver agencyId={s} getAgencyName={getAgencyName} />;
            }
            if (nk === "country" || nk.endsWith(".country")) {
                const name = getCountryName(s);
                if (name) return <span>{s} ({name})</span>;
            }
        }

        const isId = s.length > 18 && /^[a-z0-9_-]+$/i.test(s);
        const preview = s.length > 160 ? `${s.slice(0, 160)}…` : s;
        return (
            <span title={s} style={{ display: "inline-block", maxWidth: "100%", fontFamily: isId ? "'JetBrains Mono','Fira Code',monospace" : "inherit", fontSize: isId ? 11 : 12, whiteSpace: "normal", wordBreak: "break-word" }}>
                {preview}
            </span>
        );
    }, [getAgencyName, getCountryName]);

    // ── Date format ─────────────────────────────────────────────────────────

    const formatDate = useCallback((isoString: string) => {
        return formatDisplayDateTime(isoString, preferences, { includeSeconds: true, fallback: isoString });
    }, [preferences]);

    // ── Event type options (grouped, filtered by selected target) ────────────

    const TARGET_TO_GROUPS: Record<string, string[]> = {
        SIMULATION: ["Sim"],
        USER: ["User"],
        AGENCY: ["Agency"],
        CLIENT: ["Client"],
        BASE_VALUE_SET: ["BV"],
    };

    const eventTypeOptions = useMemo<FormSelectOption[]>(() => {
        const inLogs = new Set(logs.map((l) => l.eventType));
        const allTypes = Array.from(new Set([...ALL_EVENT_TYPES, ...Array.from(inLogs)])).sort();

        const allowedGroups = localTargetType ? TARGET_TO_GROUPS[localTargetType] : null;

        const opts: FormSelectOption[] = [
            { value: "", label: t("auditLogsModule", "allEvents") },
        ];

        for (const group of GROUP_CONFIG) {
            if (allowedGroups && !group.groupIds.some((g) => allowedGroups.includes(g))) continue;

            const groupTypes = allTypes.filter((et) => {
                const ev = EVENT_REGISTRY[et];
                return ev && group.groupIds.includes(ev.group);
            });
            if (!groupTypes.length) continue;

            const groupLabel = t("auditLogsModule", group.labelKey as Parameters<typeof t>[1]);
            for (const et of groupTypes) {
                opts.push({
                    value: et,
                    label: getEventTypeLabel(et, t),
                    secondaryLabel: et,
                    group: groupLabel,
                });
            }
        }

        return opts;
    }, [logs, t, localTargetType]);

    const columns = useMemo<ColumnDef<AuditLogItem>[]>(() => [
        {
            key: "eventType",
            label: t("auditLogsModal", "eventType"),
            width: "190",
            renderCell: (log) => <EventChip eventType={log.eventType} t={t} />,
        },
        {
            key: "actor",
            label: t("auditLogsModal", "actor"),
            width: "260",
            copyable: true,
            copyText: (log) => [log.actorName, log.actorEmail].filter(Boolean).join(" "),
            renderCell: (log) => (
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--scheme-neutral-100)", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.actorName || t("auditLogsModule", "groupAuth")}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "var(--scheme-neutral-500)", fontSize: "0.65rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.actorEmail || "—"}
                    </Typography>
                </Stack>
            ),
        },
        {
            key: "targetType",
            label: t("logs", "target"),
            width: "150",
            renderCell: (log) => (
                <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--scheme-neutral-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {log.targetType || "—"}
                </Typography>
            ),
        },
        {
            key: "targetName",
            label: t("columns", "name"),
            copyable: true,
            copyText: (log) => log.targetName ?? log.targetId ?? "",
            renderCell: (log) => {
                const route = getTargetRoute(log.targetType, log.targetId);
                const label = log.targetName ?? (log.targetId ? `${log.targetId.slice(0, 10)}...` : "—");
                if (route && log.targetName) {
                    return (
                        <Typography
                            variant="caption"
                            component="button"
                            onClick={(e) => { e.stopPropagation(); window.open(route, "_blank"); }}
                            title={log.targetId ?? undefined}
                            sx={{
                                border: 0,
                                background: "transparent",
                                p: 0,
                                font: "inherit",
                                fontSize: "0.72rem",
                                color: "primary.main",
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                minWidth: 0,
                                "&:hover": { textDecoration: "underline" },
                            }}
                        >
                            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {label}
                            </Box>
                            <LaunchIcon fontSize="small" sx={{ ml: 0.5, flexShrink: 0 }} />
                        </Typography>
                    );
                }
                return (
                    <Typography
                        variant="caption"
                        title={log.targetId ?? undefined}
                        sx={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "0.68rem", color: "var(--scheme-neutral-500)" }}
                    >
                        {label}
                    </Typography>
                );
            },
        },
        {
            key: "createdAt",
            label: t("auditLogsModal", "timestamp"),
            width: "190",
            renderCell: (log) => (
                <Typography variant="caption" sx={{ color: "var(--scheme-neutral-300)", whiteSpace: "nowrap" }}>
                    {formatDate(log.createdAt)}
                </Typography>
            ),
        },
    ], [formatDate, getTargetRoute, t]);

    return (
        <Stack spacing={3}>
            {errorText && (
                <Box sx={{ p: 2, color: "var(--scheme-danger-500)", borderRadius: 1 }}>
                    <Typography variant="body2">{errorText}</Typography>
                </Box>
            )}

            <TableFiltersDialog
                open={filtersOpen}
                title={t("simulationsModule", "filtersTitle")}
                saveViewLabel={t("simulationsModule", "saveView")}
                clearLabel={t("simulationsModule", "clearFilters")}
                applyLabel={t("simulationsModule", "applyFilters")}
                onClose={() => setFiltersOpen(false)}
                onOpenSaveView={openSaveViewDialog}
                onClear={handleClear}
                onApply={handleSearch}
            >
                <FormSelect
                    label={t("logs", "target")}
                    options={[
                        { value: "", label: t("logs", "allTargets") },
                        { value: "SIMULATION", label: t("auditLogsModule", "groupSimulation") },
                        { value: "USER", label: t("auditLogsModule", "groupUser") },
                        { value: "AGENCY", label: t("auditLogsModule", "groupAgency") },
                        { value: "CLIENT", label: t("auditLogsModule", "groupClient") },
                        { value: "BASE_VALUE_SET", label: t("auditLogsModule", "groupBaseValues") },
                    ]}
                    value={localTargetType}
                    onChange={(value) => {
                        const next = String(value ?? "");
                        setLocalTargetType(next);
                        if (next && localEventType) {
                            const ev = EVENT_REGISTRY[localEventType];
                            const allowed = TARGET_TO_GROUPS[next];
                            if (!ev || !allowed?.includes(ev.group)) {
                                setLocalEventType("");
                            }
                        }
                    }}
                />
                <FormSelect
                    label={t("auditLogsModal", "eventType")}
                    options={eventTypeOptions}
                    value={localEventType}
                    onChange={(value) => setLocalEventType(String(value ?? ""))}
                />
                <DateInput
                    label={t("datePicker", "from")}
                    labelPosition="top"
                    value={toDateOnly(localDateFrom)}
                    onChange={(value) => setLocalDateFrom(value ? new Date(`${value}T00:00:00`) : null)}
                />
                <DateInput
                    label={t("datePicker", "to")}
                    labelPosition="top"
                    value={toDateOnly(localDateTo)}
                    onChange={(value) => setLocalDateTo(value ? new Date(`${value}T00:00:00`) : null)}
                />
            </TableFiltersDialog>

            <DataTable<AuditLogItem>
                tableId="audit-logs"
                columns={columns}
                rows={logs}
                loading={loading}
                {...searchProps}
                onClearFilters={handleClear}
                hasActiveFilters={Boolean(searchQuery || toolbarFilterCount)}
                headerRight={(
                    <TableFilterButton
                        title={t("simulationsModule", "filtersTitle")}
                        activeFilterCount={toolbarFilterCount}
                        onClick={() => setFiltersOpen(true)}
                    />
                )}
                emptyMessage={t("auditLogsModal", "noLogs")}
                pagination={{
                    page,
                    pageSize,
                    total,
                    onPageChange: setPage,
                    onPageSizeChange: setPageSize,
                }}
                t={t}
                rowDetailContent={(log) => {
                    const metadata = log.metadataJson as Record<string, unknown> | null | undefined;
                    if (!metadata || Object.keys(metadata).length === 0) return null;
                    return (
                        <FieldChangeDetails
                            metadata={metadata}
                            resolveFieldLabel={resolveFieldLabel}
                            renderValue={renderValue}
                        />
                    );
                }}
                mobileCard={{
                    title: "eventType",
                    status: "targetType",
                    fields: ["actor", "targetName", "createdAt"],
                }}
            />
            {saveViewDialog}
        </Stack>
    );
}
