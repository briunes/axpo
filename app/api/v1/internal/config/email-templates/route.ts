import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

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
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const active = searchParams.get("active");
  const excludeType = searchParams.get("excludeType");

  const where: any = {};
  if (type) where.type = type;
  if (active !== null) where.active = active === "true";
  if (excludeType) where.type = { not: excludeType };

  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

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
export async function POST(req: NextRequest) {
  const body = await req.json();

  const template = await prisma.emailTemplate.create({
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      active: body.active ?? true,
      subject: body.subject,
      htmlContent: body.htmlContent,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
