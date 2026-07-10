import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
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

    expect(byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:ENERGIA")).toBe(0);
    expect(byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:POTENCIA")).toBe(0);
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
