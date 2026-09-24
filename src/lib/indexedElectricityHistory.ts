import { indexedEnergyPriceOf } from "@/application/services/calculationService";
import type { ElectricityInputs } from "@/domain/types/simulation";

type Item = { key: string; valueNumeric: unknown };
export type IndexedHistoryProduct = {
  productKey: string;
  productLabel: string;
  tariffs: Record<string, Record<string, { avg: number; monthly: Record<string, number> } | number>>;
};

// COMPARATIVA LUZ!T20:Y31 and T37:Y48: only these periods are
// displayed, even where Precio TE carries forward a price from another month.
const HISTORY_PERIODS: Record<string, number[][]> = {
  PENINSULA: [[1, 2, 6], [1, 2, 6], [2, 3, 6], [4, 5, 6], [4, 5, 6], [3, 4, 6],
    [1, 2, 6], [3, 4, 6], [3, 4, 6], [4, 5, 6], [2, 3, 6], [1, 2, 6]],
  CANARIAS: [[2, 4, 6], [2, 4, 6], [2, 4, 6], [4, 5, 6], [4, 5, 6], [4, 5, 6],
    [1, 3, 6], [1, 3, 6], [1, 3, 6], [1, 3, 6], [2, 3, 6], [2, 3, 6]],
};

/** Resolve each historical month independently, without borrowing averages or other months. */
export function buildIndexedElectricityHistory(
  items: Item[],
  profile: ElectricityInputs["perfilCarga"] = "NORMAL",
  zone: ElectricityInputs["zonaGeografica"] = "Peninsula",
  labels: Record<string, string> = {},
  energyMargins: Partial<Record<string, number>> = {},
): Record<string, IndexedHistoryProduct> {
  const monthlyPrices = new Map<string, number>();
  const periods = new Map<string, Set<string>>();
  for (const item of items) {
    const match = item.key.match(/^(ELEC:INDEX:[^:]+:[^:]*:[^:]+:P[1-6]):MARGEN:(\d{4}-(?:0[1-9]|1[0-2]))(?=:|$)/);
    if (!match || item.valueNumeric == null || !Number.isFinite(Number(item.valueNumeric))) continue;
    monthlyPrices.set(item.key, Number(item.valueNumeric));
    const months = periods.get(match[1]) ?? new Set<string>();
    months.add(match[2]);
    periods.set(match[1], months);
  }

  const products: Record<string, IndexedHistoryProduct> = {};
  const zoneKey = zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  for (const [baseKey, months] of periods) {
    const [, , product, tier, tariff, period] = baseKey.split(":");
    const productKey = tier ? `${product}:${tier}` : product;
    const monthly: Record<string, number> = {};
    for (const month of [...months].sort()) {
      const monthNumber = Number(month.slice(5));
      const activePeriods = tariff === "2.0TD" ? [1, 2, 3] : HISTORY_PERIODS[zoneKey]?.[monthNumber - 1];
      // Excel's 6.1TD history explicitly looks up 3.0TD for P3 in
      // August, September and November (COMPARATIVA LUZ!V44,V45,V47).
      const sourceKey = tariff === "6.1TD" && period === "P3" && [8, 9, 11].includes(monthNumber)
        ? baseKey.replace(":6.1TD:", ":3.0TD:") : baseKey;
      const value = indexedEnergyPriceOf(monthlyPrices, sourceKey, month, profile ?? "NORMAL", zone);
      if (value === undefined) continue;
      if (activePeriods && !activePeriods.includes(Number(period.slice(1)))) {
        monthly[month] = 0;
        continue;
      }
      const margin = product === "PERSONALIZADA_INDEX" ? (energyMargins[period] ?? 0) * 1.01528 / 1000 : 0;
      monthly[month] = value + margin;
    }
    if (!Object.keys(monthly).length) continue;
    const entry = products[productKey] ??= {
      productKey,
      productLabel: labels[productKey] ?? `${product.replace(/_/g, " ")} ${tier}`.trim(),
      tariffs: {},
    };
    const positive = Object.values(monthly).filter((value) => value > 0);
    (entry.tariffs[tariff] ??= {})[period] = {
      monthly,
      avg: positive.length ? positive.reduce((sum, value) => sum + value, 0) / positive.length : 0,
    };
  }
  return products;
}

/** The date window must come from the resolved product, profile and zone. */
export function latestIndexedHistoryMonth(products: IndexedHistoryProduct[]): Date | undefined {
  const months = products.flatMap((product) => Object.values(product.tariffs)
    .flatMap((periods) => Object.values(periods)
      .flatMap((period) => typeof period === "number" ? [] : Object.keys(period.monthly))));
  const latest = months.sort().at(-1);
  if (!latest) return undefined;
  const [year, month] = latest.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
