/**
 * Utility functions for formatting dates and numbers according to user preferences.
 */

// ─── Date ────────────────────────────────────────────────────────────────────

/**
 * Formats a Date object into a display string respecting the user's dateFormat.
 * Supported formats: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
 */
export function formatDisplayDate(
  date: Date,
  dateFormat: string,
  timeZone?: string,
): string {
  let day: string;
  let month: string;
  let year: string;

  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      day = values.day;
      month = values.month;
      year = values.year;
    } catch {
      day = String(date.getDate()).padStart(2, "0");
      month = String(date.getMonth() + 1).padStart(2, "0");
      year = String(date.getFullYear());
    }
  } else {
    day = String(date.getDate()).padStart(2, "0");
    month = String(date.getMonth() + 1).padStart(2, "0");
    year = String(date.getFullYear());
  }

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

export interface DateTimeDisplayPreferences {
  dateFormat: string;
  timeFormat: string;
  timezone: string;
}

/**
 * Formats an instant in the user's configured timezone. Timestamp values must
 * include an offset (normally the API's ISO `Z` suffix) so they represent an
 * unambiguous instant.
 */
export function formatDisplayDateTime(
  value: Date | string | number | null | undefined,
  preferences: DateTimeDisplayPreferences,
  options: { includeSeconds?: boolean; fallback?: string } = {},
): string {
  if (value === null || value === undefined || value === "") {
    return options.fallback ?? "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return options.fallback ?? "—";

  const datePart = formatDisplayDate(
    date,
    preferences.dateFormat,
    preferences.timezone,
  );

  try {
    const timePart = new Intl.DateTimeFormat("en-GB", {
      timeZone: preferences.timezone,
      hour: "2-digit",
      minute: "2-digit",
      ...(options.includeSeconds ? { second: "2-digit" } : {}),
      hour12: preferences.timeFormat === "12h",
    }).format(date);
    return `${datePart} ${timePart}`;
  } catch {
    const timePart = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      ...(options.includeSeconds ? { second: "2-digit" } : {}),
      hour12: preferences.timeFormat === "12h",
    }).format(date);
    return `${formatDisplayDate(date, preferences.dateFormat)} ${timePart}`;
  }
}

/**
 * Returns a regex + parser for the given dateFormat.
 * Returns null if the text doesn't match the expected format.
 */
export function parseDisplayDate(
  text: string,
  dateFormat: string,
): Date | null {
  let day: string, month: string, year: string;

  switch (dateFormat) {
    case "MM/DD/YYYY": {
      const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return null;
      [, month, day, year] = match;
      break;
    }
    case "YYYY-MM-DD": {
      const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      [, year, month, day] = match;
      break;
    }
    case "DD/MM/YYYY":
    default: {
      const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return null;
      [, day, month, year] = match;
      break;
    }
  }

  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Returns the placeholder string for the given dateFormat.
 */
export function getDatePlaceholder(dateFormat: string): string {
  switch (dateFormat) {
    case "MM/DD/YYYY":
      return "MM/DD/YYYY";
    case "YYYY-MM-DD":
      return "YYYY-MM-DD";
    case "DD/MM/YYYY":
    default:
      return "DD/MM/YYYY";
  }
}

/**
 * Auto-formats a raw digit string into the given date format as the user types.
 * Returns the formatted string (partial or complete).
 */
export function autoFormatDateInput(
  digits: string,
  dateFormat: string,
): string {
  switch (dateFormat) {
    case "MM/DD/YYYY":
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    case "YYYY-MM-DD":
      if (digits.length <= 4) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    case "DD/MM/YYYY":
    default:
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }
}

// ─── Number ──────────────────────────────────────────────────────────────────

/**
 * Formats a number according to the user's numberFormat preference.
 * "eu" → European  (1.234,56)
 * "us" → US/UK     (1,234.56)
 */
export function formatNumber(
  value: number,
  numberFormat: string,
  decimals?: number,
): string {
  const locale = numberFormat === "us" ? "en-US" : "de-DE";
  const options: Intl.NumberFormatOptions =
    decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : {};
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formats a currency value according to the user's numberFormat preference.
 */
export function formatCurrency(
  value: number,
  numberFormat: string,
  currency = "EUR",
  decimals = 2,
): string {
  const locale = numberFormat === "us" ? "en-US" : "de-DE";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
