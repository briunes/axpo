import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { ValidationError } from "@/domain/errors/errors";

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
export const PUT = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template variable id is required");
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
});

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
export const DELETE = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");
  const id = context?.params?.id;
  if (!id) throw new ValidationError("Template variable id is required");

  await prisma.templateVariable.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
});
