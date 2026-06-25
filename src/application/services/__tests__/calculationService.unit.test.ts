import { CalculationService } from "../calculationService";
import {
  defaultExcelParserProductConfigs,
  withMissingDefaultExcelParserProductConfigs,
} from "@/domain/excelParserProductConfig";
import type { ElectricityInputs, GasInputs } from "@/domain/types";
import type { ProductDefinition } from "@/domain/productRegistry";

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

function buildSinglePeriodP1OnlyPriceMap(tariff = "3.0TD") {
  const entries: Array<{ key: string; valueNumeric: number }> = [];

  for (const product of ["1P_PLUS", "1P_PLUS_XL"] as const) {
    for (const tier of ["N1", "N2", "N3"] as const) {
      entries.push({
        key: `ELEC:FIJO:${product}:${tier}:${tariff}:P1:ENERGIA`,
        valueNumeric: 0.1,
      });
      entries.push({
        key: `ELEC:FIJO:${product}:${tier}:${tariff}:P1:POTENCIA`,
        valueNumeric: 36.5,
      });
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

describe("Excel parser product defaults", () => {
  it("include gas fixed and indexed products for both scopes", () => {
    for (const scope of ["GLOBAL", "TLV"] as const) {
      const defaults = defaultExcelParserProductConfigs(scope);

      expect(
        defaults.some(
          (item) =>
            item.commodity === "GAS" &&
            item.pricingType === "FIXED" &&
            item.productKey === "FIJO",
        ),
      ).toBe(true);
      expect(
        defaults.some(
          (item) =>
            item.commodity === "GAS" &&
            item.pricingType === "INDEXED" &&
            item.productKey === "INDEXADO",
        ),
      ).toBe(true);
    }
  });

  it("does not re-enable an existing disabled parser config row", () => {
    const disabledEstable = {
      ...defaultExcelParserProductConfigs("TLV").find(
        (item) =>
          item.commodity === "ELECTRICITY" &&
          item.pricingType === "FIXED" &&
          item.sourceLabel === "ESTABLE",
      )!,
      id: "existing-estable",
      enabled: false,
    };

    const merged = withMissingDefaultExcelParserProductConfigs("TLV", [
      disabledEstable,
    ]);
    const stableRows = merged.filter(
      (item) =>
        item.commodity === "ELECTRICITY" &&
        item.pricingType === "FIXED" &&
        item.sourceLabel === "ESTABLE",
    );

    expect(stableRows).toHaveLength(1);
    expect(stableRows[0].enabled).toBe(false);
  });
});

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

  it("keeps 1P Plus XL when annual consumption is saved as a numeric string", () => {
    const inputs = buildInputs(51000) as ElectricityInputs & {
      clientData: { consumoAnual: string };
    };
    inputs.clientData.consumoAnual = "51000";

    const results = CalculationService.calculateElectricity(
      inputs,
      buildSinglePeriodPriceMap(),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      false,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(true);
  });

  it("does not infer annual consumption from a billing period when it is missing", () => {
    const inputs = buildInputs(51000);
    delete (inputs as ElectricityInputs & { clientData?: unknown }).clientData;
    inputs.periodo.dias = 30;
    inputs.consumo = {
      P1: 700,
      P2: 700,
      P3: 700,
      P4: 700,
      P5: 700,
      P6: 691.78,
    };

    const results = CalculationService.calculateElectricity(
      inputs,
      buildSinglePeriodPriceMap(),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      true,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(false);
  });

  it("treats explicit zero annual consumption like the Excel input", () => {
    const results = CalculationService.calculateElectricity(
      buildInputs(0),
      buildSinglePeriodPriceMap(),
      { baseValueScope: "TLV" },
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      true,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(false);
  });

  it("does not borrow single-period prices from another access tariff", () => {
    const inputs = buildInputs(51000);
    inputs.tarifaAcceso = "6.1TD";

    const results = CalculationService.calculateElectricity(
      inputs,
      buildSinglePeriodP1OnlyPriceMap("3.0TD"),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      false,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(false);
  });

  it("uses same-tariff P1 single-period prices across periods", () => {
    const inputs = buildInputs(51000);
    inputs.tarifaAcceso = "6.1TD";

    const results = CalculationService.calculateElectricity(
      inputs,
      buildSinglePeriodP1OnlyPriceMap("6.1TD"),
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      false,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(true);
  });

  it("uses TLV annual-consumption thresholds when base value scope is TLV", () => {
    const results = CalculationService.calculateElectricity(
      buildInputs(120000),
      buildSinglePeriodPriceMap(),
      { baseValueScope: "TLV" },
    );

    expect(results.some((item) => item.productKey.startsWith("1P_PLUS:"))).toBe(
      false,
    );
    expect(
      results.some((item) => item.productKey.startsWith("1P_PLUS_XL:")),
    ).toBe(true);
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

describe("CalculationService gas product configuration", () => {
  it("uses configured gas product definitions when provided", () => {
    const inputs: GasInputs = {
      tarifaAcceso: "RL01",
      zonaGeografica: "Peninsula",
      consumo: 1000,
      periodo: {
        fechaInicio: "2026-03-01",
        fechaFin: "2026-03-31",
        dias: 31,
      },
      facturaActual: 500,
      extras: {},
    } as GasInputs;
    const map = CalculationService.buildPriceMap([
      {
        key: "GAS:FIJO:FIJO:N1:RL01:PEN:ENERGIA",
        valueNumeric: 0.05,
      },
      {
        key: "GAS:FIJO:FIJO:N1:RL01:TERMINO_DIA",
        valueNumeric: 0.2,
      },
      {
        key: "GAS:FIJO:ESTABLE_PLUS:N1:RL01:PEN:ENERGIA",
        valueNumeric: 0.04,
      },
      {
        key: "GAS:FIJO:ESTABLE_PLUS:N1:RL01:TERMINO_DIA",
        valueNumeric: 0.2,
      },
    ]);
    const productDefinitions: ProductDefinition[] = [
      {
        productKey: "ESTABLE_PLUS",
        displayName: "Gas Estable Plus",
        commodity: "GAS",
        pricingType: "FIXED",
        tiers: ["N1"],
      },
    ];

    const results = CalculationService.calculateGas(inputs, map, {
      productDefinitions,
    });

    expect(results.some((item) => item.productKey === "FIJO:N1")).toBe(false);
    expect(results.some((item) => item.productKey === "ESTABLE_PLUS:N1")).toBe(
      true,
    );
  });
});
