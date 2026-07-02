import fs from "fs";
import path from "path";
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

  it("exposes the user agency from owner or simulation context", () => {
    expect(
      extractVariableValues({
        id: "simulation-id",
        ownerUser: { agency: { name: "Owner Agency" } },
        agency: { name: "Simulation Agency" },
      }).USER_AGENCY,
    ).toBe("Owner Agency");

    expect(
      extractVariableValues({
        id: "simulation-id",
        ownerUser: {},
        agency: { name: "Simulation Agency" },
      }).USER_AGENCY,
    ).toBe("Simulation Agency");
  });

  it("exposes the timestamp from the last calculation run", () => {
    const calculatedAt = "2026-02-01T00:00:00.000Z";
    const variables = extractVariableValues(
      { id: "simulation-id" },
      {
        results: {
          calculatedAt,
          baseValueSetId: "base-values",
        },
      },
    );

    expect(variables.SIMULATION_GENERATED_AT).toBe(
      new Date(calculatedAt).toLocaleString("es-ES"),
    );
  });

  it("exposes gas simulation variables", () => {
    const variables = extractVariableValues(
      {
        id: "simulation-id",
        client: { name: "Gas Client" },
      },
      {
        type: "GAS",
        gas: {
          cups: "ES0230901000023635SW",
          direccion: "Gas Supply Street 1",
          tarifaAcceso: "RL03",
          zonaGeografica: "Peninsula",
          consumo: 1000,
          telemedida: "NO",
          periodo: {
            fechaInicio: "2026-01-01",
            fechaFin: "2026-01-31",
            dias: 31,
          },
          facturaActual: 121,
          extras: {
            alquilerEquipoMedida: 1,
            otrosCargos: 2,
          },
          ivaTasa: 21,
          impuestoHidrocarburo: 0.00234,
        },
        results: {
          calculatedAt: "2026-02-01T00:00:00.000Z",
          baseValueSetId: "base-values",
          gas: [
            {
              productKey: "FIJO:N1",
              productLabel: "Gas Fijo N1",
              commodity: "GAS",
              pricingType: "FIXED",
              totalFactura: 90,
              ahorro: 31,
              pctAhorro: 25.62,
              ahorroAnual: 365,
              desglose: {
                terminoFijo: 10,
                terminoEnergia: 60,
                impuestoHidrocarburo: 2.34,
                alquiler: 1,
                otrosCargos: 2,
                iva: 14.66,
              },
            },
          ],
        },
        selectedOffer: {
          productKey: "FIJO:N1",
          commodity: "GAS",
          pricingType: "FIXED",
          selectedAt: "2026-02-01T00:00:00.000Z",
        },
      },
      undefined,
      undefined,
      undefined,
      "en",
    );

    expect(variables.PRODUCT_NAME).toBe("Gas Fijo N1");
    expect(variables.CUPS_NUMBER).toBe("ES0230901000023635SW");
    expect(variables.CLIENT_ADDRESS).toBe("Gas Supply Street 1");
    expect(variables.GAS_TARIFF).toBe("RL03");
    expect(variables.GAS_ZONE).toBe("Peninsula");
    expect(variables.GAS_TELEMEASURED).toBe("NO");
    expect(variables.GAS_BILLING_DAYS).toBe("31");
    expect(variables.GAS_CONSUMPTION_KWH).toBe("1000");
    expect(variables.GAS_HYDROCARBON_TAX_RATE).toBe("0,00234");
    expect(variables.CURRENT_GAS_RENTAL_COST).toBe("1.00");
    expect(variables.AXPO_GAS_TOTAL).toBe("90.00");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("Fixed term");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("Variable energy term");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("Hydrocarbon tax");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("1.00 €");
    expect(variables.CURRENT_BREAKDOWN_HTML).not.toContain(
      "{{CURRENT_GAS_FIXED_COST}}",
    );
  });

  it("uses the shared current breakdown placeholder in gas templates", () => {
    const pdfDir = path.resolve(__dirname, "..");
    const enTemplate = fs.readFileSync(
      path.join(pdfDir, "gas-simulation-template.html"),
      "utf8",
    );
    const esTemplate = fs.readFileSync(
      path.join(pdfDir, "gas-simulation-template-es.html"),
      "utf8",
    );

    expect(enTemplate).toContain("{{CURRENT_BREAKDOWN_HTML}}");
    expect(esTemplate).toContain("{{CURRENT_BREAKDOWN_HTML}}");
    expect(enTemplate).not.toContain("{{CURRENT_GAS_FIXED_COST}}");
    expect(esTemplate).not.toContain("{{CURRENT_GAS_FIXED_COST}}");
  });

  it("uses explicit gas current invoice breakdown amounts when present", () => {
    const variables = extractVariableValues(
      { id: "simulation-id" },
      {
        type: "GAS",
        gas: {
          cups: "ES0230901000023635SW",
          tarifaAcceso: "RL02",
          zonaGeografica: "Peninsula",
          consumo: 5646,
          telemedida: "NO",
          periodo: {
            fechaInicio: "2025-11-27",
            fechaFin: "2026-01-27",
            dias: 61,
          },
          facturaActual: 568.98,
          extras: {
            alquilerEquipoMedida: 1.18,
            otrosCargos: 0,
            terminoFijoActual: 12.34,
            terminoVariableActual: 440.56,
            impuestoHidrocarburoActual: 13.21,
            ivaActual: 101.69,
            useCurrentInvoiceBreakdown: true,
          },
          ivaTasa: 21,
          impuestoHidrocarburo: 0.00234,
        },
        results: {
          calculatedAt: "2026-02-01T00:00:00.000Z",
          baseValueSetId: "base-values",
          gas: [],
        },
      },
      undefined,
      undefined,
      undefined,
      "en",
    );

    expect(variables.CURRENT_GAS_FIXED_COST).toBe("12.34");
    expect(variables.CURRENT_GAS_VARIABLE_COST).toBe("440.56");
    expect(variables.CURRENT_GAS_TAX).toBe("13.21");
    expect(variables.CURRENT_GAS_VAT).toBe("101.69");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("12.34 €");
    expect(variables.CURRENT_BREAKDOWN_HTML).toContain("440.56 €");
  });

  it("exposes electricity simulation variables", () => {
    const variables = extractVariableValues(
      {
        id: "simulation-id",
        client: { name: "Electricity Client" },
      },
      {
        type: "ELECTRICITY",
        electricity: {
          tarifaAcceso: "3.0TD",
          zonaGeografica: "Peninsula",
          perfilCarga: "NORMAL",
          potenciaContratada: {
            P1: 10,
            P2: 10,
            P3: 10,
            P4: 10,
            P5: 10,
            P6: 10,
          },
          consumo: {
            P1: 100,
            P2: 200,
            P3: 300,
            P4: 400,
            P5: 500,
            P6: 600,
          },
          periodo: {
            fechaInicio: "2026-01-01",
            fechaFin: "2026-01-31",
            dias: 31,
          },
          facturaActual: 242,
          extras: {
            alquilerEquipoMedida: 1,
            reactiva: 3,
            otrosCargos: 2,
            ivaTasa: 21,
            impuestoElectricoTasa: 5.11269,
          },
        },
        results: {
          calculatedAt: "2026-02-01T00:00:00.000Z",
          baseValueSetId: "base-values",
          electricity: [
            {
              productKey: "ESTABLE:N1",
              productLabel: "Estable N1",
              commodity: "ELECTRICITY",
              pricingType: "FIXED",
              totalFactura: 200,
              ahorro: 42,
              pctAhorro: 17.36,
              ahorroAnual: 494.52,
              desglose: {
                terminoPotencia: 20,
                terminoEnergia: 130,
                excesoPotencia: 0,
                impuestoElectrico: 7.67,
                alquiler: 1,
                otrosCargos: 2,
                iva: 39.33,
              },
            },
          ],
        },
        selectedOffer: {
          productKey: "ESTABLE:N1",
          commodity: "ELECTRICITY",
          pricingType: "FIXED",
          selectedAt: "2026-02-01T00:00:00.000Z",
        },
      },
    );

    expect(variables.PRODUCT_NAME).toBe("Estable N1");
    expect(variables.ELECTRICITY_TARIFF).toBe("3.0TD");
    expect(variables.ELECTRICITY_ZONE).toBe("Peninsula");
    expect(variables.ELECTRICITY_PROFILE).toBe("NORMAL");
    expect(variables.ELECTRICITY_BILLING_DAYS).toBe("31");
    expect(variables.ELECTRICITY_CONSUMPTION_KWH).toBe("2100");
    expect(variables.ELECTRICITY_IVA_RATE).toBe("21,00");
    expect(variables.ELECTRICITY_TAX_RATE).toBe("5,11269");
    expect(variables.CURRENT_REACTIVE_COST).toBe("3.00");
    expect(variables.CURRENT_OTHER_CHARGES).toBe("2.00");
    expect(variables.CHART_COMPARATIVA).toContain("display:block;width:100%");
    expect(variables.CHART_COMPARATIVA).toContain('width="100%"');
    expect(variables.CHART_COMPARATIVA).toContain("flex:0 0 50%");
    expect(variables.CHART_COMPARATIVA).toContain("font-size:20px");
    expect(variables.CHART_COMPARATIVA).toContain("border-top:1px solid");
  });

  it("uses explicit current invoice breakdown amounts when present", () => {
    const variables = extractVariableValues(
      {
        id: "simulation-id",
        client: { name: "Electricity Client" },
      },
      {
        type: "ELECTRICITY",
        electricity: {
          tarifaAcceso: "2.0TD",
          zonaGeografica: "Peninsula",
          perfilCarga: "NORMAL",
          potenciaContratada: {
            P1: 11.42,
            P2: 11.42,
          },
          consumo: {
            P1: 558.97,
            P2: 583.701,
            P3: 1549.008,
          },
          periodo: {
            fechaInicio: "2026-03-07",
            fechaFin: "2026-05-09",
            dias: 64,
          },
          facturaActual: 705.91,
          excesoPotencia: 0,
          extras: {
            alquilerEquipoMedida: 4.27,
            otrosCargos: 4.27,
            terminoPotenciaActual: 78.36,
            terminoEnergiaActual: 497.88,
            impuestoElectricoActual: 2.89,
            ivaActual: 122.51,
            useCurrentInvoiceBreakdown: true,
            ivaTasa: 21,
            impuestoElectricoTasa: 5.11269,
          },
        },
        results: {
          calculatedAt: "2026-02-01T00:00:00.000Z",
          baseValueSetId: "base-values",
          electricity: [
            {
              productKey: "DINAMICA_PLUS:N2",
              productLabel: "Dinámica Plus N2",
              commodity: "ELECTRICITY",
              pricingType: "INDEXED",
              totalFactura: 581.58,
              ahorro: 124.33,
              pctAhorro: 17.61,
              ahorroAnual: 709.07,
              desglose: {
                terminoPotencia: 99.38,
                terminoEnergia: 353.83,
                excesoPotencia: 0,
                impuestoElectrico: 23.17,
                alquiler: 4.27,
                otrosCargos: 0,
                iva: 100.94,
              },
            },
          ],
        },
        selectedOffer: {
          productKey: "DINAMICA_PLUS:N2",
          commodity: "ELECTRICITY",
          pricingType: "INDEXED",
          selectedAt: "2026-02-01T00:00:00.000Z",
        },
      },
    );

    expect(variables.CURRENT_POWER_COST).toBe("78.36");
    expect(variables.CURRENT_ENERGY_COST).toBe("497.88");
    expect(variables.CURRENT_TAX_COST).toBe("2.89");
    expect(variables.CURRENT_VAT).toBe("122.51");
  });

  it("ignores explicit current invoice breakdown amounts when disabled", () => {
    const variables = extractVariableValues(
      { id: "simulation-id" },
      {
        type: "ELECTRICITY",
        electricity: {
          tarifaAcceso: "2.0TD",
          zonaGeografica: "Peninsula",
          perfilCarga: "NORMAL",
          potenciaContratada: { P1: 11.42, P2: 11.42 },
          consumo: { P1: 558.97, P2: 583.701, P3: 1549.008 },
          periodo: {
            fechaInicio: "2026-03-07",
            fechaFin: "2026-05-09",
            dias: 64,
          },
          facturaActual: 705.91,
          excesoPotencia: 0,
          extras: {
            alquilerEquipoMedida: 4.27,
            terminoPotenciaActual: 78.36,
            terminoEnergiaActual: 497.88,
            impuestoElectricoActual: 2.89,
            ivaActual: 122.51,
            useCurrentInvoiceBreakdown: false,
            ivaTasa: 21,
            impuestoElectricoTasa: 5.11269,
          },
        },
        results: {
          calculatedAt: "2026-02-01T00:00:00.000Z",
          baseValueSetId: "base-values",
          electricity: [
            {
              productKey: "DINAMICA_PLUS:N2",
              productLabel: "Dinámica Plus N2",
              commodity: "ELECTRICITY",
              pricingType: "INDEXED",
              totalFactura: 581.58,
              ahorro: 124.33,
              pctAhorro: 17.61,
              ahorroAnual: 709.07,
              desglose: {
                terminoPotencia: 99.38,
                terminoEnergia: 353.83,
                excesoPotencia: 0,
                impuestoElectrico: 23.17,
                alquiler: 4.27,
                otrosCargos: 0,
                iva: 100.94,
              },
            },
          ],
        },
        selectedOffer: {
          productKey: "DINAMICA_PLUS:N2",
          commodity: "ELECTRICITY",
          pricingType: "INDEXED",
          selectedAt: "2026-02-01T00:00:00.000Z",
        },
      },
    );

    expect(variables.CURRENT_POWER_COST).toBe("116.63");
    expect(variables.CURRENT_ENERGY_COST).toBe("415.25");
    expect(variables.CURRENT_TAX_COST).toBe("28.38");
    expect(variables.CURRENT_VAT).toBe("141.39");
  });
});
