export interface AppChangelogEntry {
  version: string;
  title: string;
  notes: string[];
  notesByLanguage?: Record<string, string[]>;
  publishedAt: string;
}

const DEFAULT_CHANGELOG_TITLE = "Application update";

function cleanVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNotes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function cleanNotesByLanguage(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string[]> = {};
  for (const [languageCode, notes] of Object.entries(value)) {
    const cleanLanguageCode = languageCode.trim().toLowerCase();
    const cleanLanguageNotes = cleanNotes(notes);
    if (cleanLanguageCode && cleanLanguageNotes.length > 0) {
      result[cleanLanguageCode] = cleanLanguageNotes;
    }
  }

  return result;
}

function cleanPublishedAt(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function normalizeAppChangelog(value: unknown): AppChangelogEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: AppChangelogEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const version = cleanVersion(record.version);
    if (!version || seen.has(version)) continue;

    seen.add(version);
    entries.push({
      version,
      title: cleanVersion(record.title) ?? `Version ${version}`,
      notes: cleanNotes(record.notes),
      notesByLanguage: cleanNotesByLanguage(record.notesByLanguage),
      publishedAt: cleanPublishedAt(record.publishedAt),
    });
  }

  return entries.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function withCurrentVersionChangelog(
  changelog: unknown,
  version: string,
): AppChangelogEntry[] {
  const cleanCurrentVersion = cleanVersion(version) ?? "0.2.1";
  const entries = normalizeAppChangelog(changelog);

  if (entries.some((entry) => entry.version === cleanCurrentVersion)) {
    return entries;
  }

  return [
    {
      version: cleanCurrentVersion,
      title: `Version ${cleanCurrentVersion}`,
      notes: [],
      notesByLanguage: {},
      publishedAt: new Date().toISOString(),
    },
    ...entries,
  ];
}

export function appendVersionChangelogEntry(options: {
  changelog: unknown;
  previousVersion?: string | null;
  nextVersion: string;
  notes?: unknown;
}): AppChangelogEntry[] {
  const nextVersion = cleanVersion(options.nextVersion) ?? "0.2.1";
  const notes = cleanNotes(options.notes);
  const notesByLanguage = cleanNotesByLanguage(options.notes);
  const firstTranslatedNotes = Object.values(notesByLanguage)[0] ?? [];
  const entries = normalizeAppChangelog(options.changelog).filter(
    (entry) => entry.version !== nextVersion,
  );
  const previousVersion = cleanVersion(options.previousVersion);
  const title =
    previousVersion && previousVersion !== nextVersion
      ? `Updated from ${previousVersion} to ${nextVersion}`
      : `Version ${nextVersion}`;

  return [
    {
      version: nextVersion,
      title,
      notes:
        notes.length > 0
          ? notes
          : firstTranslatedNotes.length > 0
            ? firstTranslatedNotes
            : [DEFAULT_CHANGELOG_TITLE],
      notesByLanguage,
      publishedAt: new Date().toISOString(),
    },
    ...entries,
  ];
}
