import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";
import {
  aggregateUsage,
  calculateCallCost,
  type OcrCallUsage,
  type OcrPriceRow,
  round6,
  toNumber,
} from "@/application/lib/ocrCost";

const dateRangeSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createInvoiceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientId: z.string().trim().min(1).nullable().optional(),
  clientName: z.string().trim().min(1).max(200).nullable().optional(),
  agencyId: z.string().trim().min(1).nullable().optional(),
  userId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Build a "settings" object from the singleton SystemConfig row.
 */
async function loadSettings() {
  const config = await prisma.systemConfig.findFirst();
  return {
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
}

async function loadPrices(): Promise<OcrPriceRow[]> {
  const rows = await prisma.ocrModelPrice.findMany({
    where: { isActive: true },
    select: {
      provider: true,
      model: true,
      inputPricePer1kTokens: true,
      outputPricePer1kTokens: true,
      currency: true,
      unitTokens: true,
    },
  });
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePer1kTokens: Number(r.inputPricePer1kTokens),
    outputPricePer1kTokens: Number(r.outputPricePer1kTokens),
    currency: r.currency,
    unitTokens: r.unitTokens,
  }));
}

/**
 * @swagger
 * /api/v1/internal/ocr-usage/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List saved OCR usage invoice snapshots
 *     security:
 *       - bearerAuth: []
 *   post:
 *     tags: [Invoices]
 *     summary: Snapshot the current period's usage into a billable invoice line
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);

  const [items, total] = await Promise.all([
    prisma.ocrUsageInvoice.findMany({
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true } },
        agency: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.ocrUsageInvoice.count(),
  ]);

  return ResponseHandler.ok({
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      clientId: i.clientId,
      clientName: i.clientName ?? i.client?.name ?? null,
      agencyId: i.agencyId,
      agencyName: i.agency?.name ?? null,
      userId: i.userId,
      userName: i.user?.fullName ?? null,
      currency: i.currency,
      totalCalls: i.totalCalls,
      successfulCalls: i.successfulCalls,
      failedCalls: i.failedCalls,
      totalPromptTokens: Number(i.totalPromptTokens),
      totalCompletionTokens: Number(i.totalCompletionTokens),
      totalTokens: Number(i.totalTokens),
      baseCost: Number(i.baseCost),
      markupCost: Number(i.markupCost),
      fixedFeeCost: Number(i.fixedFeeCost),
      totalCost: Number(i.totalCost),
      status: i.status,
      note: i.note ?? null,
      createdAt: i.createdAt.toISOString(),
      createdBy: i.createdByUser
        ? {
            id: i.createdByUser.id,
            fullName: i.createdByUser.fullName,
            email: i.createdByUser.email,
          }
        : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.ocr-usage");

  const body = await request.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid invoice payload", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;

  const range = dateRangeSchema.safeParse({
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
  });
  if (!range.success) {
    throw new ValidationError("Invalid date range", {
      issues: range.error.issues,
    });
  }
  if (data.dateFrom > data.dateTo) {
    throw new ValidationError("dateFrom must be ≤ dateTo");
  }

  const start = new Date(data.dateFrom + "T00:00:00.000Z");
  const end = new Date(data.dateTo + "T23:59:59.999Z");

  // Build a where filter that may scope by client / user / agency
  const where: Prisma.OcrLogWhereInput = {
    requestedAt: { gte: start, lte: end },
  };
  if (data.userId) where.userId = data.userId;
  if (data.agencyId) {
    where.user = { agencyId: data.agencyId };
  }
  if (data.clientId) {
    where.simulation = { clientId: data.clientId };
  }

  const [logs, settings, prices] = await Promise.all([
    prisma.ocrLog.findMany({
      where,
      select: {
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        status: true,
      },
    }),
    loadSettings(),
    loadPrices(),
  ]);

  const calls: OcrCallUsage[] = logs.map((l) => ({
    provider: l.provider,
    model: l.model,
    promptTokens: l.promptTokens,
    completionTokens: l.completionTokens,
    totalTokens: l.totalTokens,
    status: l.status,
  }));

  const totals = aggregateUsage(calls, prices, settings);

  // Per-model breakdown for transparency
  const perModel = new Map<
    string,
    {
      provider: string;
      model: string;
      calls: number;
      successfulCalls: number;
      failedCalls: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      totalCost: number;
    }
  >();
  for (const call of calls) {
    const key = `${call.provider}::${call.model}`;
    let row = perModel.get(key);
    if (!row) {
      row = {
        provider: call.provider,
        model: call.model,
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      };
      perModel.set(key, row);
    }
    const isFailed = (call.status ?? "").toUpperCase() !== "SUCCESS";
    if (isFailed) row.failedCalls += 1;
    else row.successfulCalls += 1;
    row.calls += 1;
    row.promptTokens += toNumber(call.promptTokens);
    row.completionTokens += toNumber(call.completionTokens);
    row.totalTokens += toNumber(
      call.totalTokens,
      toNumber(call.promptTokens) + toNumber(call.completionTokens),
    );
    const billable = !isFailed || settings.ocrBillingIncludeFailedCalls;
    if (billable) {
      const breakdown = calculateCallCost({
        usage: call,
        prices,
        settings,
      });
      row.totalCost = round6(row.totalCost + breakdown.totalCost);
    }
  }

  const created = await prisma.ocrUsageInvoice.create({
    data: {
      label: data.label,
      periodStart: start,
      periodEnd: end,
      clientId: data.clientId ?? null,
      clientName: data.clientName ?? null,
      agencyId: data.agencyId ?? null,
      userId: data.userId ?? null,
      currency: totals.currency,
      totalCalls: totals.totalCalls,
      successfulCalls: totals.successfulCalls,
      failedCalls: totals.failedCalls,
      totalPromptTokens: BigInt(totals.totalPromptTokens),
      totalCompletionTokens: BigInt(totals.totalCompletionTokens),
      totalTokens: BigInt(totals.totalTokens),
      baseCost: new Prisma.Decimal(totals.baseCost),
      markupCost: new Prisma.Decimal(totals.markupCost),
      fixedFeeCost: new Prisma.Decimal(totals.fixedFeeCost),
      totalCost: new Prisma.Decimal(totals.totalCost),
      breakdown: {
        byModel: Array.from(perModel.values()).sort(
          (a, b) => b.totalCost - a.totalCost,
        ),
        unmatchedCalls: totals.unmatchedCalls,
        pricedModels: prices.length,
        settings: {
          enabled: settings.ocrBillingEnabled,
          currency: settings.ocrBillingCurrency,
          unitTokens: settings.ocrBillingUnitTokens,
          markupPercent: settings.ocrBillingMarkupPercent,
          fixedFeePerCall: settings.ocrBillingFixedFeePerCall,
          includeFailedCalls: settings.ocrBillingIncludeFailedCalls,
        },
      },
      status: data.status ?? "DRAFT",
      note: data.note ?? null,
      createdByUserId: auth.userId,
    },
  });

  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "OCR_USAGE_INVOICE_CREATED",
    targetType: "OCR_INVOICE",
    targetId: created.id,
    metadataJson: {
      label: created.label,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      totalCost: totals.totalCost,
      currency: totals.currency,
      clientId: data.clientId ?? null,
      userId: data.userId ?? null,
    },
  });

  return ResponseHandler.ok(
    {
      id: created.id,
      label: created.label,
      periodStart: created.periodStart.toISOString(),
      periodEnd: created.periodEnd.toISOString(),
      currency: created.currency,
      totalCalls: created.totalCalls,
      totalTokens: created.totalTokens.toString(),
      baseCost: Number(created.baseCost),
      markupCost: Number(created.markupCost),
      fixedFeeCost: Number(created.fixedFeeCost),
      totalCost: Number(created.totalCost),
      status: created.status,
    },
    201,
  );
});
