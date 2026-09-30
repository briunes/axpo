import { billingMonthsFromItems, BILLING_MONTH_KEY_PREFIX } from "@/domain/billingMonths";
import { prisma } from "@/infrastructure/database/prisma";

export async function getBaseValueBillingMonths(baseValueSetId: string): Promise<string[]> {
  // Current imports store explicit months. Fetch these first: the previous OR
  // query also fetched ~20,000 margin rows, requiring ~20 serial API requests.
  const metadata = await prisma.baseValueItem.findMany({
    where: {
      baseValueSetId,
      key: { startsWith: BILLING_MONTH_KEY_PREFIX },
    },
    select: { key: true, valueText: true },
  });
  const hasExplicitMonths = metadata.some((item) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(
      item.valueText ?? item.key.slice(BILLING_MONTH_KEY_PREFIX.length),
    ),
  );
  if (hasExplicitMonths) return billingMonthsFromItems(metadata);

  // Preserve legacy discovery, including dates embedded in malformed metadata
  // keys when no valid explicit value exists. No truncation or month caching.
  const margins = await prisma.baseValueItem.findMany({
    where: {
      baseValueSetId,
      key: { contains: ":MARGEN:" },
    },
    select: { key: true, valueText: true },
  });
  return billingMonthsFromItems([...metadata, ...margins]);
}
