import { NextRequest, NextResponse } from "next/server";
import { SimulationExpirationService } from "@/application/services/simulationExpirationService";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Cron job endpoint to expire simulations
 * This endpoint should be called by Vercel Cron or an external scheduler
 *
 * Security: Protected by CRON_SECRET environment variable
 * Configure in vercel.json to run on a schedule
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized (from Vercel Cron or with secret)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Cron] Unauthorized attempt to run expiration job");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Cron] Starting simulation expiration job...");
    const startTime = Date.now();

    // Get stats before expiration
    const statsBefore = await SimulationExpirationService.getExpirationStats();

    // Run the expiration process
    const result = await SimulationExpirationService.expireSimulations();

    // Get stats after expiration
    const statsAfter = await SimulationExpirationService.getExpirationStats();

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      result: {
        totalExpired: result.totalExpired,
        expiredIds: result.expiredIds,
      },
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    };

    console.log("[Cron] Simulation expiration job completed:", {
      totalExpired: result.totalExpired,
      duration: `${duration}ms`,
    });

    // Log to cron logs
    await prisma.cronLog
      .create({
        data: {
          jobName: "simulation-expiration",
          jobType: "EXPIRATION",
          status: "SUCCESS",
          duration,
          totalProcessed: result.totalExpired,
          totalAffected: result.totalExpired,
          metadata: {
            expiredIds: result.expiredIds,
            source: "api",
          },
        },
      })
      .catch((error) => {
        console.error("[Cron] Failed to log execution:", error);
      });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[Cron] Error during simulation expiration:", error);

    // Log error to cron logs
    await prisma.cronLog
      .create({
        data: {
          jobName: "simulation-expiration",
          jobType: "EXPIRATION",
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          metadata: {
            source: "api",
          },
        },
      })
      .catch((logError) => {
        console.error("[Cron] Failed to log error to audit:", logError);
      });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Support POST as well (some cron systems prefer POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
