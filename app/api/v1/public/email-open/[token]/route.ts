import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

// A transparent 1x1 GIF. Always return it, including for unknown tokens, so
// the endpoint does not reveal which tracking identifiers are valid.
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token: tokenWithExtension } = await context.params;
  const trackingToken = tokenWithExtension.replace(/\.gif$/i, "");
  const openedAt = new Date();

  if (trackingToken) {
    try {
      await prisma.emailLog.updateMany({
        where: { trackingToken, openedAt: null },
        data: { openedAt },
      });
      await prisma.emailLog.updateMany({
        where: { trackingToken },
        data: { lastOpenedAt: openedAt, openCount: { increment: 1 } },
      });
    } catch (error) {
      // Tracking must never break image rendering or the recipient experience.
      console.error("Failed to record email open", error);
    }
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
