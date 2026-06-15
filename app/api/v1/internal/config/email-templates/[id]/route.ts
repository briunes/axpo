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
  const template = await prisma.emailTemplate.findUnique({
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
});

export const DELETE = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template id parameter is required");
  await prisma.emailTemplate.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
});
