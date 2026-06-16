import { extractVariableValues } from "../variableReplacer";

describe("extractVariableValues", () => {
  it("exposes the human-readable simulation reference", () => {
    const variables = extractVariableValues({
      id: "simulation-id",
      referenceNumber: "00176/2026",
    });

    expect(variables.SIMULATION_REFERENCE).toBe("00176/2026");
  });

  it("falls back to the simulation id when no reference exists", () => {
    const variables = extractVariableValues({
      id: "simulation-id",
      referenceNumber: null,
    });

    expect(variables.SIMULATION_REFERENCE).toBe("simulation-id");
  });
});
