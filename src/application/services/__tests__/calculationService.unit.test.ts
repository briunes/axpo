import { CalculationService } from "../calculationService";
import type { ElectricityInputs } from "@/domain/types";

function buildSinglePeriodPriceMap() {
  const entries: Array<{ key: string; valueNumeric: number }> = [];

  for (const product of ["1P_PLUS", "1P_PLUS_XL"] as const) {
    for (const tier of ["N1", "N2", "N3"] as const) {
      for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"] as const) {
        entries.push({
          key: `ELEC:FIJO:${product}:${tier}:3.0TD:${period}:ENERGIA`,
          valueNumeric: 0.1,
        });
        entries.push({
          key: `ELEC:FIJO:${product}:${tier}:3.0TD:${period}:POTENCIA`,
          valueNumeric: 36.5,
        });
      }
    }
  }

  return CalculationService.buildPriceMap(entries);
}

function buildInputs(consumoAnual: number): ElectricityInputs {
  return {
    tarifaAcceso: "3.0TD",
    zonaGeografica: "Peninsula",
    perfilCarga: "NORMAL",
    potenciaContratada: { P1: 10, P2: 10, P3: 10, P4: 10, P5: 10, P6: 10 },
    consumo: { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100, P6: 100 },
    excesoPotencia: 0,
    periodo: {
      fechaInicio: "2026-03-01",
      fechaFin: "2026-03-31",
      dias: 31,
    },
    facturaActual: 1000,
    extras: {},
    clientData: { consumoAnual },
  } as ElectricityInputs;
}

describe("CalculationService single-period offer eligibility", () => {
  it("excludes 1P Plus and keeps 1P Plus XL for annual consumption above 50,000", () => {
    const results = CalculationService.calculateElectricity(
      buildInputs(62000),
      buildSinglePeriodPriceMap(),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      false,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(true);
  });

  it("keeps 1P Plus and excludes 1P Plus XL for annual consumption below 50,000", () => {
    const results = CalculationService.calculateElectricity(
      buildInputs(40000),
      buildSinglePeriodPriceMap(),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      true,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(false);
  });
});

describe("CalculationService Personalizada OMIE + B", () => {
  it("applies the Excel B multiplier on top of month-specific Precio TE", () => {
    const inputs = buildInputs(62000);
    inputs.personalizadaOmieB = {
      terminoB: { P1: 2, P2: 2, P3: 2, P4: 2, P5: 2, P6: 2 },
      margenPotencia: {},
    };
    inputs.omieEstimado = {
      P1: 0.001,
      P2: 0.001,
      P3: 0.001,
      P4: 0.001,
      P5: 0.001,
      P6: 0.001,
    };

    const entries: Array<{ key: string; valueNumeric: number }> = [];
    for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"] as const) {
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:${period}:MARGEN:2026-03`,
        valueNumeric: 0.1,
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:${period}:MARGEN`,
        valueNumeric: 0.5,
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:${period}:POTENCIA`,
        valueNumeric: 0,
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:${period}:B_FACTOR:2026-03`,
        valueNumeric: 1.1,
      });
    }

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
    );
    const offer = results.find(
      (item) => item.productKey === "PERSONALIZADA_OMIE_B",
    );

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoEnergia).toBe(61.32);
    expect(offer!.totalFactura).toBe(77.99);
  });
});
