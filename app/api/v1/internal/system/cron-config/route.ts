import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { reloadCronJobs } from "@/lib/cron";
import cron from "node-cron";

/**
 * GET /api/v1/internal/system/cron-config
 * Get current cron configuration
 */
export async function GET() {
  try {
    const config = await prisma.systemConfig.findFirst({
      select: {
        cronExpirationEnabled: true,
        cronExpirationSchedule: true,
        cronExpirationTimezone: true,
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: "System configuration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      enabled: config.cronExpirationEnabled,
      schedule: config.cronExpirationSchedule,
      timezone: config.cronExpirationTimezone,
      scheduleDescription: getScheduleDescription(
        config.cronExpirationSchedule,
      ),
    });
  } catch (error) {
    console.error("[API] Error fetching cron config:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron configuration" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/internal/system/cron-config
 * Update cron configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, schedule, timezone } = body;

    // Validate schedule if provided
    if (schedule && !cron.validate(schedule)) {
      return NextResponse.json(
        { error: `Invalid cron schedule expression: "${schedule}"` },
        { status: 400 },
      );
    }

    // Validate timezone if provided
    if (timezone && !isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: `Invalid timezone: "${timezone}"` },
        { status: 400 },
      );
    }

    const config = await prisma.systemConfig.findFirst();

    if (!config) {
      return NextResponse.json(
        { error: "System configuration not found" },
        { status: 404 },
      );
    }

    // Update configuration
    const updated = await prisma.systemConfig.update({
      where: { id: config.id },
      data: {
        ...(enabled !== undefined && { cronExpirationEnabled: enabled }),
        ...(schedule && { cronExpirationSchedule: schedule }),
        ...(timezone && { cronExpirationTimezone: timezone }),
      },
      select: {
        cronExpirationEnabled: true,
        cronExpirationSchedule: true,
        cronExpirationTimezone: true,
      },
    });

    // Reload cron jobs with new configuration
    await reloadCronJobs();

    return NextResponse.json({
      success: true,
      message: "Cron configuration updated and reloaded",
      config: {
        enabled: updated.cronExpirationEnabled,
        schedule: updated.cronExpirationSchedule,
        timezone: updated.cronExpirationTimezone,
        scheduleDescription: getScheduleDescription(
          updated.cronExpirationSchedule,
        ),
      },
    });
  } catch (error) {
    console.error("[API] Error updating cron config:", error);
    return NextResponse.json(
      { error: "Failed to update cron configuration" },
      { status: 500 },
    );
  }
}

/**
 * Helper function to get human-readable schedule description
 */
function getScheduleDescription(schedule: string): string {
  const descriptions: Record<string, string> = {
    "0 2 * * *": "Daily at 2:00 AM",
    "0 */6 * * *": "Every 6 hours",
    "0 */12 * * *": "Every 12 hours",
    "*/30 * * * *": "Every 30 minutes",
    "0 0 * * *": "Daily at midnight",
    "0 0 * * 0": "Weekly on Sunday at midnight",
    "0 3 * * *": "Daily at 3:00 AM",
    "0 4 * * *": "Daily at 4:00 AM",
  };

  return descriptions[schedule] || schedule;
}

/**
 * Helper function to validate timezone
 */
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
