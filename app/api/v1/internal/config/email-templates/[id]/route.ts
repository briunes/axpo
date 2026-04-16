import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/config/email-templates/{id}:
 *   get:
 *     tags: [Configuration]
 *     summary: Get an email template by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email template
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

/**
 * @swagger
 * /api/v1/internal/config/email-templates/{id}:
 *   put:
 *     tags: [Configuration]
 *     summary: Update an email template
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated email template
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      active: body.active,
      subject: body.subject,
      htmlContent: body.htmlContent,
      editableSections: body.editableSections ?? undefined,
    },
  });

  return NextResponse.json(template);
}

/**
 * @swagger
 * /api/v1/internal/config/email-templates/{id}:
 *   delete:
 *     tags: [Configuration]
 *     summary: Delete an email template
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
  await prisma.emailTemplate.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
