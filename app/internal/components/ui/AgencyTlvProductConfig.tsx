"use client";

import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
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
    Typography,
} from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AgencyTlvProduct {
    productKey: string;
    displayName: string;
    commodity: "ELECTRICITY" | "GAS";
    pricingType: "FIXED" | "INDEXED";
    isEnabled: boolean;
}

interface AgencyTlvProductConfigProps {
    agencyId: string;
    token: string;
    isTlv: boolean;
    onNotify?: (message: string, tone: "success" | "error") => void;
    hideSaveButton?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
    onProductsChange?: (
        products: Array<{
            productKey: string;
            commodity: AgencyTlvProduct["commodity"];
            pricingType: AgencyTlvProduct["pricingType"];
            isEnabled: boolean;
        }>,
    ) => void;
}

type CommodityTab = AgencyTlvProduct["commodity"];
type PricingType = AgencyTlvProduct["pricingType"];

const COMMODITY_TABS: Array<{ value: CommodityTab }> = [
    { value: "ELECTRICITY" },
    { value: "GAS" },
];

const PRICING_COLUMNS: Array<{ value: PricingType }> = [
    { value: "FIXED" },
    { value: "INDEXED" },
];

export function AgencyTlvProductConfig({
    agencyId,
    token,
    isTlv,
    onNotify,
    hideSaveButton = false,
    onDirtyChange,
    onProductsChange,
}: AgencyTlvProductConfigProps) {
    const { t } = useI18n();
    const [products, setProducts] = useState<AgencyTlvProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeCommodity, setActiveCommodity] = useState<CommodityTab>("ELECTRICITY");

    useEffect(() => {
        const controller = new AbortController();
        loadProducts(controller.signal);
        return () => controller.abort();
    }, [agencyId, isTlv]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        onProductsChange?.(
            products.map((product) => ({
                productKey: product.productKey,
                commodity: product.commodity,
                pricingType: product.pricingType,
                isEnabled: product.isEnabled,
            })),
        );
    }, [onProductsChange, products]);

    const productIdentity = (product: Pick<AgencyTlvProduct, "commodity" | "pricingType" | "productKey">) =>
        `${product.commodity}:${product.pricingType}:${product.productKey}`;

    const loadProducts = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const scopeType = isTlv ? "TLV" : "GLOBAL";
            const response = await fetch(`/api/v1/internal/agencies/${agencyId}/products?scopeType=${scopeType}`, {
                signal,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(t("agencyTlvProducts", "loadError"));
            }

            setProducts(await response.json());
        } catch (error) {
            if (signal?.aborted) return;
            onNotify?.(
                error instanceof Error ? error.message : t("agencyTlvProducts", "loadError"),
                "error",
            );
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    };

    const handleToggle = (target: AgencyTlvProduct) => {
        setProducts((current) =>
            current.map((product) =>
                productIdentity(product) === productIdentity(target)
                    ? { ...product, isEnabled: !product.isEnabled }
                    : product,
            ),
        );
        setIsDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/v1/internal/agencies/${agencyId}/products`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    products.map((product) => ({
                        productKey: product.productKey,
                        commodity: product.commodity,
                        pricingType: product.pricingType,
                        isEnabled: product.isEnabled,
                    })),
                ),
            });

            if (!response.ok) {
                throw new Error(t("agencyTlvProducts", "saveError"));
            }

            setProducts(await response.json());
            setIsDirty(false);
            onNotify?.(t("agencyTlvProducts", "saveSuccess"), "success");
        } catch (error) {
            onNotify?.(
                error instanceof Error ? error.message : t("agencyTlvProducts", "saveError"),
                "error",
            );
            throw error;
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Typography>{t("agencyTlvProducts", "loading")}</Typography>;
    }

    const enabledCount = products.filter((product) => product.isEnabled).length;
    const activeProducts = products.filter((product) => product.commodity === activeCommodity);
    const activeEnabledCount = activeProducts.filter((product) => product.isEnabled).length;

    const productsFor = (pricingType: PricingType) =>
        activeProducts.filter((product) => product.pricingType === pricingType);

    const commodityLabel = (commodity: CommodityTab) =>
        t("agencyTlvProducts", commodity === "ELECTRICITY" ? "electricity" : "gas");

    const pricingLabel = (pricingType: PricingType) =>
        t("agencyTlvProducts", pricingType === "FIXED" ? "fixed" : "indexed");

    const productTable = ({ value: pricingType }: { value: PricingType }) => {
        const tableProducts = productsFor(pricingType);
        const tableEnabledCount = tableProducts.filter((product) => product.isEnabled).length;
        const label = pricingLabel(pricingType);

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
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        borderBottom: "1px solid",
                        borderBottomColor: "divider",
                        backgroundColor: "action.hover",
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {label}
                    </Typography>
                    <Chip
                        label={t("agencyTlvProducts", "activeCount", {
                            count: tableEnabledCount,
                            total: tableProducts.length,
                        })}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: 11 }}
                    />
                </Box>

                {tableProducts.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            {pricingType === "FIXED"
                                ? t("agencyTlvProducts", "noFixedProducts")
                                : t("agencyTlvProducts", "noIndexedProducts")}
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
                        <Table size="small" aria-label={t("agencyTlvProducts", "tableAriaLabel", { type: label })}>
                            <TableHead>
                                <TableRow
                                    sx={{
                                        "& th": {
                                            color: "text.secondary",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: 0,
                                            borderBottomColor: "divider",
                                        },
                                    }}
                                >
                                    <TableCell>{t("agencyTlvProducts", "columnProduct")}</TableCell>
                                    <TableCell>{t("agencyTlvProducts", "columnProductKey")}</TableCell>
                                    <TableCell align="right" sx={{ width: 112 }}>
                                        {t("agencyTlvProducts", "columnActive")}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tableProducts.map((product) => (
                                    <TableRow
                                        key={productIdentity(product)}
                                        hover
                                        sx={{
                                            opacity: product.isEnabled ? 1 : 0.62,
                                            "&:last-child td": { borderBottom: 0 },
                                        }}
                                    >
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {product.displayName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                component="code"
                                                variant="caption"
                                                sx={{
                                                    color: "text.secondary",
                                                    fontFamily: "monospace",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {product.productKey}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Switch
                                                checked={product.isEnabled}
                                                onChange={() => handleToggle(product)}
                                                color="primary"
                                                inputProps={{
                                                    "aria-label": t(
                                                        "agencyTlvProducts",
                                                        product.isEnabled ? "deactivateProduct" : "activateProduct",
                                                        { name: product.displayName },
                                                    ),
                                                }}
                                            />
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
        <Box>
            <Box
                sx={{
                    mb: 2.5,
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box>
                    <Typography variant="h6" gutterBottom>
                        {t("agencyTlvProducts", "title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("agencyTlvProducts", "description")}
                    </Typography>
                </Box>
                {products.length > 0 && (
                    <Chip
                        label={t("agencyTlvProducts", "enabledCount", {
                            count: enabledCount,
                            total: products.length,
                        })}
                        size="small"
                        variant="outlined"
                        sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                    />
                )}
            </Box>

            {products.length === 0 ? (
                <Typography color="text.secondary">
                    {t("agencyTlvProducts", "empty")}
                </Typography>
            ) : (
                <Stack spacing={3}>
                    <Box
                        sx={{
                            borderBottom: 1,
                            borderColor: "divider",
                        }}
                    >
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
                                const tabProducts = products.filter((product) => product.commodity === tab.value);
                                const tabEnabledCount = tabProducts.filter((product) => product.isEnabled).length;

                                return (
                                    <Tab
                                        key={tab.value}
                                        value={tab.value}
                                        label={t("agencyTlvProducts", "commodityTabLabel", {
                                            commodity: commodityLabel(tab.value),
                                            count: tabEnabledCount,
                                            total: tabProducts.length,
                                        })}
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
                            {t("agencyTlvProducts", "commodityProducts", {
                                commodity: commodityLabel(activeCommodity),
                            })}
                        </Typography>
                        <Chip
                            label={t("agencyTlvProducts", "activeCount", {
                                count: activeEnabledCount,
                                total: activeProducts.length,
                            })}
                            size="small"
                            variant="outlined"
                            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
                            gap: 2,
                            alignItems: "start",
                        }}
                    >
                        {PRICING_COLUMNS.map((column) => productTable(column))}
                    </Box>

                    {!hideSaveButton && (
                        <Box sx={{ display: "flex", justifyContent: "flex-start", pt: 1 }}>
                            <Button
                                variant="contained"
                                onClick={() => void handleSave()}
                                disabled={!isDirty || saving}
                                size="large"
                            >
                                {saving
                                    ? t("agencyTlvProducts", "saving")
                                    : t("agencyTlvProducts", "saveButton")}
                            </Button>
                        </Box>
                    )}
                </Stack>
            )}
        </Box>
    );
}
