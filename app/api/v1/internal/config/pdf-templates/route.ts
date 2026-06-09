import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";

/**
 * @swagger
 * /api/v1/internal/config/pdf-templates:
 *   get:
 *     tags: [Configuration]
 *     summary: Get all PDF templates
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by template type
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: excludeType
 *         schema:
 *           type: string
 *         description: Exclude templates of this type
 *     responses:
 *       200:
 *         description: List of PDF templates
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const active = searchParams.get("active");
  const excludeType = searchParams.get("excludeType");

  const where: any = {};
  if (type) where.type = type;
  if (active !== null) where.active = active === "true";
  if (excludeType) where.type = { not: excludeType };

  const templates = await prisma.pdfTemplate.findMany({
    where,
    include: { translations: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();

  const template = await prisma.pdfTemplate.create({
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      commodity: body.commodity ?? null,
      active: body.active ?? true,
      htmlContent: body.htmlContent,
      editableSections: body.editableSections ?? undefined,
      translations: body.translations?.length
        ? {
            create: body.translations.map(
              (tr: { languageCode: string; htmlContent: string }) => ({
                languageCode: tr.languageCode,
                htmlContent: tr.htmlContent,
              }),
            ),
          }
        : undefined,
    },
    include: { translations: true },
  });

  return NextResponse.json(template, { status: 201 });
});
