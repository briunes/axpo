"use client";

import { Paper, Stack, Typography } from "@mui/material";
import Image from "next/image";

interface LoadingStateProps {
  message?: string;
  variant?: "default" | "table";
  rows?: number;
  size?: number;
}

export function LoadingState({ message = "Loading...", variant = "default", rows = 4, size = 48 }: LoadingStateProps) {
  return (
    <Paper sx={{ width: "100%", p: 3, boxShadow: "none" }}>
      <Stack alignItems="center" spacing={2}>
        <Image
          src="https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoiYXhwb1wvZmlsZVwvWFdydWluVmNaS2JEUmo1RGJWSkMuZ2lmIn0:axpo:qPyTcxxV9tma-GNp8_KdV4a_JWFXGylEOusDzhFQm1U?width=200"
          alt="Loading..."
          width={size}
          height={size}
          unoptimized
          style={{ width: 'auto', height: size, maxWidth: '100%' }}
        />
        <Typography color="text.secondary">{message}</Typography>
        {variant === "table" && (
          <Stack sx={{ width: "100%", mt: 1 }} spacing={1}>
            {Array.from({ length: rows }).map((_, index) => (
              <div
                key={`skeleton-row-${index}`}
                className="loading-skeleton"
                style={{ height: 14, width: `${92 - index * 8}%` }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
