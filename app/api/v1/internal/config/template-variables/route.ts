import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/config/template-variables:
 *   get:
 *     tags: [Configuration]
 *     summary: Get all template variables
 *     responses:
 *       200:
 *         description: List of template variables
 */
export async function GET(req: NextRequest) {
  const templates = await prisma.templateVariable.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });

  return NextResponse.json(templates);
}

/**
 * @swagger
 * /api/v1/internal/config/template-variables:
 *   post:
 *     tags: [Configuration]
 *     summary: Create a new template variable
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, label, category]
 *     responses:
 *       201:
 *         description: Created template variable
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const variable = await prisma.templateVariable.create({
    data: {
      key: body.key,
      label: body.label,
      description: body.description,
      category: body.category,
      example: body.example,
      sortOrder: body.sortOrder ?? 0,
      active: body.active ?? true,
    },
  });

  return NextResponse.json(variable, { status: 201 });
}
