"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";
import {
    listExcelParserConfig,
    saveExcelParserConfig,
    type ExcelParserConfigItem,
    type ExcelParserConfigScope,
} from "../../lib/internalApi";
import { LoadingState } from "../shared/LoadingState";
import { FormInput } from "../ui/FormInput";

interface ExcelParserConfigSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type EditableParserConfigItem = ExcelParserConfigItem & { localId: string };
type CommodityTab = ExcelParserConfigItem["commodity"];
type PricingType = ExcelParserConfigItem["pricingType"];

const COMMODITY_TABS: Array<{ value: CommodityTab; labelKey: string }> = [
    { value: "ELECTRICITY", labelKey: "electricity" },
    { value: "GAS", labelKey: "gas" },
];

const PRICING_COLUMNS: Array<{ value: PricingType; labelKey: string }> = [
    { value: "FIXED", labelKey: "fixed" },
    { value: "INDEXED", labelKey: "indexed" },
];

const emptyRow = (
    scopeType: ExcelParserConfigScope,
    sortOrder: number,
    commodity: CommodityTab,
    pricingType: PricingType,
): EditableParserConfigItem => ({
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    scopeType,
    sourceLabel: "",
    productKey: "",
    displayName: "",
    commodity,
    pricingType,
    enabled: true,
    singlePeriod: false,
    eligibilityMin: null,
    eligibilityMax: null,
    sortOrder,
});

