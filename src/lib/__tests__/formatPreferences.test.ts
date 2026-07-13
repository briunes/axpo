import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "../../../app/internal/lib/formatPreferences";

describe("timezone-aware date formatting", () => {
  const instant = "2026-01-15T23:30:45.000Z";

  it("shows the same instant in each user's configured timezone", () => {
    expect(formatDisplayDateTime(instant, {
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "Europe/Lisbon",
    })).toBe("15/01/2026 23:30");

    expect(formatDisplayDateTime(instant, {
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "Europe/Madrid",
    })).toBe("16/01/2026 00:30");
  });

  it("keeps the date and time in the same timezone across midnight", () => {
    expect(formatDisplayDateTime(instant, {
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      timezone: "Europe/Madrid",
    }, { includeSeconds: true })).toBe("2026-01-16 00:30:45");
  });

  it("can format only the calendar date in a specified timezone", () => {
    const date = new Date(instant);
    expect(formatDisplayDate(date, "MM/DD/YYYY", "Europe/Lisbon")).toBe("01/15/2026");
    expect(formatDisplayDate(date, "MM/DD/YYYY", "Europe/Madrid")).toBe("01/16/2026");
  });

  it("returns a safe fallback for missing or invalid timestamps", () => {
    const preferences = {
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "Europe/Lisbon",
    };
    expect(formatDisplayDateTime(null, preferences)).toBe("—");
    expect(formatDisplayDateTime("not-a-date", preferences, { fallback: "Invalid" })).toBe("Invalid");
  });
});
