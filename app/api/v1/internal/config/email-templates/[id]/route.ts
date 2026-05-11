import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await prisma.emailTemplate.findUnique({
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
        (tr: { languageCode: string; subject: string; htmlContent: string }) =>
          prisma.emailTemplateTranslation.upsert({
            where: {
              emailTemplateId_languageCode: {
                emailTemplateId: id,
                languageCode: tr.languageCode,
              },
            },
            update: {
              subject: tr.subject,
              htmlContent: tr.htmlContent,
            },
            create: {
              emailTemplateId: id,
              languageCode: tr.languageCode,
              subject: tr.subject,
              htmlContent: tr.htmlContent,
            },
          }),
      ),
    );
  }

  // Derive canonical subject/htmlContent from the "en" (or first) translation
  // so the parent columns stay in sync as a fallback.
  const firstTranslation =
    body.translations?.find((tr: any) => tr.languageCode === "en") ??
    body.translations?.[0];

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      active: body.active,
      subject: firstTranslation?.subject ?? body.subject,
      htmlContent: firstTranslation?.htmlContent ?? body.htmlContent,
      editableSections: body.editableSections ?? undefined,
    },
    include: { translations: true },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.emailTemplate.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
