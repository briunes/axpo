"use client";

import React, { useCallback, useEffect, useMemo, useLayoutEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { FormSelect, type FormSelectOption } from "../ui/FormSelect";
import LaunchIcon from '@mui/icons-material/Launch';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { Button as OnceButton, Column } from "@once-ui-system/core";
import { Country } from "country-state-city";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { AuditLogItem } from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import type { AuditLogsActions } from "../hooks/useAuditLogs";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { DateRangePicker } from "../ui/DateRangePicker";
import {
    AgencyValueResolver,
    FieldChangeDetails,
    formatFieldName,
    normalizeAuditFieldKey,
    makeGetAgencyName,
} from "../ui/AuditLogShared";
import { FormInput } from "../ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogsModuleProps {
    session: SessionState;
    actions: AuditLogsActions;
    onNotify?: (text: string, tone: "success" | "error") => void;
    onActionButtons?: (buttons: React.ReactNode) => void;
}

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
    if (eventType === "AUTH_SESSION_AUTO_KEPT") return "Session kept";
    if (eventType === "AUTH_SESSION_AUTO_KICK") return "Session kicked";
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
        filterActorSearch,
        setFilterActorSearch,
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
    const [localActorSearch, setLocalActorSearch] = useState(filterActorSearch);
    const [localTargetType, setLocalTargetType] = useState(filterTargetType);

    const [expandedId, setExpandedId] = useState<string | null>(null);

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
        setExpandedId(null);
    }, [page, filterEventType, filterDateFrom, filterDateTo]);

    // ── Action buttons ──────────────────────────────────────────────────────
    useLayoutEffect(() => {
        onActionButtons?.(
            <>
                <OnceButton variant="secondary" size="s" onClick={handleExportCsv} label={t("auditLogsModule", "exportCsv")} disabled={filteredLogs.length === 0} />
                <OnceButton variant="secondary" size="s" onClick={() => refresh()} label={t("actions", "refresh")} loading={loading} />
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
        setFilterActorSearch(localActorSearch);
        setFilterTargetType(localTargetType);
        setPage(1);
        setExpandedId(null);
    };

    const handleClear = () => {
        setLocalEventType("");
        setLocalDateFrom(null);
        setLocalDateTo(null);
        setLocalActorSearch("");
        setLocalTargetType("");
        setFilterEventType("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterActorSearch("");
        setFilterTargetType("");
        setSearchQuery("");
        setPage(1);
        setExpandedId(null);
    };

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
            case "maxActiveDevices": return "Max Active Devices";
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
        try {
            const date = new Date(isoString);
            const formatted = formatDisplayDate(date, preferences.dateFormat);
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            const seconds = String(date.getSeconds()).padStart(2, "0");
            return `${formatted} ${hours}:${minutes}:${seconds}`;
        } catch {
            return isoString;
        }
    }, [preferences.dateFormat]);

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

    // ── Row toggle ──────────────────────────────────────────────────────────

    const handleToggle = (id: string, hasMeta: boolean) => {
        if (!hasMeta) return;
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const safePage = Math.min(page, Math.max(totalPages, 1));

    return (
        <Column gap="24" >
            {errorText && (
                <Box sx={{ p: 2, color: "var(--scheme-danger-500)", borderRadius: 1 }}>
                    <Typography variant="body2">{errorText}</Typography>
                </Box>
            )}

            {/* Filters */}
            <Box
                sx={{
                    pt: 2,
                    px: 2,
                }}
            >
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap" >
                    <Box sx={{ minWidth: 180, flex: 1, }}>
                        <FormSelect
                            label=""
                            options={[
                                { value: "", label: "All targets" },
                                { value: "SIMULATION", label: "Simulation" },
                                { value: "USER", label: "User" },
                                { value: "AGENCY", label: "Agency" },
                                { value: "CLIENT", label: "Client" },
                                { value: "BASE_VALUE_SET", label: "Base Value Set" },
                            ]}
                            value={localTargetType}
                            onChange={(value) => {
                                const next = String(value ?? "");
                                setLocalTargetType(next);
                                // reset event type if it no longer belongs to the new target
                                if (next && localEventType) {
                                    const ev = EVENT_REGISTRY[localEventType];
                                    const allowed = TARGET_TO_GROUPS[next];
                                    if (!ev || !allowed?.includes(ev.group)) {
                                        setLocalEventType("");
                                    }
                                }
                            }}
                        />
                    </Box>

                    <Box sx={{ minWidth: 200, flex: 1 }}>
                        <FormSelect
                            label=""
                            options={eventTypeOptions}
                            value={localEventType}
                            onChange={(value) => setLocalEventType(String(value ?? ""))}
                        />
                    </Box>

                    <Box sx={{ minWidth: 200, flex: 1 }}>
                        <FormInput
                            placeholder="Search by name or email…"
                            value={localActorSearch}
                            onChange={(e) => setLocalActorSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                        />
                    </Box>

                    <Box sx={{ minWidth: 280, flex: 2 }}>
                        <DateRangePicker
                            variant="inline"
                            startDate={localDateFrom}
                            endDate={localDateTo}
                            onChange={(startDate, endDate) => {
                                setLocalDateFrom(startDate);
                                setLocalDateTo(endDate);
                            }}
                        />
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "stretch", md: "flex-end" } }}>
                        <Button variant="contained" onClick={handleSearch} >
                            <SearchIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            {t("common", "search")}
                        </Button>
                        <Button variant="outlined" onClick={handleClear}>
                            <ClearIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            {t("dataTable", "clearFilters")}
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            {/* Table card */}
            <Box
                sx={{
                    overflow: "hidden",
                    border: "1px solid var(--scheme-neutral-900)",
                }}
            >
                {loading && logs.length === 0 ? (
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : logs.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                        <Typography variant="body2" sx={{ color: "var(--scheme-neutral-600)" }}>
                            {t("auditLogsModal", "noLogs")}
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer component={Paper} sx={{ borderRadius: 0 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow
                                    sx={{
                                        backgroundColor: "var(--scheme-neutral-950)",
                                        "& th": {
                                            color: "var(--scheme-neutral-600)",
                                            fontWeight: 700,
                                            fontSize: "0.7rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            borderBottom: "1px solid var(--scheme-neutral-900)",
                                            padding: "14px 12px",
                                            backgroundColor: "var(--scheme-neutral-950)",
                                        },
                                    }}
                                >
                                    <TableCell>{t("auditLogsModal", "eventType")}</TableCell>
                                    <TableCell>{t("auditLogsModal", "actor")}</TableCell>
                                    <TableCell>Target</TableCell>
                                    <TableCell>{t("columns", "name")}</TableCell>
                                    <TableCell>{t("auditLogsModal", "timestamp")}</TableCell>
                                    <TableCell align="right">{t("auditLogsModal", "details")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.map((log) => {
                                    const hasChanges = log.metadataJson && "before" in log.metadataJson && "after" in log.metadataJson;
                                    const isExpanded = expandedId === log.id;
                                    return (
                                        <React.Fragment key={log.id}>
                                            <TableRow
                                                hover
                                                onClick={() => handleToggle(log.id, !!hasChanges)}
                                                sx={{
                                                    cursor: hasChanges ? "pointer" : "default",
                                                    backgroundColor: isExpanded ? "var(--scheme-neutral-1045)" : undefined,
                                                    "&:hover": { backgroundColor: "var(--scheme-neutral-1045)" },
                                                    "& td": {
                                                        borderBottom: "1px solid var(--scheme-neutral-920)",
                                                        padding: "10px 12px",
                                                    },
                                                }}
                                            >
                                                {/* Event */}
                                                <TableCell>
                                                    <EventChip eventType={log.eventType} t={t} />
                                                </TableCell>

                                                {/* Actor */}
                                                <TableCell>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--scheme-neutral-100)" }}>
                                                            {log.actorName || "System"}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: "var(--scheme-neutral-500)", fontSize: "0.65rem" }}>
                                                            {log.actorEmail || "—"}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>

                                                {/* Target */}
                                                <TableCell>
                                                    <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--scheme-neutral-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        {log.targetType || "—"}
                                                    </Typography>
                                                </TableCell>

                                                {/* Target ID */}
                                                <TableCell>
                                                    {(() => {
                                                        const route = getTargetRoute(log.targetType, log.targetId);
                                                        const label = log.targetName ?? (log.targetId ? `${log.targetId.slice(0, 10)}…` : "—");
                                                        if (route && log.targetName) {
                                                            return (
                                                                <Typography
                                                                    variant="caption"
                                                                    onClick={(e) => { e.stopPropagation(); window.open(route, "_blank"); }}
                                                                    title={log.targetId ?? undefined}
                                                                    sx={{
                                                                        fontSize: "0.72rem",
                                                                        color: "primary.main",
                                                                        cursor: "pointer",
                                                                        fontWeight: 600,
                                                                        "&:hover": { textDecoration: "underline" },
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    {label}
                                                                    <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
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
                                                    })()}
                                                </TableCell>

                                                {/* Timestamp */}
                                                <TableCell>
                                                    <Typography variant="caption" sx={{ color: "var(--scheme-neutral-300)", whiteSpace: "nowrap" }}>
                                                        {formatDate(log.createdAt)}
                                                    </Typography>
                                                </TableCell>

                                                {/* Expand toggle */}
                                                <TableCell align="right">
                                                    {hasChanges ? (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => { e.stopPropagation(); handleToggle(log.id, true); }}
                                                            sx={{
                                                                color: "var(--scheme-primary-500)",
                                                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                                transition: "transform 200ms ease",
                                                            }}
                                                        >
                                                            <ExpandMoreIcon fontSize="small" />
                                                        </IconButton>
                                                    ) : (
                                                        <Typography variant="caption" sx={{ color: "var(--scheme-neutral-600)" }}>—</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>

                                            {/* Collapsible field change details */}
                                            {hasChanges && (
                                                <TableRow
                                                    sx={{
                                                        backgroundColor: "var(--scheme-neutral-1045)",
                                                        "& td": {
                                                            borderBottom: "1px solid var(--scheme-neutral-920)",
                                                            padding: 0,
                                                        },
                                                    }}
                                                >
                                                    <TableCell colSpan={6}>
                                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                            <FieldChangeDetails
                                                                metadata={log.metadataJson as Record<string, unknown>}
                                                                resolveFieldLabel={resolveFieldLabel}
                                                                renderValue={renderValue}
                                                            />
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Pagination */}
                {total > 0 && (
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={total}
                        rowsPerPage={pageSize}
                        page={safePage - 1}
                        onPageChange={(_e, newPage) => setPage(newPage + 1)}
                        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
                        sx={{
                            backgroundColor: "var(--scheme-neutral-950)",
                            color: "var(--scheme-neutral-500)",
                            borderTop: "1px solid var(--scheme-neutral-900)",
                            "& .MuiTablePagination-toolbar": { paddingRight: "8px", minHeight: "48px" },
                            "& .MuiTablePagination-select": { color: "var(--scheme-neutral-400)" },
                            "& .MuiIconButton-root": { color: "var(--scheme-neutral-500)" },
                        }}
                    />
                )}
            </Box>
        </Column>
    );
}
