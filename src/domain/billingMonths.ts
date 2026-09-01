export const BILLING_MONTH_KEY_PREFIX = "META:BILLING_MONTH:";

const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface BillingMonthItem {
  key: string;
  valueText?: string | null;
}

/**
 * Returns the billing months available in a base-value set, newest first.
 * Explicit workbook metadata is preferred; legacy sets are supported by
 * discovering YYYY-MM suffixes in their month-specific price keys.
 */
export function billingMonthsFromItems(items: BillingMonthItem[]): string[] {
  const explicit = items
    .filter((item) => item.key.startsWith(BILLING_MONTH_KEY_PREFIX))
    .map((item) => item.valueText ?? item.key.slice(BILLING_MONTH_KEY_PREFIX.length))
    .filter((month): month is string => YYYY_MM.test(month));

  const discovered = explicit.length > 0
    ? explicit
    : items.flatMap((item) => item.key.match(/(?:^|:)(\d{4}-(?:0[1-9]|1[0-2]))(?:$|:)/)?.[1] ?? []);

  return [...new Set(discovered)].sort((a, b) => b.localeCompare(a));
}
