import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";

/**
 * @swagger
 * /api/v1/internal/config/template-variables:
 *   get:
 *     tags: [Configuration]
 *     summary: Get all template variables
 *     responses:
 *       200:
 *         description: List of template variables
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const { searchParams } = new URL(req.url);
  const commodity = searchParams.get("commodity"); // e.g. "ELECTRICITY" or "GAS"
  const types = searchParams.get("types"); // e.g. "simulation-output,simulation-detailed"

  const templates = await prisma.templateVariable.findMany({
    where: {
      active: true,
      // If commodity filter is given: return vars where commodity is null (universal) OR matches
      ...(commodity
        ? { OR: [{ commodity: null }, { commodity: commodity }] }
        : {}),
      // If types filter is given: return vars where templateTypes is null (universal) OR contains any of the requested types
      ...(types
        ? {
            OR: [
              { templateTypes: null },
              ...types.split(",").map((t) => ({
                templateTypes: { contains: t.trim() },
              })),
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });

  return NextResponse.json(templates);
});

/**
 * @swagger
 * /api/v1/internal/config/template-variables:
 *   post:
 *     tags: [Configuration]
 *     summary: Create a new template variable
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, label, category]
 *     responses:
 *       201:
 *         description: Created template variable
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();

  const variable = await prisma.templateVariable.create({
    data: {
      key: body.key,
      label: body.label,
      description: body.description,
      category: body.category,
      example: body.example,
      sortOrder: body.sortOrder ?? 0,
      active: body.active ?? true,
      commodity: body.commodity ?? null,
      templateTypes: body.templateTypes ?? null,
    },
  });

  return NextResponse.json(variable, { status: 201 });
});
