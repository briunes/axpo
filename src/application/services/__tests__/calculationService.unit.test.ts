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

describe("CalculationService Personalizada Index", () => {
  it("matches the TRITURADOS Excel personalized totals for May 2026", () => {
    const inputs = buildInputs(1175566);
    inputs.tarifaAcceso = "6.1TD";
    inputs.periodo = {
      fechaInicio: "2026-04-30",
      fechaFin: "2026-05-31",
      dias: 32,
    };
    inputs.billingMonth = "2026-05";
    inputs.facturaActual = 16876.9;
    inputs.extras = {
      otrosCargos: 0.59,
      ivaTasa: 21,
      impuestoElectricoTasa: 5.11,
    };
    inputs.consumo = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 20293,
      P5: 15108,
      P6: 103598,
    };
    inputs.potenciaContratada = {
      P1: 410,
      P2: 410,
      P3: 410,
      P4: 410,
      P5: 410,
      P6: 1000,
    };
    inputs.omieEstimado = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0,
    };
    inputs.personalizadaIndex = {
      margenEnergia: { P1: 12, P2: 12, P3: 12, P4: 12, P5: 12, P6: 12 },
      margenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
    };
    inputs.personalizadaOmieB = {
      terminoB: {
        P1: 25.024,
        P2: 25.852,
        P3: 26.621,
        P4: 27.786,
        P5: 28.866,
        P6: 27.079,
      },
      margenPotencia: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 },
    };

    const powerPrices = {
      P1: 29.595368,
      P2: 15.514709,
      P3: 6.801881,
      P4: 5.393829,
      P5: 2.125113,
      P6: 1.004181,
    };
    const indexPrices = {
      P1: 0,
      P2: 0,
      P3: 0.0821337598,
      P4: 0.0635630841,
      P5: 0.0591062127,
      P6: 0.0647711093,
    };
    const omieBBasePrices = {
      P1: 0,
      P2: 0,
      P3: 0.0529599404,
      P4: 0.0243378218,
      P5: 0.0202027352,
      P6: 0.025253433,
    };
    const omieBFactors = {
      P1: 1,
      P2: 1,
      P3: 1,
      P4: 1.0758561394,
      P5: 1.0630540058,
      P6: 1.0928812936,
    };

    const entries: Array<{ key: string; valueNumeric: number }> = [];
    for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"] as const) {
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_INDEX::6.1TD:${period}:MARGEN:2026-05`,
        valueNumeric: indexPrices[period] - (12 * 1.01528) / 1000,
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_INDEX::6.1TD:${period}:POTENCIA`,
        valueNumeric: powerPrices[period],
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::6.1TD:${period}:MARGEN:2026-05`,
        valueNumeric: omieBBasePrices[period],
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::6.1TD:${period}:POTENCIA`,
        valueNumeric: powerPrices[period],
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_OMIE_B::6.1TD:${period}:B_FACTOR:2026-05`,
        valueNumeric: omieBFactors[period],
      });
    }

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
    );
    const index = results.find(
      (item) => item.productKey === "PERSONALIZADA_INDEX",
    );
    const omieB = results.find(
      (item) => item.productKey === "PERSONALIZADA_OMIE_B",
    );

    expect(index).toBeDefined();
    expect(index!.desglose?.terminoEnergia).toBe(8893.02);
    expect(index!.desglose?.terminoPotencia).toBe(2224.29);
    expect(index!.totalFactura).toBe(14140.09);

    expect(omieB).toBeDefined();
    expect(omieB!.desglose?.terminoEnergia).toBe(7551.45);
    expect(omieB!.desglose?.terminoPotencia).toBe(2224.29);
    expect(omieB!.totalFactura).toBe(12433.84);
  });

  it("applies the Excel energy-margin factor on imported monthly Precio TE", () => {
    const inputs = buildInputs(62000);
    inputs.tarifaAcceso = "6.1TD";
    inputs.periodo = {
      fechaInicio: "2026-04-30",
      fechaFin: "2026-05-31",
      dias: 32,
    };
    inputs.billingMonth = "2026-05";
    inputs.consumo = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 20293,
      P5: 15108,
      P6: 103598,
    };
    inputs.potenciaContratada = {
      P1: 410,
      P2: 410,
      P3: 410,
      P4: 410,
      P5: 410,
      P6: 1000,
    };
    inputs.omieEstimado = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0,
    };
    inputs.personalizadaIndex = {
      margenEnergia: { P1: 12, P2: 12, P3: 12, P4: 12, P5: 12, P6: 12 },
      margenPotencia: {},
    };

    const entries: Array<{ key: string; valueNumeric: number }> = [];
    for (const period of ["P1", "P2", "P3", "P4", "P5", "P6"] as const) {
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_INDEX::6.1TD:${period}:MARGEN:2026-05`,
        valueNumeric: 0.05,
      });
      entries.push({
        key: `ELEC:INDEX:PERSONALIZADA_INDEX::6.1TD:${period}:POTENCIA`,
        valueNumeric: 0,
      });
    }

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
    );
    const offer = results.find(
      (item) => item.productKey === "PERSONALIZADA_INDEX",
    );

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoEnergia).toBe(8643.42);
  });

  it("falls back to explicit OMIE plus margin when no imported Precio TE exists", () => {
    const inputs = buildInputs(62000);
    inputs.personalizadaIndex = {
      margenEnergia: { P1: 12, P2: 12, P3: 12, P4: 12, P5: 12, P6: 12 },
      margenPotencia: {},
    };
    inputs.omieEstimado = {
      P1: 0.04,
      P2: 0.04,
      P3: 0.04,
      P4: 0.04,
      P5: 0.04,
      P6: 0.04,
    };

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap([]),
    );
    const offer = results.find(
      (item) => item.productKey === "PERSONALIZADA_INDEX",
    );

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoEnergia).toBe(31.31);
  });

  it("matches 00321.2026 Excel Personalized Index total with P1/P2/P3 energy margin 10", () => {
    const inputs = buildInputs(62000);
    inputs.tarifaAcceso = "2.0TD";
    inputs.periodo = {
      fechaInicio: "2026-03-07",
      fechaFin: "2026-05-09",
      dias: 64,
    };
    inputs.billingMonth = "2026-04";
    inputs.facturaActual = 705.91;
    inputs.extras = {
      alquilerEquipoMedida: 4.27,
      ivaTasa: 21,
      impuestoElectricoTasa: 5.11,
    };
    inputs.consumo = {
      P1: 558.97,
      P2: 583.701,
      P3: 1549.008,
    };
    inputs.potenciaContratada = {
      P1: 11.42,
      P2: 11.42,
    };
    inputs.personalizadaIndex = {
      margenEnergia: { P1: 10, P2: 10, P3: 10 },
      margenPotencia: {},
    };

    const entries: Array<{ key: string; valueNumeric: number }> = [
      {
        key: "ELEC:INDEX:PERSONALIZADA_INDEX::2.0TD:P1:MARGEN:2026-04",
        valueNumeric: 0.15095191151363588,
      },
      {
        key: "ELEC:INDEX:PERSONALIZADA_INDEX::2.0TD:P2:MARGEN:2026-04",
        valueNumeric: 0.10279850935377012,
      },
      {
        key: "ELEC:INDEX:PERSONALIZADA_INDEX::2.0TD:P3:MARGEN:2026-04",
        valueNumeric: 0.09161960107635181,
      },
      {
        key: "ELEC:INDEX:PERSONALIZADA_INDEX::2.0TD:P1:POTENCIA",
        valueNumeric: 27.704413,
      },
      {
        key: "ELEC:INDEX:PERSONALIZADA_INDEX::2.0TD:P2:POTENCIA",
        valueNumeric: 0.725423,
      },
    ];

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
    );
    const offer = results.find(
      (item) => item.productKey === "PERSONALIZADA_INDEX",
    );

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoEnergia).toBe(313.63);
    expect(offer!.desglose?.terminoPotencia).toBe(56.93);
    expect(offer!.totalFactura).toBe(476.45);
  });

  it("uses profile-specific indexed month prices when perfilCarga is DIURNO", () => {
    const inputsNormal = buildInputs(30000);
    inputsNormal.tarifaAcceso = "2.0TD";
    inputsNormal.perfilCarga = "NORMAL";
    inputsNormal.periodo = {
      fechaInicio: "2026-04-01",
      fechaFin: "2026-04-30",
      dias: 30,
    };
    inputsNormal.billingMonth = "2026-04";
    inputsNormal.potenciaContratada = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0,
    };
    inputsNormal.consumo = {
      P1: 1000,
      P2: 1000,
      P3: 1000,
      P4: 0,
      P5: 0,
      P6: 0,
    };
    inputsNormal.extras = {
      ivaTasa: 0,
      impuestoElectricoTasa: 0,
    };

    const inputsDiurno: ElectricityInputs = {
      ...inputsNormal,
      perfilCarga: "DIURNO",
    };

    const map = CalculationService.buildPriceMap([
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P1:MARGEN:2026-04:PROFILE:NORMAL",
        valueNumeric: 0.1,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P2:MARGEN:2026-04:PROFILE:NORMAL",
        valueNumeric: 0.1,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P3:MARGEN:2026-04:PROFILE:NORMAL",
        valueNumeric: 0.1,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P1:MARGEN:2026-04:PROFILE:DIURNO",
        valueNumeric: 0.2,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P2:MARGEN:2026-04:PROFILE:DIURNO",
        valueNumeric: 0.2,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P3:MARGEN:2026-04:PROFILE:DIURNO",
        valueNumeric: 0.2,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P1:POTENCIA",
        valueNumeric: 0,
      },
      {
        key: "ELEC:INDEX:TEST_INDEX:N1:2.0TD:P2:POTENCIA",
        valueNumeric: 0,
      },
    ]);

    const productDefinitions: ProductDefinition[] = [
      {
        productKey: "TEST_INDEX",
        displayName: "Test Indexed",
        commodity: "ELECTRICITY",
        pricingType: "INDEXED",
        tiers: ["N1"],
      },
    ];

    const normalResult = CalculationService.calculateElectricity(
      inputsNormal,
      map,
      { productDefinitions },
    ).find((item) => item.productKey === "TEST_INDEX:N1");

    const diurnoResult = CalculationService.calculateElectricity(
      inputsDiurno,
      map,
      { productDefinitions },
    ).find((item) => item.productKey === "TEST_INDEX:N1");

    expect(normalResult).toBeDefined();
    expect(diurnoResult).toBeDefined();
    expect(normalResult!.desglose?.terminoEnergia).toBe(300);
    expect(diurnoResult!.desglose?.terminoEnergia).toBe(600);
    expect(diurnoResult!.totalFactura).toBeGreaterThan(
      normalResult!.totalFactura,
    );
  });

  it("uses product-specific month prices before shared NORMAL profile keys", () => {
    const inputs = buildInputs(30000);
    inputs.tarifaAcceso = "2.0TD";
    inputs.perfilCarga = "NORMAL";
    inputs.billingMonth = "2026-04";
    inputs.potenciaContratada = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0,
    };
    inputs.consumo = { P1: 1000, P2: 1000, P3: 1000 };
    inputs.extras = { ivaTasa: 0, impuestoElectricoTasa: 0 };

    const entries: Array<{ key: string; valueNumeric: number }> = [];
    for (const [product, price] of [
      ["INDEX_A", 0.1],
      ["INDEX_B", 0.2],
    ] as const) {
      for (const period of ["P1", "P2", "P3"]) {
        entries.push(
          {
            key: `ELEC:INDEX:${product}:N1:2.0TD:${period}:MARGEN:2026-04`,
            valueNumeric: price,
          },
          {
            key: `ELEC:INDEX:${product}:N1:2.0TD:${period}:MARGEN:2026-04:PROFILE:NORMAL`,
            valueNumeric: 0.05,
          },
        );
      }
      for (const period of ["P1", "P2"]) {
        entries.push({
          key: `ELEC:INDEX:${product}:N1:2.0TD:${period}:POTENCIA`,
          valueNumeric: 0,
        });
      }
    }

    const productDefinitions: ProductDefinition[] = [
      {
        productKey: "INDEX_A",
        displayName: "Index A",
        commodity: "ELECTRICITY",
        pricingType: "INDEXED",
        tiers: ["N1"],
      },
      {
        productKey: "INDEX_B",
        displayName: "Index B",
        commodity: "ELECTRICITY",
        pricingType: "INDEXED",
        tiers: ["N1"],
      },
    ];

    const results = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
      { productDefinitions },
    );
    const a = results.find((item) => item.productKey === "INDEX_A:N1");
    const b = results.find((item) => item.productKey === "INDEX_B:N1");

    expect(a?.desglose?.terminoEnergia).toBe(300);
    expect(b?.desglose?.terminoEnergia).toBe(600);
  });
});

