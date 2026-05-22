import { NextRequest } from "next/server";
import type { SessionRequestContext } from "@/application/services/sessionService";

const firstForwardedIp = (value: string | null): string => {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
};

const parseBrowser = (userAgent: string): string => {
  if (!userAgent || userAgent === "unknown") return "Unknown";

  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return "Opera";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) {
    return "Chrome";
  }
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) {
    return "Safari";
  }
  if (/firefox\//i.test(userAgent)) return "Firefox";

  return "Other";
};

const parseOs = (userAgent: string): string => {
  if (!userAgent || userAgent === "unknown") return "Unknown";

  if (/windows nt/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/mac os x|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";

  return "Other";
};

export const getRequestSessionContext = (
  request: NextRequest,
): SessionRequestContext => {
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const ipAddress =
    firstForwardedIp(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return {
    ipAddress,
    userAgent,
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent),
  };
};
