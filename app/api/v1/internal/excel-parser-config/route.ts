import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import {
  defaultExcelParserProductConfigs,
  withMissingDefaultExcelParserProductConfigs,
  type ExcelParserConfigScope,
  type ExcelParserProductConfigItem,
} from "@/domain/excelParserProductConfig";

const scopeSchema = z.enum(["GLOBAL", "TLV"]);

const configItemSchema = z.object({
  id: z.string().optional(),
  scopeType: scopeSchema,
  sourceLabel: z.string().min(1),
  productKey: z.string().min(1),
  displayName: z.string().min(1),
  commodity: z.enum(["ELECTRICITY", "GAS"]),
  pricingType: z.enum(["FIXED", "INDEXED"]),
  enabled: z.boolean(),
  singlePeriod: z.boolean(),
  eligibilityMin: z.number().nullable().optional(),
  eligibilityMax: z.number().nullable().optional(),
  sortOrder: z.number().int(),
});

const putSchema = z.object({
  scopeType: scopeSchema,
  items: z.array(configItemSchema),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);

  const { searchParams } = new URL(request.url);
  const scopeType = scopeSchema.parse(searchParams.get("scopeType") ?? "GLOBAL");
  const items = await loadOrSeed(scopeType);

  return ResponseHandler.ok({ items }, 200);
});

export const PUT = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);

  const payload = putSchema.parse(await request.json());
  if (payload.items.some((item) => item.scopeType !== payload.scopeType)) {
    throw new ValidationError("All parser config items must match scopeType");
  }

  await prisma.excelParserProductConfig.deleteMany({
    where: { scopeType: payload.scopeType },
  });
  if (payload.items.length > 0) {
    await prisma.excelParserProductConfig.createMany({
      data: payload.items.map((item) => ({
        scopeType: item.scopeType,
        sourceLabel: item.sourceLabel.trim(),
        productKey: item.productKey.trim(),
        displayName: item.displayName.trim(),
        commodity: item.commodity,
        pricingType: item.pricingType,
        enabled: item.enabled,
        singlePeriod: item.singlePeriod,
        eligibilityMin: item.eligibilityMin ?? null,
        eligibilityMax: item.eligibilityMax ?? null,
        sortOrder: item.sortOrder,
      })),
    });
  }

  const items = await load(payload.scopeType);
  return ResponseHandler.ok({ items }, 200);
});

async function load(
  scopeType: ExcelParserConfigScope,
): Promise<ExcelParserProductConfigItem[]> {
  const rows = await prisma.excelParserProductConfig.findMany({
    where: { scopeType },
    orderBy: [{ sortOrder: "asc" }, { sourceLabel: "asc" }],
  });
  return rows.map(toItem);
}

async function loadOrSeed(
  scopeType: ExcelParserConfigScope,
): Promise<ExcelParserProductConfigItem[]> {
  const existing = await load(scopeType);
  if (existing.length > 0) {
    const merged = withMissingDefaultExcelParserProductConfigs(
      scopeType,
      existing,
    );
    const missing = merged.filter((item) => !item.id);
    if (missing.length > 0) {
      await prisma.excelParserProductConfig.createMany({
        data: missing.map((item) => ({
          scopeType: item.scopeType,
          sourceLabel: item.sourceLabel,
          productKey: item.productKey,
          displayName: item.displayName,
          commodity: item.commodity,
          pricingType: item.pricingType,
          enabled: item.enabled,
          singlePeriod: item.singlePeriod,
          eligibilityMin: item.eligibilityMin ?? null,
          eligibilityMax: item.eligibilityMax ?? null,
          sortOrder: item.sortOrder,
        })),
        skipDuplicates: true,
      });
      return load(scopeType);
    }
    return merged;
  }

  const defaults = defaultExcelParserProductConfigs(scopeType);
  await prisma.excelParserProductConfig.createMany({
    data: defaults.map((item) => ({
      scopeType: item.scopeType,
      sourceLabel: item.sourceLabel,
      productKey: item.productKey,
      displayName: item.displayName,
      commodity: item.commodity,
      pricingType: item.pricingType,
      enabled: item.enabled,
      singlePeriod: item.singlePeriod,
      eligibilityMin: item.eligibilityMin ?? null,
      eligibilityMax: item.eligibilityMax ?? null,
      sortOrder: item.sortOrder,
    })),
  });

  const seeded = await prisma.excelParserProductConfig.findMany({
    where: { scopeType },
    orderBy: [{ sortOrder: "asc" }, { sourceLabel: "asc" }],
  });
  return seeded.map(toItem);
}

function toItem(row: {
  id: string;
  scopeType: string;
  sourceLabel: string;
  productKey: string;
  displayName: string;
  commodity: string;
  pricingType: string;
  enabled: boolean;
  singlePeriod: boolean;
  eligibilityMin: unknown;
  eligibilityMax: unknown;
  sortOrder: number;
}): ExcelParserProductConfigItem {
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const maybeDecimal = value as { toNumber?: () => number };
    return typeof maybeDecimal.toNumber === "function"
      ? maybeDecimal.toNumber()
      : Number(value);
  };

  return {
    id: row.id,
    scopeType: row.scopeType as ExcelParserProductConfigItem["scopeType"],
    sourceLabel: row.sourceLabel,
    productKey: row.productKey,
    displayName: row.displayName,
    commodity: row.commodity as ExcelParserProductConfigItem["commodity"],
    pricingType: row.pricingType as ExcelParserProductConfigItem["pricingType"],
    enabled: row.enabled,
    singlePeriod: row.singlePeriod,
    eligibilityMin: toNumber(row.eligibilityMin),
    eligibilityMax: toNumber(row.eligibilityMax),
    sortOrder: row.sortOrder,
  };
}
