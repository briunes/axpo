"use client";

import { Box, Skeleton, Stack } from "@mui/material";

export type FormSkeletonVariant =
    | "agency"
    | "client"
    | "user"
    | "base-values"
    | "simulation"
    | "simulation-edit"
    | "generic";

interface FormSkeletonProps {
    /** Predefined layout matching a known form. Defaults to "generic". */
    variant?: FormSkeletonVariant;
    /** Number of skeleton rows for the "generic" variant. */
    rows?: number;
    /**
     * If provided, the skeleton is wrapped in a `crud-tab-panel` with
     * placeholder tab headers that match the count of `tabs`. Use this
     * for pages that have a tabbed chrome (e.g. agency / user edit).
     */
    tabs?: number;
}

/**
 * Skeleton placeholder that mirrors the layout of a form while data is
 * loading. Uses MUI's <Skeleton /> component so the visual style is
 * consistent with the rest of the application.
 *
 * Pass a `variant` matching the form being loaded to get a more accurate
 * preview (label + input pairs laid out as in the real form). The
 * "generic" variant renders a simple list of bars and is a sensible
 * fallback.
 */
export function FormSkeleton({ variant = "generic", rows = 6, tabs }: FormSkeletonProps) {
    const formContent = (() => {
        switch (variant) {
            case "agency":
                return <AgencySkeleton />;
            case "client":
                return <ClientSkeleton />;
            case "user":
                return <UserSkeleton />;
            case "base-values":
                return <BaseValuesSkeleton />;
            case "simulation":
                return <NewSimulationSkeleton />;
            case "simulation-edit":
                return <SimulationEditSkeleton />;
            case "generic":
            default:
                return <GenericSkeleton rows={rows} />;
        }
    })();

    if (variant === "simulation-edit") {
        return <Box sx={{ width: "100%" }}>{formContent}</Box>;
    }

    if (tabs && tabs > 0) {
        return (
            <Box className="crud-tab-panel" sx={{ width: "100%" }}>
                <Box className="crud-tab-panel__tabs">
                    <Stack direction="row" spacing={3} sx={{ px: 1 }}>
                        {Array.from({ length: tabs }).map((_, index) => (
                            <Skeleton
                                key={`tab-${index}`}
                                variant="text"
                                width={index === 0 ? 80 : 110}
                                height={40}
                                sx={{ borderRadius: 1, transform: "none" }}
                            />
                        ))}
                    </Stack>
                </Box>
                <div className="crud-form-panel">
                    {formContent}
                </div>
            </Box>
        );
    }

    return <div className="crud-form-panel" style={{ width: "100%" }}>{formContent}</div>;
}

function FieldSkeleton({ width = "100%" }: { width?: number | string }) {
    return (
        <Box sx={{ width }}>
            <Skeleton variant="text" width={120} height={18} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" height={40} />
        </Box>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
            }}
        >
            {children}
        </Box>
    );
}

function GenericSkeleton({ rows }: { rows: number }) {
    return (
        <Stack spacing={2}>
            {Array.from({ length: rows }).map((_, index) => (
                <FieldSkeleton key={`generic-row-${index}`} width={index % 2 === 0 ? "100%" : "85%"} />
            ))}
        </Stack>
    );
}

function AgencySkeleton() {
    return (
        <Stack spacing={2}>
            {/* Name + TLV switch row */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
                    alignItems: "flex-end",
                    columnGap: 3,
                    rowGap: 1.5,
                }}
            >
                <FieldSkeleton />
                <Box sx={{ minWidth: 140, pb: "4px" }}>
                    <Skeleton variant="text" width={130} height={24} />
                </Box>
            </Box>
            {/* Address */}
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <FieldSkeleton />
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
        </Stack>
    );
}

function ClientSkeleton() {
    return (
        <Stack spacing={2}>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton width="80%" />
            </Row>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            {/* Address section */}
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <FieldSkeleton />
            <Row>
                <FieldSkeleton />
                <FieldSkeleton width="60%" />
            </Row>
            {/* Language */}
            <Box sx={{ maxWidth: 320 }}>
                <FieldSkeleton />
            </Box>
            {/* Other details (multiline) */}
            <Box>
                <Skeleton variant="text" width={120} height={18} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={84} />
            </Box>
        </Stack>
    );
}

function UserSkeleton() {
    return (
        <Stack spacing={2}>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton width="60%" />
            </Row>
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            {/* Other details (multiline) */}
            <Box>
                <Skeleton variant="text" width={120} height={18} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={84} />
            </Box>
        </Stack>
    );
}

