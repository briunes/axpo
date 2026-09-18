import reference from "./fixtures/personalizada-index-history.json";
import { buildIndexedElectricityHistory, latestIndexedHistoryMonth } from "../indexedElectricityHistory";

const base = "ELEC:INDEX:DINAMICA:N3:2.0TD:P1:MARGEN";
const item = (suffix: string, valueNumeric: number | null) => ({ key: `${base}${suffix}`, valueNumeric });

describe("indexed electricity history", () => {
  it("matches all 180 monthly cells and 15 means in the reported Excel PDF", () => {
    const items = reference.baseRows.flatMap((row) => row.values.map((valueNumeric, i) => ({
      key: `ELEC:INDEX:PERSONALIZADA_INDEX::${row.tariff}:P${i + 1}:MARGEN:${row.month}:ZONE:PENINSULA`, valueNumeric,
    })));
    const history = buildIndexedElectricityHistory(items, "NORMAL", "Peninsula", {},
      { P1: 5, P2: 5, P3: 5, P4: 5, P5: 5, P6: 5 });
    const product = history.PERSONALIZADA_INDEX;
    for (const row of reference.expectedRows) {
      row.values.forEach((expected, i) => {
        const period = product.tariffs[row.tariff][`P${i + 1}`];
        expect(typeof period).toBe("object");
        if (typeof period !== "number") expect(period.monthly[row.month]).toBeCloseTo(expected, 8);
      });
    }
    for (const [tariff, means] of Object.entries(reference.expectedMeans)) {
      means.forEach((expected, i) => {
        const period = product.tariffs[tariff][`P${i + 1}`];
        if (typeof period !== "number") expect(Number(period.avg.toFixed(4))).toBe(expected);
      });
    }
    expect(latestIndexedHistoryMonth([product])).toEqual(new Date(2026, 7, 1));
    expect(JSON.stringify(product)).not.toContain("2026-09");
    expect(JSON.stringify(product)).toContain("2025-09");
  });

  it("keeps NORMAL final prices separate from other profiles and zones regardless of item order", () => {
    const items = [
      item(":2026-07:ZONE:PENINSULA", 0.192046464),
      item(":2026-07:PROFILE:NORMAL:ZONE:PENINSULA", 0.1),
      item(":2026-07:PROFILE:DIURNO:ZONE:PENINSULA", 0.14),
      item(":2026-07:ZONE:CANARIAS", 0.8),
      item(":2026-07:PROFILE:DIURNO:ZONE:CANARIAS", 0.9),
      item(":ZONE:PENINSULA", 0.3),
    ];
    for (const ordered of [items, [...items].reverse()]) {
      const normal = buildIndexedElectricityHistory(ordered, "NORMAL", "Peninsula");
      expect(normal["DINAMICA:N3"].tariffs["2.0TD"].P1).toEqual({ avg: 0.192046464, monthly: { "2026-07": 0.192046464 } });
      const diurno = buildIndexedElectricityHistory(ordered, "DIURNO", "Peninsula");
      expect(diurno["DINAMICA:N3"].tariffs["2.0TD"].P1).toEqual({ avg: 0.14, monthly: { "2026-07": 0.14 } });
    }
  });

  it("ends in August despite September data for another zone or commodity", () => {
    const items = [item(":2025-09:ZONE:PENINSULA", 0.1), item(":2026-08:ZONE:PENINSULA", 0.2),
      item(":2026-09:ZONE:CANARIAS", 0.9),
      { key: "GAS:INDEX:DINAMICA:N3:RL1:PEN:MARGEN:2026-09", valueNumeric: 0.7 }];
    const history = buildIndexedElectricityHistory(items);
    expect(latestIndexedHistoryMonth(Object.values(history))).toEqual(new Date(2026, 7, 1));
    expect(history["DINAMICA:N3"].tariffs["2.0TD"].P1).toEqual({ avg: 0.15000000000000002, monthly: { "2025-09": 0.1, "2026-08": 0.2 } });
  });

  it("preserves genuine zero prices and missing months without filling from averages", () => {
    const history = buildIndexedElectricityHistory([item("", 0.9), item(":2026-07", 0), item(":2026-08", null)]);
    expect(history["DINAMICA:N3"].tariffs["2.0TD"].P1).toEqual({ avg: 0, monthly: { "2026-07": 0 } });
    expect(latestIndexedHistoryMonth(Object.values(history))).toEqual(new Date(2026, 6, 1));
    expect(latestIndexedHistoryMonth([])).toBeUndefined();
  });

  it("covers every tariff and period independently and keeps product-specific dates", () => {
    const items = ["2.0TD", "3.0TD", "6.1TD"].flatMap((tariff) =>
      Array.from({ length: tariff === "2.0TD" ? 3 : 6 }, (_, i) => ({
        key: `ELEC:INDEX:DINAMICA:N3:${tariff}:P${i + 1}:MARGEN:2026-08:PROFILE:NORMAL:ZONE:PENINSULA`, valueNumeric: (i + 1) / 10,
      })));
    items.push({ key: "ELEC:INDEX:DINAMICA:N2:3.0TD:P1:MARGEN:2026-09", valueNumeric: 0.9 });
    const history = buildIndexedElectricityHistory(items);
    expect(Object.keys(history["DINAMICA:N3"].tariffs)).toHaveLength(3);
    expect(history["DINAMICA:N3"].tariffs["6.1TD"].P6).toEqual({ avg: 0.6, monthly: { "2026-08": 0.6 } });
    expect(latestIndexedHistoryMonth([history["DINAMICA:N3"]])).toEqual(new Date(2026, 7, 1));
  });
});
