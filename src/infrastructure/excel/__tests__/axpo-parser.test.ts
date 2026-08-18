import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { CalculationService } from "../../../application/services/calculationService";
import { parseAxpoExcel } from "../axpo-parser";

describe("parseAxpoExcel", () => {
  const workbookBuffer = async (
    sheetName: string,
    rows: unknown[][],
  ): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    rows.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value !== undefined) {
          sheet.getCell(rowIndex + 1, colIndex + 1).value = value as any;
        }
      });
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  };

  it("imports and calculates indexed offers for every v31 electricity tariff", async () => {
    const workbookPath = path.join(
      process.cwd(),
      "SIMULADOR AXPO 13.07.2026 (Pen, Islas) 1_v31.xlsm",
    );
    const parsed = await parseAxpoExcel(
      fs.readFileSync(workbookPath),
      path.basename(workbookPath),
    );
    const keys = new Set(parsed.items.map((item) => item.key));
    const priceMap = CalculationService.buildPriceMap(
      parsed.items.map((item) => ({
        key: item.key,
        valueNumeric: item.valueNumeric ?? null,
      })),
    );

    for (const tariff of ["2.0TD", "3.0TD", "6.1TD"]) {
      const energyPeriods =
        tariff === "2.0TD"
          ? ["P1", "P2", "P3"]
          : ["P1", "P2", "P3", "P4", "P5", "P6"];
      const powerPeriods =
        tariff === "2.0TD"
          ? ["P1", "P2"]
          : ["P1", "P2", "P3", "P4", "P5", "P6"];

      for (const period of energyPeriods) {
        expect(keys).toContain(
          `ELEC:INDEX:DINAMICA:N1:${tariff}:${period}:MARGEN`,
        );
      }
      for (const period of powerPeriods) {
        expect(keys).toContain(
          `ELEC:INDEX:DINAMICA:N1:${tariff}:${period}:POTENCIA`,
        );
      }

      const results = CalculationService.calculateElectricity(
        {
          tarifaAcceso: tariff as "2.0TD" | "3.0TD" | "6.1TD",
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
            P2: 100,
            P3: 100,
            P4: 100,
            P5: 100,
            P6: 100,
          },
          periodo: {
            fechaInicio: "2026-06-01",
            fechaFin: "2026-06-30",
            dias: 30,
          },
          facturaActual: 1_000,
          extras: {},
        },
        priceMap,
      );

      const hasStandardIndexedOffers = results.some(
        (result) =>
          result.pricingType === "INDEXED" &&
          !result.productKey.startsWith("PERSONALIZADA"),
      );
      expect(hasStandardIndexedOffers).toBe(true);
    }
  });

  it("matches the v31 3.0TD indexed results for simulation 00545/2026", async () => {
    const workbookPath = path.join(
      process.cwd(),
      "SIMULADOR AXPO 13.07.2026 (Pen, Islas) 1_v31.xlsm",
    );
    const parsed = await parseAxpoExcel(
      fs.readFileSync(workbookPath),
      path.basename(workbookPath),
    );
    const priceMap = CalculationService.buildPriceMap(
      parsed.items.map((item) => ({
        key: item.key,
        valueNumeric: item.valueNumeric ?? null,
      })),
    );
    const results = CalculationService.calculateElectricity(
      {
        tarifaAcceso: "3.0TD",
        zonaGeografica: "Peninsula",
        perfilCarga: "NORMAL",
        billingMonth: "2026-04",
        potenciaContratada: {
          P1: 86.5,
          P2: 86.5,
          P3: 86.5,
          P4: 86.5,
          P5: 86.5,
          P6: 86.5,
        },
        consumo: { P1: 0, P2: 0, P3: 0, P4: 4020, P5: 2211, P6: 3310 },
        periodo: {
          fechaInicio: "2026-05-01",
          fechaFin: "2026-05-31",
          dias: 31,
        },
        facturaActual: 1857.05,
        excesoPotencia: 0,
        extras: {
          alquilerEquipoMedida: 14.22,
          otrosCargos: 0.59,
          ivaTasa: 21,
          impuestoElectricoTasa: 5.11269,
        },
      },
      priceMap,
    );
    const byKey = new Map(results.map((result) => [result.productKey, result]));

    expect(byKey.get("DINAMICA:N1")?.totalFactura).toBe(1915.41);
    expect(byKey.get("DINAMICA:N2")?.totalFactura).toBe(1718.16);
    expect(byKey.get("DINAMICA:N3")?.totalFactura).toBe(1656.68);
    expect(byKey.get("DINAMICA_CONTROL:N1")?.totalFactura).toBe(1767.77);
    expect(byKey.get("DINAMICA_CONTROL_TECHO:N3")?.totalFactura).toBe(1807.79);
  });

  it("matches the v31 DIURNO indexed results for simulation 00546/2026", async () => {
    const workbookPath = path.join(
      process.cwd(),
      "SIMULADOR AXPO 13.07.2026 (Pen, Islas) 1_v31.xlsm",
    );
    const parsed = await parseAxpoExcel(
      fs.readFileSync(workbookPath),
      path.basename(workbookPath),
    );
    const priceMap = CalculationService.buildPriceMap(
      parsed.items.map((item) => ({
        key: item.key,
        valueNumeric: item.valueNumeric ?? null,
      })),
    );
    const results = CalculationService.calculateElectricity(
      {
        tarifaAcceso: "3.0TD",
        zonaGeografica: "Peninsula",
        perfilCarga: "DIURNO",
        billingMonth: "2026-05",
        potenciaContratada: {
          P1: 86.5,
          P2: 86.5,
          P3: 86.5,
          P4: 86.5,
          P5: 86.5,
          P6: 86.5,
        },
        consumo: { P1: 0, P2: 0, P3: 0, P4: 4020, P5: 2211, P6: 3310 },
        periodo: {
          fechaInicio: "2026-05-01",
          fechaFin: "2026-05-31",
          dias: 31,
        },
        facturaActual: 1857.05,
        excesoPotencia: 0,
        extras: {
          alquilerEquipoMedida: 14.22,
          otrosCargos: 0.59,
          ivaTasa: 21,
          impuestoElectricoTasa: 5.11269,
        },
      },
      priceMap,
    );
    const byKey = new Map(results.map((result) => [result.productKey, result]));

    expect(byKey.get("DINAMICA:N1")?.totalFactura).toBe(1576.31);
    expect(byKey.get("DINAMICA:N2")?.totalFactura).toBe(1379.07);
    expect(byKey.get("DINAMICA:N3")?.totalFactura).toBe(1317.59);
    expect(byKey.get("DINAMICA_CONTROL:N1")?.totalFactura).toBe(1425.01);
    expect(byKey.get("DINAMICA_CONTROL_PLUS:N2")?.totalFactura).toBe(1424.83);
    expect(byKey.get("DINAMICA_CONTROL_TECHO:N3")?.totalFactura).toBe(1464.48);
  });

  it("matches the TLV lookup exception for Dinamica Control Plus N3 3.0TD power prices", async () => {
    const rows: unknown[][] = Array.from({ length: 67 }, () => []);
    rows[62][1] = "POTENCIA";
    rows[65][1] = "3.0TD";
    rows[65][2] = 0.057197060273972596;
    rows[65][3] = 0.030459235616438356;
    rows[65][4] = 0.013648038356164384;
    rows[65][5] = 0.020236528767123285;
    rows[65][6] = 0.02058589315068493;
    rows[65][7] = 0.020389827397260276;
    rows[66][1] = "6.1TD";
    rows[66][2] = 0.08245306301369863;
    rows[66][3] = 0.04387591506849315;
    rows[66][4] = 0.020005153424657533;
    rows[66][5] = 0.024366654794520548;
    rows[66][6] = 0.019520857534246573;
    rows[66][7] = 0.01918953698630137;

    const buffer = await workbookBuffer("DINAMICA CONTROL PLUS N3", rows);

    const parsed = await parseAxpoExcel(
      buffer,
      "TELEVENTA TEST 04.05.2026.xlsx",
      {
        scopeType: "TLV",
      },
    );
    const byKey = new Map(
      parsed.items.map((item) => [item.key, item.valueNumeric]),
    );

    expect(
      byKey.get("ELEC:INDEX:DINAMICA_CONTROL_PLUS:N3:3.0TD:P1:POTENCIA"),
    ).toBeCloseTo(30.095368, 6);
    expect(
      byKey.get("ELEC:INDEX:DINAMICA_CONTROL_PLUS:N3:3.0TD:P6:POTENCIA"),
    ).toBeCloseTo(7.004181, 6);
    expect(
      byKey.get("ELEC:INDEX:DINAMICA_CONTROL_PLUS:N3:6.1TD:P1:POTENCIA"),
    ).toBeCloseTo(30.095368, 6);
  });

  it("uses hidden simulator lookup rows for final electricity prices", async () => {
    const workbookPath = path.join(
      process.cwd(),
      "SIMULADOR AXPO 09.06.2026 (Pen, Islas) 1_v27.xlsm",
    );
    const parsed = await parseAxpoExcel(
      fs.readFileSync(workbookPath),
      path.basename(workbookPath),
    );
    const byKey = new Map(
      parsed.items.map((item) => [item.key, item.valueNumeric]),
    );

    expect(
      byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:ENERGIA:ZONE:PENINSULA"),
    ).toBe(0);
    expect(
      byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:POTENCIA:ZONE:PENINSULA"),
    ).toBe(0);
    expect(
      byKey.get("ELEC:INDEX:DINAMICA_CONTROL_TECHO:N3:6.1TD:P6:MARGEN:2026-04"),
    ).toBeCloseTo(0.1201824484, 10);
  });

  it("extracts NORMAL and DIURNO indexed month keys from INPUT OMIE formula refs", async () => {
    const workbook = new ExcelJS.Workbook();

    const inputOmie = workbook.addWorksheet("INPUT OMIE");
    inputOmie.getCell("AE5").value = 100; // NORMAL €/MWh
    inputOmie.getCell("AE12").value = 200; // DIURNO €/MWh

    const dinamica = workbook.addWorksheet("DINAMICA N1");
    dinamica.getCell("E1").value = "PRECIO TE";
    dinamica.getCell("E2").value = "ABRIL-26";
    dinamica.getCell("G2").value = {
      formula:
        "IF('PETICION DATOS LUZ'!E57=\"NORMAL\",'INPUT OMIE'!AE5,'INPUT OMIE'!AE12)",
      result: 150,
    } as any;
    dinamica.getCell("E3").value = "PROMEDIO 12 MESES";

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseAxpoExcel(buffer, "SIMULADOR TEST.xlsm");
    const byKey = new Map(
      parsed.items.map((item) => [item.key, item.valueNumeric]),
    );

    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA:N1:6.1TD:P1:MARGEN:2026-04:PROFILE:NORMAL",
      ),
    ).toBeCloseTo(0.1, 10);
    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA:N1:6.1TD:P1:MARGEN:2026-04:PROFILE:DIURNO",
      ),
    ).toBeCloseTo(0.2, 10);
  });

  it("tags hidden electricity lookup values with the workbook geographic zone", async () => {
    const workbook = new ExcelJS.Workbook();
    const inputs = workbook.addWorksheet("PETICION DATOS LUZ");
    inputs.getCell("E11").value = "Canarias";

    const lookup = workbook.addWorksheet(".");
    lookup.getCell("B6").value = "DINAMICA N1";
    lookup.getCell("C6").value = "3.0TD";
    lookup.getCell("D6").value = "FEBRERO-26";
    lookup.getCell("H6").value = 0.0974043511;

    const parsed = await parseAxpoExcel(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      "SIMULADOR TEST.xlsm",
    );
    const byKey = new Map(
      parsed.items.map((item) => [item.key, item.valueNumeric]),
    );

    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA:N1:3.0TD:P4:MARGEN:2026-02:ZONE:CANARIAS",
      ),
    ).toBe(0.0974043511);
    expect(
      byKey.has("ELEC:INDEX:DINAMICA:N1:3.0TD:P4:MARGEN:2026-02"),
    ).toBe(false);
  });

  it("matches the Canarias Excel result for simulation 00357/2026", async () => {
    const workbookPath = path.join(process.cwd(), "00357.2026.xlsm");
    const parsed = await parseAxpoExcel(
      fs.readFileSync(workbookPath),
      path.basename(workbookPath),
    );
    const priceMap = CalculationService.buildPriceMap(
      parsed.items.map((item) => ({
        key: item.key,
        valueNumeric: item.valueNumeric ?? null,
      })),
    );
    const inputs = {
        tarifaAcceso: "3.0TD",
        zonaGeografica: "Canarias",
        perfilCarga: "NORMAL",
        billingMonth: "2026-02",
        potenciaContratada: {
          P1: 12,
          P2: 12,
          P3: 12,
          P4: 12,
          P5: 12,
          P6: 20.785,
        },
        consumo: { P1: 0, P2: 1083, P3: 0, P4: 708, P5: 0, P6: 1663 },
        periodo: {
          fechaInicio: "2026-02-01",
          fechaFin: "2026-02-28",
          dias: 28,
        },
        facturaActual: 594.77,
        excesoPotencia: 0,
        extras: {
          reactiva: 18.58,
          alquilerEquipoMedida: 9.94,
          otrosCargos: 0,
          ivaTasa: 3,
          impuestoElectricoTasa: 5.11,
        },
      } as const;
    const results = CalculationService.calculateElectricity(inputs, priceMap);
    const byKey = new Map(results.map((result) => [result.productKey, result]));

    expect(byKey.get("ESTABLE:N1")?.totalFactura).toBeCloseTo(739.57, 2);
    expect(byKey.get("DINAMICA:N1")?.totalFactura).toBeCloseTo(465.62, 2);
    expect(byKey.get("DINAMICA:N1")?.desglose?.terminoEnergia).toBeCloseTo(
      361.19,
      2,
    );

    for (const [zone, expected] of [
      ["Peninsula", 691.16],
      ["Baleares", 728.54],
      ["Canarias", 739.57],
    ] as const) {
      const zoneResults = CalculationService.calculateElectricity(
        { ...inputs, zonaGeografica: zone },
        priceMap,
      );
      expect(
        zoneResults.find((result) => result.productKey === "ESTABLE:N1")
          ?.totalFactura,
      ).toBeCloseTo(expected, 2);
    }

    const peninsulaResults = CalculationService.calculateElectricity(
      { ...inputs, zonaGeografica: "Peninsula" },
      priceMap,
    );
    expect(
      peninsulaResults.find((result) => result.productKey === "DINAMICA:N1")
        ?.totalFactura,
    ).toBeCloseTo(370.48, 2);
    for (const [productKey, expected] of [
      ["DINAMICA:N1", 370.48],
      ["DINAMICA:N2", 322.16],
      ["DINAMICA:N3", 307.1],
    ] as const) {
      expect(
        peninsulaResults.find((result) => result.productKey === productKey)
          ?.totalFactura,
      ).toBeCloseTo(expected, 2);
    }
    for (const [productKey, expected] of [
      ["DINAMICA:N1", 465.62],
      ["DINAMICA:N2", 404.83],
      ["DINAMICA:N3", 385.89],
      ["DINAMICA_CONTROL_PLUS:N1", 439.6],
      ["PERSONALIZADA_INDEX", 327.04],
    ] as const) {
      expect(
        results.find((result) => result.productKey === productKey)
          ?.totalFactura,
      ).toBeCloseTo(expected, 2);
    }
    for (const [productKey, expected] of [
      ["1P_PLUS_SSCC_LIBRES:N1", 130.41],
      ["1P_PLUS_SSCC_LIBRES:N2", 122.3],
      ["1P_PLUS_SSCC_LIBRES:N3", 112.67],
      ["ESTABLE_TALLERES:N1", 30.35],
      ["ESTABLE_TALLERES:N2", 30.35],
      ["ESTABLE_TALLERES:N3", 30.35],
      ["ESTABLE_PLUS_TALLERES:N1", 30.35],
      ["ESTABLE_PLUS_TALLERES:N2", 30.35],
      ["ESTABLE_PLUS_TALLERES:N3", 30.35],
    ] as const) {
      expect(
        results.find((result) => result.productKey === productKey)
          ?.totalFactura,
      ).toBeCloseTo(expected, 2);
    }

    const balearesResults = CalculationService.calculateElectricity(
      { ...inputs, zonaGeografica: "Baleares" },
      priceMap,
    );
    expect(
      balearesResults.find((result) => result.productKey === "DINAMICA:N1"),
    ).toBeUndefined();
    expect(peninsulaResults).toHaveLength(34);
    expect(results).toHaveLength(34);
    expect(balearesResults).toHaveLength(18);
  });

  it("extracts profile prices when Precio TE uses intermediate profile cells", async () => {
    const workbook = new ExcelJS.Workbook();

    const inputOmie = workbook.addWorksheet("INPUT OMIE");
    inputOmie.getCell("AE5").value = 100; // NORMAL €/MWh
    inputOmie.getCell("AE12").value = 50; // DIURNO €/MWh

    const dinamica = workbook.addWorksheet("DINAMICA N1");
    dinamica.getCell("E1").value = "PRECIO TE";
    dinamica.getCell("E2").value = "ABRIL-26";
    dinamica.getCell("C2").value = {
      formula:
        "IF('PETICION DATOS LUZ'!E57=\"NORMAL\",'INPUT OMIE'!AE5,'INPUT OMIE'!AE12)",
      result: 100,
    } as any;
    dinamica.getCell("C3").value = 10;
    dinamica.getCell("J7").value = 1;
    dinamica.getCell("L22").value = 2;
    dinamica.getCell("L3").value = 2;
    dinamica.getCell("J8").value = 10;
    dinamica.getCell("P45").value = 3;
    dinamica.getCell("P48").value = 4;
    dinamica.getCell("J10").value = 5;
    dinamica.getCell("G2").value = {
      formula:
        "IF(C2=0,0,((C2+C3+J$7+$L$22)*(1+L3*J$8/100)+(P45+P48))*(1+0.01528)+J$10)",
      result: 149.778928,
    } as any;
    dinamica.getCell("E3").value = "PROMEDIO 12 MESES";

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseAxpoExcel(buffer, "SIMULADOR TEST.xlsm");
    const byKey = new Map(
      parsed.items.map((item) => [item.key, item.valueNumeric]),
    );

    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA:N1:6.1TD:P1:MARGEN:2026-04:PROFILE:NORMAL",
      ),
    ).toBeCloseTo(0.149778928, 10);
    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA:N1:6.1TD:P1:MARGEN:2026-04:PROFILE:DIURNO",
      ),
    ).toBeCloseTo(0.088862128, 10);
  });
});
