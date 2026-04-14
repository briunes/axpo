import { NextResponse } from "next/server";

const SWAGGER_USER = process.env.SWAGGER_BASIC_AUTH_USER ?? "swagger";
const SWAGGER_PASS = process.env.SWAGGER_BASIC_AUTH_PASS ?? null;

export function isSwaggerBasicAuthValid(authHeader: string | null): boolean {
  if (!SWAGGER_PASS || !authHeader) return false;
  if (!authHeader.toLowerCase().startsWith("basic ")) return false;

  const base64 = authHeader.slice(6);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return false;
  }

  const colonIndex = decoded.indexOf(":");
  if (colonIndex <= 0 || colonIndex === decoded.length - 1) return false;

  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  return (
    user === SWAGGER_USER &&
    Buffer.from(pass).equals(Buffer.from(SWAGGER_PASS))
  );
}

export function swaggerUnauthorizedResponse(): NextResponse {
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
