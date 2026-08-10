import JSZip from "jszip";
import { fillSimulationWorkbook } from "../simulationWorkbookExport";
import type { ElectricityInputs, GasInputs } from "@/domain/types";

const electricityAddresses = [
  "E8", "E11", "E14", "O7", "D24", "E24", "E25",
  "E28", "E29", "E30", "E31", "E32", "E33",
  "E35",
  "E39", "E40", "E41", "E42", "E43", "E44",
  "E47", "E48", "E49", "E50", "E51", "E53", "E57",
];
const customElectricityAddresses = [
  "I43", "J43", "K43", "L43", "M43", "N43",
  "I48", "J48", "K48", "L48", "M48", "N48",
];
const gasAddresses = [
  "E8", "E9", "E10", "E11", "E14", "E15", "E16", "E17", "E18",
  "D24", "E24", "E25", "E29", "D30", "E33", "E34", "E35", "E37", "E39",
];

function worksheetXml(addresses: string[]): string {
  return `<?xml version="1.0"?><worksheet><sheetData><row r="1">${addresses.map((address) => address === "D24" || address === "E24" ? `<c r="${address}" s="2"/>` : `<c r="${address}" s="2"><f>OLD_FORMULA</f><v>999</v></c>`).join("")}<c r="A1"><f>SUM(E28:E33)</f><v>0</v></c></row></sheetData></worksheet>`;
}

async function sourceWorkbook(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PETICION DATOS LUZ" sheetId="1" r:id="rId1"/><sheet name="PETICION DATOS GAS" sheetId="2" r:id="rId2"/><sheet name="COMPARATIVA LIBRE LUZ" sheetId="3" r:id="rId4"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>`);
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst count="1" uniqueCount="1"><si><t>Existing</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", worksheetXml(electricityAddresses));
  zip.file("xl/worksheets/sheet2.xml", worksheetXml(gasAddresses));
  zip.file("xl/worksheets/sheet3.xml", worksheetXml(customElectricityAddresses));
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
      billingMonth: "2026-04",
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
    expect(sheet).toContain('<c r="O7" s="2" t="s"><v>4</v></c>');
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
    expect(sharedStrings).toContain("ABRIL-26");
    expect(workbook).toContain('<sheet name="COMPARATIVA LIBRE LUZ" sheetId="3" r:id="rId4" state="hidden"/>');
    await expect(zip.file("xl/vbaProject.bin")!.async("uint8array")).resolves.toEqual(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    );
  });

  it("exports custom fixed prices and keeps their comparison sheet visible", async () => {
    const electricity = {
      tarifaAcceso: "2.0TD",
      zonaGeografica: "Peninsula",
      perfilCarga: "NORMAL",
      potenciaContratada: { P1: 10, P2: 10 },
      consumo: { P1: 100, P2: 100, P3: 100 },
      periodo: { fechaInicio: "2026-06-01", fechaFin: "2026-06-30", dias: 30 },
      billingMonth: "2026-06",
      facturaActual: 100,
      personalizadaFijo: {
        preciosPotencia: { P1: 0.1, P2: 0.2 },
        preciosEnergia: { P1: 0.11, P2: 0.12, P3: 0.13 },
      },
      extras: {},
    } as ElectricityInputs;

    const output = await fillSimulationWorkbook(await sourceWorkbook(), { electricity });
    const zip = await JSZip.loadAsync(output);
    const customSheet = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");

    expect(customSheet).toContain('<c r="I43" s="2"><v>0.1</v></c>');
    expect(customSheet).toContain('<c r="J43" s="2"><v>0.2</v></c>');
    expect(customSheet).toContain('<c r="I48" s="2"><v>0.11</v></c>');
    expect(customSheet).toContain('<c r="K48" s="2"><v>0.13</v></c>');
    expect(workbook).not.toContain('name="COMPARATIVA LIBRE LUZ" sheetId="3" r:id="rId4" state="hidden"');
  });

  it("fills the PETICION DATOS GAS inputs and preserves its day formula", async () => {
    const gas: GasInputs = {
      cups: "ES0200000000000001AB",
      consumoAnual: 12500,
      nombreTitular: "GAS CUSTOMER",
      personaContacto: "CONTACT",
      comercial: "AGENT",
      direccion: "GAS STREET 1",
      comercializadorActual: "CURRENT GAS SUPPLIER",
      tarifaAcceso: "RL02",
      zonaGeografica: "Peninsula",
      consumo: 875.5,
      telemedida: "NO",
      periodo: { fechaInicio: "2026-05-01", fechaFin: "2026-06-01", dias: 31 },
      facturaActual: 123.45,
      extras: { alquilerEquipoMedida: 2.5, otrosCargos: 1.25 },
      ivaTasa: 21,
      impuestoHidrocarburo: 0.00234,
    };

    const output = await fillSimulationWorkbook(await sourceWorkbook(), { gas });
    const zip = await JSZip.loadAsync(output);
    const sheet = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    const sharedStrings = await zip.file("xl/sharedStrings.xml")!.async("string");

    expect(sheet).toContain('<c r="E8" s="2" t="s"><v>1</v></c>');
    expect(sheet).toContain('<c r="E10" s="2"><v>12500</v></c>');
    expect(sheet).toContain('<c r="D24" s="2"><v>46143</v></c>');
    expect(sheet).toContain('<c r="E24" s="2"><v>46174</v></c>');
    expect(sheet).toContain('<c r="E25" s="2"><f>OLD_FORMULA</f><v>999</v></c>');
    expect(sheet).toContain('<c r="E29" s="2"><v>875.5</v></c>');
    expect(sheet).toContain('<c r="E35" s="2"><v>0.21</v></c>');
    expect(sheet).toContain('<c r="E37" s="2"><v>0.00234</v></c>');
    expect(sheet).toContain('<c r="E39" s="2"><v>123.45</v></c>');
    expect(sharedStrings).toContain("GAS CUSTOMER");
    expect(sharedStrings).toContain("Peninsula y Baleares");
    expect(zip.file("xl/calcChain.xml")).toBeNull();
  });
});