function BaseValuesSkeleton() {
    return (
        <Stack spacing={2.5}>
            <FieldSkeleton />
            <Row>
                <FieldSkeleton />
                <FieldSkeleton />
            </Row>
            <Skeleton variant="rectangular" height={1} sx={{ width: "100%", bgcolor: "divider" }} />
            {/* Items list preview */}
            <Stack spacing={1.25}>
                {Array.from({ length: 5 }).map((_, index) => (
                    <Box
                        key={`bv-row-${index}`}
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr auto" },
                            gap: 2,
                            alignItems: "center",
                        }}
                    >
                        <Skeleton variant="rounded" height={40} />
                        <Skeleton variant="rounded" height={40} />
                        <Skeleton variant="rounded" height={40} />
                        <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
}

function NewSimulationSkeleton() {
    return (
        <Stack spacing={3}>
            {/* Section: Invoice Data Extraction */}
            <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Skeleton variant="circular" width={28} height={28} />
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width={210} height={22} />
                        <Skeleton variant="text" width="80%" height={14} sx={{ mt: 0.5 }} />
                    </Box>
                </Box>
                {/* File upload dropzone */}
                <Skeleton
                    variant="rounded"
                    height={120}
                    sx={{ borderRadius: 2 }}
                />
            </Stack>

            {/* Section: Client / Commodity / Expiration */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                    gap: 2,
                }}
            >
                <Box>
                    <Skeleton variant="text" width={80} height={18} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" height={40} />
                </Box>
                <Box>
                    <Skeleton variant="text" width={120} height={18} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" height={40} />
                </Box>
                <Box>
                    <Skeleton variant="text" width={110} height={18} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" height={40} />
                </Box>
            </Box>
        </Stack>
    );
}

function MetaItemSkeleton({
    labelWidth = 40,
    valueWidth = 80,
    valueHeight = 18,
    rounded = false,
}: {
    labelWidth?: number | string;
    valueWidth?: number | string;
    valueHeight?: number;
    rounded?: boolean;
}) {
    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
            <Skeleton variant="text" width={labelWidth} height={14} />
            <Skeleton
                variant={rounded ? "rounded" : "text"}
                width={valueWidth}
                height={valueHeight}
                sx={{ borderRadius: rounded ? 6 : 1, transform: "none" }}
            />
        </Box>
    );
}

function AccordionRowSkeleton({ expanded = false }: { expanded?: boolean }) {
    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
                <Skeleton variant="circular" width={18} height={18} />
                <Skeleton variant="text" width={130} height={18} sx={{ flex: 1 }} />
                <Skeleton variant="circular" width={18} height={18} />
            </Box>
            {expanded && (
                <Box sx={{ px: 1.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <Box key={`acc-row-${idx}`} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Skeleton variant="text" width={32} height={16} />
                            <Skeleton variant="rounded" height={36} sx={{ flex: 1 }} />
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}

function OfferRowSkeleton({ highlighted = false }: { highlighted?: boolean }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "auto 1fr", md: "auto minmax(220px, 1.6fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(90px, 0.8fr) minmax(110px, 1fr)" },
                alignItems: "center",
                gap: 2,
                px: 1.5,
                py: 1.25,
                borderTop: "1px solid",
                borderColor: "divider",
                background: highlighted ? "rgba(220, 38, 38, 0.06)" : "transparent",
            }}
        >
            <Skeleton variant="circular" width={18} height={18} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Skeleton variant="text" width="70%" height={16} />
                <Skeleton variant="rounded" width={90} height={16} sx={{ borderRadius: 999 }} />
            </Box>
            <Skeleton variant="text" width={70} height={18} sx={{ ml: "auto" }} />
            <Skeleton variant="text" width={70} height={18} sx={{ ml: "auto" }} />
            <Skeleton variant="rounded" width={56} height={22} sx={{ ml: "auto", borderRadius: 999 }} />
            <Skeleton variant="text" width={80} height={18} sx={{ ml: "auto" }} />
        </Box>
    );
}

