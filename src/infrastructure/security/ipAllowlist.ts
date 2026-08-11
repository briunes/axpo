const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// These assets are required to render the two public gate pages. Keeping the
// bypass explicit avoids exposing every file in /public when the IP gate is on.
const IP_GATE_PUBLIC_ASSETS = new Set([
  "/axpo-logo.svg",
  "/axpo-mark.svg",
]);

function normalizeIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const normalized: string[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    normalized.push(String(octet));
  }
  return normalized.join(".");
}

/** Returns a canonical form suitable for exact IPv4/IPv6 comparisons. */
export function normalizeIp(rawValue: string): string | null {
  let value = rawValue.trim().toLowerCase();
  if (!value) return null;

  // x-forwarded-for can contain a chain; Vercel's client address is first.
  value = value.split(",", 1)[0].trim();

  // Accept the bracketed representation sometimes used for IPv6.
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }

  const ipv4 = normalizeIpv4(value);
  if (ipv4) return ipv4;

  // Treat IPv4-mapped IPv6 as its IPv4 equivalent.
  if (value.startsWith("::ffff:")) {
    return normalizeIpv4(value.slice("::ffff:".length));
  }

  try {
    const hostname = new URL(`http://[${value}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
}

export function configuredAllowedIps(rawAllowlist: string | undefined): Set<string> {
  return new Set(
    (rawAllowlist ?? "")
      .split(",")
      .map(normalizeIp)
      .filter((ip): ip is string => !!ip),
  );
}

export function getClientIp(headers: Headers, isVercel: boolean): string | null {
  // Prefer Vercel's dedicated copy, but fall back to the standard headers.
  // Vercel overwrites x-forwarded-for at its edge, so it cannot be spoofed by
  // a client when the request reaches middleware without the dedicated copy.
  const raw = isVercel
    ? headers.get("x-vercel-forwarded-for") ??
      headers.get("x-forwarded-for") ??
      headers.get("x-real-ip")
    : headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  return raw ? normalizeIp(raw) : null;
}

export function isLocalRequest(hostname: string, isVercel: boolean): boolean {
  return !isVercel && LOCAL_HOSTS.has(hostname.toLowerCase());
}

export function isIpGateBypassPath(pathname: string): boolean {
  return (
    pathname === "/access-denied" ||
    pathname.startsWith("/api/v1/public/email-open/") ||
    IP_GATE_PUBLIC_ASSETS.has(pathname)
  );
}
