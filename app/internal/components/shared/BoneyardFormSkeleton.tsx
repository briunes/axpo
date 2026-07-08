"use client";

import { Box } from "@mui/material";
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react";

type FormSkeletonShape = "agency" | "client" | "user" | "base-values" | "simulation-edit";

interface BoneyardFormSkeletonProps {
  name: string;
  shape: FormSkeletonShape;
  tabs?: number;
}

const SHAPES: Record<FormSkeletonShape, { rows: number; textarea?: boolean; textareaWidth?: string }> = {
  agency: { rows: 4 },
  client: { rows: 7, textarea: true },
  user: { rows: 4, textarea: true, textareaWidth: "50%" },
  "base-values": { rows: 3 },
  "simulation-edit": { rows: 6, textarea: true },
};

function CaptureBlock({
  height,
  width = "100%",
  sx,
}: {
  height: number;
  width?: number | string;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: "8px",
        backgroundColor: "#eeeeee",
        ...sx,
      }}
    />
  );
}

function BoneyardFormSkeletonCapture({ shape, tabs }: { shape: FormSkeletonShape; tabs?: number }) {
  const config = SHAPES[shape];

  return (
    <Box>
      {tabs && tabs > 0 && (
        <Box
          sx={{
            mx: "-8px",
            mb: "22px",
            px: "8px",
            pb: "10px",
            borderBottom: "1px solid color-mix(in srgb, var(--scheme-neutral-900) 78%, transparent)",
          }}
        >
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", minHeight: 40 }}>
            {Array.from({ length: tabs }).map((_, index) => (
              <CaptureBlock
                key={`tab-${index}`}
                width={index === 0 ? 74 : index === 1 ? 102 : 86}
                height={24}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: "grid", gap: 2.5 }}>
        {Array.from({ length: config.rows }).map((_, index) => (
          <Box
            key={`row-${index}`}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <Box>
              <CaptureBlock width={index % 3 === 0 ? 120 : 92} height={14} sx={{ mb: 1 }} />
              <CaptureBlock height={38} />
            </Box>
            <Box>
              <CaptureBlock width={index % 2 === 0 ? 120 : 72} height={14} sx={{ mb: 1 }} />
              <CaptureBlock height={38} />
            </Box>
          </Box>
        ))}

        {config.textarea && (
          <Box>
            <CaptureBlock width={104} height={14} sx={{ mb: 1 }} />
            <CaptureBlock
              height={shape === "simulation-edit" ? 260 : 320}
              sx={{ maxWidth: { xs: "100%", md: config.textareaWidth ?? "100%" } }}
            />
            <CaptureBlock width={220} height={14} sx={{ mt: 1 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function BoneyardFormSkeleton({ name, shape, tabs }: BoneyardFormSkeletonProps) {
  const fallback = <BoneyardFormSkeletonCapture shape={shape} tabs={tabs} />;

  return (
    <Box className="crud-tab-panel">
      <BoneyardSkeleton
        name={name}
        loading
        fallback={fallback}
        fixture={fallback}
        select="viewport"
        animate="shimmer"
        transition
      >
        {fallback}
      </BoneyardSkeleton>
    </Box>
  );
}

export function BoneyardFormSkeletonProbe({ name, shape, tabs }: BoneyardFormSkeletonProps) {
  const fixture = <BoneyardFormSkeletonCapture shape={shape} tabs={tabs} />;

  return (
    <BoneyardSkeleton name={name} loading={false} fixture={fixture} select="viewport">
      {null}
    </BoneyardSkeleton>
  );
}
