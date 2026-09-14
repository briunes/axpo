import { resolveAnalyticsPeriod } from "../analyticsPeriod";

describe("analytics date ranges", () => {
  it("includes the entire end date and compares an equal preceding period", () => {
    const period = resolveAnalyticsPeriod(new URLSearchParams("startDate=2026-08-01&endDate=2026-08-31"));
    expect(period).toEqual({
      days: 31,
      since: new Date("2026-08-01T00:00:00Z"),
      until: new Date("2026-09-01T00:00:00Z"),
      previousSince: new Date("2026-07-01T00:00:00Z"),
    });
  });

  it.each([
    ["2024-02-29", "2024-02-29", 1],
    ["2026-01-01", "2026-12-31", 365],
    ["2026-03-28", "2026-03-30", 3],
  ])("supports %s through %s", (start, end, days) => {
    expect(resolveAnalyticsPeriod(new URLSearchParams({ startDate: start, endDate: end })).days).toBe(days);
  });

  it.each([
    "startDate=2026-08-01",
    "endDate=2026-08-31",
    "startDate=2026-02-30&endDate=2026-03-01",
    "startDate=2026-09-01&endDate=2026-08-01",
    "startDate=invalid&endDate=2026-08-31",
    "days=NaN",
  ])("rejects invalid input: %s", (query) => {
    expect(() => resolveAnalyticsPeriod(new URLSearchParams(query))).toThrow();
  });

  it.each([7, 30, 90])("preserves the %i-day preset", (days) => {
    const now = new Date("2026-09-14T12:00:00Z");
    const period = resolveAnalyticsPeriod(new URLSearchParams({ days: String(days) }), now);
    expect(period.days).toBe(days);
    expect(period.until).toEqual(now);
    expect(now.getTime() - period.since.getTime()).toBe(days * 86400000);
  });
});
