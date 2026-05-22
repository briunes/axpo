"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { useI18n } from "../../../../src/lib/i18n-context";
import { listAuditLogs, type AuditLogItem } from "../../lib/internalApi";
import { formatDisplayDate } from "../../lib/formatPreferences";
import { useUserPreferences } from "../providers/UserPreferencesProvider";

interface AuditLogsModalProps {
    open: boolean;
    onClose: () => void;
    targetType: string;
    targetId: string;
    token: string;
    title?: string;
}

// Field change details component
function FieldChangeDetails({
    metadata,
    resolveFieldLabel,
    renderValue,
}: {
    metadata: Record<string, unknown>;
    resolveFieldLabel: (key: string) => string;
    renderValue: (v: unknown) => React.ReactNode;
}) {
    const hasDiff =
        "before" in metadata && "after" in metadata &&
        typeof metadata.before === "object" && metadata.before !== null &&
        typeof metadata.after === "object" && metadata.after !== null;

    if (!hasDiff) return null;

    const before = metadata.before as Record<string, unknown>;
    const after = metadata.after as Record<string, unknown>;
    const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    const parseJsonLike = (value: unknown): unknown => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        if (
            !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
            !(trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
            return value;
        }
        try {
            return JSON.parse(trimmed) as unknown;
        } catch {
            return value;
        }
    };

    const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    const rows: Array<{ key: string; oldVal: unknown; newVal: unknown }> = [];
    for (const f of fields) {
        const oldRaw = before[f];
        const newRaw = after[f];
        const oldParsed = parseJsonLike(oldRaw);
        const newParsed = parseJsonLike(newRaw);

        const oldIsObj = isObjectRecord(oldParsed);
        const newIsObj = isObjectRecord(newParsed);

        if (oldIsObj || newIsObj) {
            const oldObj = oldIsObj ? oldParsed : {};
            const newObj = newIsObj ? newParsed : {};
            const subKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
            for (const subKey of subKeys) {
                rows.push({
                    key: `${f}.${subKey}`,
                    oldVal: oldObj[subKey],
                    newVal: newObj[subKey],
                });
            }
            continue;
        }

        rows.push({ key: f, oldVal: oldRaw, newVal: newRaw });
    }

    const rowBase: React.CSSProperties = {
        display: "grid",
        padding: "12px 14px",
        borderBottom: "1px solid var(--scheme-neutral-920)",
        alignItems: "center",
        gap: 12,
        gridTemplateColumns: "160px 1fr 1fr",
    };

    const fieldLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--scheme-neutral-500)",
        letterSpacing: "0.03em",
    };

    return (
        <Box sx={{ p: 2, backgroundColor: "var(--scheme-neutral-1045)" }}>
            <div style={{ ...rowBase, background: "rgba(148,163,184,.03)", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
                <span style={fieldLabel}>Field</span>
                <span style={fieldLabel}>Old value</span>
                <span style={fieldLabel}>New value</span>
            </div>
            {rows.map(({ key, oldVal, newVal }) => {
                const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                return (
                    <div key={key} style={{ ...rowBase, background: changed ? "rgba(251,191,36,.04)" : undefined }}>
                        <span style={fieldLabel}>{resolveFieldLabel(key)}</span>
                        <span style={{ fontSize: 12, color: "var(--scheme-neutral-400)" }}>{renderValue(oldVal)}</span>
                        <span style={{ fontSize: 12, color: changed ? "#fbbf24" : "var(--scheme-neutral-200)", fontWeight: changed ? 600 : 400 }}>
                            {renderValue(newVal)}
                        </span>
                    </div>
                );
            })}
        </Box>
    );
}

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
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Update pageSize when user preferences change
    useEffect(() => {
        setPageSize(preferences.itemsPerPage);
    }, [preferences.itemsPerPage]);

    const fetchLogs = useCallback(async () => {
        if (!open || !token) return;

        setLoading(true);
        setError(null);

        try {
            const result = await listAuditLogs(token, {
                page: page + 1, // MUI uses 0-based, API uses 1-based
                limit: pageSize,
                search: targetId, // Search for just the targetId
            });

            setLogs(result.items);
            setTotal(result.pagination.total);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("common", "error");
            setError(message);
            console.error("Failed to fetch audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [open, token, page, pageSize, targetId, t]);

    useEffect(() => {
        if (open) {
            fetchLogs();
        }
    }, [open, fetchLogs]);

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

    const formatFieldName = (key: string): string => {
        return key.replace(/([A-Z])/g, " $1").replace(/^[a-z]/, (c) => c.toUpperCase());
    };

    const normalizeAuditFieldKey = (value: string): string => {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    };

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

    const renderValue = (v: unknown): React.ReactNode => {
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
                {error && (
                    <Box sx={{ p: 2, color: "var(--scheme-danger-500)", backgroundColor: "rgba(239, 68, 68, 0.05)" }}>
                        <Typography variant="body2">{error}</Typography>
                    </Box>
                )}

                {loading && logs.length === 0 ? (
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
                ) : logs.length === 0 ? (
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
                                {logs.map((log, idx) => {
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

                {logs.length > 0 && (
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={total}
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
