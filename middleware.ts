import { NextRequest, NextResponse } from "next/server";

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

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
    // Core API routes
    "/api/:path*",
    // Swagger documentation (direct and rewritten paths)
    "/api/v1/internal/docs",
    "/api/v1/internal/docs/:path*",
    "/api/v1/internal/openapi",
    "/api/v1/internal/openapi/:path*",
    "/internal/docs",
    "/internal/docs/:path*",
    "/internal/openapi",
    "/internal/openapi/:path*",
    "/docs",
    "/docs/:path*",
    "/openapi",
    "/openapi/:path*",
  ],
};
