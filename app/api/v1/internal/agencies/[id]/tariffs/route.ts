import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";

/**
 * @swagger
 * /api/v1/internal/agencies/{id}/tariffs:
 *   get:
 *     tags: [Agencies]
 *     summary: Get agency tariff availability settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agency tariff settings
 */
const GET = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  const agencyId = context?.params?.id;
  if (!agencyId) throw new ValidationError("Agency id parameter is required");
  if (!isElevatedRole(auth.role) && auth.agencyId !== agencyId) {
    throw new NotFoundError("Agency", agencyId);
  }

  const tariffs = await prisma.agencyTariff.findMany({
    where: { agencyId },
    orderBy: { tariffType: "asc" },
  });

  return NextResponse.json(tariffs);
});

/**
 * @swagger
 * /api/v1/internal/agencies/{id}/tariffs:
 *   post:
 *     tags: [Agencies]
 *     summary: Create or update agency tariff availability
 *     security:
 *       - bearerAuth: []
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
 *             required:
 *               - tariffType
 *               - isEnabled
 *             properties:
 *               tariffType:
 *                 type: string
 *               isEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Created or updated tariff setting
 */
const POST = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "agencies.edit");
  const agencyId = context?.params?.id;
  if (!agencyId) throw new ValidationError("Agency id parameter is required");
  const body = await req.json();
  const { tariffType, isEnabled } = body;

  // Upsert tariff setting
  const tariff = await prisma.agencyTariff.upsert({
    where: {
      agencyId_tariffType: {
        agencyId,
        tariffType,
      },
    },
    update: {
      isEnabled,
    },
    create: {
      agencyId,
      tariffType,
      isEnabled,
    },
  });

  return NextResponse.json(tariff);
});

/**
 * @swagger
 * /api/v1/internal/agencies/{id}/tariffs:
 *   put:
 *     tags: [Agencies]
 *     summary: Bulk update agency tariff availability
 *     security:
 *       - bearerAuth: []
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
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - tariffType
 *                 - isEnabled
 *               properties:
 *                 tariffType:
 *                   type: string
 *                 isEnabled:
 *                   type: boolean
 *     responses:
 *       200:
 *         description: Updated tariff settings
 */
const PUT = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "agencies.edit");
  const agencyId = context?.params?.id;
  if (!agencyId) throw new ValidationError("Agency id parameter is required");
  const tariffs = await req.json();

  // Bulk upsert tariff settings
  const results = await Promise.all(
    tariffs.map((tariff: { tariffType: string; isEnabled: boolean }) =>
      prisma.agencyTariff.upsert({
        where: {
          agencyId_tariffType: {
            agencyId,
            tariffType: tariff.tariffType,
          },
        },
        update: {
          isEnabled: tariff.isEnabled,
        },
        create: {
          agencyId,
          tariffType: tariff.tariffType,
          isEnabled: tariff.isEnabled,
        },
      }),
    ),
  );

  return NextResponse.json(results);
});

export { GET, POST, PUT };
