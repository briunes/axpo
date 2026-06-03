"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Stack,
    CircularProgress,
    TablePagination,
    Typography,
    Chip,
    Collapse,
    IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Country } from "country-state-city";
import { useI18n } from "../../../../src/lib/i18n-context";
import { listAuditLogs, type AuditLogItem, getAgency, listUsers, type UserItem } from "../../lib/internalApi";
import { AgencyValueResolver, FieldChangeDetails, formatFieldName, normalizeAuditFieldKey } from "./AuditLogShared";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { DateRangePicker } from "./DateRangePicker";
import { FormSelect, type FormSelectOption } from "./FormSelect";
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
const ENTITY_EVENT_TYPES: Record<string, string[]> = {
    USER: ["USER_CREATED", "USER_UPDATED", "USER_DELETED", "USER_STATUS_CHANGED", "USER_PIN_ROTATED"],
    CLIENT: ["CLIENT_CREATED", "CLIENT_UPDATED", "CLIENT_DELETED"],
    AGENCY: ["AGENCY_CREATED", "AGENCY_UPDATED", "AGENCY_DELETED"],
    SIMULATION: [
        "SIMULATION_CREATED",
        "SIMULATION_UPDATED",
        "SIMULATION_CALCULATED",
        "SIMULATION_SHARED",
        "SIMULATION_CLONED",
        "SIMULATION_DELETED",
        "SIMULATION_PIN_ROTATED",
        "SIMULATION_PIN_SNAPSHOT_ROTATED",
        "SIMULATION_OCR_APPLIED",
        "SIMULATION_OCR_PREFILL",
        "SIMULATION_BULK_DELETED",
        "SIMULATION_BULK_ARCHIVED",
    ],
};

interface AuditLogsModalProps {
    open: boolean;
    onClose: () => void;
    targetType: string;
    targetId: string;
    token: string;
    title?: string;
}

// AgencyValueResolver and FieldChangeDetails are now in AuditLogShared.tsx

