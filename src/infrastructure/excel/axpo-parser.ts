/**
 * AXPO Price Table Parser
 *
 * Parses AXPO Excel pricing files (.xlsm) and extracts base values.
 * Port of scripts/parse-xlsm-prices.py to TypeScript.
 */

import ExcelJS from "exceljs";

interface CellAddress {
  r: number;
  c: number;
}

type WorksheetLike = Record<string, any> & {
  "!ref"?: string;
};

interface WorkbookLike {
  SheetNames: string[];
  Sheets: Record<string, WorksheetLike>;
}

const encodeCol = (columnIndex: number): string => {
  let value = columnIndex + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

const decodeCol = (label: string): number =>
  label
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;

const encodeCell = ({ r, c }: CellAddress): string => `${encodeCol(c)}${r + 1}`;

const decodeCell = (address: string): CellAddress => {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid Excel cell address: ${address}`);
  return { c: decodeCol(match[1]), r: Number(match[2]) - 1 };
};

const decodeRange = (ref: string): { s: CellAddress; e: CellAddress } => {
  const [start, end = start] = ref.split(":");
  return { s: decodeCell(start), e: decodeCell(end) };
};

const excelCellValue = (value: ExcelJS.CellValue): unknown => {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  const record = value as unknown as Record<string, unknown>;
  if ("result" in record) return record.result;
  if ("text" in record) return record.text;
  if (Array.isArray(record.richText)) {
    return record.richText
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("");
  }
  if ("formula" in record || "sharedFormula" in record) return 0;
  return String(value);
};

const excelCellFormula = (cell: ExcelJS.Cell): string | undefined => {
  if (typeof cell.formula === "string") return cell.formula;

  const value = cell.value;
  if (value === null || value === undefined || typeof value !== "object") {
    return undefined;
  }

  const record = value as unknown as Record<string, unknown>;
  if (typeof record.formula === "string") return record.formula;
  if (typeof record.sharedFormula === "string") return record.sharedFormula;
  return undefined;
};

async function readWorkbook(buffer: Buffer): Promise<WorkbookLike> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const result: WorkbookLike = { SheetNames: [], Sheets: {} };
  workbook.eachSheet((worksheet) => {
    const sheet: WorksheetLike = {};
    let minRow = Number.POSITIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxRow = 0;
    let maxCol = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = excelCellValue(cell.value);
        const formula = excelCellFormula(cell);
        if (
          (value === undefined || value === null || value === "") &&
          !formula
        ) {
          return;
        }

        const r = rowNumber - 1;
        const c = colNumber - 1;
        sheet[encodeCell({ r, c })] = {
          v: value ?? "",
          ...(formula ? { f: formula } : {}),
        };
        minRow = Math.min(minRow, r);
        minCol = Math.min(minCol, c);
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      });
    });

    sheet["!ref"] =
      Number.isFinite(minRow) && Number.isFinite(minCol)
        ? `${encodeCell({ r: minRow, c: minCol })}:${encodeCell({
            r: maxRow,
            c: maxCol,
          })}`
        : "A1";

    result.SheetNames.push(worksheet.name);
    result.Sheets[worksheet.name] = sheet;
  });

  return result;
}

export interface BaseValueItem {
  key: string;
  valueNumeric?: number;
  valueText?: string;
  unit?: string;
}

export interface ParsedBaseValues {
  name: string;
  scopeType: BaseValueImportScope;
  sourceWorkbookRef?: string;
  sourceScope?: string;
  items: BaseValueItem[];
}

export type BaseValueImportScope = "GLOBAL" | "AGENCY" | "TLV";
export type ElectricityGeographicZone =
  | "PENINSULA"
  | "BALEARES"
  | "CANARIAS";

export interface AxpoImportProfile {
  scopeType: BaseValueImportScope;
  sourceScope?: string;
  fixedProductNames?: Record<string, string>;
  indexProductNames?: Record<string, string>;
  gasFixedProductNames?: Record<string, string>;
  gasIndexProductNames?: Record<string, string>;
  dinamicaSheetNames?: Record<string, [string, string]>;
}

export interface ParseAxpoExcelOptions {
  scopeType?: BaseValueImportScope;
  profile?: AxpoImportProfile;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ELEC_TARIFFS = new Set(["2.0TD", "3.0TD", "6.1TD"]);
const GAS_TARIFFS = new Set([
  "RL01",
  "RL02",
  "RL03",
  "RL04",
  "RL05",
  "RL06",
  "RLPS1",
  "RLPS2",
  "RLPS3",
  "RLPS4",
  "RLPS5",
  "RLPS6",
]);

const FIJO_PRODUCT_NAMES: Record<string, string> = {
  ESTABLE: "ESTABLE",
  "ESTABLE PLUS": "ESTABLE_PLUS",
  "1P PLUS (Periodo Único)": "1P_PLUS",
  "1P PLUS XL (Periodo Único)": "1P_PLUS_XL",
  "ESTABLE TALLERES": "ESTABLE_TALLERES",
  "ESTABLE PLUS TALLERES": "ESTABLE_PLUS_TALLERES",
};

const INDEX_PRODUCT_MAP: Record<string, string> = {
  "Dinamica Control": "DINAMICA_CONTROL",
  "Dinamica Control Plus": "DINAMICA_CONTROL_PLUS",
  "Dinamica Control Techo": "DINAMICA_CONTROL_TECHO",
  Dinamica: "DINAMICA",
  "Dinamica Plus": "DINAMICA_PLUS",
};

const IMPORT_PROFILES: Record<"GLOBAL" | "TLV", AxpoImportProfile> = {
  GLOBAL: {
    scopeType: "GLOBAL",
    sourceScope: "GLOBAL",
    fixedProductNames: {
      "1P PLUS SSCC LIBRES (Periodo Único)": "1P_PLUS_SSCC_LIBRES",
      "1P PLUS SSAA LIBRES (Periodo Único)": "1P_PLUS_SSCC_LIBRES",
    },
  },
  TLV: {
    scopeType: "TLV",
    sourceScope: "TLV",
    fixedProductNames: {
      "1PT PLUS (Periodo Único)": "1P_PLUS",
      "1PT PLUS": "1P_PLUS",
      "1P PLUS (Periodo Único)": "1P_PLUS",
      "1P PLUS XL (Periodo Único)": "1P_PLUS_XL",
    },
  },
};

export function inferAxpoImportScope(filename: string): "GLOBAL" | "TLV" {
  return /(^|[^A-Z])TELEVENTA([^A-Z]|$)|\bTLV\b/i.test(filename)
    ? "TLV"
    : "GLOBAL";
}

function resolveImportProfile(
  filename: string,
  options?: ParseAxpoExcelOptions,
): AxpoImportProfile {
  if (options?.profile) {
    return {
      ...options.profile,
      scopeType: options.scopeType ?? options.profile.scopeType,
    };
  }

  const scope = options?.scopeType ?? inferAxpoImportScope(filename);
  if (scope === "TLV") return IMPORT_PROFILES.TLV;
  return { ...IMPORT_PROFILES.GLOBAL, scopeType: scope };
}

const GAS_FIJO_PRODUCT_MAP: Record<string, [string, string]> = {
  "Fijo N1": ["FIJO", "N1"],
  "Fijo N2": ["FIJO", "N2"],
  "Fijo N3": ["FIJO", "N3"],
  "ESTABLE PLUS N1": ["ESTABLE_PLUS", "N1"],
  "ESTABLE PLUS N2": ["ESTABLE_PLUS", "N2"],
  "ESTABLE PLUS N3": ["ESTABLE_PLUS", "N3"],
};

const GAS_INDEX_PRODUCT_MAP: Record<string, [string, string]> = {
  "Indexado N1": ["INDEXADO", "N1"],
  "Indexado N2": ["INDEXADO", "N2"],
  "Indexado N3": ["INDEXADO", "N3"],
  "Dinamica plus N1": ["DINAMICA_PLUS", "N1"],
  "Dinamica plus N2": ["DINAMICA_PLUS", "N2"],
  "Dinamica plus N3": ["DINAMICA_PLUS", "N3"],
};

const MONTH_ES_TO_NUM: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

// Column layouts
const N1_COLS = ["B", "C", "D", "E", "F", "G"];
const N2_COLS = ["J", "K", "L", "M", "N", "O"];
const N3_COLS = ["R", "S", "T", "U", "V", "W"];

const INDEX_ENERGY_COLS = ["B", "C", "D", "E", "F", "G"];
const INDEX_POWER_COLS = ["K", "L", "M", "N", "O", "P"];

// ─── Utilities ───────────────────────────────────────────────────────────────

function safeFloat(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(num) ? null : num;
}

function detectPowerUnit(label: string): "día" | "mes" | "año" {
  const lower = label.toLowerCase();
  if (
    lower.includes("día") ||
    lower.includes("dia") ||
    lower.includes("/dia")
  ) {
    return "día";
  }
  if (lower.includes("mes")) {
    return "mes";
  }
  return "año";
}

function parseMibgasMonth(label: string): string | null {
  const match = label
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)-(\d{2})$/);
  if (!match) return null;

  const [, monthEs, yy] = match;
  const monthNum = MONTH_ES_TO_NUM[monthEs];
  if (!monthNum) return null;

  const year = `20${yy}`;
  return `MIBGAS:${year}-${monthNum}`;
}

function parseIndexProductTier(
  raw: string,
  profile: AxpoImportProfile,
): [string | null, string | null] {
  const match = raw.trim().match(/^(.*?)\s+(N[123])$/);
  if (!match) return [null, null];

  const productRaw = match[1].trim();
  const tier = match[2];
  const slug =
    profile.indexProductNames?.[productRaw] ||
    INDEX_PRODUCT_MAP[productRaw] ||
    null;

  return [slug, tier];
}

// ─── Sheet Parsers ───────────────────────────────────────────────────────────

interface SheetData {
  [row: number]: { [col: string]: any };
}

function worksheetToRows(
  sheet: WorksheetLike,
  maxRows: number = 300,
): SheetData {
  const rows: SheetData = {};
  const range = decodeRange(sheet["!ref"] || "A1");

  for (let R = range.s.r; R <= Math.min(range.e.r, maxRows - 1); R++) {
    const rowData: { [col: string]: any } = {};

    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = encodeCell({ r: R, c: C });
      const cell = sheet[cellAddress];

      if (cell && cell.v !== undefined && cell.v !== null) {
        const colLetter = encodeCol(C);
        rowData[colLetter] = cell.v;
      }
    }

    if (Object.keys(rowData).length > 0) {
      rows[R + 1] = rowData; // 1-indexed
    }
  }

  return rows;
}

function parseFijo(
  rows: SheetData,
  profile: AxpoImportProfile,
): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product block start rows
  const productStarts: [number, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (Object.keys(nonEmpty).length === 1 && nonEmpty["K"]) {
      const rawName = nonEmpty["K"];
      const cleanName = rawName.replace(/\s*\(.*?\)\s*$/, "").trim();
      const slug =
        profile.fixedProductNames?.[rawName] ||
        profile.fixedProductNames?.[cleanName] ||
        FIJO_PRODUCT_NAMES[rawName] ||
        FIJO_PRODUCT_NAMES[cleanName] ||
        // Auto-slug unknown products so new products are captured automatically
        cleanName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "");

      productStarts.push([rowNum, slug]);
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, slug] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 25;

    // Find POTENCIAS separator
    let potenciasRow: number | null = null;
    for (let r = start; r < end; r++) {
      const cells = rows[r] || {};
      for (const v of Object.values(cells)) {
        if (String(v).toUpperCase().includes("POTENCIAS")) {
          potenciasRow = r;
          break;
        }
      }
      if (potenciasRow) break;
    }

    // Parse energy rows
    const energyEnd = potenciasRow || end;
    for (let r = start; r < energyEnd; r++) {
      const cells = rows[r] || {};
      const tariff = String(cells["A"] || "").trim();

      if (!ELEC_TARIFFS.has(tariff)) continue;

      for (const [tier, colList] of [
        ["N1", N1_COLS],
        ["N2", N2_COLS],
        ["N3", N3_COLS],
      ] as const) {
        for (let i = 0; i < colList.length; i++) {
          const val = cells[colList[i]];
          const v = safeFloat(val);

          if (v !== null) {
            items.push({
              key: `ELEC:FIJO:${slug}:${tier}:${tariff}:P${i + 1}:ENERGIA`,
              valueNumeric: Math.round(v * 1e10) / 1e10,
              unit: "€/kWh",
            });
          }
        }
      }
    }

    // Parse power unit row
    let unitN1 = "año";
    let unitN2 = "año";
    let unitN3 = "año";

    if (potenciasRow) {
      for (let r = potenciasRow + 1; r < end; r++) {
        const cells = rows[r] || {};
        const a = String(cells["A"] || "");
        const iVal = String(cells["I"] || "");
        const qVal = String(cells["Q"] || "");

        if (a.includes("€/kW") || a.includes("€/KW")) {
          unitN1 = detectPowerUnit(a);
          unitN2 = iVal ? detectPowerUnit(iVal) : "año";
          unitN3 = qVal ? detectPowerUnit(qVal) : "año";
          break;
        }
      }
    }

    // Parse power rows
    if (potenciasRow) {
      for (let r = potenciasRow + 1; r < end; r++) {
        const cells = rows[r] || {};
        const tariff = String(cells["A"] || "").trim();

        if (!ELEC_TARIFFS.has(tariff)) continue;

        const unitMap: Record<string, string> = {
          N1: unitN1,
          N2: unitN2,
          N3: unitN3,
        };

        for (const [tier, colList] of [
          ["N1", N1_COLS],
          ["N2", N2_COLS],
          ["N3", N3_COLS],
        ] as const) {
          for (let i = 0; i < colList.length; i++) {
            const val = cells[colList[i]];
            let v = safeFloat(val);

            if (v !== null) {
              // Normalize to €/kW/año
              const unit = unitMap[tier];
              if (unit === "día") v *= 365;
              else if (unit === "mes") v *= 12;

              items.push({
                key: `ELEC:FIJO:${slug}:${tier}:${tariff}:P${i + 1}:POTENCIA`,
                valueNumeric: Math.round(v * 1e8) / 1e8,
                unit: "€/kW/año",
              });
            }
          }
        }
      }
    }
  }

  return items;
}

const ELECTRICITY_ZONES: ElectricityGeographicZone[] = [
  "PENINSULA",
  "BALEARES",
  "CANARIAS",
];

const ELECTRICITY_ZONE_LABELS: Record<ElectricityGeographicZone, string> = {
  PENINSULA: "Peninsula",
  BALEARES: "Baleares",
  CANARIAS: "Canarias",
};

/**
 * BASE DE DATOS FIJO is only a zone-selected view. Its formulas point at the
 * three complete regional tables in the individual fixed-product sheets. Build
 * that view once per zone from the formula references instead of importing the
 * workbook's single cached result.
 */
function parseZoneAwareFijo(
  workbook: WorkbookLike,
  sheet: WorksheetLike,
  profile: AxpoImportProfile,
): BaseValueItem[] {
  const baseRows = worksheetToRows(sheet);
  const items: BaseValueItem[] = [];

  for (const zone of ELECTRICITY_ZONES) {
    const rows: SheetData = Object.fromEntries(
      Object.entries(baseRows).map(([row, cells]) => [row, { ...cells }]),
    );
    const label = ELECTRICITY_ZONE_LABELS[zone];
    const range = decodeRange(sheet["!ref"] || "A1");

    for (let r = range.s.r; r <= Math.min(range.e.r, 299); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = encodeCell({ r, c });
        const formula = sheet[address]?.f;
        if (typeof formula !== "string") continue;

        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const branch = formula.match(
          new RegExp(
            `\\$?E\\$?11="${escapedLabel}"\\s*,\\s*'([^']+)'!\\$?([A-Z]+)\\$?(\\d+)`,
            "i",
          ),
        );
        const sourceValue = branch
          ? workbook.Sheets[branch[1]]?.[`${branch[2]}${branch[3]}`]?.v
          : undefined;
        // Some Excel branches deliberately target blank cells (SSCC in the
        // islands), while Talleres only defines a Peninsula branch. Both mean
        // a zero commercial price, not "reuse the cached Peninsula value".
        (rows[r + 1] ??= {})[encodeCol(c)] = sourceValue ?? 0;
      }
    }

    items.push(
      ...parseFijo(rows, profile).map((item) => ({
        ...item,
        key: `${item.key}:ZONE:${zone}`,
      })),
    );
  }

  return items;
}

