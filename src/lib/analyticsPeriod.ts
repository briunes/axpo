import { ValidationError } from "../domain/errors/errors";

const DAY_MS = 86_400_000;

/** Date-only custom ranges include both selected UTC calendar dates. */
export function resolveAnalyticsPeriod(params: URLSearchParams, now = new Date()) {
  const start = params.get("startDate");
  const end = params.get("endDate");
  if (start !== null || end !== null) {
    const parse = (value: string | null) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ValidationError("startDate and endDate must be YYYY-MM-DD dates");
      }
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new ValidationError("Invalid analytics date");
      }
      return date;
    };
    const since = parse(start);
    const endDate = parse(end);
    if (since > endDate) throw new ValidationError("startDate must not be after endDate");
    const until = new Date(endDate.getTime() + DAY_MS);
    const days = (until.getTime() - since.getTime()) / DAY_MS;
    return { days, since, until, previousSince: new Date(since.getTime() - days * DAY_MS) };
  }
  const requestedDays = Number(params.get("days") ?? 30);
  if (!Number.isInteger(requestedDays) || requestedDays < 1) {
    throw new ValidationError("days must be a positive integer");
  }
  const days = Math.min(Math.max(requestedDays, 7), 90);
  const since = new Date(now.getTime() - days * DAY_MS);
  return { days, since, until: now, previousSince: new Date(since.getTime() - days * DAY_MS) };
}
