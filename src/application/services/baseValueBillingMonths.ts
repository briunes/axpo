import { billingMonthsFromItems, BILLING_MONTH_KEY_PREFIX } from "@/domain/billingMonths";
import { prisma } from "@/infrastructure/database/prisma";

export async function getBaseValueBillingMonths(baseValueSetId: string): Promise<string[]> {
  // A single filtered query supports both new metadata-bearing imports and
  // legacy month-specific price keys. Avoid probing metadata first because
  // that made older sets pay for two sequential remote database requests.
  const items = await prisma.baseValueItem.findMany({
    where: {
      baseValueSetId,
      OR: [
        { key: { startsWith: BILLING_MONTH_KEY_PREFIX } },
        { key: { contains: ":MARGEN:" } },
      ],
    },
    select: { key: true, valueText: true },
  });
  return billingMonthsFromItems(items);
}