function parseIndex(
  rows: SheetData,
  profile: AxpoImportProfile,
): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product blocks
  const productStarts: [number, string, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (Object.keys(nonEmpty).length === 1 && nonEmpty["A"]) {
      const [slug, tier] = parseIndexProductTier(nonEmpty["A"], profile);
      if (slug && tier) {
        productStarts.push([rowNum, slug, tier]);
      } else {
        // Auto-slug unknown index products (e.g. new tier variants)
        const match = nonEmpty["A"].trim().match(/^(.*?)\s+(N[123])$/);
        if (match) {
          const autoSlug = match[1]
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
          productStarts.push([rowNum, autoSlug, match[2]]);
        }
      }
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, slug, tier] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 10;

    for (let r = start; r < end; r++) {
      const cells = rows[r] || {};
      const tariff = String(cells["A"] || "").trim();

      if (!ELEC_TARIFFS.has(tariff)) continue;

      // Energy margin (cols B-G)
      for (let i = 0; i < INDEX_ENERGY_COLS.length; i++) {
        const val = cells[INDEX_ENERGY_COLS[i]];
        const v = safeFloat(val);

        if (v !== null) {
          items.push({
            key: `ELEC:INDEX:${slug}:${tier}:${tariff}:P${i + 1}:MARGEN`,
            valueNumeric: Math.round(v * 1e10) / 1e10,
            unit: "€/kWh",
          });
        }
      }

      // Power (cols K-P)
      const tariffJ = String(cells["J"] || "").trim();
      if (ELEC_TARIFFS.has(tariffJ)) {
        for (let i = 0; i < INDEX_POWER_COLS.length; i++) {
          const val = cells[INDEX_POWER_COLS[i]];
          const v = safeFloat(val);

          if (v !== null) {
            items.push({
              key: `ELEC:INDEX:${slug}:${tier}:${tariffJ}:P${i + 1}:POTENCIA`,
              valueNumeric: Math.round(v * 1e8) / 1e8,
              unit: "€/kW/año",
            });
          }
        }
      }
    }
  }

  return items;
}

