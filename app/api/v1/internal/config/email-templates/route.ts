import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";

/**
 * @swagger
 * /api/v1/internal/config/email-templates:
 *   get:
 *     tags: [Configuration]
 *     summary: Get all email templates
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
 *         description: List of email templates
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const active = searchParams.get("active");
  const excludeType = searchParams.get("excludeType");

  const where: any = {};
  if (type) {
    // Support comma-separated types for filtering multiple types
    const types = type.split(",").map((t) => t.trim());
    where.type = types.length > 1 ? { in: types } : types[0];
  }
  if (active !== null) where.active = active === "true";
  if (excludeType) where.type = { not: excludeType };

  const templates = await prisma.emailTemplate.findMany({
    where,
    include: { translations: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
});

/**
 * @swagger
 * /api/v1/internal/config/email-templates:
 *   post:
 *     tags: [Configuration]
 *     summary: Create a new email template
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, description, subject, htmlContent]
 *     responses:
 *       201:
 *         description: Created email template
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();

  const template = await prisma.emailTemplate.create({
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      active: body.active ?? true,
      subject: body.subject,
      htmlContent: body.htmlContent,
      editableSections: body.editableSections ?? undefined,
      translations: body.translations?.length
        ? {
            create: body.translations.map(
              (tr: {
                languageCode: string;
                subject: string;
                htmlContent: string;
              }) => ({
                languageCode: tr.languageCode,
                subject: tr.subject,
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
