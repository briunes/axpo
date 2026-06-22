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
  });
});