function parseProductTierLabel(
  raw: string,
): { productLabel: string; tier: string } | null {
  const match = raw.trim().match(/^(.*?)\s+(N[123])$/);
  if (!match) return null;
  return { productLabel: match[1].trim(), tier: match[2] };
}

function normalizeLookupLabel(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeElectricityZone(
  value: unknown,
): ElectricityGeographicZone | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized === "PENINSULA") return "PENINSULA";
  if (normalized === "BALEARES") return "BALEARES";
  if (normalized === "CANARIAS") return "CANARIAS";
  return null;
}

function workbookElectricityZone(
  workbook: WorkbookLike,
): ElectricityGeographicZone | null {
  return normalizeElectricityZone(
    workbook.Sheets["PETICION DATOS LUZ"]?.E11?.v,
  );
}

const HIDDEN_FIXED_PRODUCT_MAP: Record<string, string> = {
  ESTABLE: "ESTABLE",
  "ESTABLE PLUS": "ESTABLE_PLUS",
  "1P": "1P_PLUS",
  "1P XL": "1P_PLUS_XL",
  "ESTABLE TALLER": "ESTABLE_TALLERES",
  "ESTABLE TALLER +": "ESTABLE_PLUS_TALLERES",
};

const HIDDEN_INDEX_PRODUCT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(INDEX_PRODUCT_MAP).map(([label, productKey]) => [
    normalizeLookupLabel(label),
    productKey,
  ]),
);

function parseHiddenElectricityLookup(
  sheet: WorksheetLike,
  zone: ElectricityGeographicZone | null,
): BaseValueItem[] {
  const items: BaseValueItem[] = [];
  const range = decodeRange(sheet["!ref"] || "A1");
  const periods = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const energyCols = [4, 5, 6, 7, 8, 9]; // E-J
  const powerCols = [10, 11, 12, 13, 14, 15]; // K-P, stored as €/kW/día

  for (let R = range.s.r; R <= range.e.r; R++) {
    const rawProduct = String(
      sheet[encodeCell({ r: R, c: 1 })]?.v ?? "",
    ).trim();
    const tariff = String(sheet[encodeCell({ r: R, c: 2 })]?.v ?? "").trim();
    const monthLabel = String(
      sheet[encodeCell({ r: R, c: 3 })]?.v ?? "",
    ).trim();

    if (!rawProduct || !ELEC_TARIFFS.has(tariff)) continue;

    const parsed = parseProductTierLabel(rawProduct);
    if (!parsed) continue;

    const monthKey = parseSpanishMonthYear(monthLabel);
    const normalizedProduct = normalizeLookupLabel(parsed.productLabel);
    const fixedProduct = HIDDEN_FIXED_PRODUCT_MAP[normalizedProduct];
    const indexProduct = HIDDEN_INDEX_PRODUCT_MAP[normalizedProduct];

    if (!fixedProduct && (!indexProduct || monthKey === null)) continue;

    for (let i = 0; i < periods.length; i++) {
      const energyValue = safeFloat(
        sheet[encodeCell({ r: R, c: energyCols[i] })]?.v,
      );
      if (energyValue !== null) {
        const key = fixedProduct
          ? `ELEC:FIJO:${fixedProduct}:${parsed.tier}:${tariff}:${periods[i]}:ENERGIA`
          : `ELEC:INDEX:${indexProduct}:${parsed.tier}:${tariff}:${periods[i]}:MARGEN:${monthKey}`;
        items.push({
          key: zone ? `${key}:ZONE:${zone}` : key,
          valueNumeric: Math.round(energyValue * 1e10) / 1e10,
          unit: "€/kWh",
        });
      }

      const dailyPowerValue = safeFloat(
        sheet[encodeCell({ r: R, c: powerCols[i] })]?.v,
      );
      if (dailyPowerValue !== null) {
        const key = fixedProduct
          ? `ELEC:FIJO:${fixedProduct}:${parsed.tier}:${tariff}:${periods[i]}:POTENCIA`
          : `ELEC:INDEX:${indexProduct}:${parsed.tier}:${tariff}:${periods[i]}:POTENCIA`;
        items.push({
          key: zone ? `${key}:ZONE:${zone}` : key,
          valueNumeric: Math.round(dailyPowerValue * 365 * 1e10) / 1e10,
          unit: "€/kW/año",
        });
      }
    }
  }

  return items;
}

function productAndTierFromGasLabel(
  rawName: string,
  configuredProductKey?: string | null,
): [string, string] | null {
  const match = rawName.trim().match(/^(.*?)\s+(N[123])$/);
  if (!match) return null;

  const productKey =
    configuredProductKey ||
    match[1]
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return [productKey, match[2]];
}

