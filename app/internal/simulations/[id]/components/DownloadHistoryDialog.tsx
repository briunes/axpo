"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Typography,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getPdfTemplates, type PdfTemplate } from "../../../lib/configApi";
import { LoadingState } from "../../../components/shared";
import { FormSelect } from "../../../components/ui/FormSelect";
import { buildSimulationPdfFilenameFromSimulation } from "@/infrastructure/pdf/pdfFilename";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Per-period data: avg = 12-month PROMEDIO, monthly = { YYYY-MM -> value } (all in €/kWh) */
interface PeriodData {
    avg: number;
    monthly: Record<string, number>;
}

interface HistoryProduct {
    productKey: string;
    productLabel: string;
    /**
     * Electricity: tariff -> period -> PeriodData
     * Gas:         tariff -> zone (PEN/BAL) -> { avg: number; monthly: {} }
     */
    tariffs: Record<string, Record<string, PeriodData | number>>;
    type?: "GAS";
}

interface HistoryData {
    tarifaAcceso: string;
    perfilCarga: string;
    products: HistoryProduct[];
    months: { label: string; key: string }[];
    // Gas-specific
    isGas?: boolean;
    gasTarifaAcceso?: string;
    gasProducts?: HistoryProduct[];
}

/** Safely extract a numeric value from either a PeriodData or a plain number */
function periodAvg(v: PeriodData | number | undefined): number {
    if (v === undefined || v === null) return 0;
    if (typeof v === "number") return v;
    return v.avg ?? 0;
}

/**
 * Get the per-month value for a period entry.
 *
 * Returns `null` (NOT 0, NOT the 12-month average) when the requested month
 * is missing from `monthly` — the Excel's source sheet uses an explicit `0`
 * to mean "this period was not billed for that month" (e.g. 2.0TD has no
 * P4/P5/P6 columns, and 3.0TD/6.1TD months can have certain periods with
 * zero consumption). The Excel renders those as blank cells, and its
 * MEDIA AVERAGEIF(..., ">0") excludes them from the average.
 *
 * Returning the 12-month `avg` here was the previous bug — it caused every
 * month cell to display roughly the same value.
 */
function periodMonthly(v: PeriodData | number | undefined, monthKey: string): number | null {
    if (v === undefined || v === null) return null;
    if (typeof v === "number") return v;
    if (v.monthly && Object.prototype.hasOwnProperty.call(v.monthly, monthKey)) {
        return v.monthly[monthKey];
    }
    return null;
}

