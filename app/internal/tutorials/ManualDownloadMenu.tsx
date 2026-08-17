"use client";

import { useState, type MouseEvent } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  ListSubheader,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useI18n } from "@/lib/i18n-context";
import type { UserRole } from "../lib/internalApi";

type ManualRole = Exclude<UserRole, "SYS_ADMIN">;
type ManualLanguage = "en" | "es";
type ManualFormat = "pdf" | "docx";

const MANUAL_RELEASE = "2026-08-17-role-permissions-v4";

const ALL_MANUAL_ROLES: ManualRole[] = ["ADMIN", "AGENT", "COMMERCIAL"];

const roleSlugs: Record<ManualRole, string> = {
  ADMIN: "administrator",
  AGENT: "agent",
  COMMERCIAL: "commercial",
};

export function ManualDownloadMenu({ role, token }: { role: UserRole; token: string }) {
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const roles = role === "SYS_ADMIN" ? ALL_MANUAL_ROLES : [role as ManualRole];

  const download = async (
    manualRole: ManualRole,
    language: ManualLanguage,
    format: ManualFormat,
  ) => {
    const downloadKey = `${manualRole}-${language}-${format}`;
    setDownloading(downloadKey);
    setError(false);

    try {
      const response = await fetch(
        `/api/v1/internal/manuals/${manualRole}/${language}/${format}?release=${MANUAL_RELEASE}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Manual download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `axpo-simulator-${roleSlugs[manualRole]}-manual-${language}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAnchorEl(null);
    } catch {
      setError(true);
    } finally {
      setDownloading(null);
    }
  };

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        data-testid="manual-download-button"
        sx={{ flexShrink: 0 }}
      >
        {t("tutorials", "downloadManual")}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ "aria-label": t("tutorials", "manualOptions") }}
        slotProps={{ paper: { sx: { minWidth: 300, maxHeight: 520 } } }}
      >
        {roles.flatMap((manualRole, roleIndex) => {
          const items = (["en", "es"] as ManualLanguage[]).flatMap((language) =>
            (["pdf", "docx"] as ManualFormat[]).map((format) => {
              const key = `${manualRole}-${language}-${format}`;
              const isDownloading = downloading === key;
              return (
                <MenuItem
                  key={key}
                  disabled={downloading !== null}
                  onClick={() => download(manualRole, language, format)}
                  data-testid={`manual-${key}`}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                    {isDownloading
                      ? <CircularProgress size={20} />
                      : format === "pdf"
                        ? <PictureAsPdfIcon fontSize="small" color="error" />
                        : <DescriptionOutlinedIcon fontSize="small" color="primary" />}
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {t("tutorials", language === "en" ? "manualEnglish" : "manualSpanish")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {format === "pdf" ? "PDF" : "Word"}
                    </Typography>
                  </Stack>
                </MenuItem>
              );
            }),
          );

          return [
            ...(roleIndex > 0 ? [<Divider key={`${manualRole}-divider`} component="li" />] : []),
            <ListSubheader key={`${manualRole}-header`} disableSticky sx={{ lineHeight: 1.2, py: 1.25 }}>
              {t("tutorials", `manualRole${manualRole}`)}
            </ListSubheader>,
            ...items,
          ];
        })}
      </Menu>
      <Snackbar open={error} autoHideDuration={5000} onClose={() => setError(false)}>
        <Alert severity="error" onClose={() => setError(false)}>
          {t("tutorials", "manualDownloadFailed")}
        </Alert>
      </Snackbar>
    </>
  );
}
