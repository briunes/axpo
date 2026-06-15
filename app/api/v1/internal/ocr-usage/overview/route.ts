import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import {
  aggregateUsage,
  calculateCallCost,
  findPrice,
  type OcrCallUsage,
  type OcrPriceRow,
  round6,
  toNumber,
} from "@/application/lib/ocrCost";

/**
 * Build a Prisma `where` filter for OcrLog based on common query params.
 */
function buildOcrLogWhere(
  searchParams: URLSearchParams,
): Prisma.OcrLogWhereInput {
  const where: Prisma.OcrLogWhereInput = {};
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom || dateTo) {
    where.requestedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
    };
  }
  const provider = searchParams.get("provider");
  if (provider) where.provider = provider;
  const model = searchParams.get("model");
  if (model) where.model = model;
  const userId = searchParams.get("userId");
  if (userId) where.userId = userId;
  const status = searchParams.get("status");
  if (status) where.status = status;
  const type = searchParams.get("type");
  if (type) where.type = type as Prisma.EnumOcrLogTypeFilter;
  return where;
}

function serializePrices(
  rows: Array<{
    provider: string;
    model: string;
    inputPricePer1kTokens: Prisma.Decimal | number | string;
    outputPricePer1kTokens: Prisma.Decimal | number | string;
    currency: string;
    unitTokens: number;
  }>,
): OcrPriceRow[] {
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePer1kTokens: Number(r.inputPricePer1kTokens),
    outputPricePer1kTokens: Number(r.outputPricePer1kTokens),
    currency: r.currency,
    unitTokens: r.unitTokens,
  }));
}

