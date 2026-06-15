import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const updatePriceSchema = z.object({
  provider: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  inputPricePer1kTokens: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 0, "Must be ≥ 0")
    .optional(),
  outputPricePer1kTokens: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 0, "Must be ≥ 0")
    .optional(),
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
 * /api/v1/internal/ocr-prices/{id}:
 *   put:
 *     tags: [Invoices]
 *     summary: Update an OCR model price row
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Invoices]
 *     summary: Hard-delete an OCR model price row
 *     security:
 *       - bearerAuth: []
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.ocr-usage");

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Price id is required");

    const existing = await prisma.ocrModelPrice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("OCR price not found");

    const body = await request.json();
    const parsed = updatePriceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid OCR price payload", {
        issues: parsed.error.issues,
      });
    }
    const data = parsed.data;

    const nextProvider = data.provider ?? existing.provider;
    const nextModel = data.model ?? existing.model;
    const nextIsActive = data.isActive ?? existing.isActive;

    if (nextIsActive) {
      const conflict = await prisma.ocrModelPrice.findFirst({
        where: {
          provider: nextProvider,
          model: nextModel,
          isActive: true,
          NOT: { id: existing.id },
        },
      });
      if (conflict) {
        throw new ValidationError(
          "Another active price already exists for this provider/model.",
          { existingId: conflict.id },
        );
      }
    }

    const updated = await prisma.ocrModelPrice.update({
      where: { id },
      data: {
        provider: nextProvider,
        model: nextModel,
        inputPricePer1kTokens:
          data.inputPricePer1kTokens !== undefined
            ? new Prisma.Decimal(data.inputPricePer1kTokens)
            : undefined,
        outputPricePer1kTokens:
          data.outputPricePer1kTokens !== undefined
            ? new Prisma.Decimal(data.outputPricePer1kTokens)
            : undefined,
        currency: data.currency,
        unitTokens: data.unitTokens,
        isActive: nextIsActive,
        effectiveFrom: data.effectiveFrom
          ? new Date(data.effectiveFrom)
          : undefined,
        effectiveTo:
          data.effectiveTo === null
            ? null
            : data.effectiveTo
              ? new Date(data.effectiveTo)
              : undefined,
        note: data.note,
        updatedByUserId: auth.userId,
      },
    });

    return ResponseHandler.ok({
      id: updated.id,
      provider: updated.provider,
      model: updated.model,
      inputPricePer1kTokens: Number(updated.inputPricePer1kTokens),
      outputPricePer1kTokens: Number(updated.outputPricePer1kTokens),
      currency: updated.currency,
      unitTokens: updated.unitTokens,
      isActive: updated.isActive,
      effectiveFrom: updated.effectiveFrom.toISOString(),
      effectiveTo: updated.effectiveTo?.toISOString() ?? null,
      note: updated.note ?? null,
    });
  },
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.ocr-usage");

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Price id is required");

    const existing = await prisma.ocrModelPrice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("OCR price not found");

    await prisma.ocrModelPrice.delete({ where: { id } });
    return ResponseHandler.ok({ id, deleted: true });
  },
);
