import type { SimulationPayload } from "@/domain/types/simulation";
import { indexedEnergyPriceOf } from "@/application/services/calculationService";

type BaseValueItem = { key: string; valueNumeric: unknown };

/** Resolve display prices with the same month, profile and zone lookup as billing. */
export function selectedIndexedEnergyPrices(
  payload: SimulationPayload | null | undefined,
  items: BaseValueItem[],
): Record<string, number> | undefined {
  const electricity = payload?.electricity;
  const selectedKey = payload?.selectedOffer?.productKey;
  if (!electricity || !selectedKey || selectedKey.includes("PERSONALIZADA")) return undefined;
  const [product, tier] = selectedKey.split(":");
  const tariff = product === "DINAMICA_CONTROL_TECHO" && tier === "N3" && electricity.tarifaAcceso === "6.1TD"
    ? "3.0TD" : electricity.tarifaAcceso;
  const prefix = `ELEC:INDEX:${product}:${tier}:${tariff}:`;
  if (!items.some((item) => item.key.startsWith(prefix))) return undefined;
  const map = new Map(items.filter((item) => item.valueNumeric != null).map((item) => [item.key, Number(item.valueNumeric)]));
  const month = electricity.billingMonth ?? electricity.periodo?.fechaFin?.slice(0, 7);
  if (!month) return {};
  const prices: Record<string, number> = {};
  for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"]) {
    const price = indexedEnergyPriceOf(map, `${prefix}${period}`, month,
      electricity.perfilCarga ?? "NORMAL", electricity.zonaGeografica ?? "Peninsula");
    if (price !== undefined) prices[period] = price;
  }
  return prices;
}

export function selectedProductEnergyKeyPrefixes(
  payload: SimulationPayload | null | undefined,
): string[] {
  const selectedKey = payload?.selectedOffer?.productKey?.trim();
  if (!selectedKey || selectedKey.includes("PERSONALIZADA")) return [];
  const isGas = payload?.selectedOffer?.commodity === "GAS";
  const tariff = isGas
    ? payload?.gas?.tarifaAcceso
    : payload?.electricity?.tarifaAcceso;
  if (!tariff) return [];
  const parts = selectedKey.split(":");
  const normalized = isGas && parts[0] === "GAS" ? parts.slice(1) : parts;
  if (normalized.length < 2) return [];
  const [product, tier] = normalized;
  const commodity = isGas ? "GAS" : "ELEC";
  const energyTariff = product === "DINAMICA_CONTROL_TECHO" && tier === "N3" && tariff === "6.1TD" ? "3.0TD" : tariff;
  return ["FIJO", "INDEX"].map(
    (pricing) => `${commodity}:${pricing}:${product}:${tier}:${energyTariff}:`,
  );
}

/**
 * Builds the small history object consumed by the PDF variable replacer for the
 * selected offer only. Keeping this based on the simulation's snapshotted base
 * value set makes public/shared PDFs reproducible after prices are updated.
 */
export function buildSelectedProductEnergyHistory(
  payload: SimulationPayload | null | undefined,
  items: BaseValueItem[],
): { productKey: string; tariffs: Record<string, Record<string, unknown>>; selectedEnergyPrices?: Record<string, number> } | null {
  const selectedKey = payload?.selectedOffer?.productKey?.trim();
  if (!selectedKey) return null;

  const isGas = payload?.selectedOffer?.commodity === "GAS";
  const tariff = isGas
    ? payload?.gas?.tarifaAcceso
    : payload?.electricity?.tarifaAcceso;
  if (!tariff) return null;

  const keyParts = selectedKey.split(":");
  const normalizedParts = isGas && keyParts[0] === "GAS" ? keyParts.slice(1) : keyParts;
  if (normalizedParts.length < 2) return null;
  const [product, tier] = normalizedParts;
  const tariffValues: Record<string, unknown> = {};
  const electricityZone = String(payload?.electricity?.zonaGeografica ?? "PENINSULA")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const fixedPeriodPriorities: Record<string, number> = {};

  if (isGas) {
    for (const item of items) {
      const parts = item.key.split(":");
      if (
        parts.length === 7 &&
        parts[0] === "GAS" &&
        (parts[1] === "FIJO" || parts[1] === "INDEX") &&
        parts[2] === product &&
        parts[3] === tier &&
        parts[4] === tariff &&
        (parts[6] === "ENERGIA" || parts[6] === "MARGEN")
      ) {
        tariffValues[parts[5]] = Number(item.valueNumeric) || 0;
      }
    }
  } else {
    for (const item of items) {
      const parts = item.key.split(":");
      if (
        parts.length >= 7 &&
        parts[0] === "ELEC" &&
        (parts[1] === "FIJO" || parts[1] === "INDEX") &&
        parts[2] === product &&
        parts[3] === tier &&
        parts[4] === tariff
      ) {
        const period = parts[5];
        const value = Number(item.valueNumeric) || 0;
        if (parts[1] === "FIJO" && parts[6] === "ENERGIA") {
          const itemZone = parts[7] === "ZONE" ? parts[8] : undefined;
          if (itemZone && itemZone !== electricityZone) continue;
          const priority = itemZone ? 2 : 1;
          if ((fixedPeriodPriorities[period] ?? 0) <= priority) {
            tariffValues[period] = value;
            fixedPeriodPriorities[period] = priority;
          }
        } else if (parts[1] === "INDEX" && parts[6] === "MARGEN") {
          const current =
            typeof tariffValues[period] === "object" && tariffValues[period] !== null
              ? (tariffValues[period] as { avg: number; monthly: Record<string, number> })
              : { avg: 0, monthly: {} };
          if (parts[7]) current.monthly[parts[7]] = value;
          else current.avg = value;
          tariffValues[period] = current;
        }
      }
    }
  }

  const selectedEnergyPrices = isGas ? undefined : selectedIndexedEnergyPrices(payload, items);
  if (Object.keys(tariffValues).length === 0 && selectedEnergyPrices === undefined) return null;
  return { productKey: selectedKey, tariffs: { [tariff]: tariffValues },
    ...(selectedEnergyPrices !== undefined ? { selectedEnergyPrices } : {}) };
}
