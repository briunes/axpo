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
  type IconButtonProps,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";

const CHANGELOG_SEEN_VERSION_KEY = "axpo_changelog_seen_version";
const DEFAULT_CHANGELOG_LANGUAGE = "en";

interface AppChangelogEntry {
  version: string;
  title: string;
  notes: string[];
  notesByLanguage?: Record<string, string[]>;
  publishedAt: string;
}

interface VersionResponse {
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

export function WhatsNewButton({
  buttonClassName = "topbar-icon-btn",
  buttonSx,
}: {
  buttonClassName?: string;
  buttonSx?: IconButtonProps["sx"];
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<AppChangelogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/public/version", {
      cache: "no-store",
      headers: { pragma: "no-cache", "cache-control": "no-cache" },
    })
      .then((res) => res.json())
      .then((data: VersionResponse) => {
        if (cancelled) return;
        setVersion(data.version);
        setEntries(Array.isArray(data.changelog) ? data.changelog : []);

        const seenVersion = localStorage.getItem(CHANGELOG_SEEN_VERSION_KEY);
        if (data.version && seenVersion !== data.version) {
          setOpen(true);
        }
      })
      .catch(() => {
        // Changelog loading is best-effort.
      });

    return () => {
      cancelled = true;
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
    <>
      <Tooltip title={version ? `What's new in v${version}` : "What's new"}>
        <IconButton
          className={buttonClassName}
          onClick={() => setOpen(true)}
          aria-label="What's new"
          size="small"
          sx={buttonSx}
        >
          <NewReleasesIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 7 }}>
          <Stack spacing={1}>
            <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
              What&apos;s new
            </Typography>
            {currentEntry && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip size="small" color="primary" label={`v${currentEntry.version}`} />
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
          <Button variant="text" onClick={handleGoToChangelog}>
            Go to changelog
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