export function AuditLogsModal({
    open,
    onClose,
    targetType,
    targetId,
    token,
    title,
}: AuditLogsModalProps) {
    const { t } = useI18n();
    const { preferences } = useUserPreferences();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(preferences.itemsPerPage);
    const [error, setError] = useState<string | null>(null);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [filterEventType, setFilterEventType] = useState("");
    const [filterActorUserId, setFilterActorUserId] = useState("");
    const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
    const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
    const [appliedEventType, setAppliedEventType] = useState("");
    const [appliedActorUserId, setAppliedActorUserId] = useState("");
    const [appliedStartDate, setAppliedStartDate] = useState<Date | null>(null);
    const [appliedEndDate, setAppliedEndDate] = useState<Date | null>(null);
    const [users, setUsers] = useState<UserItem[]>([]);

    // Use ref for cache to avoid dependency issues
    const agenciesCacheRef = React.useRef<Map<string, string>>(new Map());
    const agenciesInFlightRef = React.useRef<Map<string, Promise<string | null>>>(new Map());

    // Update pageSize when user preferences change
    useEffect(() => {
        setPageSize(preferences.itemsPerPage);
    }, [preferences.itemsPerPage]);

    // Helper: Resolve country code to country name
    const getCountryName = useCallback((countryCode: string): string | null => {
        if (!countryCode || typeof countryCode !== "string") return null;
        try {
            const country = Country.getCountryByCode(countryCode);
            return country?.name || null;
        } catch {
            return null;
        }
    }, []);

    // Helper: Resolve agency ID to agency name
    const getAgencyName = useCallback(
        async (agencyId: string): Promise<string | null> => {
            if (!agencyId || typeof agencyId !== "string") return null;

            // Check resolved cache first
            if (agenciesCacheRef.current.has(agencyId)) {
                const cached = agenciesCacheRef.current.get(agencyId);
                return cached || null;
            }

            // Check if already in-flight
            if (agenciesInFlightRef.current.has(agencyId)) {
                return agenciesInFlightRef.current.get(agencyId)!;
            }

            // Create the fetch promise and cache it
            const promise = (async () => {
                try {
                    const agency = await getAgency(token, agencyId);
                    const name = agency?.name || null;

                    // Update resolved cache
                    agenciesCacheRef.current.set(agencyId, name || "");

                    return name;
                } catch (err) {
                    console.error("Failed to fetch agency:", err);
                    // Cache the failed lookup to avoid repeated requests
                    agenciesCacheRef.current.set(agencyId, "");
                    return null;
                } finally {
                    // Remove from in-flight after completion
                    agenciesInFlightRef.current.delete(agencyId);
                }
            })();

            // Cache the promise while in-flight
            agenciesInFlightRef.current.set(agencyId, promise);

            return promise;
        },
        [token]
    );

    const toDateOnly = (date: Date | null): string | undefined => {
        if (!date) return undefined;
        const localDate = new Date(date);
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, "0");
        const day = String(localDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const fetchUsers = useCallback(async () => {
        if (!open || !token) return;

        try {
            const firstPage = await listUsers(token, {
                page: 1,
                pageSize: 100,
                includeDeleted: true,
            });

            const allUsers: UserItem[] = [...firstPage.items];
            const totalPages = Math.max(1, Math.ceil(firstPage.total / firstPage.pageSize));

            if (totalPages > 1) {
                for (let nextPage = 2; nextPage <= totalPages; nextPage++) {
                    const nextResult = await listUsers(token, {
                        page: nextPage,
                        pageSize: 100,
                        includeDeleted: true,
                    });
                    allUsers.push(...nextResult.items);
                }
            }

            setUsers(allUsers);
        } catch (err) {
            console.error("Failed to fetch users for audit filters:", err);
            setUsers([]);
        }
    }, [open, token]);

    const fetchLogs = useCallback(async () => {
        if (!open || !token) return;

        setLoading(true);
        setError(null);

        try {
            const baseParams = {
                limit: 100,
                excludeAuthEvents: true,
                search: targetId,
                ...(appliedEventType ? { eventType: appliedEventType } : {}),
                ...(appliedStartDate ? { dateFrom: toDateOnly(appliedStartDate) } : {}),
                ...(appliedEndDate ? { dateTo: toDateOnly(appliedEndDate) } : {}),
            };

            const firstPage = await listAuditLogs(token, {
                ...baseParams,
                page: 1,
            });

            const allItems: AuditLogItem[] = [...firstPage.items];

            if (firstPage.pagination.totalPages > 1) {
                for (let nextPage = 2; nextPage <= firstPage.pagination.totalPages; nextPage++) {
                    const nextResult = await listAuditLogs(token, {
                        ...baseParams,
                        page: nextPage,
                    });
                    allItems.push(...nextResult.items);
                }
            }

            setLogs(allItems);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("common", "error");
            setError(message);
            console.error("Failed to fetch audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [open, token, targetId, t, appliedEventType, appliedStartDate, appliedEndDate]);

    useEffect(() => {
        if (open) {
            fetchLogs();
            fetchUsers();
        }
    }, [open, fetchLogs, fetchUsers]);

    const handleSearchFilters = () => {
        setAppliedEventType(filterEventType);
        setAppliedActorUserId(filterActorUserId);
        setAppliedStartDate(filterStartDate);
        setAppliedEndDate(filterEndDate);
        setPage(0);
        setExpandedLogId(null);
    };

    const handleClearFilters = () => {
        setFilterEventType("");
        setFilterActorUserId("");
        setFilterStartDate(null);
        setFilterEndDate(null);
        setAppliedEventType("");
        setAppliedActorUserId("");
        setAppliedStartDate(null);
        setAppliedEndDate(null);
        setPage(0);
        setExpandedLogId(null);
    };

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setPageSize(parseInt(event.target.value, 10));
        setPage(0);
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const formatted = formatDisplayDate(date, preferences.dateFormat);
            // Add time in HH:mm format
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${formatted} ${hours}:${minutes}`;
        } catch {
            return isoString;
        }
    };

    // formatFieldName and normalizeAuditFieldKey imported from AuditLogShared.tsx

    const resolveSimulationFieldLabel = (rawKey: string): string | null => {
        const segments = rawKey.split(".");
        const last = segments[segments.length - 1] ?? rawKey;
        const normalizedPath = normalizeAuditFieldKey(rawKey);
        const normalizedLast = normalizeAuditFieldKey(last);

        const pick = (labelKey: "fieldAnnualConsumption" | "fieldCups" | "fieldCurrentInvoice" | "fieldConsumption" | "fieldReactiveEnergy" | "fieldMeterRental" | "fieldOtherCharges" | "sectionInvoiceData" | "sectionClientInfo" | "fieldCurrentSupplier" | "fieldSalesAgent" | "fieldAccessTariff" | "fieldVat" | "fieldIgic" | "fieldStartDate" | "fieldEndDate" | "fieldAddress" | "fieldClientName") =>
            t("simulationForm", labelKey);

        if (normalizedLast === "invoicedata") {
            return pick("sectionInvoiceData");
        }

        if (normalizedLast === "clientdata") {
            return pick("sectionClientInfo");
        }

        if (
            normalizedLast === "annualconsumption" ||
            normalizedLast === "consumoanual" ||
            normalizedLast === "consumoanualkwh" ||
            normalizedPath.includes("annualconsumption") ||
            normalizedPath.includes("consumoanual")
        ) {
            return pick("fieldAnnualConsumption");
        }

        if (
            normalizedLast === "cups" ||
            normalizedPath.endsWith("clientdatacups") ||
            normalizedPath.includes("fieldcups")
        ) {
            return pick("fieldCups");
        }

        if (normalizedLast === "currentinvoice" || normalizedPath.includes("currentinvoice")) {
            return pick("fieldCurrentInvoice");
        }

        if (normalizedLast === "cif") {
            return t("clientFormPage", "fieldCif");
        }

        if (normalizedLast === "ivatasa" || normalizedLast === "iva") {
            return pick("fieldVat");
        }

        if (normalizedLast === "igictasa" || normalizedLast === "igic") {
            return pick("fieldIgic");
        }

        if (normalizedLast === "fechaini" || normalizedLast === "startdate") {
            return pick("fieldStartDate");
        }

        if (normalizedLast === "fechafin" || normalizedLast === "enddate") {
            return pick("fieldEndDate");
        }

        if (normalizedLast === "direccion" || normalizedLast === "address") {
            return pick("fieldAddress");
        }

        if (normalizedLast === "clientename" || normalizedLast === "clientname") {
            return pick("fieldClientName");
        }

        const periodMatch = normalizedLast.match(/^(consumop|potenciap|precioenergiap|preciopotenciap)(\d+)$/);
        if (periodMatch) {
            const prefix = periodMatch[1];
            const period = `P${periodMatch[2]}`;

            if (prefix === "consumop") {
                return `${pick("fieldConsumption")} ${period}`;
            }
            if (prefix === "potenciap") {
                return `Power ${period}`;
            }
            if (prefix === "precioenergiap") {
                return `Energy price ${period}`;
            }
            if (prefix === "preciopotenciap") {
                return `Power price ${period}`;
            }
        }

        if (normalizedLast === "consumption" || normalizedLast === "consumo" || normalizedPath.includes("totalconsumption")) {
            return pick("fieldConsumption");
        }

        if (
            normalizedLast === "accesstariff" ||
            normalizedLast === "fieldaccesstariff" ||
            normalizedLast === "fieldtariff" ||
            normalizedLast === "tarifaacceso" ||
            normalizedPath.includes("accesstariff") ||
            normalizedPath.includes("fieldaccesstariff") ||
            normalizedPath.includes("fieldtariff") ||
            normalizedPath.includes("tarifaacceso")
        ) {
            return pick("fieldAccessTariff");
        }

        if (
            normalizedLast === "currentsupplier" ||
            normalizedLast === "comercializadoraactual" ||
            normalizedLast === "comercializadoractual" ||
            normalizedPath.includes("currentsupplier")
        ) {
            return pick("fieldCurrentSupplier");
        }

        if (
            normalizedLast === "salesagent" ||
            normalizedLast === "comercial" ||
            normalizedPath.endsWith("gascomercial") ||
            normalizedPath.includes("salesagent")
        ) {
            return pick("fieldSalesAgent");
        }

        if (normalizedLast === "reactiveenergy" || normalizedPath.includes("energiareactiva")) {
            return pick("fieldReactiveEnergy");
        }

        if (normalizedLast === "meterrental" || normalizedPath.includes("alquilerequipo") || normalizedPath.includes("alquilerequipo") || normalizedPath.includes("meterrental")) {
            return pick("fieldMeterRental");
        }

        if (normalizedLast === "othercharges" || normalizedPath.includes("otroscargos") || normalizedPath.includes("othercharges")) {
            return pick("fieldOtherCharges");
        }

        return null;
    };

    const resolveFieldLabel = (key: string): string => {
        const simulationLabel = resolveSimulationFieldLabel(key);
        if (simulationLabel) return simulationLabel;

        const fallbackSegment = key.includes(".")
            ? (key.split(".").pop() ?? key)
            : key;

        switch (key) {
            // Shared/common
            case "id":
                return t("columns", "id");
            case "name":
                return t("columns", "name");
            case "role":
                return t("columns", "role");
            case "status":
                return t("columns", "status");
            case "agency":
            case "agencyId":
                return t("columns", "agency");
            case "isActive":
                return t("userFormPage", "fieldIsActive");

            // User fields
            case "fullName":
                return t("userFormPage", "fieldFullName");
            case "email":
                return t("userFormPage", "fieldEmail");
            case "mobilePhone":
                return t("userFormPage", "fieldMobilePhone");
            case "commercialPhone":
                return t("userFormPage", "fieldCommercialPhone");
            case "commercialEmail":
                return t("userFormPage", "fieldCommercialEmail");
            case "otherDetails":
                return t("userFormPage", "fieldOtherDetails");

            // Client fields
            case "cif":
                return t("clientFormPage", "fieldCif");
            case "contactName":
                return t("clientFormPage", "fieldContactName");
            case "contactPhone":
                return t("clientFormPage", "fieldContactPhone");
            case "contactEmail":
                return t("clientFormPage", "fieldContactEmail");

            // Address fields
            case "street":
                return t("addressForm", "streetLabel");
            case "city":
                return t("addressForm", "cityLabel");
            case "postalCode":
                return t("addressForm", "postalCodeLabel");
            case "province":
                return t("addressForm", "provinceLabel");
            case "country":
                return t("addressForm", "countryLabel");

            default:
                return formatFieldName(fallbackSegment);
        }
    };

    const renderValue = (v: unknown, fieldKey?: string): React.ReactNode => {
        if (v === null || v === undefined)
            return <em style={{ color: "var(--scheme-neutral-700)" }}>—</em>;
        if (typeof v === "boolean")
            return <span style={{ color: v ? "#34d399" : "#f87171", fontWeight: 600 }}>{String(v)}</span>;
        if (typeof v === "object") {
            const raw = JSON.stringify(v);
            const preview = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
            return (
                <span
                    title={raw}
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        fontSize: 11,
                        color: "var(--scheme-neutral-400)",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                    }}
                >
                    {preview}
                </span>
            );
        }

        const s = String(v);

        // Handle special field types with context awareness
        if (fieldKey) {
            const normalizedKey = fieldKey.toLowerCase();

            // Handle agency/agencyId fields - try to resolve to name
            if (normalizedKey.includes("agency") && s.length > 18 && /^[a-z0-9_-]+$/i.test(s)) {
                // This looks like an ID, attempt async resolution
                // For now, return a placeholder and use state management
                // We'll handle this with async rendering below
                return <AgencyValueResolver agencyId={s} getAgencyName={getAgencyName} />;
            }

            // Handle country fields - resolve code to name
            if (normalizedKey === "country" || normalizedKey.endsWith(".country")) {
                const countryName = getCountryName(s);
                if (countryName) {
                    return (
                        <span style={{ display: "inline-block", maxWidth: "100%" }}>
                            {s} ({countryName})
                        </span>
                    );
                }
            }
        }

        const isId = s.length > 18 && /^[a-z0-9_-]+$/i.test(s);
        const preview = s.length > 160 ? `${s.slice(0, 160)}…` : s;
        return (
            <span
                title={s}
                style={{
                    display: "inline-block",
                    maxWidth: "100%",
                    fontFamily: isId ? "'JetBrains Mono','Fira Code',monospace" : "inherit",
                    fontSize: isId ? 11 : 12,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                }}
            >
                {preview}
            </span>
        );
    };

    const getEventTypeColor = (eventType: string): "default" | "primary" | "secondary" => {
        if (eventType.includes("CREATE")) return "primary";
        if (eventType.includes("UPDATE")) return "secondary";
        if (eventType.includes("DELETE")) return "default";
        return "default";
    };

    const getEventTypeLabel = (eventType: string): string => {
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
        if (eventType === "PUBLIC_ACCESS_ATTEMPT") return t("auditEvents", "accessAttempt");
        return eventType;
    };

    const eventTypeOptions = useMemo(() => {
        const options = new Set<string>([
            ...(ENTITY_EVENT_TYPES[targetType] || []),
            ...logs
                .map((log) => log.eventType)
                .filter((eventType) => eventType.startsWith(`${targetType}_`)),
        ]);
        if (filterEventType) options.add(filterEventType);
        return Array.from(options).sort((a, b) => a.localeCompare(b));
    }, [logs, filterEventType, targetType]);

    const eventTypeSelectOptions = useMemo<FormSelectOption[]>(() => {
        return [
            { value: "", label: "All" },
            ...eventTypeOptions.map((eventType) => ({
                value: eventType,
                label: getEventTypeLabel(eventType),
                secondaryLabel: eventType,
            })),
        ];
    }, [eventTypeOptions, getEventTypeLabel]);

    const userOptions = useMemo(() => {
        return [...users].sort((a, b) => {
            const aLabel = `${a.fullName} ${a.email}`.toLowerCase();
            const bLabel = `${b.fullName} ${b.email}`.toLowerCase();
            return aLabel.localeCompare(bLabel);
        });
    }, [users]);

    const userSelectOptions = useMemo<FormSelectOption[]>(() => {
        return [
            { value: "", label: "All" },
            { value: "__system__", label: "System" },
            ...userOptions.map((user) => ({
                value: user.id,
                label: user.fullName,
                secondaryLabel: user.email,
            })),
        ];
    }, [userOptions]);

    const filteredLogs = useMemo(() => {
        if (!appliedActorUserId) return logs;
        if (appliedActorUserId === "__system__") {
            return logs.filter((log) => !log.actorUserId);
        }
        return logs.filter((log) => log.actorUserId === appliedActorUserId);
    }, [logs, appliedActorUserId]);

    const paginatedLogs = useMemo(() => {
        const start = page * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, page, pageSize]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth

        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--scheme-neutral-900)",
                    color: "var(--scheme-neutral-100)",
                    backgroundColor: "var(--scheme-neutral-1050)",
                    padding: "16px 20px",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                }}
            >
                <span>{title || t("auditLogsModal", "title")}</span>
                <Button
                    onClick={onClose}
                    size="small"
                    sx={{
                        minWidth: "auto",
                        padding: "4px",
                        color: "var(--scheme-neutral-500)",
                        "&:hover": {
                            backgroundColor: "var(--scheme-neutral-900)",
                            color: "var(--scheme-neutral-100)",
                        },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </Button>
            </DialogTitle>

            <DialogContent
                sx={{
                    padding: 0,
                    backgroundColor: "var(--scheme-neutral-1050)",
                    color: "var(--scheme-neutral-100)",
                }}
            >
                <Box
                    sx={{
                        p: 2,
                        borderBottom: "1px solid var(--scheme-neutral-920)",
                        backgroundColor: "var(--scheme-neutral-1045)",
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                        <Box sx={{ minWidth: 220 }}>
                            <FormSelect
                                label={t("auditLogsModal", "eventType")}
                                options={eventTypeSelectOptions}
                                value={filterEventType}
                                onChange={(value) => setFilterEventType(String(value ?? ""))}
                                size="small"
                            />
                        </Box>

                        <Box sx={{ minWidth: 280 }}>
                            <FormSelect
                                label={t("auditLogsModal", "actor")}
                                options={userSelectOptions}
                                value={filterActorUserId}
                                onChange={(value) => setFilterActorUserId(String(value ?? ""))}
                                size="small"
                            />
                        </Box>

                        <Box sx={{ minWidth: 280, flex: 1 }}>
                            <DateRangePicker
                                labelPosition="top"
                                variant="single"
                                label={t("auditLogsModal", "timestamp")}
                                startDate={filterStartDate}
                                endDate={filterEndDate}
                                onChange={(startDate, endDate) => {
                                    setFilterStartDate(startDate);
                                    setFilterEndDate(endDate);
                                }}
                            />
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "stretch", md: "flex-end" } }}>
                            <Button variant="contained" onClick={handleSearchFilters}>
                                <SearchIcon />
                                {t("common", "search")}
                            </Button>
                            <Button variant="outlined" onClick={handleClearFilters}>
                                <ClearIcon />
                                {t("dataTable", "clearFilters")}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                {error && (
                    <Box sx={{ p: 2, color: "var(--scheme-danger-500)", backgroundColor: "rgba(239, 68, 68, 0.05)" }}>
                        <Typography variant="body2">{error}</Typography>
                    </Box>
                )}

                {loading && filteredLogs.length === 0 ? (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: "400px",
                        }}
                    >
                        <CircularProgress size={40} />
                    </Box>
                ) : filteredLogs.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                        <Typography variant="body2" sx={{ color: "var(--scheme-neutral-600)" }}>
                            {t("auditLogsModal", "noLogs")}
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer
                        component={Paper}
                        sx={{
                            backgroundColor: "var(--scheme-neutral-1050)",
                            borderRadius: 0,
                        }}
                    >
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
                                    <TableCell>{t("auditLogsModal", "timestamp")}</TableCell>
                                    <TableCell align="right">{t("auditLogsModal", "details")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedLogs.map((log, idx) => {
                                    const hasChanges = log.metadataJson && "before" in log.metadataJson && "after" in log.metadataJson;
                                    const isExpanded = expandedLogId === log.id;
                                    return (
                                        <React.Fragment key={log.id}>
                                            <TableRow
                                                sx={{
                                                    backgroundColor: idx % 2 === 0 ? "var(--scheme-neutral-1050)" : "var(--scheme-neutral-1045)",
                                                    "&:hover": {
                                                        backgroundColor: "var(--scheme-neutral-1040)",
                                                    },
                                                    transition: "background-color 150ms ease",
                                                    "& td": {
                                                        color: "var(--scheme-neutral-200)",
                                                        borderBottom: "1px solid var(--scheme-neutral-920)",
                                                        padding: "12px",
                                                    },
                                                }}
                                            >
                                                <TableCell>
                                                    <Chip
                                                        label={getEventTypeLabel(log.eventType)}
                                                        size="small"
                                                        color={getEventTypeColor(log.eventType)}
                                                        variant="outlined"
                                                        sx={{
                                                            height: "24px",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--scheme-neutral-100)" }}>
                                                            {log.actorName || "System"}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: "var(--scheme-neutral-500)",
                                                                fontSize: "0.65rem",
                                                            }}
                                                        >
                                                            {log.actorEmail || "—"}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" sx={{ color: "var(--scheme-neutral-300)" }}>
                                                        {formatDate(log.createdAt)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {hasChanges ? (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                            sx={{
                                                                color: "var(--scheme-primary-500)",
                                                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                                transition: "transform 200ms ease",
                                                            }}
                                                        >
                                                            <ExpandMoreIcon fontSize="small" />
                                                        </IconButton>
                                                    ) : (
                                                        <Typography variant="caption" sx={{ color: "var(--scheme-neutral-600)" }}>
                                                            —
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
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
                                                    <TableCell colSpan={4}>
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

                {filteredLogs.length > 0 && (
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={filteredLogs.length}
                        rowsPerPage={pageSize}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        sx={{
                            backgroundColor: "var(--scheme-neutral-950)",
                            color: "var(--scheme-neutral-500)",
                            borderTop: "1px solid var(--scheme-neutral-900)",
                            "& .MuiTablePagination-toolbar": {
                                paddingRight: "8px",
                                minHeight: "48px",
                            },
                            "& .MuiTablePagination-select": {
                                color: "var(--scheme-neutral-400)",
                            },
                            "& .MuiIconButton-root": {
                                color: "var(--scheme-neutral-500)",
                            },
                        }}
                    />
                )}
            </DialogContent>

            <DialogActions
                sx={{
                    borderTop: "1px solid var(--scheme-neutral-900)",
                    padding: "12px 16px",
                    backgroundColor: "var(--scheme-neutral-1040)",
                }}
            >
                <Button onClick={onClose} variant="outlined" size="small">
                    {t("common", "close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
