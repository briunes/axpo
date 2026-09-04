import {
  buildSelectedProductEnergyHistory,
  selectedProductEnergyKeyPrefixes,
} from "../selectedProductEnergyHistory";

describe("buildSelectedProductEnergyHistory", () => {
  it("loads the selected fixed electricity offer from the correct zone", () => {
    const history = buildSelectedProductEnergyHistory(
      {
        type: "ELECTRICITY",
        electricity: { tarifaAcceso: "3.0TD", zonaGeografica: "Peninsula" },
        selectedOffer: { productKey: "1P_PLUS:N2", commodity: "ELECTRICITY" },
      } as any,
      [
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA", valueNumeric: 0.999999 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA:ZONE:BALEARES", valueNumeric: 0.192308 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P1:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.162328 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P2:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.162328 },
        { key: "ELEC:FIJO:1P_PLUS:N2:3.0TD:P3:ENERGIA:ZONE:PENINSULA", valueNumeric: 0.162328 },
      ],
    );

    expect(history).toEqual({
      productKey: "1P_PLUS:N2",
      tariffs: {
        "3.0TD": { P1: 0.162328, P2: 0.162328, P3: 0.162328 },
      },
    });
  });

  it("limits database lookups to the selected product and tariff", () => {
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
