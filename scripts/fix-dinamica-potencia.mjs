/**
 * Fix DINAMICA product POTENCIA values in the active base value set.
 *
 * The DINAMICA product sheets contain a POTENCIA section that was not
 * previously parsed. Excel's VLOOKUP uses the "6.1TD" row for BOTH 3.0TD
 * and 6.1TD scenarios, while the static BASE DE DATOS INDEX provided the
 * (wrong) "3.0TD" row values.
 *
 * This script reads the correct values from the product sheets and updates
 * them in-place in the active (production) base value set.
 *
 * Usage:
 *   node scripts/fix-dinamica-potencia.mjs <path-to-xlsm>
 *   # e.g. node scripts/fix-dinamica-potencia.mjs "PRUEBA SESION 14.05.2026.xlsm"
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const DINAMICA_SHEET_MAP = {
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
};

function parsePotenciaFromSheet(sheet, product, tier) {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const items = [];
  let inPotenciaSection = false;

  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[XLSX.utils.encode_cell({ r: R, c: 1 })]; // col B
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : '';
    const labelUp = labelRaw.toUpperCase();

    if (!inPotenciaSection) {
      if (labelUp === 'POTENCIA') inPotenciaSection = true;
      continue;
    }

    const isTariff2 = labelUp === '2.0TD';
    const isTariff3 = labelUp === '3.0TD';
    const isTariff6 = labelUp === '6.1TD';

    if (!isTariff2 && !isTariff3 && !isTariff6) {
      if (labelRaw !== '') break; // end of section
      continue;
    }

    // Excel's VLOOKUP uses the 6.1TD row for both 3.0TD and 6.1TD scenarios.
    if (isTariff3) continue;

    const tariffsToEmit = isTariff2 ? ['2.0TD'] : ['3.0TD', '6.1TD'];
    const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

    for (let i = 0; i < periods.length; i++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: 2 + i })]; // cols C–H
      if (!cell || cell.v == null) continue;
      const dailyRate = parseFloat(cell.v);
      if (isNaN(dailyRate) || dailyRate <= 0) continue;
      const yearlyRate = Math.round(dailyRate * 365 * 1e10) / 1e10;

      for (const tariff of tariffsToEmit) {
        items.push({
          key: `ELEC:INDEX:${product}:${tier}:${tariff}:${periods[i]}:POTENCIA`,
          valueNumeric: yearlyRate,
          unit: '€/kW/año',
        });
      }
    }
  }

  return items;
}

async function main() {
  const xlsmPath = process.argv[2];
  if (!xlsmPath) {
    console.error('Usage: node scripts/fix-dinamica-potencia.mjs <path-to-xlsm>');
    process.exit(1);
  }

  console.log(`Reading: ${xlsmPath}`);
  const buffer = readFileSync(xlsmPath);
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // Get active base value set
  const activeSet = await prisma.baseValueSet.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!activeSet) {
    console.error('No active base value set found');
    process.exit(1);
  }
  console.log(`Active set: ${activeSet.id} (${activeSet.name} v${activeSet.version})`);

  // Parse all POTENCIA items from product sheets
  const allItems = [];
  const trimmedSheetNames = new Map(wb.SheetNames.map(n => [n.trim(), n]));

  for (const [sheetName, [product, tier]] of Object.entries(DINAMICA_SHEET_MAP)) {
    const actualSheetName = trimmedSheetNames.get(sheetName);
    if (!actualSheetName) {
      console.log(`  Sheet not found: "${sheetName}"`);
      continue;
    }
    const sheet = wb.Sheets[actualSheetName];
    const items = parsePotenciaFromSheet(sheet, product, tier);
    console.log(`  ${sheetName}: ${items.length} POTENCIA keys`);
    allItems.push(...items);
  }

  if (allItems.length === 0) {
    console.error('No POTENCIA items found — check sheet layout');
    process.exit(1);
  }

  // Upsert each key into the active set
  console.log(`\nUpserting ${allItems.length} POTENCIA keys into set ${activeSet.id}...`);
  let updated = 0;
  let created = 0;

  for (const item of allItems) {
    const result = await prisma.baseValueItem.upsert({
      where: {
        baseValueSetId_key: {
          baseValueSetId: activeSet.id,
          key: item.key,
        },
      },
      update: {
        valueNumeric: item.valueNumeric,
        unit: item.unit,
      },
      create: {
        baseValueSetId: activeSet.id,
        key: item.key,
        valueNumeric: item.valueNumeric,
        valueText: null,
        unit: item.unit,
      },
    });
    // Check if it was an update or create
    updated++;
  }

  console.log(`Done: ${allItems.length} keys upserted.`);

  // Verify DCP N3 3.0TD P1
  const check = await prisma.baseValueItem.findUnique({
    where: {
      baseValueSetId_key: {
        baseValueSetId: activeSet.id,
        key: 'ELEC:INDEX:DINAMICA_CONTROL_PLUS:N3:3.0TD:P1:POTENCIA',
      },
    },
  });
  console.log(`\nVerification: DCP N3 3.0TD P1 POTENCIA = ${check?.valueNumeric}`);
  console.log(`Expected: ~30.095368`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
