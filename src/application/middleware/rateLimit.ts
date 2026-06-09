import { RateLimitError } from "@/domain/errors/errors";

interface RateBucket {
  count: number;
  windowStart: number;
}

interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

const buckets = new Map<string, RateBucket>();

const RATE_LIMIT_WINDOW_MS = (() => {
  const raw = process.env.RATE_LIMIT_WINDOW ?? "15m";
  const match = raw.match(/^(\\d+)([smh])$/);
  if (!match) {
    return 15 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60 * 1000;
  return value * 60 * 60 * 1000;
})();

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100);

export const applyRateLimit = (key: string, options: RateLimitOptions = {}) => {
  const now = Date.now();
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? RATE_LIMIT_MAX;
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }

  if (bucket.count >= maxRequests) {
    const retryAfter = Math.ceil(
      (windowMs - (now - bucket.windowStart)) / 1000,
    );
    throw new RateLimitError(retryAfter);
  }

  bucket.count += 1;
};

export const getClientRateLimitKey = (ip: string | null, suffix = "public") => {
  return `${suffix}:${ip ?? "unknown"}`;
};
