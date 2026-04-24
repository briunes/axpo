import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/base-values/{id}/production:
 *   post:
 *     tags: [BaseValues]
 *     summary: Toggle production flag for base value set
 *     description: Marks a base value set as production version (and optionally unmarks others in same scope)
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
 *               - isProduction
 *             properties:
 *               isProduction:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated base value set
 */
async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: baseValueSetId } = await params;
  const body = await req.json();
  const { isProduction } = body;

  // Get the base value set to check scope
  const baseValueSet = await prisma.baseValueSet.findUnique({
    where: { id: baseValueSetId },
  });

  if (!baseValueSet) {
    return NextResponse.json(
      { error: "Base value set not found" },
      { status: 404 },
    );
  }

  // Prevent removing the production flag — there must always be exactly one production set
  if (!isProduction) {
    return NextResponse.json(
      {
        error:
          "Cannot remove production flag. There must always be one active production set.",
      },
      { status: 400 },
    );
  }

  // Build where clause for same scope
  const whereClause =
    baseValueSet.scopeType === "GLOBAL"
      ? { scopeType: "GLOBAL" as const }
      : { scopeType: "AGENCY" as const, agencyId: baseValueSet.agencyId };

  // Set all other sets in same scope to draft (isActive: false) and unmark production
  await prisma.baseValueSet.updateMany({
    where: {
      ...whereClause,
      id: { not: baseValueSetId },
    },
    data: {
      isProduction: false,
      isActive: false,
    },
  });

  // Set the target as production and active
  const updatedSet = await prisma.baseValueSet.update({
    where: { id: baseValueSetId },
    data: {
      isProduction: true,
      isActive: true,
    },
  });

  return NextResponse.json({ success: true, data: updatedSet });
}

export { POST };
