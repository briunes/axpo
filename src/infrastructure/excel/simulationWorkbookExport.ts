import JSZip from "jszip";
import type { ElectricityInputs } from "@/domain/types";

const INPUT_SHEET_NAME = "PETICION DATOS LUZ";
const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

export interface SimulationWorkbookExportInput {
  electricity: ElectricityInputs;
  clientName?: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeRate(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value > 1 ? value / 100 : value;
}

function excelDateSerial(value: string): number {
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(milliseconds)) throw new Error(`Invalid simulation date: ${value}`);
  return milliseconds / 86400000 + 25569;
}

function cellValues(input: SimulationWorkbookExportInput): Record<string, string | number> {
  const electricity = input.electricity;
  const values: Record<string, string | number> = {
    E8: electricity.tarifaAcceso,
    E11: electricity.zonaGeografica,
    E14: input.clientName ?? "",
    D24: excelDateSerial(electricity.periodo.fechaInicio),
    E24: excelDateSerial(electricity.periodo.fechaFin),
    E35: electricity.excesoPotencia ?? 0,
    E47: electricity.excesoPotencia ?? 0,
    E48: electricity.extras?.alquilerEquipoMedida ?? 0,
    E49: electricity.extras?.otrosCargos ?? 0,
    E50: normalizeRate(electricity.extras?.ivaTasa, 0.21),
    E51: normalizeRate(electricity.extras?.impuestoElectricoTasa, 0.0511269),
    E53: electricity.facturaActual,
    E57: electricity.perfilCarga,
  };

  PERIODS.forEach((period, index) => {
    values[`E${28 + index}`] = electricity.potenciaContratada?.[period] ?? 0;
    values[`E${39 + index}`] = electricity.consumo?.[period] ?? 0;
  });

  return values;
}

function replaceCell(
  sheetXml: string,
  address: string,
  value: number,
  sharedString = false,
): string {
  const cellPattern = new RegExp(`<c\\b([^>]*\\br="${address}"[^>]*)>[\\s\\S]*?<\\/c>`);
  const selfClosingPattern = new RegExp(`<c\\b([^>]*\\br="${address}"[^>]*)\\s*\\/>`);
  // Blank Excel inputs are commonly self-closing (`<c .../>`). Check those
  // first; otherwise the paired-tag regex can consume through a later `</c>`
  // and corrupt all intervening cell records.
  const match = sheetXml.match(selfClosingPattern) ?? sheetXml.match(cellPattern);
  if (!match) {
    throw new Error(`Workbook input cell ${INPUT_SHEET_NAME}!${address} was not found`);
  }

  const attributes = match[1]
    .replace(/\s+t="[^"]*"/g, "")
    .replace(/\s*\/$/, "");
  const replacement = sharedString
    ? `<c${attributes} t="s"><v>${value}</v></c>`
    : `<c${attributes}><v>${Number.isFinite(value) ? value : 0}</v></c>`;

  return sheetXml.replace(match[0], replacement);
}

function appendSharedStrings(
  sharedStringsXml: string,
  values: string[],
): { xml: string; indexes: number[] } {
  const uniqueCountMatch = sharedStringsXml.match(/\buniqueCount="(\d+)"/);
  const countMatch = sharedStringsXml.match(/\bcount="(\d+)"/);
  if (!uniqueCountMatch || !countMatch || !sharedStringsXml.includes("</sst>")) {
    throw new Error("Invalid workbook shared-string table");
  }

  const uniqueCount = Number(uniqueCountMatch[1]);
  const count = Number(countMatch[1]);
  const additions = values.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join("");
  return {
    xml: sharedStringsXml
      .replace(`uniqueCount="${uniqueCount}"`, `uniqueCount="${uniqueCount + values.length}"`)
      .replace(`count="${count}"`, `count="${count + values.length}"`)
      .replace("</sst>", `${additions}</sst>`),
    indexes: values.map((_, index) => uniqueCount + index),
  };
}

