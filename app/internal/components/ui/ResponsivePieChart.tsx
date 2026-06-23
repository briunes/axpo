"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { PieChart } from "@mui/x-charts/PieChart";

type ResponsivePieChartProps = Omit<ComponentProps<typeof PieChart>, "width">;

export function ResponsivePieChart({ height = 300, ...props }: ResponsivePieChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        const updateWidth = () => {
            const nextWidth = Math.floor(node.getBoundingClientRect().width);
            if (nextWidth > 0) setWidth(nextWidth);
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            {width ? (
                <PieChart {...props} width={width} height={height} />
            ) : (
                <div style={{ height, width: "100%" }} />
            )}
        </div>
    );
}