describe("CalculationService 2.0TD positional power parity", () => {
  const productDefinitions: ProductDefinition[] = [
    {
      productKey: "TEST_FIXED",
      displayName: "Test Fixed",
      commodity: "ELECTRICITY",
      pricingType: "FIXED",
      tiers: ["N1"],
    },
  ];

  function calculate20TdPower(
    potenciaContratada: ElectricityInputs["potenciaContratada"],
    extraPowerEntries: Array<{ key: string; valueNumeric: number }> = [],
  ) {
    const inputs = buildInputs(10000);
    inputs.tarifaAcceso = "2.0TD";
    inputs.periodo = {
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
      dias: 365,
    };
    inputs.potenciaContratada = potenciaContratada;
    inputs.consumo = { P1: 0, P2: 0, P3: 0, P4: 999, P5: 999, P6: 999 };

    const entries = [
      ...["P1", "P2", "P3"].map((period) => ({
        key: `ELEC:FIJO:TEST_FIXED:N1:2.0TD:${period}:ENERGIA`,
        valueNumeric: 0,
      })),
      {
        key: "ELEC:FIJO:TEST_FIXED:N1:2.0TD:P1:POTENCIA",
        valueNumeric: 10,
      },
      {
        key: "ELEC:FIJO:TEST_FIXED:N1:2.0TD:P2:POTENCIA",
        valueNumeric: 20,
      },
      ...extraPowerEntries,
    ];

    return CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
      { productDefinitions },
    ).find((item) => item.productKey === "TEST_FIXED:N1");
  }

  it("keeps sparse P1/P3 positions and does not compact P3 into P2", () => {
    const offer = calculate20TdPower({ P1: 3, P2: 0, P3: 7 });

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoPotencia).toBe(30);
    expect(offer!.desglose?.terminoEnergia).toBe(0);
  });

  it("prices a later period only when Excel supplied a same-position price", () => {
    const offer = calculate20TdPower(
      { P1: 3, P2: 0, P3: 7, P4: 11, P5: 13 },
      [{
        key: "ELEC:FIJO:TEST_FIXED:N1:2.0TD:P3:POTENCIA",
        valueNumeric: 4,
      }],
    );

    expect(offer).toBeDefined();
    expect(offer!.desglose?.terminoPotencia).toBe(58);
  });

  it("passes 2.0TD excess power through to the calculated offer like Excel E35", () => {
    const inputs = buildInputs(10000);
    inputs.tarifaAcceso = "2.0TD";
    inputs.periodo = {
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
      dias: 365,
    };
    inputs.potenciaContratada = { P1: 3, P2: 2 };
    inputs.consumo = { P1: 0, P2: 0, P3: 0 };
    inputs.excesoPotencia = 12.34;

    const entries = [
      ...["P1", "P2", "P3"].map((period) => ({
        key: `ELEC:FIJO:TEST_FIXED:N1:2.0TD:${period}:ENERGIA`,
        valueNumeric: 0,
      })),
      {
        key: "ELEC:FIJO:TEST_FIXED:N1:2.0TD:P1:POTENCIA",
        valueNumeric: 10,
      },
      {
        key: "ELEC:FIJO:TEST_FIXED:N1:2.0TD:P2:POTENCIA",
        valueNumeric: 20,
      },
    ];

    const offer = CalculationService.calculateElectricity(
      inputs,
      CalculationService.buildPriceMap(entries),
      { productDefinitions },
    ).find((item) => item.productKey === "TEST_FIXED:N1");

    expect(offer).toBeDefined();
    expect(offer!.desglose?.excesoPotencia).toBe(12.34);
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
      {
        key: "GAS:INDEX:INDEXADO:N1:RL01:PEN:MARGEN",
        valueNumeric: 0.01,
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
    expect(results.some((item) => item.productKey === "INDEXADO:N1")).toBe(
      false,
    );
  });
});
