import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";

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
const POST = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  const baseValueSetId = context?.params?.id;
  if (!baseValueSetId) {
    throw new ValidationError("Base value set id parameter is required");
  }
  const body = await req.json();
  const { isProduction } = body;

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

  const resultSelect = {
    id: true,
    scopeType: true,
    agencyId: true,
    name: true,
    version: true,
    isActive: true,
    isProduction: true,
    updatedAt: true,
  } as const;

  let updatedSet;
  if (isSupabaseApiMode()) {
    const rows = await (prisma as any).$rpc(
      "axpo_set_base_value_production",
      {
        p_base_value_set_id: baseValueSetId,
        p_now: new Date(),
      },
    );
    updatedSet = Array.isArray(rows) ? rows[0] : rows;
  } else {
    updatedSet = await prisma.$transaction(async (tx) => {
      const baseValueSet = await tx.baseValueSet.findUnique({
        where: { id: baseValueSetId },
        select: {
          id: true,
          scopeType: true,
          agencyId: true,
        },
      });
      if (!baseValueSet) return null;

      const whereClause =
        baseValueSet.scopeType === "AGENCY"
          ? {
              scopeType: "AGENCY" as const,
              agencyId: baseValueSet.agencyId,
            }
          : { scopeType: baseValueSet.scopeType };

      await tx.baseValueSet.updateMany({
        where: {
          ...whereClause,
          id: { not: baseValueSetId },
          OR: [{ isProduction: true }, { isActive: true }],
        },
        data: {
          isProduction: false,
          isActive: false,
        },
      });

      return tx.baseValueSet.update({
        where: { id: baseValueSetId },
        data: {
          isProduction: true,
          isActive: true,
        },
        select: resultSelect,
      });
    });
  }

  if (!updatedSet) {
    return NextResponse.json(
      { error: "Base value set not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: updatedSet });
});

export { POST };
