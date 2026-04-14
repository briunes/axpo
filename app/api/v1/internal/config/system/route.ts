import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/config/system:
 *   get:
 *     tags: [Configuration]
 *     summary: Get system configuration
 *     responses:
 *       200:
 *         description: System configuration
 */
async function GET(req: NextRequest) {
  // Get or create system config (singleton pattern)
  let config = await prisma.systemConfig.findFirst();

  if (!config) {
    // Create default config if none exists
    config = await prisma.systemConfig.create({
      data: {
        simulationExpirationDays: 30,
        simulationShareText:
          "Your simulation is ready. Access it with PIN: {PIN}",
        enablePixelTracking: true,
        requirePinForAccess: true,
        pinLength: 4,
        autoCreateClientOnSim: false,
        enableAnalyticsModule: true,
        enableAuditLogsModule: true,
        defaultDashboardView: "COMMERCIAL",
        enableRealtimeReports: false,
      },
    });
  }

  return NextResponse.json(config);
}

/**
 * @swagger
 * /api/v1/internal/config/system:
 *   put:
 *     tags: [Configuration]
 *     summary: Update system configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated configuration
 */
async function PUT(req: NextRequest) {
  const body = await req.json();

  // Get or create config
  let config = await prisma.systemConfig.findFirst();

  if (!config) {
    config = await prisma.systemConfig.create({ data: body });
  } else {
    config = await prisma.systemConfig.update({
      where: { id: config.id },
      data: body,
    });
  }

  return NextResponse.json(config);
}

export { GET, PUT };