function workbookSheetPath(workbookXml: string, relsXml: string): string {
  const sheetPattern = new RegExp(
    `<sheet\\b[^>]*name="${INPUT_SHEET_NAME}"[^>]*r:id="([^"]+)"[^>]*/?>`,
  );
  const sheetMatch = workbookXml.match(sheetPattern);
  if (!sheetMatch) throw new Error(`Workbook sheet "${INPUT_SHEET_NAME}" was not found`);

  const relationshipPattern = new RegExp(
    `<Relationship\\b[^>]*Id="${sheetMatch[1]}"[^>]*Target="([^"]+)"[^>]*/?>`,
  );
  const relationshipMatch = relsXml.match(relationshipPattern);
  if (!relationshipMatch) throw new Error(`Workbook relationship ${sheetMatch[1]} was not found`);

  const target = relationshipMatch[1].replace(/^\//, "");
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
}

function enableFullRecalculation(workbookXml: string): string {
  const calcPrPattern = /<calcPr\b([^>]*)\/?\s*>/;
  const match = workbookXml.match(calcPrPattern);
  if (!match) {
    return workbookXml.replace(
      "</workbook>",
      '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>',
    );
  }

  const attributes = match[1]
    .replace(/\s+calcMode="[^"]*"/g, "")
    .replace(/\s+fullCalcOnLoad="[^"]*"/g, "")
    .replace(/\s+forceFullCalc="[^"]*"/g, "")
    .replace(/\s*\/$/, "");
  return workbookXml.replace(
    match[0],
    `<calcPr${attributes} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`,
  );
}

function removeCalcChainRelationship(relsXml: string): string {
  return relsXml.replace(
    /<Relationship\b(?=[^>]*\bType="[^"]*\/calcChain")(?=[^>]*\bTarget="[^"]*calcChain\.xml")[^>]*\/>/g,
    "",
  );
}

function removeCalcChainContentType(contentTypesXml: string): string {
  return contentTypesXml.replace(
    /<Override\b(?=[^>]*\bPartName="\/xl\/calcChain\.xml")[^>]*\/>/g,
    "",
  );
}

/** Creates a filled copy without rebuilding the XLSM package. */
export async function fillSimulationWorkbook(
  source: Buffer,
  input: SimulationWorkbookExportInput,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(source);
  const workbookFile = zip.file("xl/workbook.xml");
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (!workbookFile || !relsFile || !contentTypesFile || !sharedStringsFile) {
    throw new Error("Invalid Excel workbook package");
  }

  const [workbookXml, relsXml, contentTypesXml, sharedStringsXml] = await Promise.all([
    workbookFile.async("string"),
    relsFile.async("string"),
    contentTypesFile.async("string"),
    sharedStringsFile.async("string"),
  ]);
  const sheetPath = workbookSheetPath(workbookXml, relsXml);
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error(`Workbook worksheet file ${sheetPath} was not found`);

  let sheetXml = await sheetFile.async("string");
  const entries = Object.entries(cellValues(input));
  const stringEntries = entries.filter((entry): entry is [string, string] => typeof entry[1] === "string");
  const appendedStrings = appendSharedStrings(
    sharedStringsXml,
    stringEntries.map(([, value]) => value),
  );
  const sharedStringIndexes = new Map(
    stringEntries.map(([address], index) => [address, appendedStrings.indexes[index]]),
  );
  for (const [address, value] of entries) {
    const sharedStringIndex = sharedStringIndexes.get(address);
    sheetXml = replaceCell(
      sheetXml,
      address,
      sharedStringIndex ?? (value as number),
      sharedStringIndex != null,
    );
  }
  zip.file(sheetPath, sheetXml);
  zip.file("xl/sharedStrings.xml", appendedStrings.xml);
  zip.file("xl/workbook.xml", enableFullRecalculation(workbookXml));
  // The calculation chain is a derived cache. Replacing inputs makes the old
  // chain invalid, so remove it and let Excel rebuild it during full recalc.
  zip.remove("xl/calcChain.xml");
  zip.file("xl/_rels/workbook.xml.rels", removeCalcChainRelationship(relsXml));
  zip.file("[Content_Types].xml", removeCalcChainContentType(contentTypesXml));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