export interface DownloadHistoryDialogProps {
    open: boolean;
    onClose: () => void;
    simulation: any;
    token: string;
    initialProductKey?: string;
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Gas tariff display order */
const GAS_TARIFF_ORDER = [
    "RL01", "RL02", "RL03", "RL04", "RL05", "RL06",
    "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6",
];

function buildGasHistoryHtml(
    data: HistoryData,
    product: HistoryProduct,
    template: PdfTemplate | null,
    axpoPrimary: string,
    simulation?: any,
): string {
    // Build a table showing all tariffs x zones (PEN / BAL)
    const allTariffs = GAS_TARIFF_ORDER.filter((t) => product.tariffs[t]);
    const allZones = Array.from(
        new Set(allTariffs.flatMap((t) => Object.keys(product.tariffs[t] ?? {})))
    ).sort();

    const headerCells = allZones
        .map(
            (z) =>
                `<th style="background:${axpoPrimary};color:#fff;padding:5px 10px;text-align:center;font-weight:bold;font-size:11px;border:1px solid rgba(255,255,255,0.15);">${z}</th>`,
        )
        .join("");

    const tariffRows = allTariffs
        .map(
            (tariff) =>
                `<tr>
          <td style="background:${axpoPrimary};color:#fff;font-weight:bold;padding:5px 10px;font-size:11px;border:1px solid rgba(255,255,255,0.15);white-space:nowrap;">${tariff}</td>
          ${allZones
                    .map(
                        (z) =>
                            `<td style="padding:5px 10px;text-align:center;font-size:11px;border:1px solid #f0f0f0;background:#fff;">${fmtMargin(periodAvg(product.tariffs[tariff]?.[z]))}</td>`,
                    )
                    .join("")}
        </tr>`,
        )
        .join("");

    const gasTableHtml = allTariffs.length === 0
        ? `<p style="color:#aaa;text-align:center;">No hay datos de histórico de gas disponibles.</p>`
        : `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
        <thead>
          <tr>
            <th style="background:${axpoPrimary};color:#fff;padding:5px 10px;text-align:center;font-weight:bold;font-size:11px;border:1px solid rgba(255,255,255,0.15);">Tarifa</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${tariffRows}</tbody>
      </table>`;

    if (template?.htmlContent) {
        const createdAt = simulation?.createdAt
            ? new Date(simulation.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "";

        return template.htmlContent
            .replace(/\{\{HISTORY_TABLES_GAS\}\}/g, gasTableHtml)
            .replace(/\{\{HISTORY_TABLE_GAS\}\}/g, gasTableHtml)
            .replace(/\{\{GAS_PRODUCT_LABEL\}\}/g, product.productLabel)
            .replace(/\{\{GAS_TARIFA\}\}/g, data.gasTarifaAcceso ?? "")
            .replace(/\{\{CLIENT_NAME\}\}/g, simulation?.client?.name ?? "")
            .replace(/\{\{SIMULATION_ID\}\}/g, simulation?.id ?? "")
            .replace(/\{\{SIMULATION_REFERENCE\}\}/g, simulation?.referenceNumber ?? simulation?.id ?? "")
            .replace(/\{\{CREATED_AT\}\}/g, createdAt)
            .replace(/\{\{OWNER_NAME\}\}/g, simulation?.ownerUser?.fullName ?? "")
            .replace(/\{\{OWNER_EMAIL\}\}/g, simulation?.ownerUser?.commercialEmail ?? simulation?.ownerUser?.email ?? "");
    }

    // Built-in default template for gas
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #333; padding: 36px 40px; background: #fff; }
    h2 { text-align: center; font-size: 14px; font-weight: bold; color: #333; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 2px solid ${axpoPrimary}; }
  </style>
</head>
<body>
  <h2>Histórico Gas — ${product.productLabel}</h2>
  ${gasTableHtml}
</body>
</html>`;
}

/** Canonical period counts per electricity tariff — matches the Excel
 *  source sheet "." (COMPARATIVA LUZ) which stores 2.0TD with P1–P3 and
 *  3.0TD / 6.1TD with P1–P6. */
const TARIFF_PERIODS: Record<string, string[]> = {
    "2.0TD": ["P1", "P2", "P3"],
    "3.0TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "6.1TD": ["P1", "P2", "P3", "P4", "P5", "P6"],
};

const TARIFF_ORDER = ["2.0TD", "3.0TD", "6.1TD"];

/** Excel-matching palette for the price-history table. */
const HISTORY_HEADER_RED = "#FD5D66"; // tariff label / month row
const HISTORY_PERIOD_YELLOW = "#EE57"; // P1..Pn column header (yellow)

// ─── HTML generator ──────────────────────────────────────────────────────────

/**
 * Format a €/kWh margin value to 6 decimal places with a comma as the decimal
 * separator (matches the Excel's "0,000000" formatting).
 *
 * IMPORTANT: in the Excel base-data sheet, 2.0TD only has P1–P3 columns and
 * 3.0TD/6.1TD have P1–P6, but the source still pads the unused cells with
 * `0` (e.g. 2.0TD's P4/P5/P6 or a 3.0TD month where that period had no
 * consumption).  Per the Excel, those `0` cells render as blank — not as
 * "0,000000" — and are also excluded from the MEDIA AVERAGEIF (">0").
 * So we treat `0` as "no data" here as well.
 */
function fmtMargin(val: number | null | undefined): string {
    if (val == null || val <= 0) return "";
    return val.toFixed(6).replace(".", ",");
}

function buildHistoryHtml(
    data: HistoryData,
    product: HistoryProduct,
    template: PdfTemplate | null,
    axpoPrimary: string,
    simulation?: any,
): string {
    const perfilLabel =
        data.perfilCarga === "NORMAL" ? "Perfil Normal" : "Perfil Diurno";

    // Sort months chronologically (oldest → newest)
    const sortedMonths = [...data.months].sort((a, b) => {
        const [ay, am] = a.key.split("-").map(Number);
        const [by, bm] = b.key.split("-").map(Number);
        return ay !== by ? ay - by : am - bm;
    });

    // Build one <table> block per tariff.
    // Each cell shows the full all-in Precio TE (€/kWh) for that month+period,
    // taken from the per-month MARGEN key stored in the base value set.
    // Visually mirrors the Excel sheet "COMPARATIVA LUZ" panel (R1:Y53):
    //   - red header (#FD5D66) for tariff label and month rows
    //   - yellow period header (#EE57) for P1..Pn
    //   - 6-decimal €/kWh values with comma decimal separator
    //   - Media row = AVERAGEIF of monthly values > 0 (matches Excel AVERAGEIF)
    const buildTariffBlock = (tariff: string): string => {
        const tariffData = product.tariffs[tariff];
        if (!tariffData) return "";
        const canonicalPeriods = TARIFF_PERIODS[tariff] ?? [];
        const activePeriods = canonicalPeriods.filter(
            (p) => tariffData[p] !== undefined,
        );
        if (activePeriods.length === 0) return "";

        const headerCells = activePeriods
            .map(
                (p) =>
                    `<th style="background:${HISTORY_PERIOD_YELLOW};color:#3A3C39;padding:5px 10px;text-align:center;font-weight:bold;font-size:11px;border:1px solid #f0f0f0;">${p}</th>`,
            )
            .join("");

        const monthRows = sortedMonths
            .map(
                (month) =>
                    `<tr>
              <td style="background:${HISTORY_HEADER_RED};color:#fff;font-weight:bold;padding:5px 10px;font-size:11px;border:1px solid rgba(255,255,255,0.15);white-space:nowrap;">${month.label}</td>
              ${activePeriods
                        .map(
                            (p) =>
                                `<td style="padding:5px 10px;text-align:center;font-size:11px;border:1px solid #f0f0f0;background:#fff;">${fmtMargin(periodMonthly(tariffData[p], month.key))}</td>`,
                        )
                        .join("")}
            </tr>`,
            )
            .join("");

        // Media row — mirrors the Excel's =AVERAGEIF(T3:T14,">0")
        // (average of the displayed monthly values, ignoring zeros / blanks)
        const avgCells = activePeriods
            .map((p) => {
                const vals = sortedMonths
                    .map((m) => periodMonthly(tariffData[p], m.key))
                    .filter((v): v is number => v != null && v > 0);
                const mean =
                    vals.length > 0
                        ? vals.reduce((a, b) => a + b, 0) / vals.length
                        : 0;
                return `<td style="padding:5px 10px;text-align:center;font-size:11px;border:1px solid #e8e8e8;font-weight:bold;background:#f5f5f5;">${fmtMargin(mean)}</td>`;
            })
            .join("");

        return `
          <div class="asim-history-block" style="margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;">
            <div class="asim-history-title" style="text-align:center;color:${HISTORY_HEADER_RED};font-weight:bold;margin-bottom:6px;break-after:avoid;page-break-after:avoid;">${tariff}</div>
            <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
              <thead>
                <tr>
                  <th style="background:${HISTORY_HEADER_RED};color:#fff;padding:5px 10px;text-align:center;font-weight:bold;font-size:11px;border:1px solid rgba(255,255,255,0.15);">—</th>
                  ${headerCells}
                </tr>
              </thead>
              <tbody>
                ${monthRows}
                <tr>
                  <td style="padding:5px 10px;font-weight:bold;font-size:11px;border:1px solid #e8e8e8;background:#f5f5f5;">Media</td>
                  ${avgCells}
                </tr>
              </tbody>
            </table>
          </div>`;
    };

    // Render all 3 electricity tariffs stacked vertically, just like the
    // Excel sheet "COMPARATIVA LUZ" panel — the user wants to see the full
    // historical picture for every tariff the product covers, not only the
    // simulation's own access tariff. Tabs without per-month data in the
    // base value set are silently skipped by buildTariffBlock.
    const visibleTariffs = TARIFF_ORDER;

    const tariffBlocks = visibleTariffs.map(buildTariffBlock).join("");
    const block2TD = buildTariffBlock("2.0TD");
    const block3TD = buildTariffBlock("3.0TD");
    const block6TD = buildTariffBlock("6.1TD");

    // If a price-history template is selected, inject the tables and all variables
    if (template?.htmlContent) {
        const createdAt = simulation?.createdAt
            ? new Date(simulation.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "";

        return template.htmlContent
            .replace(/\{\{HISTORY_TABLES\}\}/g, tariffBlocks)
            .replace(/\{\{HISTORY_TABLE_2TD\}\}/g, block2TD)
            .replace(/\{\{HISTORY_TABLE_3TD\}\}/g, block3TD)
            .replace(/\{\{HISTORY_TABLE_6TD\}\}/g, block6TD)
            .replace(/\{\{PRODUCT_LABEL\}\}/g, product.productLabel)
            .replace(/\{\{PERFIL\}\}/g, perfilLabel)
            .replace(/\{\{TARIFA\}\}/g, data.tarifaAcceso)
            .replace(/\{\{CLIENT_NAME\}\}/g, simulation?.client?.name ?? "")
            .replace(/\{\{SIMULATION_ID\}\}/g, simulation?.id ?? "")
            .replace(/\{\{SIMULATION_REFERENCE\}\}/g, simulation?.referenceNumber ?? simulation?.id ?? "")
            .replace(/\{\{CREATED_AT\}\}/g, createdAt)
            .replace(/\{\{OWNER_NAME\}\}/g, simulation?.ownerUser?.fullName ?? "")
            .replace(/\{\{OWNER_EMAIL\}\}/g, simulation?.ownerUser?.commercialEmail ?? simulation?.ownerUser?.email ?? "");
    }

    // Built-in default template
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #333;
      padding: 36px 40px;
      background: #fff;
    }
    h2 {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      color: #333;
      margin-bottom: 28px;
      padding-bottom: 14px;
      border-bottom: 2px solid ${axpoPrimary};
    }
  </style>
</head>
<body>
  <h2>Histórico indexado últimos 12 meses - ${product.productLabel} - ${perfilLabel}</h2>
  ${tariffBlocks}
</body>
</html>`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve which product key to pre-select in the dialog.
 * 1. Exact match  (selected offer is already an indexed product)
 * 2. Tier fallback (e.g. ESTABLE:N2 → first product ending in :N2)
 * 3. First available product
 */
function resolveProductKey(products: HistoryProduct[], key?: string): string {
    if (!products.length) return "";
    if (!key) return products[0].productKey;
    const exact = products.find((p) => p.productKey === key);
    if (exact) return exact.productKey;
    const tier = key.split(":")[1];
    if (tier) {
        const byTier = products.find((p) => p.productKey.endsWith(`:${tier}`));
        if (byTier) return byTier.productKey;
    }
    return products[0].productKey;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DownloadHistoryDialog({
    open,
    onClose,
    simulation,
    token,
    initialProductKey,
    onSuccess,
    onError,
}: DownloadHistoryDialogProps) {
    const { t } = useI18n();
    const theme = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    const [historyTemplates, setHistoryTemplates] = useState<PdfTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

    const [historyData, setHistoryData] = useState<HistoryData | null>(null);
    const [selectedProductKey, setSelectedProductKey] = useState<string>("");

    // Fetch templates + history data when dialog opens
    useEffect(() => {
        if (!open) return;

        setIsLoading(true);
        setHistoryData(null);
        setSelectedProductKey("");
        setSelectedTemplateId("");

        Promise.all([
            getPdfTemplates({ active: true, type: "price-history" }),
            fetch(`/api/v1/internal/simulations/${simulation.id}/price-history`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(async (r) => {
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.error ?? `Price history request failed (${r.status})`);
                }
                return r.json();
            }),
        ])
            .then(([templates, histData]) => {
                const data = histData as HistoryData;
                const commodity = data.isGas ? "GAS" : "ELECTRICITY";
                const historyTpls = templates.filter(
                    (tpl) =>
                        tpl.active &&
                        tpl.type === "price-history" &&
                        (tpl.commodity || "ELECTRICITY") === commodity,
                );
                setHistoryTemplates(historyTpls);

                // Never mix commodity product lists. An empty gas list should
                // show the no-data state instead of falling back to electricity.
                setHistoryData(
                    data.isGas
                        ? { ...data, products: data.gasProducts ?? [] }
                        : data,
                );

                // All templates are already restricted to the simulation commodity.
                if (historyTpls.length > 0) {
                    setSelectedTemplateId(historyTpls[0].id);
                }
            })
            .catch((err) => {
                onError?.(err.message ?? "Failed to load history data");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [open, simulation.id, token]);

    // Runs whenever historyData loads OR initialProductKey changes.
    // Using both as deps means React always supplies the latest prop value here,
    // avoiding the stale-closure problem that occurs inside .then() callbacks.
    useEffect(() => {
        if (!historyData || historyData.products.length === 0) return;
        setSelectedProductKey(resolveProductKey(historyData.products, initialProductKey));
    }, [historyData, initialProductKey]);

    const selectedProduct = useMemo(
        () =>
            historyData?.products.find((p) => p.productKey === selectedProductKey) ??
            historyData?.products[0] ??
            null,
        [historyData, selectedProductKey],
    );

    const selectedTemplate = useMemo(
        () => historyTemplates.find((t) => t.id === selectedTemplateId) ?? null,
        [selectedTemplateId, historyTemplates],
    );

    const previewHtml = useMemo(() => {
        if (!historyData || !selectedProduct) return "";
        if (selectedProduct.type === "GAS" || historyData.isGas) {
            return buildGasHistoryHtml(historyData, selectedProduct, selectedTemplate, theme.palette.primary.main, simulation);
        }
        return buildHistoryHtml(historyData, selectedProduct, selectedTemplate, theme.palette.primary.main, simulation);
    }, [historyData, selectedProduct, selectedTemplate, theme.palette.primary.main, simulation]);

    const handleDownload = async () => {
        if (!historyData || !selectedProduct) return;

        setIsDownloading(true);
        try {
            const html = (selectedProduct.type === "GAS" || historyData.isGas)
                ? buildGasHistoryHtml(historyData, selectedProduct, selectedTemplate, theme.palette.primary.main, simulation)
                : buildHistoryHtml(historyData, selectedProduct, selectedTemplate, theme.palette.primary.main, simulation);

            const response = await fetch(
                `/api/v1/internal/simulations/${simulation.id}/generate-pdf`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ htmlContent: html }),
                },
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error ?? "Failed to generate PDF");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = buildSimulationPdfFilenameFromSimulation(simulation, {
                productName: selectedProduct.productLabel,
                prefix: "history",
            });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            onSuccess?.(
                t("downloadHistory", "success") || "History PDF downloaded successfully.",
            );
        } catch (err) {
            onError?.(
                err instanceof Error ? err.message : "Failed to generate history PDF",
            );
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: { xs: "auto", md: "90vh" }, maxHeight: { xs: "92vh", md: "90vh" } } }}
        >
            <DialogTitle
                sx={{
                    pb: 1.5,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <HistoryIcon fontSize="small" />
                    <Typography variant="h6" component="span">
                        {t("downloadHistory", "dialogTitle") || "Download Price History PDF"}
                    </Typography>
                </Box>
                <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", overflow: { xs: "auto", md: "hidden" } }}>
                {isLoading ? (
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                        }}
                    >
                        <LoadingState size={100} message={t("downloadHistory", "loading") || "Loading history data…"} />
                    </Box>
                ) : !historyData || historyData.products.length === 0 ? (
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
                        <Typography color="text.secondary" textAlign="center">
                            {t("downloadHistory", "noData") ||
                                "No price history products are available for this simulation."}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Controls row */}
                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                p: 2,
                                pb: 1.5,
                                flexWrap: "wrap",
                                borderBottom: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            {/* Product selector */}
                            <Box sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { xs: 0, sm: 300 } }}>
                                <FormSelect
                                    label={t("downloadHistory", "selectProduct") || "Product"}
                                    value={selectedProductKey}
                                    onChange={(value) => setSelectedProductKey(String(value ?? ""))}
                                    options={historyData.products.map((product) => ({
                                        value: product.productKey,
                                        label: product.productLabel,
                                    }))}
                                    textFieldProps={{ size: "small" }}
                                />
                            </Box>

                            {/* Template selector — only shown when price-history templates exist */}
                            {historyTemplates.length > 0 && (
                                <Box sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { xs: 0, sm: 300 } }}>
                                    <FormSelect
                                        label={t("downloadHistory", "selectTemplate") || "Template"}
                                        value={selectedTemplateId}
                                        onChange={(value) => setSelectedTemplateId(String(value ?? ""))}
                                        options={historyTemplates.map((template) => ({
                                            value: template.id,
                                            label: template.name,
                                            secondaryLabel: template.description || undefined,
                                        }))}
                                        textFieldProps={{ size: "small" }}
                                    />
                                </Box>
                            )}

