import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const createPriceSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required").max(120),
  model: z.string().trim().min(1, "Model is required").max(200),
  inputPricePer1kTokens: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 0, "Must be ≥ 0"),
  outputPricePer1kTokens: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 0, "Must be ≥ 0"),
  currency: z.string().trim().length(3).optional(),
  unitTokens: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, "Must be a positive integer")
    .optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * @swagger
 * /api/v1/internal/ocr-prices:
 *   get:
 *     tags: [Invoices]
 *     summary: List configured OCR model prices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean, default: false }
 *   post:
 *     tags: [Invoices]
 *     summary: Create a new OCR model price row
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  const rows = await prisma.ocrModelPrice.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ provider: "asc" }, { model: "asc" }, { effectiveFrom: "desc" }],
  });

  return ResponseHandler.ok({
    items: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      inputPricePer1kTokens: Number(r.inputPricePer1kTokens),
      outputPricePer1kTokens: Number(r.outputPricePer1kTokens),
      currency: r.currency,
      unitTokens: r.unitTokens,
      isActive: r.isActive,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString() ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  const body = await request.json();
  const parsed = createPriceSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid OCR price payload", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;

  // Ensure uniqueness: only one *active* price per (provider, model)
  if (data.isActive !== false) {
    const existing = await prisma.ocrModelPrice.findFirst({
      where: {
        provider: data.provider,
        model: data.model,
        isActive: true,
      },
    });
    if (existing) {
      throw new ValidationError(
        "An active price already exists for this provider/model. Deactivate the existing one first.",
        { existingId: existing.id },
      );
    }
  }

  const created = await prisma.ocrModelPrice.create({
    data: {
      provider: data.provider,
      model: data.model,
      inputPricePer1kTokens: new Prisma.Decimal(data.inputPricePer1kTokens),
      outputPricePer1kTokens: new Prisma.Decimal(data.outputPricePer1kTokens),
      currency: data.currency ?? "USD",
      unitTokens: data.unitTokens ?? 1000,
      isActive: data.isActive ?? true,
      effectiveFrom: data.effectiveFrom
        ? new Date(data.effectiveFrom)
        : new Date(),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      note: data.note ?? null,
      createdByUserId: auth.userId,
    },
  });

  return ResponseHandler.ok(
    {
      id: created.id,
      provider: created.provider,
      model: created.model,
      inputPricePer1kTokens: Number(created.inputPricePer1kTokens),
      outputPricePer1kTokens: Number(created.outputPricePer1kTokens),
      currency: created.currency,
      unitTokens: created.unitTokens,
      isActive: created.isActive,
      effectiveFrom: created.effectiveFrom.toISOString(),
      effectiveTo: created.effectiveTo?.toISOString() ?? null,
      note: created.note ?? null,
    },
    201,
  );
});
