"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import { useI18n } from "../../../src/lib/i18n-context";
import { useTopBarBreadcrumbs } from "../components/InternalWorkspace";

const DEFAULT_CHANGELOG_LANGUAGE = "en";

interface AppChangelogEntry {
  version: string;
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

function ChangelogSkeleton() {
  return (
    <Stack spacing={1.5}>
      {[0, 1, 2].map((item) => (
        <Paper
          key={item}
          variant="outlined"
          sx={{ borderRadius: 2, p: 2.5, borderColor: "var(--scheme-neutral-900)" }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Skeleton variant="rounded" width={72} height={26} />
              <Skeleton variant="text" width={132} height={24} />
            </Stack>
            <Skeleton variant="text" width="78%" height={22} />
            <Skeleton variant="text" width="64%" height={22} />
            <Skeleton variant="text" width="70%" height={22} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function ReleaseNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No release notes have been published for this version.
      </Typography>
    );
  }

  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {notes.map((note, noteIndex) => (
        <Typography
          key={noteIndex}
          component="li"
          variant="body2"
          sx={{ mb: 0.75, lineHeight: 1.5 }}
        >
          {note}
        </Typography>
      ))}
    </Box>
  );
}

export default function ChangelogPage() {
  const { locale } = useI18n();
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<AppChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const breadcrumbs = useMemo(
    () => [{ label: "Changelog", href: "/internal/changelog", icon: NewReleasesIcon }],
    [],
  );

  useTopBarBreadcrumbs(breadcrumbs);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/public/version", {
      cache: "no-store",
      headers: { pragma: "no-cache", "cache-control": "no-cache" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load changelog.");
        return res.json();
      })
      .then((data: VersionResponse) => {
        if (cancelled) return;
        setVersion(data.version);
        setEntries(Array.isArray(data.changelog) ? data.changelog : []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load changelog.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const latestVersion = useMemo(
    () => version ?? entries[0]?.version ?? null,
    [entries, version],
  );

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <ChangelogSkeleton />
        ) : entries.length === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, borderColor: "var(--scheme-neutral-900)" }}>
            <Typography variant="body2" color="text.secondary">
              No release notes have been published yet.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {entries.map((entry) => {
              const notes = resolveNotes(entry, locale);
              const isLatest = entry.version === latestVersion;

              if (isLatest) {
                return (
                  <Paper
                    key={`${entry.version}-${entry.publishedAt}`}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      borderColor: "rgba(255, 50, 84, 0.34)",
                      backgroundColor: "rgba(255, 50, 84, 0.035)",
                      overflow: "hidden",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ px: 2.5, py: 2 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip size="small" color="primary" label={`v${entry.version}`} />
                        <Chip size="small" variant="outlined" color="primary" label="Latest" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {formatReleaseDate(entry.publishedAt)}
                      </Typography>
                    </Stack>

                    <Divider />

                    <Box sx={{ px: 2.5, py: 2 }}>
                      <ReleaseNotes notes={notes} />
                    </Box>
                  </Paper>
                );
              }

              return (
                <Accordion
                  key={`${entry.version}-${entry.publishedAt}`}
                  disableGutters
                  variant="outlined"
                  sx={{
                    borderRadius: "8px !important",
                    borderColor: "var(--scheme-neutral-900)",
                    backgroundColor: "var(--scheme-neutral-1200)",
                    boxShadow: "none",
                    overflow: "hidden",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon fontSize="small" />}
                    sx={{
                      minHeight: 56,
                      px: 2.5,
                      "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        m: 0,
                      },
                      "&.Mui-expanded": {
                        minHeight: 56,
                      },
                      "& .MuiAccordionSummary-content.Mui-expanded": {
                        m: 0,
                      },
                    }}
                  >
                    <Chip size="small" label={`v${entry.version}`} />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
                      {formatReleaseDate(entry.publishedAt)}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <ReleaseNotes notes={notes} />
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
