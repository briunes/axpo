import { normalizeOcr20TdPowerPeriods } from "../ocrElectricityNormalization";

describe("normalizeOcr20TdPowerPeriods", () => {
  it("maps the confirmed 2.0TD P1 + P3 invoice layout to canonical P1 + P2", () => {
    const result = normalizeOcr20TdPowerPeriods({
      tarifaAcceso: "2.0 TD",
      potenciaP1: 10.392,
      potenciaP3: 10.392,
      precioPotenciaP1: 2.308701,
      precioPotenciaP3: 0.060452,
    });

    expect(result).toEqual({
      tarifaAcceso: "2.0 TD",
      potenciaP1: 10.392,
      potenciaP2: 10.392,
      potenciaP3: undefined,
      precioPotenciaP1: 2.308701,
      precioPotenciaP2: 0.060452,
      precioPotenciaP3: undefined,
    });
  });

  it("leaves the standard 2.0TD P1 + P2 representation unchanged", () => {
    const input = {
      tarifaAcceso: "2.0TD",
      potenciaP1: 4.6,
      potenciaP2: 5.75,
    };

    expect(normalizeOcr20TdPowerPeriods(input)).toBe(input);
  });

  it.each([
    { potenciaP1: 10, potenciaP4: 10 },
    { potenciaP2: 10, potenciaP3: 10 },
    { potenciaP1: 10 },
    { potenciaP1: 10, potenciaP2: 10, potenciaP3: 10 },
  ])("does not guess for an unexpected 2.0TD layout: %o", (periods) => {
    const input = { tarifaAcceso: "2.0TD", ...periods };

    expect(normalizeOcr20TdPowerPeriods(input)).toBe(input);
  });

  it("does not alter P1 + P3 on tariffs with six power periods", () => {
    const input = {
      tarifaAcceso: "3.0TD",
      potenciaP1: 20,
      potenciaP3: 30,
      precioPotenciaP3: 1.25,
    };

    expect(normalizeOcr20TdPowerPeriods(input)).toBe(input);
  });
});
