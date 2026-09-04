import type { SimulationPayload } from "@/domain/types/simulation";

type BaseValueItem = { key: string; valueNumeric: unknown };

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
  return ["FIJO", "INDEX"].map(
    (pricing) => `${commodity}:${pricing}:${product}:${tier}:${tariff}:`,
  );
}

export function buildSelectedProductEnergyHistory(
  payload: SimulationPayload | null | undefined,
  items: BaseValueItem[],
): { productKey: string; tariffs: Record<string, Record<string, unknown>> } | null {
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

  for (const item of items) {
    const parts = item.key.split(":");
    if (
      parts.length < 7 ||
      parts[0] !== (isGas ? "GAS" : "ELEC") ||
      (parts[1] !== "FIJO" && parts[1] !== "INDEX") ||
      parts[2] !== product ||
      parts[3] !== tier ||
      parts[4] !== tariff
    ) continue;

    const period = parts[5];
    const value = Number(item.valueNumeric) || 0;
    if (isGas && (parts[6] === "ENERGIA" || parts[6] === "MARGEN")) {
      tariffValues[period] = value;
    } else if (!isGas && parts[1] === "FIJO" && parts[6] === "ENERGIA") {
      const itemZone = parts[7] === "ZONE" ? parts[8] : undefined;
      if (itemZone && itemZone !== electricityZone) continue;
      const priority = itemZone ? 2 : 1;
      if ((fixedPeriodPriorities[period] ?? 0) <= priority) {
        tariffValues[period] = value;
        fixedPeriodPriorities[period] = priority;
      }
    } else if (!isGas && parts[1] === "INDEX" && parts[6] === "MARGEN") {
      const current =
        typeof tariffValues[period] === "object" && tariffValues[period] !== null
          ? tariffValues[period] as { avg: number; monthly: Record<string, number> }
          : { avg: 0, monthly: {} };
      if (parts[7]) current.monthly[parts[7]] = value;
      else current.avg = value;
      tariffValues[period] = current;
    }
  }

  if (Object.keys(tariffValues).length === 0) return null;
  return { productKey: selectedKey, tariffs: { [tariff]: tariffValues } };
}
