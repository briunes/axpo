import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/config/pdf-templates/{id}:
 *   get:
 *     tags: [Configuration]
 *     summary: Get a PDF template by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF template
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await prisma.pdfTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

/**
 * @swagger
 * /api/v1/internal/config/pdf-templates/{id}:
 *   put:
 *     tags: [Configuration]
 *     summary: Update a PDF template
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated PDF template
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const template = await prisma.pdfTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      active: body.active,
      htmlContent: body.htmlContent,
    },
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
