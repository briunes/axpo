import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import {
  withMissingDefaultExcelParserProductConfigs,
  type ExcelParserProductConfigItem,
} from "@/domain/excelParserProductConfig";

const productConfigSchema = z.object({
  productKey: z.string().min(1),
  commodity: z.enum(["ELECTRICITY", "GAS"]),
  pricingType: z.enum(["FIXED", "INDEXED"]),
  isEnabled: z.boolean(),
});

type AgencyProductRow = {
  productKey: string;
  displayName: string;
  commodity: string;
  pricingType: string;
  isEnabled: boolean;
};

const loadAgencyProducts = async (
  agencyId: string,
  scopeType: "GLOBAL" | "TLV",
): Promise<AgencyProductRow[]> => {
  const [configuredRows, agencyRows] = await Promise.all([
    prisma.excelParserProductConfig.findMany({
      where: {
        scopeType,
      },
      orderBy: [{ sortOrder: "asc" }, { sourceLabel: "asc" }],
    }),
    prisma.agencyProductConfig.findMany({
      where: { agencyId },
      select: {
        productKey: true,
        commodity: true,
        pricingType: true,
        isEnabled: true,
      },
    }),
  ]);
  const configuredProducts = withMissingDefaultExcelParserProductConfigs(
    scopeType,
    configuredRows.map((row) => ({
      id: row.id,
      scopeType: row.scopeType as ExcelParserProductConfigItem["scopeType"],
      sourceLabel: row.sourceLabel,
      productKey: row.productKey,
      displayName: row.displayName,
      commodity: row.commodity as ExcelParserProductConfigItem["commodity"],
      pricingType: row.pricingType as ExcelParserProductConfigItem["pricingType"],
      enabled: row.enabled,
      singlePeriod: row.singlePeriod,
      eligibilityMin: row.eligibilityMin?.toNumber() ?? null,
      eligibilityMax: row.eligibilityMax?.toNumber() ?? null,
      sortOrder: row.sortOrder,
    })),
  ).filter((row) => row.enabled);

  const agencyEnabledByKey = new Map(
    agencyRows.map((row) => [
      `${row.commodity}:${row.pricingType}:${row.productKey}`,
      row.isEnabled,
    ]),
  );
  const seen = new Set<string>();
  const products: AgencyProductRow[] = [];

  for (const row of configuredProducts) {
    const identity = `${row.commodity}:${row.pricingType}:${row.productKey}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    products.push({
      productKey: row.productKey,
      displayName: row.displayName,
      commodity: row.commodity,
      pricingType: row.pricingType,
      isEnabled: agencyEnabledByKey.get(identity) ?? true,
    });
  }

  return products;
};

const GET = withErrorHandler(async (req: NextRequest, context) => {
  const auth = await requireAuth(req);
  const agencyId = context?.params?.id;
  if (!agencyId) throw new ValidationError("Agency id parameter is required");
  if (!isElevatedRole(auth.role) && auth.agencyId !== agencyId) {
    throw new NotFoundError("Agency", agencyId);
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, isTlv: true, isDeleted: true },
  });
  if (!agency || agency.isDeleted) {
    throw new NotFoundError("Agency", agencyId);
  }

  const requestedScopeType = req.nextUrl.searchParams.get("scopeType");
  const scopeType =
    requestedScopeType === "TLV" || requestedScopeType === "GLOBAL"
      ? requestedScopeType
      : agency.isTlv
        ? "TLV"
        : "GLOBAL";

  return NextResponse.json(await loadAgencyProducts(agencyId, scopeType));
});

const PUT = withErrorHandler(async (req: NextRequest, context) => {
  await assertPermission(await requireAuth(req), "agencies.edit");
  const agencyId = context?.params?.id;
  if (!agencyId) throw new ValidationError("Agency id parameter is required");

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, isTlv: true, isDeleted: true },
  });
  if (!agency || agency.isDeleted) {
    throw new NotFoundError("Agency", agencyId);
  }
  const products = z.array(productConfigSchema).parse(await req.json());
  await Promise.all(
    products.map((product) =>
      prisma.agencyProductConfig.upsert({
        where: {
          agencyId_commodity_pricingType_productKey: {
            agencyId,
            commodity: product.commodity,
            pricingType: product.pricingType,
            productKey: product.productKey,
          },
        },
        update: {
          isEnabled: product.isEnabled,
        },
        create: {
          agencyId,
          productKey: product.productKey,
          commodity: product.commodity,
          pricingType: product.pricingType,
          isEnabled: product.isEnabled,
        },
      }),
    ),
  );

  return NextResponse.json(
    await loadAgencyProducts(agencyId, agency.isTlv ? "TLV" : "GLOBAL"),
  );
});

export { GET, PUT };
