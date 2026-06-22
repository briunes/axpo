import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, isElevatedRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import {
  getProductDefinitions,
  type ProductCommodity,
  type ProductPricingType,
} from "@/domain/productRegistry";

const parseCommodity = (value: string | null): ProductCommodity | undefined =>
  value === "ELECTRICITY" || value === "GAS" ? value : undefined;

const parsePricingType = (
  value: string | null,
): ProductPricingType | undefined =>
  value === "FIXED" || value === "INDEXED" ? value : undefined;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");

  const searchParams = request.nextUrl.searchParams;
  const requestedAgencyId = searchParams.get("agencyId") ?? undefined;
  const agencyId =
    requestedAgencyId && isElevatedRole(auth.role)
      ? requestedAgencyId
      : auth.agencyId;
  const commodity = parseCommodity(searchParams.get("commodity"));
  const pricingType = parsePricingType(searchParams.get("pricingType"));
  const search = searchParams.get("search")?.trim() || undefined;
  const take = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("take") ?? "25", 10)),
  );

  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, isDeleted: false },
    select: { id: true, name: true, isTlv: true },
  });

  const [systemConfig, agencyTariffs, agencyProducts, baseValueSets, clients, owners, pdfTemplates] =
    await Promise.all([
      prisma.systemConfig.findFirst({
        select: {
          simulationExpirationDays: true,
          requirePinForAccess: true,
          pinLength: true,
          autoCreateClientOnSim: true,
          defaultPdfTemplateElectricityId: true,
          defaultPdfTemplateGasId: true,
        },
      }),
      prisma.agencyTariff.findMany({
        where: { agencyId, isEnabled: true },
        select: { tariffType: true },
        orderBy: { tariffType: "asc" },
      }),
      prisma.agencyProductConfig.findMany({
        where: { agencyId, isEnabled: true },
        select: {
          commodity: true,
          pricingType: true,
          productKey: true,
        },
      }),
      prisma.baseValueSet.findMany({
        where: {
          isDeleted: false,
          OR: [
            { scopeType: agency?.isTlv ? "TLV" : "GLOBAL" },
            { agencyId },
          ],
        },
        select: {
          id: true,
          name: true,
          version: true,
          scopeType: true,
          agencyId: true,
          isActive: true,
          isProduction: true,
          updatedAt: true,
        },
        orderBy: [
          { isProduction: "desc" },
          { isActive: "desc" },
          { version: "desc" },
          { updatedAt: "desc" },
        ],
        take: 25,
      }),
      prisma.client.findMany({
        where: {
          agencyId,
          isDeleted: false,
          ...(search
            ? { name: { contains: search, mode: "insensitive" as const } }
            : {}),
        },
        select: { id: true, name: true, cif: true, language: true },
        orderBy: { name: "asc" },
        take,
      }),
      prisma.user.findMany({
        where: {
          agencyId,
          isDeleted: false,
          isActive: true,
          ...(search
            ? { fullName: { contains: search, mode: "insensitive" as const } }
            : {}),
        },
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: { fullName: "asc" },
        take,
      }),
      prisma.pdfTemplate.findMany({
        where: {
          active: true,
          isDeleted: false,
          ...(commodity ? { OR: [{ commodity }, { commodity: null }] } : {}),
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          commodity: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const commodities: ProductCommodity[] = commodity
    ? [commodity]
    : ["ELECTRICITY", "GAS"];
  const pricingTypes: ProductPricingType[] = pricingType
    ? [pricingType]
    : ["FIXED", "INDEXED"];
  const enabledProductKeys = new Set(
    agencyProducts.map(
      (item) => `${item.commodity}:${item.pricingType}:${item.productKey}`,
    ),
  );
  const hasAgencyProductOverrides = agencyProducts.length > 0;

  const products = commodities.flatMap((currentCommodity) =>
    pricingTypes.flatMap((currentPricingType) =>
      getProductDefinitions({
        scopeType: agency?.isTlv ? "TLV" : "GLOBAL",
        commodity: currentCommodity,
        pricingType: currentPricingType,
      })
        .filter(
          (product) =>
            !hasAgencyProductOverrides ||
            enabledProductKeys.has(
              `${currentCommodity}:${currentPricingType}:${product.productKey}`,
            ),
        )
        .map((product) => ({
          ...product,
          enabled: true,
        })),
    ),
  );

  return ResponseHandler.ok(
    {
      agency,
      defaults: {
        expirationDays: systemConfig?.simulationExpirationDays ?? 30,
        requirePinForAccess: systemConfig?.requirePinForAccess ?? true,
        pinLength: systemConfig?.pinLength ?? 4,
        autoCreateClientOnSim: systemConfig?.autoCreateClientOnSim ?? false,
        defaultPdfTemplateElectricityId:
          systemConfig?.defaultPdfTemplateElectricityId ?? null,
        defaultPdfTemplateGasId: systemConfig?.defaultPdfTemplateGasId ?? null,
      },
      products,
      tariffs: agencyTariffs.map((item) => item.tariffType),
      baseValueSets,
      pdfTemplates,
      clients: clients.map((client) => ({
        id: client.id,
        label: client.name,
        cif: client.cif,
        language: client.language,
      })),
      owners: owners.map((owner) => ({
        id: owner.id,
        label: owner.fullName,
        email: owner.email,
        role: owner.role,
      })),
    },
    200,
  );
});
