import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Legacy QLD Domain Redirect
// ---------------------------------------------------------------------------
// Keep the old Vercel preview domain alive for existing client links, but move
// all traffic to the current pre-production QLD domain.
const LEGACY_QLD_HOST = "axpo-qld.vercel.app";
const CURRENT_QLD_ORIGIN = "https://misimulador-pre.axpoiberia.es";

function getRequestHost(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host
  )
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// Allowed origins: comma-separated list in CORS_ORIGIN env var.
// Example: https://axpo-simulator.vercel.app,http://localhost:3001
// Use "*" to allow all origins (not recommended for production)
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  // Check if wildcard is configured
  const isWildcard = allowedOrigins.includes("*");

  const allowed = isWildcard
    ? "*"
    : origin && allowedOrigins.length > 0 && allowedOrigins.includes(origin)
      ? origin
      : (allowedOrigins[0] ?? "");

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Axpo-App-Version, X-Axpo-Page-Path, X-Browser-Fingerprint",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// Swagger Basic Auth
// ---------------------------------------------------------------------------
// Protects only internal documentation routes
// (/api/v1/internal/docs and /api/v1/internal/openapi plus root aliases)
// with HTTP Basic Auth.
// Credentials supplied via env vars:
//   SWAGGER_BASIC_AUTH_USER  (default: swagger)
//   SWAGGER_BASIC_AUTH_PASS  (no default — absent means endpoint is blocked)
const SWAGGER_USER = process.env.SWAGGER_BASIC_AUTH_USER ?? "swagger";
const SWAGGER_PASS = process.env.SWAGGER_BASIC_AUTH_PASS ?? null;

function isSwaggerRoute(pathname: string): boolean {
  // Match all variations of Swagger documentation routes:
  // - /api/v1/internal/docs, /api/v1/internal/openapi
  // - /internal/docs, /internal/openapi (rewritten by vercel.json)
  const swaggerPatterns = [
    /^\/api\/v1\/internal\/docs($|\/)/,
    /^\/api\/v1\/internal\/openapi($|\/)/,
    /^\/internal\/docs($|\/)/,
    /^\/internal\/openapi($|\/)/,
  ];

  return swaggerPatterns.some((pattern) => pattern.test(pathname));
}

function checkBasicAuth(request: NextRequest): boolean {
  if (!SWAGGER_PASS) {
    // No password configured — deny all access to be safe
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("basic ")) return false;

  let decoded: string;
  try {
    const base64 = authHeader.slice(6);
    // Validate base64 format before decoding
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return false;
    decoded = Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return false;
  }

  const colonIndex = decoded.indexOf(":");
  if (
    colonIndex === -1 ||
    colonIndex === 0 ||
    colonIndex === decoded.length - 1
  )
    return false;

  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  // Use constant-time comparison to prevent timing attacks
  return (
    user === SWAGGER_USER && Buffer.from(pass).equals(Buffer.from(SWAGGER_PASS))
  );
}

// ---------------------------------------------------------------------------
// Maintenance Mode
// ---------------------------------------------------------------------------
// Bypass paths that must always be accessible during maintenance:
//   - /maintenance (the page itself)
//   - /api/maintenance (the status endpoint)
//   - selected API endpoints needed to show or disable maintenance mode
//   - /internal/configurations (so the admin can reach the toggle)
//   - /_next/ static files & favicon
// Static asset extensions served from /public that must remain reachable
// during maintenance (logos, favicons, OG images, etc.).
const STATIC_ASSET_EXTENSION =
  /\.(svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|tif|tiff|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|pdf|xml|txt|json|css|js|map)(\?.*)?$/i;

function isMaintenanceBypass(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/maintenance/") ||
    pathname === "/api/maintenance" ||
    pathname === "/api/v1/internal/config/system" ||
    pathname === "/api/v1/internal/health" ||
    pathname === "/api/v1/public/version" ||
    pathname.startsWith("/internal/configurations") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET_EXTENSION.test(pathname)
  );
}

let maintenanceCache: {
  mode: boolean;
  until: string | null;
  message: string | null;
  ts: number;
} | null = null;
const MAINTENANCE_CACHE_TTL_MS = 2_000; // 2 seconds

async function getMaintenanceStatus(
  req: NextRequest,
): Promise<{ mode: boolean; until: string | null; message: string | null }> {
  const now = Date.now();
  if (
    maintenanceCache &&
    now - maintenanceCache.ts < MAINTENANCE_CACHE_TTL_MS
  ) {
    return {
      mode: maintenanceCache.mode,
      until: maintenanceCache.until,
      message: maintenanceCache.message,
    };
  }

  try {
    const url = new URL("/api/maintenance", req.nextUrl.origin);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      maintenanceCache = {
        mode: !!data.maintenanceMode,
        until: data.maintenanceUntil ?? null,
        message: data.maintenanceMessage ?? null,
        ts: now,
      };
      return {
        mode: maintenanceCache.mode,
        until: maintenanceCache.until,
        message: maintenanceCache.message,
      };
    }
  } catch {
    // If the check fails, don't block the site
  }
  return { mode: false, until: null, message: null };
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  if (getRequestHost(request) === LEGACY_QLD_HOST) {
    const url = new URL(request.nextUrl.pathname, CURRENT_QLD_ORIGIN);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }

  // Maintenance mode gate — check before everything else
  if (!isMaintenanceBypass(pathname)) {
    const { mode, until, message } = await getMaintenanceStatus(request);
    if (mode) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      url.search = "";
      if (until) url.searchParams.set("until", until);
      if (message) url.searchParams.set("message", encodeURIComponent(message));
      return NextResponse.redirect(url);
    }
  }

  // Handle CORS preflight for API routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Swagger Basic Auth gate
  if (isSwaggerRoute(pathname)) {
    if (!checkBasicAuth(request)) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="AXPO Simulator API Docs"',
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }
  }

  // Pass through — attach CORS headers to all API responses
  const response = NextResponse.next();
  if (pathname.startsWith("/api/")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
