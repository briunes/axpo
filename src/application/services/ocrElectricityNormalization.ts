export interface OcrElectricityPowerData {
  tarifaAcceso?: string;
  potenciaP1?: number;
  potenciaP2?: number;
  potenciaP3?: number;
  potenciaP4?: number;
  potenciaP5?: number;
  potenciaP6?: number;
  precioPotenciaP1?: number;
  precioPotenciaP2?: number;
  precioPotenciaP3?: number;
  precioPotenciaP4?: number;
  precioPotenciaP5?: number;
  precioPotenciaP6?: number;
}

function isPresent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function is20Td(tariff?: string): boolean {
  return (tariff ?? "").toUpperCase().replace(/\s+/g, "") === "2.0TD";
}

/**
 * Normalizes supplier invoice labels into the simulator's canonical 2.0TD
 * power periods (P1 and P2).
 *
 * Some suppliers, including Factor Energia, print the valley contracted power
 * in the P3 row of the three-period energy table. For 2.0TD that value is the
 * second power term, so it must be stored as P2 by the simulator.
 *
 * Deliberately do not guess for any other period combination. Unexpected
 * combinations remain visible in the OCR review form for manual correction.
 */
export function normalizeOcr20TdPowerPeriods<T extends OcrElectricityPowerData>(
  data: T,
): T {
  if (!is20Td(data.tarifaAcceso)) return data;

  const hasP1 = isPresent(data.potenciaP1);
  const hasP2 = isPresent(data.potenciaP2);
  const hasP3 = isPresent(data.potenciaP3);
  const hasLaterPower = [
    data.potenciaP4,
    data.potenciaP5,
    data.potenciaP6,
  ].some(isPresent);

  if (!hasP1 || hasP2 || !hasP3 || hasLaterPower) return data;

  return {
    ...data,
    potenciaP2: data.potenciaP3,
    potenciaP3: undefined,
    precioPotenciaP2: isPresent(data.precioPotenciaP2)
      ? data.precioPotenciaP2
      : data.precioPotenciaP3,
    precioPotenciaP3: undefined,
  };
}
