import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withCurrentVersionChangelog } from "@/application/lib/appChangelog";

/**
 * @swagger
 * /api/v1/public/version:
 *   get:
 *     tags: [Public]
 *     summary: Get current app version
 *     description: Returns the current app version and changelog history stored in system configuration. Used by the frontend to detect stale caches after deployments.
 *     responses:
 *       200:
 *         description: App version
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 */
export async function GET(): Promise<NextResponse> {
  const config = await prisma.systemConfig.findFirst({
    select: { appVersion: true, appChangelog: true },
  });

  const version = config?.appVersion ?? "0.2.1";
  const changelog = withCurrentVersionChangelog(config?.appChangelog, version);

  return NextResponse.json(
    { version, changelog },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
