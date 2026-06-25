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

    const buffer = await workbookBuffer(
      "DINAMICA CONTROL PLUS N3",
      rows,
    );

    const parsed = await parseAxpoExcel(buffer, "TELEVENTA TEST 04.05.2026.xlsx", {
      scopeType: "TLV",
    });
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
      byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:ENERGIA"),
    ).toBe(0);
    expect(
      byKey.get("ELEC:FIJO:1P_PLUS:N1:6.1TD:P1:POTENCIA"),
    ).toBe(0);
    expect(
      byKey.get(
        "ELEC:INDEX:DINAMICA_CONTROL_TECHO:N3:6.1TD:P6:MARGEN:2026-04",
      ),
    ).toBeCloseTo(0.1201824484, 10);
  });
});
