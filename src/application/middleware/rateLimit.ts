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
  const match = raw.match(/^(\d+)([smh])$/);
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

const getRedisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
};

const redisCommand = async <T>(command: unknown[]): Promise<T | null> => {
  const config = getRedisConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit command failed: ${response.status}`);
  }

  const payload = (await response.json()) as Array<{ result?: T }>;
  return payload[0]?.result ?? null;
};

/**
 * Shared rate limiter for auth/public endpoints.
 *
 * In production, configure UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN so limits are enforced across serverless
 * instances. Without those env vars this falls back to the in-process limiter,
 * which is useful for local development and tests only.
 */
export const applyRateLimitShared = async (
  key: string,
  options: RateLimitOptions = {},
) => {
  const redisConfig = getRedisConfig();
  if (!redisConfig) {
    applyRateLimit(key, options);
    return;
  }

  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? RATE_LIMIT_MAX;
  const redisKey = `rate-limit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  const count = Number(await redisCommand<number>(["INCR", redisKey]));
  if (count === 1) {
    await redisCommand(["EXPIRE", redisKey, windowSeconds]);
  }

  if (count > maxRequests) {
    const ttl = Number(await redisCommand<number>(["TTL", redisKey]));
    throw new RateLimitError(ttl > 0 ? ttl : windowSeconds);
  }
};

export const getClientRateLimitKey = (ip: string | null, suffix = "public") => {
  return `${suffix}:${ip ?? "unknown"}`;
};
