import JSZip from "jszip";
import { fillSimulationWorkbook } from "../simulationWorkbookExport";
import type { ElectricityInputs } from "@/domain/types";

const addresses = [
  "E8", "E11", "E14", "D24", "E24", "E25",
  "E28", "E29", "E30", "E31", "E32", "E33",
  "E35",
  "E39", "E40", "E41", "E42", "E43", "E44",
  "E47", "E48", "E49", "E50", "E51", "E53", "E57",
];

async function sourceWorkbook(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PETICION DATOS LUZ" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>`);
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst count="1" uniqueCount="1"><si><t>Existing</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet><sheetData><row r="1">${addresses.map((address) => address === "D24" || address === "E24" ? `<c r="${address}" s="2"/>` : `<c r="${address}" s="2"><f>OLD_FORMULA</f><v>999</v></c>`).join("")}<c r="A1"><f>SUM(E28:E33)</f><v>0</v></c></row></sheetData></worksheet>`);
  zip.file("xl/calcChain.xml", `<?xml version="1.0"?><calcChain><c r="E28" i="1"/></calcChain>`);
  zip.file("xl/vbaProject.bin", Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("fillSimulationWorkbook", () => {
  it("fills the fixed electricity input cells and preserves formulas and VBA elsewhere", async () => {
    const electricity = {
      tarifaAcceso: "2.0TD",
      zonaGeografica: "Peninsula",
      perfilCarga: "NORMAL",
      potenciaContratada: { P1: 10.392, P2: 10.392 },
      consumo: { P1: 26.948, P2: 27.533, P3: 65.441 },
      excesoPotencia: 0,
      periodo: { fechaInicio: "2026-04-24", fechaFin: "2026-05-25", dias: 31 },
      facturaActual: 59.02,
      extras: {
        alquilerEquipoMedida: 1.4,
        otrosCargos: 0,
        ivaTasa: 21,
        impuestoElectricoTasa: 5.11269,
      },
    } as ElectricityInputs;

    const output = await fillSimulationWorkbook(await sourceWorkbook(), {
      electricity,
      clientName: "CDAD PROP LOS PLANOS 1A-1B",
    });
    const zip = await JSZip.loadAsync(output);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");
    const relationships = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    const contentTypes = await zip.file("[Content_Types].xml")!.async("string");

    const sharedStrings = await zip.file("xl/sharedStrings.xml")!.async("string");
    expect(sheet).toContain('<c r="E8" s="2" t="s"><v>1</v></c>');
    expect(sheet).toContain('<c r="D24" s="2"><v>46136</v></c>');
    expect(sheet).toContain('<c r="E24" s="2"><v>46167</v></c>');
    expect(sheet).toContain('<c r="E25" s="2"><f>OLD_FORMULA</f><v>999</v></c>');
    expect(sheet).toContain('<c r="E29" s="2"><v>10.392</v></c>');
    expect(sheet).toContain('<c r="E41" s="2"><v>65.441</v></c>');
    expect(sheet).toContain('<c r="E50" s="2"><v>0.21</v></c>');
    expect(sheet).toContain('<c r="E53" s="2"><v>59.02</v></c>');
    expect(sheet).toContain('<c r="A1"><f>SUM(E28:E33)</f><v>0</v></c>');
    expect(workbook).toContain('<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
    expect(zip.file("xl/calcChain.xml")).toBeNull();
    expect(relationships).not.toContain("calcChain");
    expect(contentTypes).not.toContain("calcChain");
    expect(sharedStrings).toContain("CDAD PROP LOS PLANOS 1A-1B");
    await expect(zip.file("xl/vbaProject.bin")!.async("uint8array")).resolves.toEqual(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    );
  });
});
