import {
  buildSelectedProductEnergyHistory,
  selectedProductEnergyKeyPrefixes,
  selectedIndexedEnergyPrices,
} from "../selectedProductEnergyHistory";
import { extractVariableValues } from "@/infrastructure/pdf/variableReplacer";

describe("buildSelectedProductEnergyHistory", () => {
  it("matches native Excel's June proposal, preserving zero prices and all six periods", () => {
    // COMPARATIVA LUZ!I48:N48, evaluated in Excel with the reported invoice:
    // 3.0TD / Peninsula / DIURNO / JUNIO-26 / DINAMICA CONTROL N3.
    const payload = indexedPayload("2026-06", "DIURNO");
    payload.electricity.zonaGeografica = "Peninsula";
    payload.selectedOffer.productKey = "DINAMICA_CONTROL:N3";
    payload.results.electricity[0].productKey = "DINAMICA_CONTROL:N3";
    payload.electricity.consumo = { P1: 12089, P2: 7985, P3: 0, P4: 0, P5: 0, P6: 12719 };
    const items = [0, 0, 0.1, 0.1, 0, 0.080516356616].map((valueNumeric, i) => ({
      key: `ELEC:INDEX:DINAMICA_CONTROL:N3:3.0TD:P${i + 1}:MARGEN:2026-06:PROFILE:DIURNO:ZONE:PENINSULA`, valueNumeric,
    }));
    const history = buildSelectedProductEnergyHistory(payload, items);
    const variables = extractVariableValues({ id: "test" }, payload, undefined, undefined, undefined, "es", history);
    const html = variables.SELECTED_PRODUCT_ENERGY_TABLE;
    expect(html.match(/asim-energy-price-label">P[1-6]/g)).toHaveLength(6);
    expect(html.match(/>0 €\/kWh/g)).toHaveLength(5);
    expect(html).toContain("0,080516 €/kWh");
    expect(html).not.toContain("0,1 €/kWh");
  });
  const indexedPayload = (month: string, profile = "NORMAL"): any => ({
    electricity: {
      tarifaAcceso: "3.0TD", zonaGeografica: "Canarias", perfilCarga: profile,
      billingMonth: month,
      periodo: { fechaInicio: "2026-01-01", fechaFin: "2026-01-31", dias: 31 },
      consumo: { P6: 100 }, potenciaContratada: {}, facturaActual: 100,
    },
    selectedOffer: { productKey: "DINAMICA:N2", commodity: "ELECTRICITY" },
    results: { electricity: [{ productKey: "DINAMICA:N2", desglose: { terminoEnergia: 100 } }] },
  });
  const prefix = "ELEC:INDEX:DINAMICA:N2:3.0TD:P6:MARGEN";
  const indexedItems = [
    { key: `${prefix}:2026-05:ZONE:CANARIAS`, valueNumeric: 0.127606397 },
    { key: `${prefix}:2026-06:ZONE:CANARIAS`, valueNumeric: 0.1425324106 },
    { key: `${prefix}:2026-07:ZONE:CANARIAS`, valueNumeric: 0.1857999722 },
    { key: `${prefix}:2026-05:PROFILE:DIURNO:ZONE:CANARIAS`, valueNumeric: 0.15 },
    { key: `${prefix}:2026-05:PROFILE:NORMAL:ZONE:CANARIAS`, valueNumeric: 0.05 },
    { key: `${prefix}:2026-05:ZONE:PENINSULA`, valueNumeric: 0.99 },
    { key: `${prefix}:ZONE:CANARIAS`, valueNumeric: 0.1236486545 },
  ];

  it.each([
    ["2026-05", "0,127606"], ["2026-06", "0,142532"], ["2026-07", "0,1858"],
  ])("renders the actual monthly price for %s instead of the zone average", (month, expected) => {
    const payload = indexedPayload(month);
    const history = buildSelectedProductEnergyHistory(payload, indexedItems);
    const variables = extractVariableValues({ id: "test" }, payload, undefined, undefined, undefined, "es", history);
    expect(variables.SELECTED_PRODUCT_ENERGY_TABLE).toContain(`${expected} €/kWh`);
    expect(variables.SELECTED_PRODUCT_ENERGY_TABLE).not.toContain("0,123649");
  });

  it("respects profile, date fallback and item order", () => {
    const payload = indexedPayload("2026-05", "DIURNO");
    expect(selectedIndexedEnergyPrices(payload, [...indexedItems].reverse())?.P6).toBe(0.15);
    delete payload.electricity.billingMonth;
    payload.electricity.periodo.fechaFin = "2026-05-31";
    expect(selectedIndexedEnergyPrices(payload, indexedItems)?.P6).toBe(0.15);
  });

  it("preserves zero monthly prices and does not borrow another zone", () => {
    expect(selectedIndexedEnergyPrices(indexedPayload("2026-05"), [
      { key: `${prefix}:2026-05:ZONE:CANARIAS`, valueNumeric: 0 },
      { key: prefix, valueNumeric: 0.4 },
    ])?.P6).toBe(0);
    expect(selectedIndexedEnergyPrices(indexedPayload("2026-05"), [
      { key: `${prefix}:2026-05:ZONE:PENINSULA`, valueNumeric: 0.9 },
    ])).toEqual({});
  });

  it("uses the calculation's special 3.0TD energy block for Control Techo N3 6.1TD", () => {
    const payload = indexedPayload("2026-05");
    payload.selectedOffer.productKey = "DINAMICA_CONTROL_TECHO:N3";
    payload.electricity.tarifaAcceso = "6.1TD";
    const items = [{ key: "ELEC:INDEX:DINAMICA_CONTROL_TECHO:N3:3.0TD:P6:MARGEN:2026-05:ZONE:CANARIAS", valueNumeric: 0.2 }];
    expect(selectedProductEnergyKeyPrefixes(payload)).toContain("ELEC:INDEX:DINAMICA_CONTROL_TECHO:N3:3.0TD:");
    expect(buildSelectedProductEnergyHistory(payload, items)?.selectedEnergyPrices).toEqual({ P6: 0.2 });
  });

  it("loads the selected fixed electricity offer from snapshotted base values", () => {
    const history = buildSelectedProductEnergyHistory(
      {
        type: "ELECTRICITY",
        electricity: { tarifaAcceso: "3.0TD" },
        selectedOffer: { productKey: "1P_PLUS:N2", commodity: "ELECTRICITY" },
      } as any,
      [
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA", valueNumeric: 0.999999 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA:ZONE:BALEARES", valueNumeric: 0.192308 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.177527 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P2:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.177527 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P3:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.177527 },
        { key: "ELEC:FIJO:ESTABLE:N2:3.0TD:P1:ENERGIA", valueNumeric: 9.99 },
      ],
    );

    expect(history).toEqual({
      productKey: "1P_PLUS:N2",
      tariffs: {
        "3.0TD": { P1: 0.177527, P2: 0.177527, P3: 0.177527 },
      },
    });
  });

  it("limits the shared-PDF query to the selected product and tariff", () => {
    expect(
      selectedProductEnergyKeyPrefixes({
        type: "ELECTRICITY",
        electricity: { tarifaAcceso: "3.0TD" },
        selectedOffer: { productKey: "1P_PLUS:N2", commodity: "ELECTRICITY" },
      } as any),
    ).toEqual([
      "ELEC:FIJO:1P_PLUS:N2:3.0TD:",
      "ELEC:INDEX:1P_PLUS:N2:3.0TD:",
    ]);
  });
});
