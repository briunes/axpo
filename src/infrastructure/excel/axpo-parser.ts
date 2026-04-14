/**
 * AXPO Price Table Parser
 *
 * Parses AXPO Excel pricing files (.xlsm) and extracts base values.
 * Port of scripts/parse-xlsm-prices.py to TypeScript.
 */

import * as XLSX from "xlsx";

export interface BaseValueItem {
  key: string;
  valueNumeric?: number;
  valueText?: string;
  unit?: string;
}

export interface ParsedBaseValues {
  name: string;
  scopeType: "GLOBAL" | "AGENCY";
  sourceWorkbookRef?: string;
  sourceScope?: string;
  items: BaseValueItem[];
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

function parseIndexProductTier(raw: string): [string | null, string | null] {
  const match = raw.trim().match(/^(.*?)\s+(N[123])$/);
  if (!match) return [null, null];

  const productRaw = match[1].trim();
  const tier = match[2];
  const slug = INDEX_PRODUCT_MAP[productRaw] || null;

  return [slug, tier];
}

// ─── Sheet Parsers ───────────────────────────────────────────────────────────

interface SheetData {
  [row: number]: { [col: string]: any };
}

function worksheetToRows(
  sheet: XLSX.WorkSheet,
  maxRows: number = 300,
): SheetData {
  const rows: SheetData = {};
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  for (let R = range.s.r; R <= Math.min(range.e.r, maxRows - 1); R++) {
    const rowData: { [col: string]: any } = {};

    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];

      if (cell && cell.v !== undefined && cell.v !== null) {
        const colLetter = XLSX.utils.encode_col(C);
        rowData[colLetter] = cell.v;
      }
    }

    if (Object.keys(rowData).length > 0) {
      rows[R + 1] = rowData; // 1-indexed
    }
  }

  return rows;
}

function parseFijo(rows: SheetData): BaseValueItem[] {
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
      const slug = FIJO_PRODUCT_NAMES[rawName] || FIJO_PRODUCT_NAMES[cleanName];

      if (slug) {
        productStarts.push([rowNum, slug]);
      }
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

function parseIndex(rows: SheetData): BaseValueItem[] {
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
      const [slug, tier] = parseIndexProductTier(nonEmpty["A"]);
      if (slug && tier) {
        productStarts.push([rowNum, slug, tier]);
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

function parseGasFijo(rows: SheetData): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product blocks
  const productStarts: [number, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (
      nonEmpty["A"] &&
      GAS_FIJO_PRODUCT_MAP[nonEmpty["A"]] &&
      Object.keys(nonEmpty).length <= 2
    ) {
      productStarts.push([rowNum, nonEmpty["A"]]);
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, rawName] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 20;
    const [slug, tier] = GAS_FIJO_PRODUCT_MAP[rawName];

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
      const tariffRl = String(cells["I"] || "").trim();
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

function parseGasIndex(rows: SheetData): BaseValueItem[] {
  const items: BaseValueItem[] = [];

  // Find product blocks
  const productStarts: [number, string][] = [];

  for (const [r, cells] of Object.entries(rows)) {
    const rowNum = parseInt(r);
    const nonEmpty = Object.entries(cells)
      .filter(([, v]) => String(v).trim())
      .reduce(
        (acc, [k, v]) => ({ ...acc, [k]: String(v).trim() }),
        {} as Record<string, string>,
      );

    if (
      nonEmpty["A"] &&
      GAS_INDEX_PRODUCT_MAP[nonEmpty["A"]] &&
      Object.keys(nonEmpty).length <= 2
    ) {
      productStarts.push([rowNum, nonEmpty["A"]]);
    }
  }

  for (let idx = 0; idx < productStarts.length; idx++) {
    const [start, rawName] = productStarts[idx];
    const end =
      idx + 1 < productStarts.length ? productStarts[idx + 1][0] : start + 20;
    const [slug, tier] = GAS_INDEX_PRODUCT_MAP[rawName];

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

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseAxpoExcel(
  buffer: Buffer,
  filename: string,
): ParsedBaseValues {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const allItems: BaseValueItem[] = [];

  // Parse FIJO sheet (electricity fixed)
  if (workbook.SheetNames.includes("BASE DE DATOS FIJO")) {
    const sheet = workbook.Sheets["BASE DE DATOS FIJO"];
    const rows = worksheetToRows(sheet);
    const fijoItems = parseFijo(rows);
    allItems.push(...fijoItems);
  }

  // Parse INDEX sheet (electricity indexed)
  if (workbook.SheetNames.includes("BASE DE DATOS INDEX")) {
    const sheet = workbook.Sheets["BASE DE DATOS INDEX"];
    const rows = worksheetToRows(sheet);
    const indexItems = parseIndex(rows);
    allItems.push(...indexItems);
  }

  // Parse GAS FIJO sheet (note: sheet name is "PRECIOS FIJOS GAS" in actual files)
  if (workbook.SheetNames.includes("PRECIOS FIJOS GAS")) {
    const sheet = workbook.Sheets["PRECIOS FIJOS GAS"];
    const rows = worksheetToRows(sheet, 110);
    const gasFijoItems = parseGasFijo(rows);
    allItems.push(...gasFijoItems);
  } else if (workbook.SheetNames.includes("GAS FIJO")) {
    const sheet = workbook.Sheets["GAS FIJO"];
    const rows = worksheetToRows(sheet, 110);
    const gasFijoItems = parseGasFijo(rows);
    allItems.push(...gasFijoItems);
  }

  // Parse GAS INDEX sheet (note: sheet name is "PRECIOS INDEX GAS" in actual files)
  if (workbook.SheetNames.includes("PRECIOS INDEX GAS")) {
    const sheet = workbook.Sheets["PRECIOS INDEX GAS"];
    const rows = worksheetToRows(sheet, 110);
    const gasIndexItems = parseGasIndex(rows);
    allItems.push(...gasIndexItems);
  } else if (workbook.SheetNames.includes("GAS INDEX")) {
    const sheet = workbook.Sheets["GAS INDEX"];
    const rows = worksheetToRows(sheet, 110);
    const gasIndexItems = parseGasIndex(rows);
    allItems.push(...gasIndexItems);
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
    scopeType: "GLOBAL",
    sourceWorkbookRef: filename,
    sourceScope: "ALL",
    items: uniqueItems,
  };
}
