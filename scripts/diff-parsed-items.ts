import { parseAxpoExcel } from "../src/infrastructure/excel/axpo-parser";
import { readFileSync } from "fs";

const files: Record<string, string> = {
  "ABIERTO v23 (April)":
    "ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm",
  "PRUEBA 18.05 (May)": "PRUEBA SESION 18.05.2026 (1).xlsm",
};

const results: Record<string, Record<string, number>> = {};

for (const [label, filename] of Object.entries(files)) {
  const buf = readFileSync(filename);
  const parsed = parseAxpoExcel(buf, filename);
  const items = parsed.items;
  console.log(`\n=== ${label} — Total: ${items.length} ===`);

  const byPrefix: Record<string, number> = {};
  for (const item of items) {
    // group by first 3 segments
    const parts = item.key.split(":");
    const prefix = parts.slice(0, 3).join(":");
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  for (const [prefix, count] of Object.entries(byPrefix).sort()) {
    console.log(`  ${prefix}: ${count}`);
  }
  results[label] = byPrefix;
}

const labels = Object.keys(results);
if (labels.length === 2) {
  console.log("\n=== DIFF (April - May per prefix) ===");
  const allPrefixes = new Set([
    ...Object.keys(results[labels[0]]),
    ...Object.keys(results[labels[1]]),
  ]);
  for (const p of [...allPrefixes].sort()) {
    const a = results[labels[0]][p] || 0;
    const b = results[labels[1]][p] || 0;
    if (a !== b) console.log(`  ${p}: ${a} vs ${b} (diff: ${a - b})`);
  }
}
