import { parseAxpoExcel } from "../src/infrastructure/excel/axpo-parser";
import { readFileSync } from "fs";

const files: [string, string][] = [
  [
    "ABIERTO v23 (April)",
    "ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm",
  ],
  ["PRUEBA 18.05 (May)", "PRUEBA SESION 18.05.2026 (1).xlsm"],
];

for (const [label, filename] of files) {
  const buf = readFileSync(filename);
  const parsed = parseAxpoExcel(buf, filename);
  const items = parsed.items;
  console.log(`\n=== ${label} — Total: ${items.length} ===`);
  const keys = items.filter(
    (i) => i.key.includes("DINAMICA_CONTROL") && i.key.includes("N3"),
  );
  keys
    .slice(0, 40)
    .forEach((i) => console.log(`  ${i.key} = ${i.valueNumeric}`));
}
