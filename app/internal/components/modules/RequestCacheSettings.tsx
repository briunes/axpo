"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, Switch, TextField, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../src/lib/i18n-context";
import { getSystemConfig, updateSystemConfig } from "../../lib/configApi";
import {
  normalizeRequestCacheConfig,
  REQUEST_CACHE_MODULE_LABELS,
  REQUEST_CACHE_MODULES,
  type RequestCacheConfig,
  type RequestCacheModule,
} from "../../lib/requestCacheConfig";
import type { SessionState } from "../../lib/authSession";
import { LoadingState } from "../shared/LoadingState";

export interface RequestCacheSettingsProps {
  session: SessionState;
  onNotify: (message: string, tone: "success" | "error") => void;
}

const durationToMinutes = (ms: number) => Math.round((ms / 60_000) * 100) / 100;
const minutesToDuration = (minutes: number) => Math.round(minutes * 60_000);

export function RequestCacheSettings({ onNotify }: RequestCacheSettingsProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<RequestCacheConfig>(() =>
    normalizeRequestCacheConfig(null),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        setIsLoading(true);
        const data = await getSystemConfig({ view: "admin" });
        if (!cancelled) {
          setConfig(normalizeRequestCacheConfig(data.requestCacheConfig));
          setIsDirty(false);
        }
      } catch (error) {
        onNotify(t("requestCache", "loadError"), "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [onNotify]);

  const updateModule = (
    module: RequestCacheModule,
    patch: Partial<RequestCacheConfig[RequestCacheModule]>,
  ) => {
    setConfig((current) => ({
      ...current,
      [module]: {
        ...current[module],
        ...patch,
      },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const nextConfig = normalizeRequestCacheConfig(config);
      await updateSystemConfig({ requestCacheConfig: nextConfig });
      await queryClient.invalidateQueries({
        queryKey: ["system-config", "request-cache"],
      });
      setConfig(nextConfig);
      setIsDirty(false);
      onNotify(t("requestCache", "saveSuccess"), "success");
    } catch (error) {
      onNotify(t("requestCache", "saveError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(normalizeRequestCacheConfig(null));
    setIsDirty(true);
  };

  if (isLoading) {
    return <LoadingState message={t("requestCache", "loading")} />;
  }

  return (
    <div className="settings-panel">
      <h3 className="settings-panel-title">{t("requestCache", "title")}</h3>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        {t("requestCache", "description")}
      </Typography>

      <Stack spacing={1.5}>
        {REQUEST_CACHE_MODULES.map((module) => {
          const moduleConfig = config[module];
          return (
            <Box
              key={module}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(160px, 1fr) 150px 190px 180px" },
                gap: 2,
                alignItems: "center",
                p: 2,
                border: "1px solid var(--scheme-neutral-800)",
                borderRadius: 1,
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {REQUEST_CACHE_MODULE_LABELS[module]}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {t("requestCache", "moduleDescription")}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch
                  checked={moduleConfig.enabled}
                  onChange={(event) =>
                    updateModule(module, { enabled: event.target.checked })
                  }
                />
                <Typography variant="body2">
                  {moduleConfig.enabled ? t("common", "active") : t("common", "inactive")}
                </Typography>
              </Box>

              <TextField
                size="small"
                type="number"
                label={t("requestCache", "cacheMinutes")}
                value={durationToMinutes(moduleConfig.durationMs)}
                disabled={!moduleConfig.enabled}
                slotProps={{ htmlInput: { min: 0.08, max: 1440, step: 1 } }}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  updateModule(module, {
                    durationMs: minutesToDuration(Number.isFinite(minutes) ? minutes : 5),
                  });
                }}
              />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch
                  checked={moduleConfig.autoRefetchOnExpire}
                  disabled={!moduleConfig.enabled}
                  onChange={(event) =>
                    updateModule(module, {
                      autoRefetchOnExpire: event.target.checked,
                    })
                  }
                />
                <Typography variant="body2">{t("requestCache", "refetchOnExpiry")}</Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3 }}>
        <Button variant="outlined" onClick={handleReset} disabled={isSaving}>
          {t("requestCache", "resetDefaults")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {t("actions", "saveChanges")}
        </Button>
      </Box>
    </div>
  );
}
