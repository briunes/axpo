import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { ValidationError } from "@/domain/errors/errors";

export const GET = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template id parameter is required");
  const template = await prisma.pdfTemplate.findUnique({
    where: { id },
    include: { translations: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
});

export const PUT = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template id parameter is required");
  const body = await req.json();

  // Upsert translations when provided
  if (body.translations && Array.isArray(body.translations)) {
    await Promise.all(
      body.translations.map(
        (tr: { languageCode: string; htmlContent: string }) =>
          prisma.pdfTemplateTranslation.upsert({
            where: {
              pdfTemplateId_languageCode: {
                pdfTemplateId: id,
                languageCode: tr.languageCode,
              },
            },
            update: { htmlContent: tr.htmlContent },
            create: {
              pdfTemplateId: id,
              languageCode: tr.languageCode,
              htmlContent: tr.htmlContent,
            },
          }),
      ),
    );
  }

  const firstTranslation =
    body.translations?.find((tr: any) => tr.languageCode === "en") ??
    body.translations?.[0];

  const template = await prisma.pdfTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      commodity: body.commodity ?? null,
      active: body.active,
      htmlContent: firstTranslation?.htmlContent ?? body.htmlContent,
      editableSections: body.editableSections ?? undefined,
    },
    include: { translations: true },
  });

  return NextResponse.json(template);
});

/**
 * @swagger
 * /api/v1/internal/config/pdf-templates/{id}:
 *   delete:
 *     tags: [Configuration]
 *     summary: Delete a PDF template
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Template deleted
 */
export const DELETE = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template id parameter is required");
  await prisma.pdfTemplate.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
});
