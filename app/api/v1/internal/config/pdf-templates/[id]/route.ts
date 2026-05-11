import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await prisma.pdfTemplate.findUnique({
    where: { id },
    include: { translations: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
}

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
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.pdfTemplate.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
