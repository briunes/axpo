import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Public endpoint — no auth required.
 * Returns the current maintenance mode status.
 */
export async function GET() {
  try {
    const config = await prisma.systemConfig.findFirst({
      select: {
        maintenanceMode: true,
        maintenanceUntil: true,
        maintenanceMessage: true,
      },
    });

    return NextResponse.json(
      {
        maintenanceMode: config?.maintenanceMode ?? false,
        maintenanceUntil: config?.maintenanceUntil ?? null,
        maintenanceMessage: config?.maintenanceMessage ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch {
    // If DB is down, don't block the site
    return NextResponse.json({
      maintenanceMode: false,
      maintenanceUntil: null,
      maintenanceMessage: null,
    });
  }
}
