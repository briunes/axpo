import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/ocr-usage/available-models:
 *   get:
 *     tags: [Invoices]
 *     summary: List distinct provider/model pairs seen in OCR logs
 *     description: Useful for the admin to see which models they should price
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  // Aggregate (provider, model) with usage stats
  const grouped = await prisma.ocrLog.groupBy({
    by: ["provider", "model"],
    _count: { _all: true },
    _sum: {
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
    },
    _max: { requestedAt: true },
    _min: { requestedAt: true },
  });

  // Cross-reference with active prices
  const prices = await prisma.ocrModelPrice.findMany({
    where: { isActive: true },
    select: {
      id: true,
      provider: true,
      model: true,
      currency: true,
      inputPricePer1kTokens: true,
      outputPricePer1kTokens: true,
      unitTokens: true,
    },
  });

  const priceByKey = new Map<string, (typeof prices)[number]>();
  for (const p of prices) {
    priceByKey.set(`${p.provider.toLowerCase()}::${p.model.toLowerCase()}`, p);
  }

  const items = grouped
    .map((g) => {
      const key = `${g.provider.toLowerCase()}::${g.model.toLowerCase()}`;
      const price = priceByKey.get(key);
      return {
        provider: g.provider,
        model: g.model,
        calls: g._count._all,
        totalPromptTokens: g._sum.promptTokens ?? 0,
        totalCompletionTokens: g._sum.completionTokens ?? 0,
        totalTokens: g._sum.totalTokens ?? 0,
        firstUsedAt: g._min.requestedAt?.toISOString() ?? null,
        lastUsedAt: g._max.requestedAt?.toISOString() ?? null,
        priced: !!price,
        activePrice: price
          ? {
              id: price.id,
              currency: price.currency,
              inputPricePer1kTokens: Number(price.inputPricePer1kTokens),
              outputPricePer1kTokens: Number(price.outputPricePer1kTokens),
              unitTokens: price.unitTokens,
            }
          : null,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  return ResponseHandler.ok({ items });
});
