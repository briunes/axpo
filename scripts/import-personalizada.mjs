/**
 * Import PERSONALIZADA INDEX and PERSONALIZADA OMIE + B prices from the active
 * Excel workbook into the active base value set.
 *
 * Both sheets have the same layout as DINAMICA sheets (monthly Precio TE + POTENCIA
 * section). We use parseDinamicaSheet logic inline.
 *
 * Usage: node scripts/import-personalizada.mjs <path-to-xlsm>
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const SPANISH_MONTH_MAP = {
  ENERO:'01', FEBRERO:'02', MARZO:'03', ABRIL:'04', MAYO:'05', JUNIO:'06',
  JULIO:'07', AGOSTO:'08', SEPTIEMBRE:'09', OCTUBRE:'10', NOVIEMBRE:'11', DICIEMBRE:'12',
};

function parseSpanishMonthYear(s) {
  const m = s.trim().toUpperCase().match(/^([A-ZÁÉÍÓÚ]+)-(\d{2})$/);
  if (!m) return null;
  const month = SPANISH_MONTH_MAP[m[1]];
  if (!month) return null;
  return `${2000 + parseInt(m[2], 10)}-${month}`;
}

const PRECIO_TE_COLS = [
  { tariff: '6.1TD', periods: ['P1','P2','P3','P4','P5','P6'], cols: [6,7,8,9,10,11] },
  { tariff: '3.0TD', periods: ['P1','P2','P3','P4','P5','P6'], cols: [25,26,27,28,29,30] },
  { tariff: '2.0TD', periods: ['P1','P2','P3'], cols: [45,46,47] },
];

function safeFloat(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseDinamicaSheet(sheet, product, tier) {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const items = [];
  let inSection = false;

  // ── MARGEN (energy) section ──
  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[XLSX.utils.encode_cell({r:R, c:4})];
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : '';
    const labelUp = labelRaw.toUpperCase();

    if (!inSection) {
      if (labelUp.startsWith('PRECIO TE')) inSection = true;
      continue;
    }

    const isPromedio = labelUp.includes('PROMEDIO');
    const monthKey = isPromedio ? null : parseSpanishMonthYear(labelRaw);

    if (!isPromedio && monthKey === null) continue;

    for (const {tariff, periods, cols} of PRECIO_TE_COLS) {
      for (let i = 0; i < periods.length; i++) {
        const cell = sheet[XLSX.utils.encode_cell({r:R, c:cols[i]})];
        if (!cell || cell.v == null) continue;
        const v = safeFloat(cell.v);
        if (v === null || v <= 0) continue;
        const numVal = Math.round((v / 1000) * 1e10) / 1e10;
        const baseKey = `ELEC:INDEX:${product}:${tier}:${tariff}:${periods[i]}:MARGEN`;

        if (isPromedio) {
          items.push({key: baseKey, valueNumeric: numVal, unit: '€/kWh'});
        } else {
          items.push({key: `${baseKey}:${monthKey}`, valueNumeric: numVal, unit: '€/kWh'});
        }
      }
    }

    if (isPromedio) break;
  }

  // ── POTENCIA section ──
  let inPotenciaSection = false;
  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[XLSX.utils.encode_cell({r:R, c:1})]; // col B
    const labelRaw = labelCell?.v != null ? String(labelCell.v).trim() : '';
    const labelUp = labelRaw.toUpperCase();

    if (!inPotenciaSection) {
      if (labelUp === 'POTENCIA') { inPotenciaSection = true; }
      continue;
    }

    const isTariff2 = labelUp === '2.0TD';
    const isTariff3 = labelUp === '3.0TD';
    const isTariff6 = labelUp === '6.1TD';

    if (!isTariff2 && !isTariff3 && !isTariff6) {
      if (labelRaw !== '') break;
      continue;
    }

    if (isTariff3) { /* handled below based on potenciaByTariff */ }

    // Personalizada: each tariff row emits for its own tariff only
    const tariffsToEmit = isTariff2 ? ['2.0TD'] : isTariff3 ? ['3.0TD'] : ['6.1TD'];
    const periods = ['P1','P2','P3','P4','P5','P6'];

    for (let i = 0; i < periods.length; i++) {
      const cell = sheet[XLSX.utils.encode_cell({r:R, c:2+i})];
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
    console.error('Usage: node scripts/import-personalizada.mjs <path-to-xlsm>');
    process.exit(1);
  }

  console.log(`Reading: ${xlsmPath}`);
  const buffer = readFileSync(xlsmPath);
  const wb = XLSX.read(buffer, {type:'buffer'});

  const activeSet = await prisma.baseValueSet.findFirst({
    where: {isActive: true},
    orderBy: {createdAt: 'desc'},
  });
  if (!activeSet) { console.error('No active base value set'); process.exit(1); }
  console.log(`Active set: ${activeSet.id} (${activeSet.name} v${activeSet.version})`);

  const trimmedSheetNames = new Map(wb.SheetNames.map(n => [n.trim(), n]));

  const PERSONALIZADA_MAP = {
    'PERSONALIZADA INDEX': ['PERSONALIZADA_INDEX', ''],
    'PERSONALIZADA OMIE + B': ['PERSONALIZADA_OMIE_B', ''],
  };

  const allItems = [];
  for (const [sheetName, [product, tier]] of Object.entries(PERSONALIZADA_MAP)) {
    const actualSheetName = trimmedSheetNames.get(sheetName);
    if (!actualSheetName) {
      console.log(`  Sheet not found: "${sheetName}"`);
      continue;
    }
    const sheet = wb.Sheets[actualSheetName];
    const items = parseDinamicaSheet(sheet, product, tier);
    const margenCount = items.filter(i => i.key.includes(':MARGEN')).length;
    const potenciaCount = items.filter(i => i.key.includes(':POTENCIA')).length;
    console.log(`  ${sheetName}: ${margenCount} MARGEN + ${potenciaCount} POTENCIA keys`);
    allItems.push(...items);
  }

  console.log(`\nUpserting ${allItems.length} keys into set ${activeSet.id}...`);
  for (const item of allItems) {
    await prisma.baseValueItem.upsert({
      where: {baseValueSetId_key: {baseValueSetId: activeSet.id, key: item.key}},
      update: {valueNumeric: item.valueNumeric, unit: item.unit},
      create: {baseValueSetId: activeSet.id, key: item.key, valueNumeric: item.valueNumeric, valueText: null, unit: item.unit},
    });
  }

  console.log(`Done: ${allItems.length} keys upserted.`);

  // Verify a few keys
  for (const key of [
    'ELEC:INDEX:PERSONALIZADA_INDEX::3.0TD:P1:MARGEN:2026-03',
    'ELEC:INDEX:PERSONALIZADA_INDEX::3.0TD:P1:POTENCIA',
    'ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:P1:MARGEN:2026-03',
    'ELEC:INDEX:PERSONALIZADA_OMIE_B::3.0TD:P1:POTENCIA',
  ]) {
    const item = await prisma.baseValueItem.findUnique({
      where: {baseValueSetId_key: {baseValueSetId: activeSet.id, key}},
    });
    console.log(`  ${key} = ${item?.valueNumeric ?? 'NOT FOUND'}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