                            {/* Info chip */}
                            {selectedProduct && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        ml: { xs: 0, sm: "auto" },
                                        minWidth: 0,
                                        width: { xs: "100%", sm: "auto" },
                                    }}
                                >
                                    <VisibilityIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        {t("downloadHistory", "preview") || "Preview"} —{" "}
                                        <strong>{selectedProduct.productLabel}</strong>
                                        {historyData.perfilCarga === "NORMAL"
                                            ? " · Perfil Normal"
                                            : " · Perfil Diurno"}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Preview area */}
                        <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    borderStyle: "dashed",
                                    bgcolor: "action.hover",
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    {t("downloadHistory", "previewUnavailableMobileTitle") || "Preview not available on mobile"}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t("downloadHistory", "previewUnavailableMobile") || "The PDF preview is available on medium screens and above."}
                                </Typography>
                            </Paper>
                        </Box>
                        <Box sx={{ display: { xs: "none", md: "block" }, flex: 1, overflow: "auto", p: 2 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 0,
                                    minHeight: 400,
                                    overflow: "hidden",
                                    bgcolor: "#fff",
                                }}
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </Box>
                    </>
                )}
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button variant="outlined" onClick={onClose} disabled={isDownloading}>
                    {t("actions", "cancel") || "Cancel"}
                </Button>
                <Button
                    variant="contained"
                    startIcon={
                        isDownloading ? (
                            <CircularProgress size={16} color="inherit" />
                        ) : (
                            <DownloadIcon />
                        )
                    }
                    onClick={handleDownload}
                    disabled={isLoading || isDownloading || !selectedProduct}
                >
                    {isDownloading
                        ? t("downloadHistory", "downloading") || "Generating…"
                        : t("downloadHistory", "download") || "Download PDF"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
