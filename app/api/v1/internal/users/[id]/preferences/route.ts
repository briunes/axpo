import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/users/{id}/preferences:
 *   get:
 *     summary: Get user preferences merged with system defaults
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User preferences (merged with system defaults)
 */
async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params;

  // Get system defaults
  const systemConfig = await prisma.systemConfig.findFirst();

  // Get user-specific preferences
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  // Merge with system defaults (user preferences override system defaults)
  const effectivePreferences = {
    dateFormat:
      userPrefs?.dateFormat ?? systemConfig?.defaultDateFormat ?? "DD/MM/YYYY",
    timeFormat:
      userPrefs?.timeFormat ?? systemConfig?.defaultTimeFormat ?? "24h",
    timezone:
      userPrefs?.timezone ?? systemConfig?.defaultTimezone ?? "Europe/Madrid",
    numberFormat:
      userPrefs?.numberFormat ?? systemConfig?.defaultNumberFormat ?? "eu",
    itemsPerPage:
      userPrefs?.itemsPerPage ?? systemConfig?.defaultItemsPerPage ?? 10,
    // Include info about which values are overridden
    _overrides: {
      dateFormat:
        userPrefs?.dateFormat !== null && userPrefs?.dateFormat !== undefined,
      timeFormat:
        userPrefs?.timeFormat !== null && userPrefs?.timeFormat !== undefined,
      timezone:
        userPrefs?.timezone !== null && userPrefs?.timezone !== undefined,
      numberFormat:
        userPrefs?.numberFormat !== null &&
        userPrefs?.numberFormat !== undefined,
      itemsPerPage:
        userPrefs?.itemsPerPage !== null &&
        userPrefs?.itemsPerPage !== undefined,
    },
  };

  return NextResponse.json(effectivePreferences);
}

/**
 * @swagger
 * /api/v1/internal/users/{id}/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dateFormat:
 *                 type: string
 *                 nullable: true
 *               timeFormat:
 *                 type: string
 *                 nullable: true
 *               timezone:
 *                 type: string
 *                 nullable: true
 *               numberFormat:
 *                 type: string
 *                 nullable: true
 *               itemsPerPage:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated user preferences
 */
async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params;
  const body = await req.json();

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Upsert user preferences
  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      dateFormat: body.dateFormat,
      timeFormat: body.timeFormat,
      timezone: body.timezone,
      numberFormat: body.numberFormat,
      itemsPerPage: body.itemsPerPage,
    },
    update: {
      dateFormat: body.dateFormat,
      timeFormat: body.timeFormat,
      timezone: body.timezone,
      numberFormat: body.numberFormat,
      itemsPerPage: body.itemsPerPage,
    },
  });

  return NextResponse.json(preferences);
}

export { GET, PUT };
