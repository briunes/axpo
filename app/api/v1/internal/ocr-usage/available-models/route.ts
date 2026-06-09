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

  const logs: Array<{
    provider: string;
    model: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    requestedAt: Date;
  }> = [];
  const pageSize = 1000;
  for (let skip = 0; ; skip += pageSize) {
    const page = await prisma.ocrLog.findMany({
      select: {
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        requestedAt: true,
      },
      orderBy: { requestedAt: "asc" },
      skip,
      take: pageSize,
    });
    logs.push(...page);
    if (page.length < pageSize) break;
  }
  const grouped = new Map<
    string,
    {
      provider: string;
      model: string;
      calls: number;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      firstUsedAt: Date;
      lastUsedAt: Date;
    }
  >();

  for (const log of logs) {
    const key = `${log.provider.toLowerCase()}::${log.model.toLowerCase()}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        provider: log.provider,
        model: log.model,
        calls: 1,
        totalPromptTokens: log.promptTokens ?? 0,
        totalCompletionTokens: log.completionTokens ?? 0,
        totalTokens: log.totalTokens ?? 0,
        firstUsedAt: log.requestedAt,
        lastUsedAt: log.requestedAt,
      });
      continue;
    }

    existing.calls += 1;
    existing.totalPromptTokens += log.promptTokens ?? 0;
    existing.totalCompletionTokens += log.completionTokens ?? 0;
    existing.totalTokens += log.totalTokens ?? 0;
    if (log.requestedAt < existing.firstUsedAt) {
      existing.firstUsedAt = log.requestedAt;
    }
    if (log.requestedAt > existing.lastUsedAt) {
      existing.lastUsedAt = log.requestedAt;
    }
  }

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

  const items = Array.from(grouped.values())
    .map((g) => {
      const key = `${g.provider.toLowerCase()}::${g.model.toLowerCase()}`;
      const price = priceByKey.get(key);
      return {
        provider: g.provider,
        model: g.model,
        calls: g.calls,
        totalPromptTokens: g.totalPromptTokens,
        totalCompletionTokens: g.totalCompletionTokens,
        totalTokens: g.totalTokens,
        firstUsedAt: g.firstUsedAt.toISOString(),
        lastUsedAt: g.lastUsedAt.toISOString(),
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
