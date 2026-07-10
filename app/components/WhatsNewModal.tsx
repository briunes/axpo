"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useRouter } from "next/navigation";
import { useI18n } from "../../src/lib/i18n-context";

export const APP_VERSION_EVENT = "axpo:app-version";
export const OPEN_WHATS_NEW_EVENT = "axpo:open-whats-new";

const CHANGELOG_SEEN_VERSION_KEY = "axpo_changelog_seen_version";
const DEFAULT_CHANGELOG_LANGUAGE = "en";
const BRAND_PRIMARY = "var(--scheme-brand-600, #FF3254)";
const BRAND_PRIMARY_HOVER = "var(--scheme-brand-700, #FF5D64)";

export interface AppChangelogEntry {
  version: string;
  title: string;
  notes: string[];
  notesByLanguage?: Record<string, string[]>;
  publishedAt: string;
}

export interface VersionResponse {
  version: string;
  changelog?: AppChangelogEntry[];
}

function formatReleaseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function resolveNotes(entry: AppChangelogEntry, locale: string): string[] {
  const normalizedLocale = locale.trim().toLowerCase();
  return (
    entry.notesByLanguage?.[normalizedLocale] ??
    entry.notesByLanguage?.[DEFAULT_CHANGELOG_LANGUAGE] ??
    entry.notes
  );
}

export function broadcastAppVersion(payload: VersionResponse): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_VERSION_EVENT, { detail: payload }));
}

export function openWhatsNewModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT));
}

export function WhatsNewModal() {
  const { locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<AppChangelogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    function applyVersionData(data: VersionResponse, autoOpen: boolean) {
      if (cancelled) return;

      setVersion(data.version);
      setEntries(Array.isArray(data.changelog) ? data.changelog : []);

      if (!autoOpen || !data.version) return;

      const seenVersion = localStorage.getItem(CHANGELOG_SEEN_VERSION_KEY);
      if (seenVersion !== data.version) {
        setOpen(true);
      }
    }

    function handleVersionEvent(event: Event) {
      const detail = (event as CustomEvent<VersionResponse>).detail;
      if (detail?.version) {
        applyVersionData(detail, true);
      }
    }

    function handleOpenEvent() {
      setOpen(true);
    }

    window.addEventListener(APP_VERSION_EVENT, handleVersionEvent);
    window.addEventListener(OPEN_WHATS_NEW_EVENT, handleOpenEvent);

    fetch("/api/v1/public/version", {
      cache: "no-store",
      headers: { pragma: "no-cache", "cache-control": "no-cache" },
    })
      .then((res) => res.json())
      .then((data: VersionResponse) => applyVersionData(data, true))
      .catch(() => {
        // Changelog loading is best-effort.
      });

    return () => {
      cancelled = true;
      window.removeEventListener(APP_VERSION_EVENT, handleVersionEvent);
      window.removeEventListener(OPEN_WHATS_NEW_EVENT, handleOpenEvent);
    };
  }, []);

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.version === version) ?? entries[0],
    [entries, version],
  );

  const handleClose = () => {
    if (version) {
      localStorage.setItem(CHANGELOG_SEEN_VERSION_KEY, version);
    }
    setOpen(false);
  };

  const handleGoToChangelog = () => {
    handleClose();
    router.push("/internal/changelog");
  };

  const currentNotes = currentEntry ? resolveNotes(currentEntry, locale) : [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack spacing={1}>
          <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
            What&apos;s new
          </Typography>
          {currentEntry && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                label={`v${currentEntry.version}`}
                sx={{
                  bgcolor: BRAND_PRIMARY,
                  color: "#fff",
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {formatReleaseDate(currentEntry.publishedAt)}
              </Typography>
            </Stack>
          )}
        </Stack>
        <IconButton
          aria-label="Close what's new"
          onClick={handleClose}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!currentEntry ? (
          <Typography variant="body2" color="text.secondary">
            No release notes have been published yet.
          </Typography>
        ) : currentNotes.length > 0 ? (
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {currentNotes.map((note, noteIndex) => (
              <Typography
                key={noteIndex}
                component="li"
                variant="body2"
                sx={{ mb: 0.75, lineHeight: 1.45 }}
              >
                {note}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No release notes have been published for this version.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="text"
          onClick={handleGoToChangelog}
          sx={{
            color: BRAND_PRIMARY,
            "&:hover": {
              color: BRAND_PRIMARY_HOVER,
              bgcolor: "var(--scheme-brand-600-15, rgba(255, 50, 84, 0.10))",
            },
          }}
        >
          Go to changelog
        </Button>
      </DialogActions>
    </Dialog>
  );
}
