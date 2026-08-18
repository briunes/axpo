import { resolveSelectedHistoryProduct } from "../historyProductSelection";

describe("resolveSelectedHistoryProduct", () => {
  it("prefers the exact selected product for the current commodity", () => {
    const products = [
      { productKey: "ESTABLE:N1", productLabel: "Estable N1" },
      { productKey: "ESTABLE:N2", productLabel: "Estable N2" },
      { productKey: "ESTABLE:N3", productLabel: "Estable N3" },
    ];

    expect(
      resolveSelectedHistoryProduct(products, {
        productKey: "ESTABLE:N2",
        commodity: "ELECTRICITY",
      }),
    ).toMatchObject({ productKey: "ESTABLE:N2" });
  });

  it("uses the gas history catalog when the selected offer is gas", () => {
    const gasProducts = [
      {
        productKey: "GAS:INDEX:FIJO:N1",
        productLabel: "Gas Fijo N1",
        type: "GAS",
      },
      {
        productKey: "GAS:INDEX:FIJO:N2",
        productLabel: "Gas Fijo N2",
        type: "GAS",
      },
      {
        productKey: "GAS:INDEX:FIJO:N3",
        productLabel: "Gas Fijo N3",
        type: "GAS",
      },
    ];

    expect(
      resolveSelectedHistoryProduct(gasProducts, {
        productKey: "GAS:INDEX:FIJO:N2",
        commodity: "GAS",
      }),
    ).toMatchObject({ productKey: "GAS:INDEX:FIJO:N2" });
  });

  it("falls back to the tier match instead of the first product when the exact key is missing", () => {
    const products = [
      { productKey: "ESTABLE:N1", productLabel: "Estable N1" },
      { productKey: "ESTABLE:N3", productLabel: "Estable N3" },
      { productKey: "ESTABLE_PLUS:N2", productLabel: "Estable Plus N2" },
    ];

    expect(
      resolveSelectedHistoryProduct(products, {
        productKey: "ESTABLE:N2",
        commodity: "ELECTRICITY",
      }),
    ).toMatchObject({ productKey: "ESTABLE_PLUS:N2" });
  });
});
