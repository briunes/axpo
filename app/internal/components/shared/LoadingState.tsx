"use client";

import { CircularProgress, Paper, Stack, Typography } from "@mui/material";
import Image from "next/image";
import { useI18n } from "../../../../src/lib/i18n-context";

interface LoadingStateProps {
  message?: string;
  variant?: "default" | "table";
  rows?: number;
  size?: number;
}

export function LoadingState({ message = "Loading...", variant = "default", rows = 4, size = 48 }: LoadingStateProps) {
  const { t } = useI18n();
  const resolvedMessage = message === "Loading..." ? t("common", "loading") : message;

  return (
    <Paper sx={{ width: "100%", p: 3, boxShadow: "none" }}>
      <Stack alignItems="center" spacing={2}>
        <CircularProgress  size={size}/>
       {false &&  <Image
          src="https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoiYXhwb1wvZmlsZVwvWFdydWluVmNaS2JEUmo1RGJWSkMuZ2lmIn0:axpo:qPyTcxxV9tma-GNp8_KdV4a_JWFXGylEOusDzhFQm1U?width=200"
          alt={t("common", "loading")}
          width={size}
          height={size}
          unoptimized
          style={{ width: 'auto', height: size, maxWidth: '100%' }}
        />}
        <Typography color="text.secondary">{resolvedMessage}</Typography>
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
