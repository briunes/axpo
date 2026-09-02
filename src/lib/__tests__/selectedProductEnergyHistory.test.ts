import {
  buildSelectedProductEnergyHistory,
  selectedProductEnergyKeyPrefixes,
} from "../selectedProductEnergyHistory";

describe("buildSelectedProductEnergyHistory", () => {
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