export function ExcelParserConfigSettings({ session, onNotify }: ExcelParserConfigSettingsProps) {
    const { t } = useI18n();
    const [scopeType, setScopeType] = useState<ExcelParserConfigScope>("GLOBAL");
    const [items, setItems] = useState<EditableParserConfigItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeCommodity, setActiveCommodity] = useState<CommodityTab>("ELECTRICITY");

    const loadConfig = useCallback(async () => {
        try {
            setIsLoading(true);
            const rows = await listExcelParserConfig(session.token, scopeType);
            setItems(
                rows.map((row) => ({
                    ...row,
                    localId:
                        row.id ??
                        emptyRow(scopeType, row.sortOrder, row.commodity, row.pricingType).localId,
                })),
            );
            setIsDirty(false);
        } catch (error) {
            onNotify(error instanceof Error ? error.message : "Failed to load Excel parser config", "error");
        } finally {
            setIsLoading(false);
        }
    }, [onNotify, scopeType, session.token]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    const sortedItems = useMemo(
        () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.sourceLabel.localeCompare(b.sourceLabel)),
        [items],
    );

    const updateItem = <K extends keyof ExcelParserConfigItem>(
        localId: string,
        field: K,
        value: ExcelParserConfigItem[K],
    ) => {
        setItems((current) =>
            current.map((item) =>
                item.localId === localId ? { ...item, [field]: value } : item,
            ),
        );
        setIsDirty(true);
    };

    const addRow = (commodity: CommodityTab, pricingType: PricingType) => {
        const nextSortOrder =
            items
                .filter((item) => item.commodity === commodity && item.pricingType === pricingType)
                .reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10;
        setItems((current) => [...current, emptyRow(scopeType, nextSortOrder, commodity, pricingType)]);
        setIsDirty(true);
    };

    const deleteRow = (localId: string) => {
        setItems((current) => current.filter((item) => item.localId !== localId));
        setIsDirty(true);
    };

    const parseNullableNumber = (value: string): number | null => {
        if (value.trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const saveConfig = async () => {
        const invalid = items.some(
            (item) =>
                !item.sourceLabel.trim() ||
                !item.productKey.trim() ||
                !item.displayName.trim(),
        );
        if (invalid) {
            onNotify(t("excelParserConfig", "validationRequired"), "error");
            return;
        }

        try {
            setIsSaving(true);
            const saved = await saveExcelParserConfig(
                session.token,
                scopeType,
                sortedItems.map(({ localId: _localId, id, ...item }) => ({
                    ...item,
                    ...(id ? { id } : {}),
                    scopeType,
                    sourceLabel: item.sourceLabel.trim(),
                    productKey: item.productKey.trim(),
                    displayName: item.displayName.trim(),
                })),
            );
            setItems(
                saved.map((row) => ({
                    ...row,
                    localId:
                        row.id ??
                        emptyRow(scopeType, row.sortOrder, row.commodity, row.pricingType).localId,
                })),
            );
            setIsDirty(false);
            onNotify(t("excelParserConfig", "saveSuccess"), "success");
        } catch (error) {
            onNotify(error instanceof Error ? error.message : t("excelParserConfig", "saveError"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const activeItems = sortedItems.filter((item) => item.commodity === activeCommodity);
    const activeEnabledCount = activeItems.filter((item) => item.enabled).length;

    const itemsFor = (pricingType: PricingType) =>
        activeItems.filter((item) => item.pricingType === pricingType);

    const parserTable = ({ value: pricingType, labelKey }: { value: PricingType; labelKey: string }) => {
        const tableItems = itemsFor(pricingType);
        const tableEnabledCount = tableItems.filter((item) => item.enabled).length;
        const label = t("excelParserConfig", labelKey);

        return (
            <Box
                key={pricingType}
                sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    backgroundColor: "background.paper",
                    minWidth: 0,
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 1.5,
                        borderBottom: "1px solid",
                        borderBottomColor: "divider",
                        backgroundColor: "action.hover",
                    }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {label}
                        </Typography>
                        <Chip
                            label={t("excelParserConfig", "enabledCount", {
                                enabled: tableEnabledCount,
                                total: tableItems.length,
                            })}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 11 }}
                        />
                    </Stack>
                    <Button
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                        onClick={() => addRow(activeCommodity, pricingType)}
                        disabled={isLoading || isSaving}
                    >
                        {t("excelParserConfig", "addPricingType", { type: label })}
                    </Button>
                </Box>

                {tableItems.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            {t("excelParserConfig", "emptyPricingType", { type: label.toLowerCase() })}
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer
                        sx={{ maxHeight: "calc(100vh - 360px)", maxWidth: "100%", overflowX: "auto" }}
                    >
                        <Table
                            stickyHeader
                            size="small"
                            sx={{ minWidth: 960, tableLayout: "fixed" }}
                            aria-label={t("excelParserConfig", "tableAriaLabel", { type: label })}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 88 }}>{t("excelParserConfig", "columnEnabled")}</TableCell>
                                    <TableCell sx={{ width: 200 }}>{t("excelParserConfig", "columnExcelLabel")}</TableCell>
                                    <TableCell sx={{ width: 190 }}>{t("excelParserConfig", "columnProductKey")}</TableCell>
                                    <TableCell sx={{ width: 180 }}>{t("excelParserConfig", "columnDisplayName")}</TableCell>
                                    <TableCell sx={{ width: 76 }}>{t("excelParserConfig", "columnSinglePeriod")}</TableCell>
                                    <TableCell sx={{ width: 120 }}>{t("excelParserConfig", "columnMinKwh")}</TableCell>
                                    <TableCell sx={{ width: 120 }}>{t("excelParserConfig", "columnMaxKwh")}</TableCell>
                                    <TableCell sx={{ width: 88 }}>{t("excelParserConfig", "columnOrder")}</TableCell>
                                    <TableCell sx={{ width: 56 }} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tableItems.map((item) => (
                                    <TableRow key={item.localId} hover sx={{ opacity: item.enabled ? 1 : 0.62 }}>
                                        <TableCell>
                                            <Switch
                                                checked={item.enabled}
                                                onChange={(event) => updateItem(item.localId, "enabled", event.target.checked)}
                                                size="small"
                                                color="primary"
                                                inputProps={{
                                                    "aria-label": t(
                                                        "excelParserConfig",
                                                        item.enabled ? "disableRowAria" : "enableRowAria",
                                                        { row: item.displayName || item.productKey || t("excelParserConfig", "parserRow") },
                                                    ),
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                value={item.sourceLabel}
                                                onChange={(event) => updateItem(item.localId, "sourceLabel", event.target.value)}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                value={item.productKey}
                                                onChange={(event) => updateItem(item.localId, "productKey", event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                value={item.displayName}
                                                onChange={(event) => updateItem(item.localId, "displayName", event.target.value)}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Checkbox
                                                checked={item.singlePeriod}
                                                onChange={(event) => updateItem(item.localId, "singlePeriod", event.target.checked)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                type="number"
                                                value={item.eligibilityMin ?? ""}
                                                onChange={(event) => updateItem(item.localId, "eligibilityMin", parseNullableNumber(event.target.value))}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                type="number"
                                                value={item.eligibilityMax ?? ""}
                                                onChange={(event) => updateItem(item.localId, "eligibilityMax", parseNullableNumber(event.target.value))}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormInput
                                                label=""
                                                type="number"
                                                value={item.sortOrder}
                                                onChange={(event) => updateItem(item.localId, "sortOrder", Number(event.target.value) || 0)}
                                                size="small"
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={t("common", "delete")}>
                                                <IconButton size="small" onClick={() => deleteRow(item.localId)}>
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        );
    };

    return (
        <div className="system-settings-container">
            <Box sx={{ px: 2, py: 2, borderBottom: "1px solid var(--scheme-neutral-900)" }}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {t("excelParserConfig", "title")}
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={scopeType}
                            onChange={(_, value: ExcelParserConfigScope | null) => {
                                if (value && value !== scopeType) setScopeType(value);
                            }}
                        >
                            <ToggleButton value="GLOBAL">{t("excelParserConfig", "scopeGlobal")}</ToggleButton>
                            <ToggleButton value="TLV">{t("excelParserConfig", "scopeTlv")}</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={t("common", "refresh")}>
                            <span>
                                <IconButton onClick={loadConfig} disabled={isLoading || isSaving} size="small">
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button
                            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                            variant="contained"
                            onClick={saveConfig}
                            disabled={!isDirty || isLoading || isSaving}
                        >
                            {t("common", "save")}
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            {isLoading ? (
                <LoadingState message={t("excelParserConfig", "loading")} />
            ) : (
                <Stack spacing={3} sx={{ p: 2 }}>
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                        <Tabs
                            value={activeCommodity}
                            onChange={(_, newValue: CommodityTab) => setActiveCommodity(newValue)}
                            sx={{
                                minHeight: 44,
                                "& .MuiTabs-indicator": {
                                    backgroundColor: "var(--scheme-brand-600)",
                                    height: 2,
                                },
                            }}
                        >
                            {COMMODITY_TABS.map((tab) => {
                                const tabItems = sortedItems.filter((item) => item.commodity === tab.value);
                                const tabEnabledCount = tabItems.filter((item) => item.enabled).length;

                                return (
                                    <Tab
                                        key={tab.value}
                                        value={tab.value}
                                        label={`${t("excelParserConfig", tab.labelKey)} (${tabEnabledCount}/${tabItems.length})`}
                                        sx={{ minHeight: 44, textTransform: "none", fontWeight: 600 }}
                                    />
                                );
                            })}
                        </Tabs>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: { xs: "flex-start", sm: "center" },
                            justifyContent: "space-between",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 1,
                        }}
                    >
                        <Typography variant="subtitle2" color="text.secondary">
                            {t("excelParserConfig", "commodityRows", {
                                commodity: t(
                                    "excelParserConfig",
                                    COMMODITY_TABS.find((tab) => tab.value === activeCommodity)?.labelKey ?? "electricity",
                                ),
                            })}
                        </Typography>
                        <Chip
                            label={t("excelParserConfig", "enabledCount", {
                                enabled: activeEnabledCount,
                                total: activeItems.length,
                            })}
                            size="small"
                            variant="outlined"
                            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 2,
                            alignItems: "start",
                        }}
                    >
                        {PRICING_COLUMNS.map((column) => parserTable(column))}
                    </Box>
                </Stack>
            )}
        </div>
    );
}