function bucketKey(date: Date, granularity: "hour" | "day" | "week" | "month") {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (granularity === "hour") {
    const h = String(date.getUTCHours()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:00:00.000Z`;
  }
  if (granularity === "day") return `${y}-${m}-${d}`;
  if (granularity === "month") return `${y}-${m}`;
  // week: start on the Monday of that week
  const tmp = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() - (day - 1));
  const wm = String(tmp.getUTCMonth() + 1).padStart(2, "0");
  const wd = String(tmp.getUTCDate()).padStart(2, "0");
  return `${tmp.getUTCFullYear()}-${wm}-${wd}`;
}

const OCR_LOG_TYPE_LABELS: Record<string, string> = {
  INVOICE_EXTRACTION: "Invoice extraction",
  PROVIDER_DETECTION: "Provider detection",
  PROMPT_IMPROVEMENT: "Prompt improvement",
  PROMPT_TEST: "Prompt test",
  TEMPLATE_BUILDER: "Template builder",
};

/**
 * @swagger
 * /api/v1/internal/ocr-usage/overview:
 *   get:
 *     tags: [Invoices]
 *     summary: Aggregated OCR usage metrics (tokens, cost) for a date range
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: provider
 *         schema: { type: string }
 *       - in: query
 *         name: model
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, user, provider, model, type] }
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [hour, day, week, month] }
 *       - in: query
 *         name: recentLimit
 *         schema: { type: integer, default: 10, maximum: 50 }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  const { searchParams } = new URL(request.url);
  const where = buildOcrLogWhere(searchParams);
  const groupBy = (searchParams.get("groupBy") ?? "day").toLowerCase();
  const granularity = (searchParams.get("granularity") ?? "day").toLowerCase();
  const recentLimit = Math.min(
    Math.max(parseInt(searchParams.get("recentLimit") ?? "10", 10), 0),
    50,
  );

  // Pull all rows for the period so we can compute cost client-side from the
  // configured prices. For very large date ranges this would need server-side
  // aggregation, but for typical billing periods (≤90 days) it's fine.
  const [logs, config, priceRows] = await Promise.all([
    prisma.ocrLog.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        requestedAt: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        status: true,
        durationMs: true,
        userId: true,
        user: { select: { id: true, fullName: true, email: true } },
        type: true,
      },
    }),
    prisma.systemConfig.findFirst(),
    prisma.ocrModelPrice.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        model: true,
        inputPricePer1kTokens: true,
        outputPricePer1kTokens: true,
        currency: true,
        unitTokens: true,
      },
    }),
  ]);

  const settings = {
    ocrBillingEnabled: config?.ocrBillingEnabled ?? false,
    ocrBillingCurrency: config?.ocrBillingCurrency ?? "USD",
    ocrBillingUnitTokens: config?.ocrBillingUnitTokens ?? 1000,
    ocrBillingMarkupPercent: config
      ? Number(config.ocrBillingMarkupPercent)
      : 0,
    ocrBillingFixedFeePerCall: config
      ? Number(config.ocrBillingFixedFeePerCall)
      : 0,
    ocrBillingIncludeFailedCalls: config?.ocrBillingIncludeFailedCalls ?? false,
  };
  const prices = serializePrices(priceRows);

  const calls: OcrCallUsage[] = logs.map((l) => ({
    provider: l.provider,
    model: l.model,
    promptTokens: l.promptTokens,
    completionTokens: l.completionTokens,
    totalTokens: l.totalTokens,
    status: l.status,
  }));

  const totals = aggregateUsage(calls, prices, settings);

  // Latency & success
  const successfulDurations = logs
    .filter((l) => (l.status ?? "").toUpperCase() === "SUCCESS")
    .map((l) => l.durationMs)
    .filter((d): d is number => typeof d === "number");
  const avgDurationMs =
    successfulDurations.length > 0
      ? Math.round(
          successfulDurations.reduce((a, b) => a + b, 0) /
            successfulDurations.length,
        )
      : null;

  // Build time-series / group-by buckets
  type SeriesBucket = {
    key: string;
    label: string;
    calls: number;
    successfulCalls: number;
    failedCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCost: number;
  };

  const seriesMap = new Map<string, SeriesBucket>();
  const groupedMap = new Map<string, SeriesBucket>();

  const getSeriesBucket = (key: string, label: string): SeriesBucket => {
    let b = seriesMap.get(key);
    if (!b) {
      b = {
        key,
        label,
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      };
      seriesMap.set(key, b);
    }
    return b;
  };

  const getGroupedBucket = (key: string, label: string): SeriesBucket => {
    let b = groupedMap.get(key);
    if (!b) {
      b = {
        key,
        label,
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      };
      groupedMap.set(key, b);
    }
    return b;
  };

  for (const log of logs) {
    const breakdown = calculateCallCost({
      usage: {
        provider: log.provider,
        model: log.model,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        status: log.status,
      },
      prices,
      settings,
    });

    const isFailed = (log.status ?? "").toUpperCase() !== "SUCCESS";
    const billable = !isFailed || settings.ocrBillingIncludeFailedCalls;

    // Time-series
    if (
      granularity === "hour" ||
      granularity === "day" ||
      granularity === "week" ||
      granularity === "month"
    ) {
      const date = new Date(log.requestedAt);
      const key = bucketKey(date, granularity);
      const bucket = getSeriesBucket(key, key);
      bucket.calls += 1;
      if (isFailed) bucket.failedCalls += 1;
      else bucket.successfulCalls += 1;
      bucket.promptTokens += toNumber(log.promptTokens);
      bucket.completionTokens += toNumber(log.completionTokens);
      bucket.totalTokens += toNumber(
        log.totalTokens,
        toNumber(log.promptTokens) + toNumber(log.completionTokens),
      );
      if (billable)
        bucket.totalCost = round6(bucket.totalCost + breakdown.totalCost);
    }

    // Group-by
    if (groupBy !== "day" && groupBy !== granularity) {
      let gKey = "unknown";
      let gLabel = "Unknown";
      if (groupBy === "user") {
        gKey = log.userId ?? "anonymous";
        gLabel = log.user?.fullName ?? log.user?.email ?? "Anonymous";
      } else if (groupBy === "provider") {
        gKey = log.provider;
        gLabel = log.provider;
      } else if (groupBy === "model") {
        gKey = `${log.provider}/${log.model}`;
        gLabel = `${log.provider} / ${log.model}`;
      } else if (groupBy === "type") {
        gKey = log.type;
        gLabel = OCR_LOG_TYPE_LABELS[log.type] ?? log.type;
      }
      const gBucket = getGroupedBucket(gKey, gLabel);
      gBucket.calls += 1;
      if (isFailed) gBucket.failedCalls += 1;
      else gBucket.successfulCalls += 1;
      gBucket.promptTokens += toNumber(log.promptTokens);
      gBucket.completionTokens += toNumber(log.completionTokens);
      gBucket.totalTokens += toNumber(
        log.totalTokens,
        toNumber(log.promptTokens) + toNumber(log.completionTokens),
      );
      if (billable)
        gBucket.totalCost = round6(gBucket.totalCost + breakdown.totalCost);
    }
  }

  const series = Array.from(seriesMap.values()).sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );

  // Top users / providers / models
  const userAgg = new Map<
    string,
    SeriesBucket & { userEmail?: string | null }
  >();
  const providerAgg = new Map<string, SeriesBucket>();
  const modelAgg = new Map<string, SeriesBucket>();

  for (const log of logs) {
    const breakdown = calculateCallCost({
      usage: {
        provider: log.provider,
        model: log.model,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        status: log.status,
      },
      prices,
      settings,
    });
    const isFailed = (log.status ?? "").toUpperCase() !== "SUCCESS";
    const billable = !isFailed || settings.ocrBillingIncludeFailedCalls;

    if (log.userId) {
      const uKey = log.userId;
      let u = userAgg.get(uKey);
      if (!u) {
        u = {
          key: uKey,
          label: log.user?.fullName ?? log.user?.email ?? "Unknown",
          userEmail: log.user?.email ?? null,
          calls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        };
        userAgg.set(uKey, u);
      }
      u.calls += 1;
      if (isFailed) u.failedCalls += 1;
      else u.successfulCalls += 1;
      u.promptTokens += toNumber(log.promptTokens);
      u.completionTokens += toNumber(log.completionTokens);
      u.totalTokens += toNumber(
        log.totalTokens,
        toNumber(log.promptTokens) + toNumber(log.completionTokens),
      );
      if (billable) u.totalCost = round6(u.totalCost + breakdown.totalCost);
    }

    {
      const pKey = log.provider;
      let p = providerAgg.get(pKey);
      if (!p) {
        p = {
          key: pKey,
          label: log.provider,
          calls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        };
        providerAgg.set(pKey, p);
      }
      p.calls += 1;
      if (isFailed) p.failedCalls += 1;
      else p.successfulCalls += 1;
      p.promptTokens += toNumber(log.promptTokens);
      p.completionTokens += toNumber(log.completionTokens);
      p.totalTokens += toNumber(
        log.totalTokens,
        toNumber(log.promptTokens) + toNumber(log.completionTokens),
      );
      if (billable) p.totalCost = round6(p.totalCost + breakdown.totalCost);
    }

    {
      const mKey = `${log.provider}/${log.model}`;
      let m = modelAgg.get(mKey);
      if (!m) {
        m = {
          key: mKey,
          label: `${log.provider} / ${log.model}`,
          calls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        };
        modelAgg.set(mKey, m);
      }
      m.calls += 1;
      if (isFailed) m.failedCalls += 1;
      else m.successfulCalls += 1;
      m.promptTokens += toNumber(log.promptTokens);
      m.completionTokens += toNumber(log.completionTokens);
      m.totalTokens += toNumber(
        log.totalTokens,
        toNumber(log.promptTokens) + toNumber(log.completionTokens),
      );
      if (billable) m.totalCost = round6(m.totalCost + breakdown.totalCost);
    }
  }

  const top = (m: Map<string, SeriesBucket>, n = 10) =>
    Array.from(m.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, n);

  // Priced/unpriced split
  const unpriced = new Set<string>();
  for (const log of logs) {
    if (!findPrice(prices, log.provider, log.model)) {
      unpriced.add(`${log.provider}/${log.model}`);
    }
  }

  // Recent calls with computed cost
  const recentCalls = logs.slice(0, recentLimit).map((l) => {
    const breakdown = calculateCallCost({
      usage: {
        provider: l.provider,
        model: l.model,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        status: l.status,
      },
      prices,
      settings,
    });
    return {
      id: l.id,
      requestedAt: l.requestedAt.toISOString(),
      userId: l.userId,
      userName: l.user?.fullName ?? null,
      userEmail: l.user?.email ?? null,
      provider: l.provider,
      model: l.model,
      status: l.status,
      type: l.type,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      durationMs: l.durationMs,
      cost: breakdown.totalCost,
      currency: breakdown.currency,
      matched: breakdown.matched,
    };
  });

  return ResponseHandler.ok(
    {
      totals: {
        ...totals,
        avgDurationMs,
        successRate:
          logs.length === 0
            ? null
            : round6(totals.successfulCalls / logs.length),
        avgCostPerCall:
          totals.billableCalls > 0
            ? round6(totals.totalCost / totals.billableCalls)
            : 0,
        avgPromptTokensPerCall:
          logs.length > 0 ? round6(totals.totalPromptTokens / logs.length) : 0,
        avgCompletionTokensPerCall:
          logs.length > 0
            ? round6(totals.totalCompletionTokens / logs.length)
            : 0,
      },
      billing: {
        enabled: settings.ocrBillingEnabled,
        currency: settings.ocrBillingCurrency,
        unitTokens: settings.ocrBillingUnitTokens,
        markupPercent: settings.ocrBillingMarkupPercent,
        fixedFeePerCall: settings.ocrBillingFixedFeePerCall,
        includeFailedCalls: settings.ocrBillingIncludeFailedCalls,
        pricedModels: prices.length,
        unpricedModels: Array.from(unpriced).sort(),
      },
      series: {
        granularity,
        buckets: series,
      },
      groupBy: {
        key: groupBy,
        buckets: Array.from(groupedMap.values()).sort(
          (a, b) => b.totalCost - a.totalCost,
        ),
      },
      top: {
        users: top(userAgg, 10),
        providers: top(providerAgg, 10),
        models: top(modelAgg, 10),
      },
      recentCalls,
    },
    200,
  );
});
