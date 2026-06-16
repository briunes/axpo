/**
 * OCR usage cost calculator.
 *
 * Single source of truth used by:
 *   - the OCR usage API routes
 *   - the dashboard frontend
 *   - the invoice-snapshot endpoint
 *
 * Cost formula (per OCR call):
 *
 *   tokensCost = (promptTokens / unitTokens) * inputPricePerUnit
 *              + (completionTokens / unitTokens) * outputPricePerUnit
 *   fixedCost  = fixedFeePerCall * (1 + markupPercent / 100)
 *   total      = (tokensCost * (1 + markupPercent / 100)) + fixedCost
 *
 * `unitTokens` defaults to 1000 (matches OpenAI / Anthropic). If the model
 * stores a different `unitTokens` (e.g. 1_000_000 for "per-1M" pricing), it is
 * respected per row.
 *
 * All math is done in plain JS numbers. Decimals are accepted on input and the
 * output is rounded to 6 decimals to keep currency math stable.
 */

export interface OcrPriceRow {
  provider: string;
  model: string;
  inputPricePer1kTokens: number | string;
  outputPricePer1kTokens: number | string;
  currency?: string | null;
  /** Tokens per price unit. Defaults to 1000. */
  unitTokens?: number | null;
}

export interface OcrBillingSettings {
  ocrBillingEnabled: boolean;
  ocrBillingCurrency: string;
  ocrBillingUnitTokens: number;
  ocrBillingMarkupPercent: number | string;
  ocrBillingFixedFeePerCall: number | string;
  ocrBillingIncludeFailedCalls: boolean;
}

export interface OcrCallUsage {
  provider: string;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  status?: string | null;
}

export interface CostBreakdown {
  baseCost: number;
  markupCost: number;
  fixedFeeCost: number;
  totalCost: number;
  tokensCost: number;
  matched: boolean;
  currency: string;
}

export const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export const toNumber = (
  v: number | string | null | undefined,
  fallback = 0,
) => {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Look up a price row by (provider, model). Returns undefined if not found.
 */
export function findPrice(
  prices: OcrPriceRow[],
  provider: string,
  model: string,
): OcrPriceRow | undefined {
  const norm = (s: string) => (s ?? "").trim().toLowerCase();
  const p = norm(provider);
  const m = norm(model);
  return prices.find(
    (row) => norm(row.provider) === p && norm(row.model) === m,
  );
}

export interface CalculateCostInput {
  usage: OcrCallUsage;
  prices: OcrPriceRow[];
  settings: OcrBillingSettings;
  /** Skip fixed-fee & markup (e.g. for a base/tokens-only view). */
  excludeFeesAndMarkup?: boolean;
}

/**
 * Compute the cost for a single OCR call given the configured prices and
 * billing settings. Returns a {@link CostBreakdown} indicating whether a price
 * row was matched (calls with no matching price still report tokens but
 * `totalCost` = 0 so the admin can see "un-priced" usage).
 */
export function calculateCallCost(input: CalculateCostInput): CostBreakdown {
  const { usage, prices, settings } = input;
  const price = findPrice(prices, usage.provider, usage.model);
  const currency = price?.currency ?? settings.ocrBillingCurrency ?? "USD";
  const markupPercent = toNumber(settings.ocrBillingMarkupPercent);
  const fixedFee = toNumber(settings.ocrBillingFixedFeePerCall);
  const unitTokens = price?.unitTokens ?? settings.ocrBillingUnitTokens ?? 1000;

  const prompt = toNumber(usage.promptTokens);
  const completion = toNumber(usage.completionTokens);

  if (!price) {
    return {
      baseCost: 0,
      markupCost: 0,
      fixedFeeCost: 0,
      totalCost: 0,
      tokensCost: 0,
      matched: false,
      currency,
    };
  }

  const inputRate = toNumber(price.inputPricePer1kTokens);
  const outputRate = toNumber(price.outputPricePer1kTokens);

  const tokensCost =
    (prompt / unitTokens) * inputRate + (completion / unitTokens) * outputRate;

  if (input.excludeFeesAndMarkup) {
    return {
      baseCost: tokensCost,
      markupCost: 0,
      fixedFeeCost: 0,
      totalCost: tokensCost,
      tokensCost,
      matched: true,
      currency,
    };
  }

  const tokensWithMarkup = tokensCost * (1 + markupPercent / 100);
  const markupCost = tokensWithMarkup - tokensCost;
  const fixedFeeCost = fixedFee * (1 + markupPercent / 100);
  const totalCost = tokensWithMarkup + fixedFeeCost;

  return {
    baseCost: round6(tokensCost),
    markupCost: round6(markupCost),
    fixedFeeCost: round6(fixedFeeCost),
    totalCost: round6(totalCost),
    tokensCost: round6(tokensCost),
    matched: true,
    currency,
  };
}

/**
 * Helper that aggregates a list of OCR calls and returns totals. Failed calls
 * are filtered out unless `settings.ocrBillingIncludeFailedCalls` is true.
 */
export interface UsageAggregate {
  totalCalls: number;
  billableCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  baseCost: number;
  markupCost: number;
  fixedFeeCost: number;
  totalCost: number;
  unmatchedCalls: number;
  currency: string;
}

export function aggregateUsage(
  calls: OcrCallUsage[],
  prices: OcrPriceRow[],
  settings: OcrBillingSettings,
): UsageAggregate {
  const result: UsageAggregate = {
    totalCalls: calls.length,
    billableCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    baseCost: 0,
    markupCost: 0,
    fixedFeeCost: 0,
    totalCost: 0,
    unmatchedCalls: 0,
    currency: settings.ocrBillingCurrency ?? "USD",
  };

  for (const call of calls) {
    const isFailed =
      !!call.status && !["SUCCESS"].includes(call.status.toUpperCase());
    if (isFailed) result.failedCalls += 1;
    else result.successfulCalls += 1;

    result.totalPromptTokens += toNumber(call.promptTokens);
    result.totalCompletionTokens += toNumber(call.completionTokens);
    result.totalTokens += toNumber(
      call.totalTokens,
      toNumber(call.promptTokens) + toNumber(call.completionTokens),
    );

    const billable = !isFailed || settings.ocrBillingIncludeFailedCalls;
    if (!billable) continue;
    result.billableCalls += 1;

    const breakdown = calculateCallCost({ usage: call, prices, settings });
    result.baseCost += breakdown.baseCost;
    result.markupCost += breakdown.markupCost;
    result.fixedFeeCost += breakdown.fixedFeeCost;
    result.totalCost += breakdown.totalCost;
    if (!breakdown.matched) result.unmatchedCalls += 1;
    if (breakdown.currency) result.currency = breakdown.currency;
  }

  result.baseCost = round6(result.baseCost);
  result.markupCost = round6(result.markupCost);
  result.fixedFeeCost = round6(result.fixedFeeCost);
  result.totalCost = round6(result.totalCost);

  return result;
}

/**
 * Format a number as currency using the provided ISO code. Falls back to a
 * plain 2-decimal number for currencies Intl can't format.
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US",
): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format a token count using compact notation (1.2M, 34K, …).
 */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count)) return "—";
  const abs = Math.abs(count);
  if (abs >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
