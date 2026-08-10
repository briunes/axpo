import JSZip from "jszip";
import type { ElectricityInputs, GasInputs } from "@/domain/types";

const ELECTRICITY_INPUT_SHEET = "PETICION DATOS LUZ";
const GAS_INPUT_SHEET = "PETICION DATOS GAS";
const ELECTRICITY_CUSTOM_SHEET = "COMPARATIVA LIBRE LUZ";
const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

const SPANISH_MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

function excelBillingMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid billing month: ${value}`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid billing month: ${value}`);
  return `${SPANISH_MONTHS[month - 1]}-${match[1].slice(2)}`;
}

export interface SimulationWorkbookExportInput {
  electricity?: ElectricityInputs;
  gas?: GasInputs;
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

function electricityCellValues(
  electricity: ElectricityInputs,
  clientName?: string | null,
): Record<string, string | number> {
  const values: Record<string, string | number> = {
    E8: electricity.tarifaAcceso,
    E11: electricity.zonaGeografica,
    E14: clientName ?? "",
    O7: excelBillingMonth(
      electricity.billingMonth ?? electricity.periodo.fechaFin.slice(0, 7),
    ),
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

function gasCellValues(
  gas: GasInputs,
  clientName?: string | null,
): Record<string, string | number> {
  return {
    E8: gas.tarifaAcceso,
    E9: gas.cups ?? "",
    E10: gas.consumoAnual ?? 0,
    E11: "Peninsula y Baleares",
    E14: clientName ?? gas.nombreTitular ?? "",
    E15: gas.personaContacto ?? "",
    E16: gas.comercial ?? "",
    E17: gas.direccion ?? "",
    E18: gas.comercializadorActual ?? "",
    D24: excelDateSerial(gas.periodo.fechaInicio),
    E24: excelDateSerial(gas.periodo.fechaFin),
    E29: gas.consumo,
    D30: gas.telemedida,
    E33: gas.extras?.otrosCargos ?? 0,
    E34: gas.extras?.alquilerEquipoMedida ?? 0,
    E35: normalizeRate(gas.ivaTasa, 0.21),
    E37: gas.impuestoHidrocarburo ?? 0.00234,
    E39: gas.facturaActual,
  };
}

function replaceCell(
  sheetXml: string,
  address: string,
  value: number,
  sharedString = false,
  sheetName = ELECTRICITY_INPUT_SHEET,
): string {
  const cellPattern = new RegExp(`<c\\b([^>]*\\br="${address}"[^>]*)>[\\s\\S]*?<\\/c>`);
  const selfClosingPattern = new RegExp(`<c\\b([^>]*\\br="${address}"[^>]*)\\s*\\/>`);
  // Blank Excel inputs are commonly self-closing (`<c .../>`). Check those
  // first; otherwise the paired-tag regex can consume through a later `</c>`
  // and corrupt all intervening cell records.
  const match = sheetXml.match(selfClosingPattern) ?? sheetXml.match(cellPattern);
  if (!match) {
    throw new Error(`Workbook input cell ${sheetName}!${address} was not found`);
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

function findWorkbookSheetPath(
  workbookXml: string,
  relsXml: string,
  sheetName: string,
): string | undefined {
  const sheetPattern = new RegExp(
    `<sheet\\b[^>]*name="${sheetName}"[^>]*r:id="([^"]+)"[^>]*/?>`,
  );
  const sheetMatch = workbookXml.match(sheetPattern);
  if (!sheetMatch) return undefined;

  const relationshipPattern = new RegExp(
    `<Relationship\\b[^>]*Id="${sheetMatch[1]}"[^>]*Target="([^"]+)"[^>]*/?>`,
  );
  const relationshipMatch = relsXml.match(relationshipPattern);
  if (!relationshipMatch) return undefined;

  const target = relationshipMatch[1].replace(/^\//, "");
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
}

function workbookSheetPath(workbookXml: string, relsXml: string, sheetName: string): string {
  const path = findWorkbookSheetPath(workbookXml, relsXml, sheetName);
  if (!path) throw new Error(`Workbook sheet "${sheetName}" was not found`);
  return path;
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

function setWorksheetVisibility(
  workbookXml: string,
  sheetName: string,
  hidden: boolean,
): string {
  const sheetPattern = new RegExp(
    `<sheet\\b([^>]*name="${sheetName}"[^>]*)/?>`,
  );
  const match = workbookXml.match(sheetPattern);
  if (!match) return workbookXml;
  const attributes = match[1]
    .replace(/\s+state="[^"]*"/g, "")
    .replace(/\s*\/$/, "");
  return workbookXml.replace(
    match[0],
    `<sheet${attributes}${hidden ? ' state="hidden"' : ""}/>`,
  );
}

/** Creates a filled copy without rebuilding the XLSM package. */
export async function fillSimulationWorkbook(
  source: Buffer,
  input: SimulationWorkbookExportInput,
): Promise<Buffer> {
  if (Boolean(input.electricity) === Boolean(input.gas)) {
    throw new Error("Exactly one electricity or gas simulation input is required");
  }
  const sheetName = input.electricity ? ELECTRICITY_INPUT_SHEET : GAS_INPUT_SHEET;
  const values = input.electricity
    ? electricityCellValues(input.electricity, input.clientName)
    : gasCellValues(input.gas!, input.clientName);
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
  const sheetPath = workbookSheetPath(workbookXml, relsXml, sheetName);
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error(`Workbook worksheet file ${sheetPath} was not found`);

  let sheetXml = await sheetFile.async("string");
  const entries = Object.entries(values);
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
      sheetName,
    );
  }
  zip.file(sheetPath, sheetXml);

  let finalWorkbookXml = enableFullRecalculation(workbookXml);
  if (input.electricity) {
    const custom = input.electricity.personalizadaFijo;
    const hasCustomEnergyPrice = Object.values(custom?.preciosEnergia ?? {}).some(
      (value) => typeof value === "number" && value > 0,
    );
    const customSheetPath = findWorkbookSheetPath(
      workbookXml,
      relsXml,
      ELECTRICITY_CUSTOM_SHEET,
    );
    const customSheetFile = customSheetPath ? zip.file(customSheetPath) : null;
    if (customSheetFile && hasCustomEnergyPrice) {
      let customSheetXml = await customSheetFile.async("string");
      PERIODS.forEach((period, index) => {
        customSheetXml = replaceCell(
          customSheetXml,
          `${String.fromCharCode(73 + index)}43`,
          custom?.preciosPotencia?.[period] ?? 0,
          false,
          ELECTRICITY_CUSTOM_SHEET,
        );
        customSheetXml = replaceCell(
          customSheetXml,
          `${String.fromCharCode(73 + index)}48`,
          custom?.preciosEnergia?.[period] ?? 0,
          false,
          ELECTRICITY_CUSTOM_SHEET,
        );
      });
      zip.file(customSheetPath!, customSheetXml);
    }
    // An empty personalized offer otherwise recalculates as a near-zero invoice
    // and displays a fictitious ~100% saving in Excel.
    finalWorkbookXml = setWorksheetVisibility(
      finalWorkbookXml,
      ELECTRICITY_CUSTOM_SHEET,
      !hasCustomEnergyPrice,
    );
  }
  zip.file("xl/sharedStrings.xml", appendedStrings.xml);
  zip.file("xl/workbook.xml", finalWorkbookXml);
  // The calculation chain is a derived cache. Replacing inputs makes the old
  // chain invalid, so remove it and let Excel rebuild it during full recalc.
  zip.remove("xl/calcChain.xml");
  zip.file("xl/_rels/workbook.xml.rels", removeCalcChainRelationship(relsXml));
  zip.file("[Content_Types].xml", removeCalcChainContentType(contentTypesXml));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