function parseGasFijo(
  rows: SheetData,
  profile: AxpoImportProfile,
): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product blocks
  const productStarts: [number, string, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (nonEmpty["A"] && Object.keys(nonEmpty).length <= 2) {
      const rawName = nonEmpty["A"];
      const configured = productAndTierFromGasLabel(
        rawName,
        profile.gasFixedProductNames?.[rawName],
      );
      const fallback = GAS_FIJO_PRODUCT_MAP[rawName];
      if (configured) {
        productStarts.push([rowNum, configured[0], configured[1]]);
      } else if (fallback) {
        productStarts.push([rowNum, fallback[0], fallback[1]]);
      } else {
        const auto = productAndTierFromGasLabel(rawName);
        if (auto) productStarts.push([rowNum, auto[0], auto[1]]);
      }
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, slug, tier] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 20;

    for (let r = start; r < end; r++) {
      const cells = rows[r] || {};

      // Península energy
      const tariffPen = String(cells["A"] || "").trim();
      if (GAS_TARIFFS.has(tariffPen)) {
        const v = safeFloat(cells["B"]);
        if (v !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffPen}:PEN:ENERGIA`,
            valueNumeric: Math.round(v * 1e10) / 1e10,
            unit: "€/kWh",
          });
        }
      }

      // Baleares energy
      const tariffBal = String(cells["E"] || "").trim();
      if (GAS_TARIFFS.has(tariffBal)) {
        const v = safeFloat(cells["F"]);
        if (v !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffBal}:BAL:ENERGIA`,
            valueNumeric: Math.round(v * 1e10) / 1e10,
            unit: "€/kWh",
          });
        }
      }

      // RL fixed terms
      // Note: ESTABLE PLUS uses "RLTB5"/"RLTB6" as aliases for RL05/RL06 in the
      // terminoDia column; normalise them to the canonical tariff names.
      const tariffRlRaw = String(cells["I"] || "").trim();
      const tariffRl =
        tariffRlRaw === "RLTB5"
          ? "RL05"
          : tariffRlRaw === "RLTB6"
            ? "RL06"
            : tariffRlRaw;
      if (tariffRl.startsWith("RL") && GAS_TARIFFS.has(tariffRl)) {
        const vDia = safeFloat(cells["J"]);
        const vAnio = safeFloat(cells["K"]);

        if (vDia !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffRl}:TERMINO_DIA`,
            valueNumeric: Math.round(vDia * 1e10) / 1e10,
            unit: "€/día",
          });
        }
        if (vAnio !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffRl}:TERMINO_ANIO`,
            valueNumeric: Math.round(vAnio * 1e6) / 1e6,
            unit: "€/año",
          });
        }
      }

      // RLPS fixed terms
      const tariffRlps = String(cells["M"] || "").trim();
      if (tariffRlps.startsWith("RLPS") && GAS_TARIFFS.has(tariffRlps)) {
        const vDia = safeFloat(cells["N"]);
        const vAnio = safeFloat(cells["O"]);

        if (vDia !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffRlps}:TERMINO_DIA`,
            valueNumeric: Math.round(vDia * 1e10) / 1e10,
            unit: "€/día",
          });
        }
        if (vAnio !== null) {
          items.push({
            key: `GAS:FIJO:${slug}:${tier}:${tariffRlps}:TERMINO_ANIO`,
            valueNumeric: Math.round(vAnio * 1e6) / 1e6,
            unit: "€/año",
          });
        }
      }
    }
  }

  return items;
}

function parseGasIndex(
  rows: SheetData,
  profile: AxpoImportProfile,
): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product blocks
  const productStarts: [number, string, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (nonEmpty["A"] && Object.keys(nonEmpty).length <= 2) {
      const rawName = nonEmpty["A"];
      const configured = productAndTierFromGasLabel(
        rawName,
        profile.gasIndexProductNames?.[rawName],
      );
      const fallback = GAS_INDEX_PRODUCT_MAP[rawName];
      if (configured) {
        productStarts.push([rowNum, configured[0], configured[1]]);
      } else if (fallback) {
        productStarts.push([rowNum, fallback[0], fallback[1]]);
      } else {
        const auto = productAndTierFromGasLabel(rawName);
        if (auto) productStarts.push([rowNum, auto[0], auto[1]]);
      }
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, slug, tier] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 20;

    for (let r = start; r < end; r++) {
      const cells = rows[r] || {};

      // Península margin
      const tariffPen = String(cells["A"] || "").trim();
      if (GAS_TARIFFS.has(tariffPen)) {
        const v = safeFloat(cells["B"]);
        if (v !== null) {
          items.push({
            key: `GAS:INDEX:${slug}:${tier}:${tariffPen}:PEN:MARGEN`,
            valueNumeric: Math.round(v * 1e10) / 1e10,
            unit: "€/kWh",
          });
        }
      }

      // Baleares margin
      const tariffBal = String(cells["E"] || "").trim();
      if (GAS_TARIFFS.has(tariffBal)) {
        const v = safeFloat(cells["F"]);
        if (v !== null) {
          items.push({
            key: `GAS:INDEX:${slug}:${tier}:${tariffBal}:BAL:MARGEN`,
            valueNumeric: Math.round(v * 1e10) / 1e10,
            unit: "€/kWh",
          });
        }
      }

      // MIBGAS reference prices (col J = month label, K = €/kWh)
      const monthLabel = String(cells["J"] || "").trim();
      if (monthLabel && monthLabel !== "Mes") {
        const mibgasKey = parseMibgasMonth(monthLabel);
        if (mibgasKey) {
          const v = safeFloat(cells["K"]);
          if (v !== null) {
            items.push({
              key: mibgasKey,
              valueNumeric: Math.round(v * 1e10) / 1e10,
              unit: "€/kWh",
            });
          }
        }
      }
    }
  }

  return items;
}

// ─── DINAMICA / DINAMICA PLUS individual sheet parsers ──────────────────────
//
// Each product sheet (e.g. "DINAMICA N1", "DINAMICA PLUS N2") contains a
// "PROMEDIO 12 MESES" row with the full all-in 12-month average "Precio TE"
// per tariff per period (€/MWh).  This value includes:
//   PMDh (OMIE pool price) + Sobrecostes + ATRe + CMi + CG
//
// We store these as the canonical MARGEN key (overwriting the placeholder
// CG-only values that BASE DE DATOS INDEX stores for DINAMICA products).
// Column layout in the "Precio TE" section (rows ~44-58 in each sheet):
//   6.1TD : P1-P6 at 0-indexed cols 6,7,8,9,10,11
//   3.0TD : P1-P6 at 0-indexed cols 25,26,27,28,29,30
//   2.0TD : P1-P3 at 0-indexed cols 45,46,47

// Sheet name → [product slug, tier]
// Sheet names are trimmed before lookup (some have trailing spaces in the workbook).
// Personalizada products use an empty-string tier (they have no N1/N2/N3 tiers).
const DINAMICA_SHEET_MAP: Record<string, [string, string]> = {
  "DINAMICA N1": ["DINAMICA", "N1"],
  "DINAMICA N2": ["DINAMICA", "N2"],
  "DINAMICA N3": ["DINAMICA", "N3"],
  "DINAMICA PLUS N1": ["DINAMICA_PLUS", "N1"],
  "DINAMICA PLUS N2": ["DINAMICA_PLUS", "N2"],
  "DINAMICA PLUS N3": ["DINAMICA_PLUS", "N3"],
  "DINAMICA CONTROL N1": ["DINAMICA_CONTROL", "N1"],
  "DINAMICA CONTROL N2": ["DINAMICA_CONTROL", "N2"],
  "DINAMICA CONTROL N3": ["DINAMICA_CONTROL", "N3"],
  "DINAMICA CONTROL PLUS N1": ["DINAMICA_CONTROL_PLUS", "N1"],
  "DINAMICA CONTROL PLUS N2": ["DINAMICA_CONTROL_PLUS", "N2"],
  "DINAMICA CONTROL PLUS N3": ["DINAMICA_CONTROL_PLUS", "N3"],
  "DINAMICA CONTROL TECHO N1": ["DINAMICA_CONTROL_TECHO", "N1"],
  "DINAMICA CONTROL TECHO N2": ["DINAMICA_CONTROL_TECHO", "N2"],
  "DINAMICA CONTROL TECHO N3": ["DINAMICA_CONTROL_TECHO", "N3"],
  // Personalizada products — same sheet layout as DINAMICA, no tier variant
  "PERSONALIZADA INDEX": ["PERSONALIZADA_INDEX", ""],
  "PERSONALIZADA OMIE + B": ["PERSONALIZADA_OMIE_B", ""],
};

// Per-tariff column positions (0-indexed) for the Precio TE average values.
// Layout confirmed from DINAMICA N1 sheet analysis.
const PRECIO_TE_COLS: Array<{
  tariff: string;
  periods: string[];
  cols: number[];
  bCols: number[];
}> = [
  {
    tariff: "6.1TD",
    periods: ["P1", "P2", "P3", "P4", "P5", "P6"],
    cols: [6, 7, 8, 9, 10, 11],
    bCols: [2, 3, 4, 5, 6, 7],
  },
  {
    tariff: "3.0TD",
    periods: ["P1", "P2", "P3", "P4", "P5", "P6"],
    cols: [25, 26, 27, 28, 29, 30],
    bCols: [21, 22, 23, 24, 25, 26],
  },
  {
    tariff: "2.0TD",
    periods: ["P1", "P2", "P3"],
    cols: [45, 46, 47],
    bCols: [43, 44, 45],
  },
];

const OMIE_B_FACTOR_REFS: Record<
  string,
  Record<string, { profileCol: number; predhCol: number }>
> = {
  "6.1TD": {
    P1: { profileCol: 11, predhCol: 9 },
    P2: { profileCol: 12, predhCol: 10 },
    P3: { profileCol: 13, predhCol: 11 },
    P4: { profileCol: 14, predhCol: 12 },
    P5: { profileCol: 15, predhCol: 13 },
    P6: { profileCol: 16, predhCol: 14 },
  },
  "3.0TD": {
    P1: { profileCol: 30, predhCol: 28 },
    P2: { profileCol: 31, predhCol: 29 },
    P3: { profileCol: 32, predhCol: 30 },
    P4: { profileCol: 33, predhCol: 31 },
    P5: { profileCol: 34, predhCol: 32 },
    P6: { profileCol: 35, predhCol: 33 },
  },
  "2.0TD": {
    P1: { profileCol: 50, predhCol: 48 },
    P2: { profileCol: 51, predhCol: 49 },
    P3: { profileCol: 52, predhCol: 50 },
  },
};

const PERSONALIZADA_INDEX_MARGIN_FACTOR = 1.01528;

function personalizadaIndexEnergyMarginMwh(
  sheet: WorksheetLike,
  tariff: string,
  periodIndex: number,
): number {
  let primaryRef: { r: number; c: number } | null = null;
  let secondaryRef: { r: number; c: number } | null = null;

  if (tariff === "6.1TD") {
    primaryRef = { r: 44, c: 15 + periodIndex }; // P45:U45
    secondaryRef = { r: 47, c: 15 + periodIndex }; // P48:U48
  } else if (tariff === "3.0TD") {
    primaryRef = { r: 44, c: 34 + periodIndex }; // AI45:AN45
    secondaryRef = { r: 47, c: 34 + periodIndex }; // AI48:AN48
  } else if (tariff === "2.0TD") {
    primaryRef = { r: 45, c: 51 + periodIndex }; // AZ46:BB46
    secondaryRef = { r: 48, c: 51 + periodIndex }; // AZ49:BB49
  }

  if (!primaryRef) return 0;

  const primary = safeFloat(sheet[encodeCell(primaryRef)]?.v) ?? 0;
  const secondary = secondaryRef
    ? (safeFloat(sheet[encodeCell(secondaryRef)]?.v) ?? 0)
    : 0;

  return primary + secondary;
}

function computeOmieBFactor(
  sheet: WorksheetLike,
  row: number,
  tariff: string,
  period: string,
): number | null {
  const factorRefs = OMIE_B_FACTOR_REFS[tariff]?.[period];
  const profileRow = row - 30;
  if (!factorRefs || profileRow < 0) return null;

  const profile = safeFloat(
    sheet[
      encodeCell({
        r: profileRow,
        c: factorRefs.profileCol,
      })
    ]?.v,
  );
  const predh = safeFloat(
    sheet[encodeCell({ r: 6, c: factorRefs.predhCol })]?.v,
  );
  if (profile === null || predh === null) return null;

  return Math.round((1 + (profile * predh) / 100) * 1.01528 * 1e10) / 1e10;
}

function averageRefsFromFormula(
  formula: string | undefined,
  zone: string,
): Array<{ r: number; c: number }> {
  if (!formula) return [];
  const averageMatches = Array.from(
    formula.matchAll(/AVERAGE\(([^)]*)\)/gi),
    (match) => match[1],
  );
  if (averageMatches.length === 0) return [];

  const zoneUp = zone.trim().toUpperCase();
  const selectedAverage =
    averageMatches.length > 1 && zoneUp.includes("CANARIAS")
      ? averageMatches[1]
      : averageMatches[0];

  const refs: CellAddress[] = [];
  for (const part of selectedAverage.split(",")) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(
      /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i,
    );
    if (rangeMatch) {
      const start = decodeCell(`${rangeMatch[1]}${rangeMatch[2]}`);
      const end = decodeCell(`${rangeMatch[3]}${rangeMatch[4]}`);
      for (let r = Math.min(start.r, end.r); r <= Math.max(start.r, end.r); r++) {
        for (
          let c = Math.min(start.c, end.c);
          c <= Math.max(start.c, end.c);
          c++
        ) {
          refs.push({ r, c });
        }
      }
      continue;
    }

    refs.push(
      ...Array.from(trimmed.matchAll(/\$?([A-Z]+)\$?(\d+)/gi), (match) =>
        decodeCell(`${match[1]}${match[2]}`),
      ),
    );
  }
  return refs;
}

function profileRefsFromFormula(
  formula: string | undefined,
): { normalRef: CellAddress; diurnoRef: CellAddress } | null {
  if (!formula || !formula.toUpperCase().includes("E57")) return null;
  const refs = Array.from(
    formula.matchAll(/'INPUT OMIE'!\$?([A-Z]+)\$?(\d+)/gi),
    (match) => decodeCell(`${match[1]}${match[2]}`),
  );
  if (refs.length < 2) return null;
  return { normalRef: refs[0], diurnoRef: refs[1] };
}

function localRefsFromFormula(formula: string | undefined): CellAddress[] {
  if (!formula) return [];
  const refs: CellAddress[] = [];
  for (const match of formula.matchAll(/\$?([A-Z]{1,3})\$?(\d+)/gi)) {
    const start = match.index ?? 0;
    const previous = start > 0 ? formula[start - 1] : "";
    // Skip references that are explicitly qualified with a sheet name.
    if (previous === "!") continue;
    refs.push(decodeCell(`${match[1]}${match[2]}`));
  }
  return refs;
}

function formulaCellValue(sheet: WorksheetLike, ref: CellAddress): number | null {
  return safeFloat(sheet[encodeCell(ref)]?.v);
}

function splitFormulaArguments(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function unwrapFormulaParentheses(value: string): string {
  let result = value.trim();
  while (result.startsWith("(") && result.endsWith(")")) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < result.length; i++) {
      if (result[i] === "(") depth++;
      else if (result[i] === ")") depth--;
      if (depth === 0 && i < result.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (!wrapsAll) break;
    result = result.slice(1, -1).trim();
  }
  return result;
}

/** Evaluate the small, deterministic Excel formula subset used by Precio TE. */
function evaluateZoneFormulaCell(
  workbook: WorkbookLike,
  sheetName: string,
  address: string,
  zone: "Peninsula" | "Canarias",
  cache: Map<string, number | string | null>,
  profile?: "NORMAL" | "DIURNO",
): number | string | null {
  const resolvedSheetName =
    workbook.SheetNames.find((name) => name === sheetName) ??
    workbook.SheetNames.find((name) => name.trim() === sheetName.trim()) ??
    sheetName;
  sheetName = resolvedSheetName;

  if (
    sheetName.trim() === "PETICION DATOS LUZ" &&
    address.replace(/\$/g, "") === "E11"
  ) {
    return zone;
  }
  if (
    profile &&
    sheetName.trim() === "PETICION DATOS LUZ" &&
    address.replace(/\$/g, "") === "E57"
  ) {
    return profile;
  }
  const cacheKey = `${sheetName}!${address}:${zone}:${profile ?? "CACHED"}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;
  const cell = workbook.Sheets[sheetName]?.[address.replace(/\$/g, "")];
  if (!cell) return null;
  cache.set(cacheKey, null);

  const evaluate = (raw: string): number | string | null => {
    let expression = unwrapFormulaParentheses(
      raw.trim().replace(/^=/, "").replace(/_xlfn\./gi, ""),
    );
    if (expression === '""') return "";
    if (/^".*"$/.test(expression)) return expression.slice(1, -1);
    const literal = Number(expression);
    if (Number.isFinite(literal)) return literal;

    const call = expression.match(/^([A-Z]+)\(([\s\S]*)\)$/i);
    if (call) {
      const name = call[1].toUpperCase();
      const args = splitFormulaArguments(call[2]);
      if (name === "IF") {
        return evaluate(args[0]) ? evaluate(args[1]) : evaluate(args[2]);
      }
      if (name === "IFS") {
        for (let i = 0; i + 1 < args.length; i += 2) {
          if (evaluate(args[i])) return evaluate(args[i + 1]);
        }
        return null;
      }
      if (name === "IFERROR") {
        try {
          return evaluate(args[0]);
        } catch {
          return args.length > 1 ? evaluate(args[1]) : null;
        }
      }
      if (name === "AVERAGE") {
        const values = args
          .map(evaluate)
          .filter((item): item is number => typeof item === "number");
        return values.length
          ? values.reduce((sum, item) => sum + item, 0) / values.length
          : null;
      }
    }

    const equality = expression.match(/^([\s\S]*?)=([\s\S]*)$/);
    if (equality && !/[<>]/.test(expression)) {
      const left = evaluate(equality[1]);
      const right = evaluate(equality[2]);
      const normalizedLeft = left === "" || left === null ? 0 : left;
      const normalizedRight = right === "" || right === null ? 0 : right;
      return normalizedLeft === normalizedRight ? 1 : 0;
    }

    const directReference = expression.match(
      /^(?:'([^']+)'|([A-Za-z0-9 _.+\-]+))!\$?([A-Z]+)\$?(\d+)$|^\$?([A-Z]+)\$?(\d+)$/,
    );
    if (directReference) {
      const targetSheet =
        directReference[1] || directReference[2] || sheetName;
      const targetAddress = directReference[3]
        ? `${directReference[3]}${directReference[4]}`
        : `${directReference[5]}${directReference[6]}`;
      return evaluateZoneFormulaCell(
        workbook,
        targetSheet,
        targetAddress,
        zone,
        cache,
        profile,
      );
    }

    expression = expression.replace(
      /(?:'([^']+)'|([A-Za-z0-9 _.+\-]+))!\$?([A-Z]+)\$?(\d+)|\$?([A-Z]+)\$?(\d+)/g,
      (match, quotedSheet, plainSheet, crossCol, crossRow, localCol, localRow) => {
        const targetSheet = quotedSheet || plainSheet || sheetName;
        const targetAddress = crossCol
          ? `${crossCol}${crossRow}`
          : `${localCol}${localRow}`;
        const result = evaluateZoneFormulaCell(
          workbook,
          targetSheet,
          targetAddress,
          zone,
          cache,
          profile,
        );
        if (result === "" || result === null) return "0";
        if (typeof result !== "number" || !Number.isFinite(result)) {
          throw new Error(`Non-numeric formula reference ${match}`);
        }
        return String(result);
      },
    );
    if (!/^[0-9eE+\-*/().\s]+$/.test(expression)) {
      throw new Error(`Unsupported Excel formula: ${expression}`);
    }
    // Formula text has been reduced to numeric literals and arithmetic only.
    const result = Function(`"use strict"; return (${expression});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  };

  let result: number | string | null;
  if (typeof cell.f === "string") {
    try {
      result = evaluate(cell.f);
    } catch {
      result = safeFloat(cell.v);
    }
  } else {
    result = typeof cell.v === "string" ? cell.v : safeFloat(cell.v);
  }
  cache.set(cacheKey, result);
  return result;
}

function profileSensitivityFromFormula(
  sheet: WorksheetLike,
  formula: string | undefined,
): number {
  if (!formula) return 1;
  const factorMatch = formula.match(
    /\(1\+\$?([A-Z]{1,3})\$?(\d+)\*\$?([A-Z]{1,3})\$?(\d+)\/100\)/i,
  );
  const upliftMatch = formula.match(/\*\(1\+([0-9]+(?:\.[0-9]+)?)\)/);
  const uplift = upliftMatch ? Number(upliftMatch[1]) : 0;
  if (!factorMatch) return 1 + uplift;

  const left = formulaCellValue(
    sheet,
    decodeCell(`${factorMatch[1]}${factorMatch[2]}`),
  );
  const right = formulaCellValue(
    sheet,
    decodeCell(`${factorMatch[3]}${factorMatch[4]}`),
  );
  if (left === null || right === null) return 1 + uplift;
  return (1 + (left * right) / 100) * (1 + uplift);
}

function profilePricesFromFormulaCell(
  sheet: WorksheetLike,
  inputOmieSheet: WorksheetLike | undefined,
  cell: { v?: unknown; f?: string } | undefined,
  seen = new Set<string>(),
): { normalMwh: number; diurnoMwh: number } | null {
  if (!cell?.f || !inputOmieSheet) return null;

  const directRefs = profileRefsFromFormula(cell.f);
  if (directRefs) {
    const normalMwh = safeFloat(
      inputOmieSheet[encodeCell(directRefs.normalRef)]?.v,
    );
    const diurnoMwh = safeFloat(
      inputOmieSheet[encodeCell(directRefs.diurnoRef)]?.v,
    );
    return normalMwh !== null && diurnoMwh !== null
      ? { normalMwh, diurnoMwh }
      : null;
  }

  const averageRefs = averageRefsFromFormula(cell.f, "Peninsula");
  if (averageRefs.length > 0) {
    const values = averageRefs
      .map((ref) =>
        profilePricesFromFormulaCell(
          sheet,
          inputOmieSheet,
          sheet[encodeCell(ref)],
          seen,
        ),
      )
      .filter(
        (
          value,
        ): value is {
          normalMwh: number;
          diurnoMwh: number;
        } => value !== null,
      );
    if (values.length === 0) return null;
    return {
      normalMwh:
        values.reduce((acc, value) => acc + value.normalMwh, 0) /
        values.length,
      diurnoMwh:
        values.reduce((acc, value) => acc + value.diurnoMwh, 0) /
        values.length,
    };
  }

  for (const ref of localRefsFromFormula(cell.f)) {
    const address = encodeCell(ref);
    if (seen.has(address)) continue;
    seen.add(address);

    const referencedCell = sheet[address];
    const nested = profilePricesFromFormulaCell(
      sheet,
      inputOmieSheet,
      referencedCell,
      seen,
    );
    if (nested) {
      const currentFinal = safeFloat(cell.v);
      // Intermediate pass-through cells (for example Y19 -> Y16 -> F16) do
      // not reference INPUT OMIE directly, but their cached value is still the
      // NORMAL profile value used by the outer Precio TE formula. Preserve that
      // value so the NORMAL/DIURNO delta is transformed by every outer formula
      // instead of returning the raw shared OMIE component for every product.
      const currentProfile = safeFloat(referencedCell?.v);

      if (currentFinal !== null && currentProfile !== null) {
        const sensitivity = profileSensitivityFromFormula(sheet, cell.f);
        return {
          normalMwh:
            currentFinal + (nested.normalMwh - currentProfile) * sensitivity,
          diurnoMwh:
            currentFinal + (nested.diurnoMwh - currentProfile) * sensitivity,
        };
      }

      return nested;
    }
  }

  return null;
}

// Spanish month name → zero-padded month number
const SPANISH_MONTH_MAP: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

/**
 * Parse a Spanish month-year label like "ENERO-26" or "MARZO-26" into an
 * ISO year-month string like "2026-01" / "2026-03".
 */
function parseSpanishMonthYear(s: string): string | null {
  const m = s
    .trim()
    .toUpperCase()
    .match(/^([A-ZÁÉÍÓÚ]+)-(\d{2})$/);
  if (!m) return null;
  const month = SPANISH_MONTH_MAP[m[1]];
  if (!month) return null;
  const year = 2000 + parseInt(m[2], 10);
  return `${year}-${month}`;
}

/**
 * Parse a DINAMICA / DINAMICA PLUS product sheet.
 *
 * The "Precio TE" section (rows ~45-58) contains:
 *   - One row per billing month (label like "ENERO-26") with the actual
 *     all-in energy price (PMDh + ATRe + CMi + Sobrecostes + CG) in €/MWh.
 *   - A "PROMEDIO 12 MESES" summary row with the 12-month average.
 *
 * We store:
 *   - Per-month keys:  ELEC:INDEX:<product>:<tier>:<tariff>:<P>:MARGEN:YYYY-MM
 *     (used by the calculation to match the simulation's billing month exactly,
 *      which is what the Excel simulator does)
 *   - PROMEDIO key:    ELEC:INDEX:<product>:<tier>:<tariff>:<P>:MARGEN
 *     (used as a fallback when no month-specific key is available)
 *
 * @param potenciaByTariff
 *   When true (always recommended): each tariff row is emitted only for its own
 *   tariff.  Earlier code used false for DINAMICA products under the (incorrect)
 *   assumption that the Excel VLOOKUP always referenced the 6.1TD row regardless
 *   of tariff — analysis of simulator results confirmed this was wrong.
 */
function parseDinamicaSheet(
  sheet: WorksheetLike,
  inputOmieSheet: WorksheetLike | undefined,
  product: string,
  tier: string,
  potenciaByTariff = false,
  zoneContext?: {
    workbook: WorkbookLike;
    sheetName: string;
    zone: "Peninsula" | "Canarias";
  },
): BaseValueItem[] {
  const items: BaseValueItem[] = [];
  const range = decodeRange(sheet["!ref"] || "A1");

  // The "Precio TE" section starts after the header row that has "Precio TE" at
  // col 4.  Each subsequent row either holds a month ("ENERO-26" etc.) or is the
  // PROMEDIO summary row.  We stop after the PROMEDIO row.
  let inSection = false;
  const zone =
    zoneContext?.zone ??
    String(sheet[encodeCell({ r: 41, c: 6 })]?.v ?? "Peninsula");
  const zoneFormulaCache = new Map<string, number | string | null>();
  const promedioBFactors = new Map<string, { sum: number; count: number }>();

  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[encodeCell({ r: R, c: 4 })];
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : "";
    const labelUp = labelRaw.toUpperCase();

    // Detect the header that begins the Precio TE section
    if (!inSection) {
      if (labelUp.startsWith("PRECIO TE")) {
        inSection = true;
      }
      continue;
    }

    // Determine row type
    const isPromedio = labelUp.includes("PROMEDIO");
    const monthKey = isPromedio ? null : parseSpanishMonthYear(labelRaw);

    // Skip rows that are neither a month row nor the PROMEDIO row
    if (!isPromedio && monthKey === null) continue;

    // Extract prices for each tariff × period using the known column layout
    for (const { tariff, periods, cols, bCols } of PRECIO_TE_COLS) {
      for (let i = 0; i < periods.length; i++) {
        const cell = sheet[encodeCell({ r: R, c: cols[i] })];
        if (!cell || cell.v === undefined || cell.v === null) continue;
        const v = zoneContext
          ? safeFloat(
              evaluateZoneFormulaCell(
                zoneContext.workbook,
                zoneContext.sheetName,
                encodeCell({ r: R, c: cols[i] }),
                zoneContext.zone,
                zoneFormulaCache,
              ),
            )
          : safeFloat(cell.v);
        if (v === null || (!zoneContext && v <= 0)) continue;
        const baseKey = `ELEC:INDEX:${product}:${tier}:${tariff}:${periods[i]}:MARGEN`;
        let adjustedMwh = v;
        let bFactor: number | null = null;
        const factorKey = `ELEC:INDEX:${product}:${tier}:${tariff}:${periods[i]}:B_FACTOR`;

        if (product === "PERSONALIZADA_INDEX") {
          const embeddedMargin = personalizadaIndexEnergyMarginMwh(
            sheet,
            tariff,
            i,
          );
          if (embeddedMargin !== 0) {
            adjustedMwh = Math.max(
              0,
              adjustedMwh - embeddedMargin * PERSONALIZADA_INDEX_MARGIN_FACTOR,
            );
          }
        } else if (product === "PERSONALIZADA_OMIE_B") {
          if (isPromedio) {
            const factors = averageRefsFromFormula(cell.f, zone)
              .map((ref) =>
                computeOmieBFactor(sheet, ref.r, tariff, periods[i]),
              )
              .filter((factor): factor is number => factor !== null);
            if (factors.length > 0) {
              bFactor =
                Math.round(
                  (factors.reduce((acc, factor) => acc + factor, 0) /
                    factors.length) *
                    1e10,
                ) / 1e10;
            } else {
              const promedio = promedioBFactors.get(factorKey);
              if (promedio && promedio.count > 0) {
                bFactor =
                  Math.round((promedio.sum / promedio.count) * 1e10) / 1e10;
              }
            }
          } else {
            bFactor = computeOmieBFactor(sheet, R, tariff, periods[i]);
            if (bFactor !== null) {
              const promedio = promedioBFactors.get(factorKey) ?? {
                sum: 0,
                count: 0,
              };
              promedio.sum += bFactor;
              promedio.count += 1;
              promedioBFactors.set(factorKey, promedio);
            }
          }

          const embeddedB = safeFloat(
            sheet[encodeCell({ r: 28, c: bCols[i] })]?.v,
          );
          if (embeddedB !== null && bFactor !== null) {
            adjustedMwh = Math.max(0, adjustedMwh - embeddedB * bFactor);
          }
        }

        const profilePrices = zoneContext
          ? null
          : profilePricesFromFormulaCell(sheet, inputOmieSheet, cell);
        const normalRawMwh = zoneContext
          ? safeFloat(
              evaluateZoneFormulaCell(
                zoneContext.workbook,
                zoneContext.sheetName,
                encodeCell({ r: R, c: cols[i] }),
                zoneContext.zone,
                zoneFormulaCache,
                "NORMAL",
              ),
            )
          : (profilePrices?.normalMwh ?? null);
        const diurnoRawMwh = zoneContext
          ? safeFloat(
              evaluateZoneFormulaCell(
                zoneContext.workbook,
                zoneContext.sheetName,
                encodeCell({ r: R, c: cols[i] }),
                zoneContext.zone,
                zoneFormulaCache,
                "DIURNO",
              ),
            )
          : (profilePrices?.diurnoMwh ?? null);

        const toAdjustedKwh = (rawMwh: number): number => {
          let adjusted = rawMwh;
          if (product === "PERSONALIZADA_INDEX") {
            const embeddedMargin = personalizadaIndexEnergyMarginMwh(
              sheet,
              tariff,
              i,
            );
            if (embeddedMargin !== 0) {
              adjusted = Math.max(
                0,
                adjusted - embeddedMargin * PERSONALIZADA_INDEX_MARGIN_FACTOR,
              );
            }
          } else if (product === "PERSONALIZADA_OMIE_B") {
            const embeddedB = safeFloat(
              sheet[encodeCell({ r: 28, c: bCols[i] })]?.v,
            );
            if (embeddedB !== null && bFactor !== null) {
              adjusted = Math.max(0, adjusted - embeddedB * bFactor);
            }
          }
          return Math.round((adjusted / 1000) * 1e10) / 1e10;
        };

        // Keep legacy key (profile-agnostic) for backward compatibility.
        const numVal = Math.round((adjustedMwh / 1000) * 1e10) / 1e10;

        if (isPromedio) {
          // 12-month average — stored as the un-suffixed fallback key
          items.push({ key: baseKey, valueNumeric: numVal, unit: "€/kWh" });
          if (normalRawMwh !== null && (zoneContext || normalRawMwh > 0)) {
            items.push({
              key: `${baseKey}:PROFILE:NORMAL`,
              valueNumeric: toAdjustedKwh(normalRawMwh),
              unit: "€/kWh",
            });
          }
          if (diurnoRawMwh !== null && (zoneContext || diurnoRawMwh > 0)) {
            items.push({
              key: `${baseKey}:PROFILE:DIURNO`,
              valueNumeric: toAdjustedKwh(diurnoRawMwh),
              unit: "€/kWh",
            });
          }
        } else {
          // Month-specific price — stored with YYYY-MM suffix
          items.push({
            key: `${baseKey}:${monthKey}`,
            valueNumeric: numVal,
            unit: "€/kWh",
          });
          if (normalRawMwh !== null && (zoneContext || normalRawMwh > 0)) {
            items.push({
              key: `${baseKey}:${monthKey}:PROFILE:NORMAL`,
              valueNumeric: toAdjustedKwh(normalRawMwh),
              unit: "€/kWh",
            });
          }
          if (diurnoRawMwh !== null && (zoneContext || diurnoRawMwh > 0)) {
            items.push({
              key: `${baseKey}:${monthKey}:PROFILE:DIURNO`,
              valueNumeric: toAdjustedKwh(diurnoRawMwh),
              unit: "€/kWh",
            });
          }
        }

        if (bFactor !== null) {
          items.push({
            key: isPromedio ? factorKey : `${factorKey}:${monthKey}`,
            valueNumeric: bFactor,
            unit: "multiplier",
          });
        }
      }
    }

    // Stop scanning after the PROMEDIO row
    if (isPromedio) break;
  }

  // ── POTENCIA section ────────────────────────────────────────────────────────
  // Each DINAMICA product sheet contains a static POTENCIA table below the
  // Precio TE section.  Layout (col B = c=1 is the label column):
  //
  //   Row "POTENCIA"  → section header
  //   Row "2.0TD"     → daily rates (€/kW/día) for P1…P6 at cols C–H (c=2–7)
  //   Row "3.0TD"     → daily rates for P1…P6
  //   Row "6.1TD"     → daily rates for P1…P6
  //
  // Each tariff row is emitted under its own tariff key only.
  // These items are added AFTER parseIndex() in allItems so the last-write-wins
  // deduplication in parseAxpoExcel() ensures they override the stale values
  // that the static BASE DE DATOS INDEX sheet carries for these products.

  let inPotenciaSection = false;

  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[encodeCell({ r: R, c: 1 })]; // col B
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : "";
    const labelUp = labelRaw.toUpperCase();

    if (!inPotenciaSection) {
      if (labelUp === "POTENCIA") {
        inPotenciaSection = true;
      }
      continue;
    }

    const isTariff2 = labelUp === "2.0TD";
    const isTariff3 = labelUp === "3.0TD";
    const isTariff6 = labelUp === "6.1TD";

    if (!isTariff2 && !isTariff3 && !isTariff6) {
      if (labelRaw !== "") break; // reached next section, stop
      continue;
    }

    // Each tariff row is normally emitted only for its own tariff.  The TLV
    // workbook's lookup table has one explicit exception: DINAMICA CONTROL PLUS
    // N3 rows for 3.0TD reference the 6.1TD power row.  Emit the 6.1TD row again
    // under 3.0TD so last-write-wins de-duplication matches the simulator.
    const tariffsToEmit: string[] = isTariff2
      ? ["2.0TD"]
      : isTariff3
        ? ["3.0TD"]
        : product === "DINAMICA_CONTROL_PLUS" && tier === "N3"
          ? ["6.1TD", "3.0TD"]
          : ["6.1TD"];
    const periods = ["P1", "P2", "P3", "P4", "P5", "P6"];

    for (let i = 0; i < periods.length; i++) {
      const cell = sheet[encodeCell({ r: R, c: 2 + i })]; // cols C–H
      if (!cell || cell.v === undefined || cell.v === null) continue;
      const dailyRate = safeFloat(cell.v);
      if (dailyRate === null || dailyRate <= 0) continue;
      // Convert from €/kW/día to €/kW/año
      const embeddedPowerMargin =
        product === "PERSONALIZADA_OMIE_B"
          ? (safeFloat(sheet[encodeCell({ r: R + 8, c: 10 + i })]?.v) ?? 0)
          : 0;
      const yearlyRate =
        Math.round(Math.max(0, dailyRate * 365 - embeddedPowerMargin) * 1e10) /
        1e10;

      for (const tariff of tariffsToEmit) {
        items.push({
          key: `ELEC:INDEX:${product}:${tier}:${tariff}:${periods[i]}:POTENCIA`,
          valueNumeric: yearlyRate,
          unit: "€/kW/año",
        });
      }
    }
  }

  return items;
}

// ─── Comparativa Libre LUZ parser ─────────────────────────────────────────────

/**
 * Parses the "COMPARATIVA LIBRE LUZ" sheet which contains the user-filled
 * custom fixed-price offer inputs:
 *   Row 43 (0-based: 42), cols I–N (8–13): TERMINO POTENCIA in €/kWdia for P1–P6
 *   Row 48 (0-based: 47), cols I–N (8–13): TÉRMINO ENERGÍA in €/kWh for P1–P6
 *
 * Stored under keys:
 *   ELEC:LIBRE:PERSONALIZADA_FIJO:P{n}:POTENCIA  (€/kWdia)
 *   ELEC:LIBRE:PERSONALIZADA_FIJO:P{n}:ENERGIA   (€/kWh)
 */
function parseComparativaLibreLuz(sheet: WorksheetLike): BaseValueItem[] {
  const items: BaseValueItem[] = [];
  const periods = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const potenciaRowIdx = 42; // row 43, 0-based
  const energiaRowIdx = 47; // row 48, 0-based

  for (let i = 0; i < 6; i++) {
    const col = 8 + i; // cols I–N

    const potAddr = encodeCell({ r: potenciaRowIdx, c: col });
    const potCell = sheet[potAddr];
    if (potCell && potCell.v != null) {
      const v = parseFloat(String(potCell.v));
      if (!isNaN(v) && v > 0) {
        items.push({
          key: `ELEC:LIBRE:PERSONALIZADA_FIJO:${periods[i]}:POTENCIA`,
          valueNumeric: Math.round(v * 1e10) / 1e10,
          unit: "€/kWdia",
        });
      }
    }

    const enaAddr = encodeCell({ r: energiaRowIdx, c: col });
    const enaCell = sheet[enaAddr];
    if (enaCell && enaCell.v != null) {
      const v = parseFloat(String(enaCell.v));
      if (!isNaN(v) && v > 0) {
        items.push({
          key: `ELEC:LIBRE:PERSONALIZADA_FIJO:${periods[i]}:ENERGIA`,
          valueNumeric: Math.round(v * 1e10) / 1e10,
          unit: "€/kWh",
        });
      }
    }
  }

  return items;
}

// ─── Comparativa Libre GAS parser ─────────────────────────────────────────────

/**
 * Parses the "COMPARATIVA LIBRE GAS" sheet which contains the user-filled
 * custom fixed-price gas offer inputs:
 *   Row 42 (0-based: 41), col K (index 10): TERMINO FIJO value in €/día
 *   Row 47 (0-based: 46), col K (index 10): TÉRMINO VARIABLE value in €/kWh
 *
 * Stored under keys:
 *   GAS:LIBRE:PERSONALIZADA_FIJO:TERMINO_DIA      (€/día)
 *   GAS:LIBRE:PERSONALIZADA_FIJO:TERMINO_VARIABLE (€/kWh)
 */
function parseComparativaLibreGas(sheet: WorksheetLike): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  const terminoDiaCell = sheet[encodeCell({ r: 41, c: 10 })];
  if (terminoDiaCell && terminoDiaCell.v != null) {
    const v = parseFloat(String(terminoDiaCell.v));
    if (!isNaN(v) && v > 0) {
      items.push({
        key: "GAS:LIBRE:PERSONALIZADA_FIJO:TERMINO_DIA",
        valueNumeric: Math.round(v * 1e10) / 1e10,
        unit: "€/día",
      });
    }
  }

  const terminoVarCell = sheet[encodeCell({ r: 46, c: 10 })];
  if (terminoVarCell && terminoVarCell.v != null) {
    const v = parseFloat(String(terminoVarCell.v));
    if (!isNaN(v) && v > 0) {
      items.push({
        key: "GAS:LIBRE:PERSONALIZADA_FIJO:TERMINO_VARIABLE",
        valueNumeric: Math.round(v * 1e10) / 1e10,
        unit: "€/kWh",
      });
    }
  }

  return items;
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export async function parseAxpoExcel(
  buffer: Buffer,
  filename: string,
  options?: ParseAxpoExcelOptions,
): Promise<ParsedBaseValues> {
  const workbook = await readWorkbook(buffer);
  const profile = resolveImportProfile(filename, options);

  const allItems: BaseValueItem[] = [];

  // Parse FIJO sheet (electricity fixed)
  if (workbook.SheetNames.includes("BASE DE DATOS FIJO")) {
    const sheet = workbook.Sheets["BASE DE DATOS FIJO"];
    const fijoItems = parseZoneAwareFijo(workbook, sheet, profile);
    allItems.push(...fijoItems);
  }

  // Parse INDEX sheet (electricity indexed)
  if (workbook.SheetNames.includes("BASE DE DATOS INDEX")) {
    const sheet = workbook.Sheets["BASE DE DATOS INDEX"];
    const rows = worksheetToRows(sheet);
    const indexItems = parseIndex(rows, profile);
    allItems.push(...indexItems);
  }

  // Parse individual DINAMICA / DINAMICA PLUS / DINAMICA CONTROL product sheets.
  // These store the full 12-month average "Precio TE" per period and OVERRIDE
  // the placeholder CG-only values that BASE DE DATOS INDEX has for these products.
  // Sheet names are trimmed before lookup to handle trailing spaces in the workbook.
  const trimmedSheetNames = new Map(
    workbook.SheetNames.map((n) => [n.trim(), n]),
  );
  const dinamicaSheetMap = {
    ...DINAMICA_SHEET_MAP,
    ...(profile.dinamicaSheetNames ?? {}),
  };
  // Auto-detect any sheets that look like DINAMICA product sheets but aren't in
  // the hardcoded map (e.g. new products added in future file versions).
  for (const [trimmed, actual] of trimmedSheetNames) {
    if (!dinamicaSheetMap[trimmed]) {
      // Match patterns like "SOME PRODUCT N1", "SOME PRODUCT N2", "SOME PRODUCT N3"
      const m = trimmed.match(/^(.+?)\s+(N[123])$/);
      if (m) {
        const autoSlug = m[1]
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        const isPersonalizada = autoSlug.startsWith("PERSONALIZADA");
        for (const zone of ["Peninsula", "Canarias"] as const) {
          const dinamicaItems = parseDinamicaSheet(
            workbook.Sheets[actual],
            workbook.Sheets["INPUT OMIE"],
            autoSlug,
            m[2],
            isPersonalizada,
            { workbook, sheetName: actual, zone },
          );
          allItems.push(
            ...dinamicaItems.map((item) => ({
              ...item,
              key: item.key.startsWith("ELEC:INDEX:")
                ? `${item.key}:ZONE:${zone.toUpperCase()}`
                : item.key,
            })),
          );
        }
      }
    }
  }

  for (const [sheetName, [product, tier]] of Object.entries(dinamicaSheetMap)) {
    const actualSheetName = trimmedSheetNames.get(sheetName);
    if (actualSheetName) {
      const sheet = workbook.Sheets[actualSheetName];
      // All sheets use tariff-specific POTENCIA rows.
      for (const zone of ["Peninsula", "Canarias"] as const) {
        const dinamicaItems = parseDinamicaSheet(
          sheet,
          workbook.Sheets["INPUT OMIE"],
          product,
          tier,
          true,
          { workbook, sheetName: actualSheetName, zone },
        );
        allItems.push(
          ...dinamicaItems.map((item) => ({
            ...item,
            key: item.key.startsWith("ELEC:INDEX:")
              ? `${item.key}:ZONE:${zone.toUpperCase()}`
              : item.key,
          })),
        );
      }
    }
  }

  // The simulator result grid VLOOKUPs this hidden table directly.  It contains
  // the final month-specific electricity prices, including product-specific
  // adjustments such as DINAMICA CONTROL TECHO caps and zero-price 1P rows for
  // tariff combinations that still appear in Excel.
  if (workbook.SheetNames.includes(".")) {
    const hiddenElectricityItems = parseHiddenElectricityLookup(
      workbook.Sheets["."],
      workbookElectricityZone(workbook),
    );
    allItems.push(...hiddenElectricityItems);
  }

  // Parse GAS FIJO sheet (note: sheet name is "PRECIOS FIJOS GAS" in actual files)
  if (workbook.SheetNames.includes("PRECIOS FIJOS GAS")) {
    const sheet = workbook.Sheets["PRECIOS FIJOS GAS"];
    const rows = worksheetToRows(sheet, 110);
    const gasFijoItems = parseGasFijo(rows, profile);
    allItems.push(...gasFijoItems);
  } else if (workbook.SheetNames.includes("GAS FIJO")) {
    const sheet = workbook.Sheets["GAS FIJO"];
    const rows = worksheetToRows(sheet, 110);
    const gasFijoItems = parseGasFijo(rows, profile);
    allItems.push(...gasFijoItems);
  }

  // Parse GAS INDEX sheet (note: sheet name is "PRECIOS INDEX GAS" in actual files)
  if (workbook.SheetNames.includes("PRECIOS INDEX GAS")) {
    const sheet = workbook.Sheets["PRECIOS INDEX GAS"];
    const rows = worksheetToRows(sheet, 110);
    const gasIndexItems = parseGasIndex(rows, profile);
    allItems.push(...gasIndexItems);
  } else if (workbook.SheetNames.includes("GAS INDEX")) {
    const sheet = workbook.Sheets["GAS INDEX"];
    const rows = worksheetToRows(sheet, 110);
    const gasIndexItems = parseGasIndex(rows, profile);
    allItems.push(...gasIndexItems);
  }

  // Parse COMPARATIVA LIBRE LUZ (custom personalizada fijo electricity offer defaults)
  if (trimmedSheetNames.has("COMPARATIVA LIBRE LUZ")) {
    const sheet =
      workbook.Sheets[trimmedSheetNames.get("COMPARATIVA LIBRE LUZ")!];
    const libreElecItems = parseComparativaLibreLuz(sheet);
    allItems.push(...libreElecItems);
  }

  // Parse COMPARATIVA LIBRE GAS (custom personalizada fijo gas offer defaults)
  if (trimmedSheetNames.has("COMPARATIVA LIBRE GAS")) {
    const sheet =
      workbook.Sheets[trimmedSheetNames.get("COMPARATIVA LIBRE GAS")!];
    const libreGasItems = parseComparativaLibreGas(sheet);
    allItems.push(...libreGasItems);
  }

  // Deduplicate by key (last one wins, matching Python behavior)
  const itemsDict: Record<string, BaseValueItem> = {};
  for (const item of allItems) {
    itemsDict[item.key] = item;
  }
  const uniqueItems = Object.values(itemsDict);

  // Extract date from filename for the name
  const dateMatch = filename.match(/(\d{2}\.\d{2}\.\d{4})/);
  const dateStr = dateMatch
    ? dateMatch[1].replace(/\./g, "-")
    : new Date().toISOString().split("T")[0];

  return {
    name: `AXPO Price Tables ${dateStr.split("-").reverse().join("-")}`,
    scopeType: profile.scopeType,
    sourceWorkbookRef: filename,
    sourceScope: profile.sourceScope ?? profile.scopeType,
    items: uniqueItems,
  };
}
