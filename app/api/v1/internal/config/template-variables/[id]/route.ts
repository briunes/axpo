import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/config/template-variables/{id}:
 *   put:
 *     tags: [Configuration]
 *     summary: Update a template variable
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
 *     responses:
 *       200:
 *         description: Updated template variable
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const variable = await prisma.templateVariable.update({
    where: { id },
    data: {
      key: body.key,
      label: body.label,
      description: body.description,
      category: body.category,
      example: body.example,
      sortOrder: body.sortOrder,
      active: body.active,
    },
  });

  return NextResponse.json(variable);
}

/**
 * @swagger
 * /api/v1/internal/config/template-variables/{id}:
 *   delete:
 *     tags: [Configuration]
 *     summary: Delete a template variable
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Variable deleted
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.templateVariable.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
