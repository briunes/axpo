import { buildSimulationPdfFilenameFromSimulation } from "../pdfFilename";

describe("buildSimulationPdfFilenameFromSimulation", () => {
  it("uses the product, client, and simulation reference when available", () => {
    expect(
      buildSimulationPdfFilenameFromSimulation({
        id: "cmshcf5ohd667d0f632caf173",
        referenceNumber: "00602/2026",
        client: { name: "ALWAYS REVOLUTION SL" },
        payloadJson: { productName: "Estable N2" },
      }),
    ).toBe("simulation-Estable-N2-ALWAYS-REVOLUTION-SL-00602-2026.pdf");
  });

  it("keeps the descriptive UUID fallback for legacy simulations", () => {
    expect(
      buildSimulationPdfFilenameFromSimulation({
        id: "legacy-id",
        referenceNumber: null,
        client: { name: "Example Client" },
        payloadJson: { productName: "Estable N2" },
      }),
    ).toBe("simulation-Estable-N2-Example-Client-legacy-id.pdf");
  });
});