function SimulationEditSkeleton() {
    return (
        <Stack spacing={1.5}>
            {/* Simulation Meta card: chip-style header row (Ref / Client / Status / PIN / Expires / Invoice / Created) */}
            <Box
                className="simulation-meta-card"
                sx={{
                    px: 2,
                    py: 1.25,
                }}
            >
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 2, rowGap: 0.75 }}>
                    <MetaItemSkeleton labelWidth={24} valueWidth={86} valueHeight={24} rounded />
                    <MetaItemSkeleton labelWidth={34} valueWidth={250} />
                    <MetaItemSkeleton labelWidth={40} valueWidth={56} valueHeight={22} rounded />
                    <MetaItemSkeleton labelWidth={22} valueWidth={64} valueHeight={24} rounded />
                    <MetaItemSkeleton labelWidth={48} valueWidth={78} />
                    <MetaItemSkeleton labelWidth={42} valueWidth={210} />
                    <MetaItemSkeleton labelWidth={48} valueWidth={78} />
                </Box>
            </Box>

            {/* Detail tabs (Inputs / Results) */}
            <Box className="simulation-detail-tabs" sx={{ mb: 0 }}>
                <Stack direction="row" spacing={3} sx={{ px: 1 }}>
                    <Skeleton variant="text" width={70} height={36} sx={{ borderRadius: 1, transform: "none" }} />
                    <Skeleton variant="text" width={150} height={36} sx={{ borderRadius: 1, transform: "none" }} />
                </Stack>
            </Box>

            {/* Two-column grid: left = Simulation Data card, right = Electricity Offers */}
            <Box
                className="simulation-results-grid"
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 320px) minmax(0, 1fr)" },
                    gap: 2.25,
                    alignItems: "stretch",
                    minHeight: 520,
                }}
            >
                {/* Left: Simulation Data card */}
                <Box
                    className="simulation-results-input-panel"
                    sx={{
                        background:
                            "linear-gradient(180deg, color-mix(in srgb, var(--scheme-surface-raised) 88%, var(--scheme-surface-raised-subtle)), var(--scheme-surface-raised))",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        boxShadow: "var(--scheme-shadow-soft)",
                        p: 2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minHeight: 520,
                    }}
                >
                    {/* Card title */}
                    <Skeleton variant="text" width={170} height={22} />

                    {/* Metric chips row */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, width: "100%" }}>
                        <Skeleton variant="rounded" width={68} height={26} sx={{ borderRadius: 999 }} />
                        <Skeleton variant="rounded" width={88} height={26} sx={{ borderRadius: 999 }} />
                    </Box>

                    {/* Accordion sections: Consumption, Power, Personalized Index, OMIE+B, Fixed */}
                    <Stack spacing={1}>
                        <AccordionRowSkeleton expanded />
                        <AccordionRowSkeleton expanded />
                        <AccordionRowSkeleton />
                        <AccordionRowSkeleton />
                        <AccordionRowSkeleton />
                    </Stack>

                    {/* Recalculate offers button */}
                    <Box sx={{ mt: "auto" }}>
                        <Skeleton variant="rounded" height={40} sx={{ borderRadius: 1 }} />
                        <Skeleton variant="text" width="80%" height={12} sx={{ mx: "auto", mt: 1 }} />
                    </Box>
                </Box>

                {/* Right: Electricity Offers card with table */}
                <Box
                    className="simulation-results-offers-pane simulation-results-offer-section"
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 520,
                        p: 2,
                    }}
                >
                    {/* Heading: "Electricity Offers" + product count badge */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
                        <Skeleton variant="circular" width={22} height={22} />
                        <Skeleton variant="text" width={170} height={22} />
                        <Skeleton variant="rounded" width={62} height={20} sx={{ borderRadius: 12 }} />
                    </Box>

                    {/* Inner tabs (All / Fixed / Indexed / Personalized) */}
                    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1.5 }}>
                        <Stack direction="row" spacing={3} sx={{ px: 1 }}>
                            <Skeleton variant="text" width={42} height={30} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="text" width={62} height={30} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="text" width={72} height={30} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="text" width={108} height={30} sx={{ borderRadius: 1 }} />
                        </Stack>
                    </Box>

                    {/* Offers table */}
                    <Box
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1.5,
                            overflow: "hidden",
                        }}
                    >
                        {/* Table header row */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "auto 1fr", md: "auto minmax(220px, 1.6fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(90px, 0.8fr) minmax(110px, 1fr)" },
                                alignItems: "center",
                                gap: 2,
                                px: 1.5,
                                py: 1.25,
                                background: "color-mix(in srgb, var(--scheme-surface-raised-subtle) 60%, transparent)",
                            }}
                        >
                            <Skeleton variant="text" width={42} height={14} />
                            <Skeleton variant="text" width={62} height={14} />
                            <Skeleton variant="text" width={92} height={14} sx={{ ml: "auto" }} />
                            <Skeleton variant="text" width={110} height={14} sx={{ ml: "auto" }} />
                            <Skeleton variant="text" width={96} height={14} sx={{ ml: "auto" }} />
                            <Skeleton variant="text" width={100} height={14} sx={{ ml: "auto" }} />
                        </Box>

                        {/* Offer rows */}
                        <OfferRowSkeleton highlighted />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                        <OfferRowSkeleton />
                    </Box>
                </Box>
            </Box>
        </Stack>
    );
}
