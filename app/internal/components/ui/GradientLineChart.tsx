"use client";

import { LineChart } from "@mui/x-charts/LineChart";
import type { SxProps } from "@mui/material";
import type { CurveType } from "@mui/x-charts/models";
import { useId } from "react";

interface GradientLineChartProps {
    /** X-axis data points (dates or numbers) */
    xData: Date[] | number[];
    /** Y-axis data points */
    yData: number[];
    /** Series label shown in the legend / tooltip */
    label?: string;
    /** Primary color for the line stroke and gradient top. Defaults to #3b82f6 */
    color?: string;
    /** Chart height in px. Defaults to 300 */
    height?: number;
    /** Top opacity of the area gradient. Defaults to 0.5 */
    areaOpacityTop?: number;
    /** Bottom opacity of the area gradient. Defaults to 0 */
    areaOpacityBottom?: number;
    /** Show marks on each data point. Defaults to true */
    showMark?: boolean;
    /** Curve type. Defaults to "natural" */
    curve?: CurveType;
    /** xAxis scale type. Defaults to "time" when xData contains Dates, "linear" otherwise */
    scaleType?: "time" | "linear" | "band" | "log" | "pow" | "sqrt" | "utc";
    /** Extra MUI sx overrides applied on top of the defaults */
    sx?: SxProps;
    /** Chart margin. Defaults to { left: 36, right: 12, top: 12, bottom: 32 } */
    margin?: { left?: number; right?: number; top?: number; bottom?: number };
    /** Message shown when there's no data */
    emptyMessage?: string;
}

const DEFAULT_CHART_SX: SxProps = {
    "& .MuiChartsAxis-tickLabel": { fontSize: 10, fill: "var(--scheme-neutral-400)" },
    "& .MuiChartsGrid-line": { strokeDasharray: "4 4", opacity: 0.2, stroke: "var(--scheme-neutral-800)" },
    "& .MuiChartsLegend-series text": { fontSize: 11, fill: "var(--scheme-neutral-300)" },
};

export function GradientLineChart({
    xData,
    yData,
    label,
    color = "#3b82f6",
    height = 300,
    areaOpacityTop = 0.5,
    areaOpacityBottom = 0,
    showMark = true,
    curve = "natural",
    scaleType,
    sx,
    margin = { left: 36, right: 12, top: 12, bottom: 32 },
    emptyMessage = "No data available",
}: GradientLineChartProps) {
    // Unique gradient id per instance so multiple charts on the same page don't conflict
    const uid = useId().replace(/:/g, "");
    const gradientId = `areaGrad_${uid}`;

    const resolvedScaleType =
        scaleType ?? (xData.length > 0 && xData[0] instanceof Date ? "time" : "linear");

    const hasData = yData.some((v) => v > 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedSx: any = {
        ...DEFAULT_CHART_SX,
        ...(sx as object),
        "& .MuiAreaElement-root": { fill: `url(#${gradientId})` },
    };

    if (!hasData) {
        return (
            <div style={{
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.4, }}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div style={{ position: "relative", width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            {/* Hidden SVG carrying the gradient definition for this instance */}
            <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                        <stop offset="0%" stopColor={color} stopOpacity={areaOpacityTop} />
                        <stop offset="100%" stopColor={color} stopOpacity={areaOpacityBottom} />
                    </linearGradient>
                </defs>
            </svg>

            <LineChart
                xAxis={[{ data: xData as Date[], scaleType: resolvedScaleType as "time" }]}
                series={[{
                    data: yData,
                    label,
                    color,
                    area: true,
                    showMark,
                    curve,
                }]}
                height={height}
                sx={mergedSx}
                margin={margin}
            />
        </div>
    );
}
