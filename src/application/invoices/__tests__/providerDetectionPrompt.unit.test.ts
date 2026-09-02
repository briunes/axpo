import { buildProviderDetectionPrompt } from "../providerDetectionPrompt";

describe("buildProviderDetectionPrompt", () => {
  const prompt = buildProviderDetectionPrompt("- Endesa (slug: endesa)");

  it("counts only electricity and gas supply invoices", () => {
    expect(prompt).toContain("ENERGY SUPPLY INVOICE COUNT");
    expect(prompt).toContain(
      "invoiceCount must be this energy-supply invoice count",
    );
  });

  it("does not treat an Endesa service invoice as another supply invoice", () => {
    expect(prompt).toContain('"factura de servicios"');
    expect(prompt).toContain("This is ONE energy supply invoice");
  });

  it("still counts distinct supply invoices from the same provider or customer", () => {
    expect(prompt).toContain(
      "including when invoices have the same provider, customer, supply point, or commodity",
    );
    expect(prompt).toContain(
      "two distinct electricity/gas supply invoices, return invoiceCount: 2",
    );
  });
});
