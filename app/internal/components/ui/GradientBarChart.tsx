"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { useId } from "react";

interface GradientBarChartSeries {
    /** Y-axis data points */
    data: number[];
    /** Series label shown in the legend / tooltip */
    label?: string;
    /** Primary color for the bars and gradient top. Defaults to #3b82f6 */
    color?: string;
    /** Top opacity of the bar gradient. Defaults to 1 */
    opacityTop?: number;
    /** Bottom opacity of the bar gradient. Defaults to 0.4 */
    opacityBottom?: number;
}

interface GradientBarChartProps {
    /** X-axis category labels */
    xData: string[] | number[];
    /** One or more series to render */
    series: GradientBarChartSeries[];
    /** Chart height in px. Defaults to 300 */
    height?: number;
    /** Bar corner radius in px. Defaults to 4 */
    borderRadius?: number;
    /** Chart margin. Defaults to { left: 36, right: 12, top: 12, bottom: 36 } */
    margin?: { left?: number; right?: number; top?: number; bottom?: number };
    /** Message shown when there's no data */
    emptyMessage?: string;
}

const DEFAULT_CHART_SX = {
    "& .MuiChartsAxis-tickLabel": { fontSize: 10, fill: "var(--scheme-neutral-400)" },
    "& .MuiChartsGrid-line": { strokeDasharray: "4 4", opacity: 0.2, stroke: "var(--scheme-neutral-800)" },
    "& .MuiChartsLegend-series text": { fontSize: 11, fill: "var(--scheme-neutral-300)" },
};

export function GradientBarChart({
    xData,
    series,
    height = 300,
    borderRadius = 4,
    margin = { left: 36, right: 12, top: 12, bottom: 36 },
    emptyMessage = "No data available",
}: GradientBarChartProps) {
    const uid = useId().replace(/:/g, "");

    const hasData = series.some((s) => s.data.some((v) => v > 0));

    if (!hasData) {
        return (
            <div style={{
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.4,
                fontSize: 13,
            }}>
                {emptyMessage}
            </div>
        );
    }

    // Build per-series gradient ids — each series receives color: url(#id) directly,
    // MUI x-charts propagates it as the SVG fill for all bars in that series.
    const gradientIds = series.map((_, i) => `barGrad_${uid}_${i}`);

    const mergedSx = { ...DEFAULT_CHART_SX };

    return (
        <div style={{ position: "relative", width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            {/* Hidden SVG carrying gradient definitions for each series */}
            <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
                <defs>
                    {series.map((s, i) => (
                        <linearGradient
                            key={gradientIds[i]}
                            id={gradientIds[i]}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                            gradientUnits="objectBoundingBox"
                        >
                            <stop
                                offset="0%"
                                stopColor={s.color ?? "#3b82f6"}
                                stopOpacity={s.opacityTop ?? 1}
                            />
                            <stop
                                offset="100%"
                                stopColor={s.color ?? "#3b82f6"}
                                stopOpacity={s.opacityBottom ?? 0.4}
                            />
                        </linearGradient>
                    ))}
                </defs>
            </svg>

            <BarChart
                xAxis={[{ data: xData as string[], scaleType: "band" }]}
                series={series.map((s, i) => ({
                    data: s.data,
                    label: s.label,
                    color: `url(#${gradientIds[i]})`,
                }))}
                borderRadius={borderRadius}
                height={height}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sx={mergedSx as any}
                margin={margin}
            />
        </div>
    );
}
