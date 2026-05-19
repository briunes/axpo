import XLSX from "xlsx";
import { readFileSync } from "fs";

const files: [string, string][] = [
  [
    "ABIERTO v23 (April)",
    "ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm",
  ],
  ["PRUEBA 18.05 (May)", "PRUEBA SESION 18.05.2026 (1).xlsm"],
];

const SHEET = "DINAMICA CONTROL N3";

for (const [label, filename] of files) {
  const wb = XLSX.readFile(filename, { type: "file", cellFormula: false });
  const sheet = wb.Sheets[SHEET];
  if (!sheet) {
    console.log(label + ": sheet not found");
    continue;
  }

  console.log(`\n=== ${label} — ${SHEET} ===`);

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  let inSection = false;
  let promedioPrinted = false;

  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[XLSX.utils.encode_cell({ r: R, c: 4 })];
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : "";
    const labelUp = labelRaw.toUpperCase();

    if (!inSection) {
      if (labelUp.startsWith("PRECIO TE")) {
        inSection = true;
      }
      continue;
    }

    const isPromedio = labelUp.includes("PROMEDIO");
    if (!isPromedio && !labelRaw) continue;

    // Print header + targeted columns
    const colsOfInterest = [
      4, 6, 7, 8, 9, 10, 11, 25, 26, 27, 28, 29, 30, 45, 46, 47,
    ];
    const vals = colsOfInterest.map((c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c })];
      return cell?.v != null ? String(cell.v) : "-";
    });
    console.log(
      `  R${R} [E,G,H,I,J,K,L,Z,AA,AB,AC,AD,AE,AT,AU,AV]: ${vals.join(" | ")}`,
    );

    if (isPromedio) {
      promedioPrinted = true;
      break;
    }
  }

  if (!promedioPrinted) console.log("  (PROMEDIO row not found)");
}
