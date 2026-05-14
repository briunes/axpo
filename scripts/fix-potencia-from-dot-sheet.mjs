/**
 * Fix DINAMICA product POTENCIA values by reading directly from the Excel dot sheet.
 * 
 * The dot sheet already has the exact power values the Excel simulator uses for each
 * product/tariff combination, removing ambiguity about which row to reference.
 *
 * Usage:
 *   node scripts/fix-potencia-from-dot-sheet.mjs <path-to-xlsm>
 */
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map product names as they appear in the dot sheet to slugs used in the DB
const PRODUCT_NAME_MAP = {
  'ESTABLE N1': ['ESTABLE', 'N1'],
  'ESTABLE N2': ['ESTABLE', 'N2'],
  'ESTABLE N3': ['ESTABLE', 'N3'],
  'ESTABLE PLUS N1': ['ESTABLE_PLUS', 'N1'],
  'ESTABLE PLUS N2': ['ESTABLE_PLUS', 'N2'],
  'ESTABLE PLUS N3': ['ESTABLE_PLUS', 'N3'],
  '1P N1': ['1P_PLUS', 'N1'],
  '1P N2': ['1P_PLUS', 'N2'],
  '1P N3': ['1P_PLUS', 'N3'],
  '1P XL N1': ['1P_PLUS_XL', 'N1'],
  '1P XL N2': ['1P_PLUS_XL', 'N2'],
  '1P XL N3': ['1P_PLUS_XL', 'N3'],
  'ESTABLE TALLER N1': ['ESTABLE_TALLER', 'N1'],
  'ESTABLE TALLER N2': ['ESTABLE_TALLER', 'N2'],
  'ESTABLE TALLER N3': ['ESTABLE_TALLER', 'N3'],
  'ESTABLE TALLER + N1': ['ESTABLE_TALLER_PLUS', 'N1'],
  'ESTABLE TALLER + N2': ['ESTABLE_TALLER_PLUS', 'N2'],
  'ESTABLE TALLER + N3': ['ESTABLE_TALLER_PLUS', 'N3'],
  'DINAMICA N1': ['DINAMICA', 'N1'],
  'DINAMICA N2': ['DINAMICA', 'N2'],
  'DINAMICA N3': ['DINAMICA', 'N3'],
  'DINAMICA PLUS N1': ['DINAMICA_PLUS', 'N1'],
  'DINAMICA PLUS N2': ['DINAMICA_PLUS', 'N2'],
  'DINAMICA PLUS N3': ['DINAMICA_PLUS', 'N3'],
  'DINAMICA CONTROL N1': ['DINAMICA_CONTROL', 'N1'],
  'DINAMICA CONTROL N2': ['DINAMICA_CONTROL', 'N2'],
  'DINAMICA CONTROL N3': ['DINAMICA_CONTROL', 'N3'],
  'DINAMICA CONTROL PLUS N1': ['DINAMICA_CONTROL_PLUS', 'N1'],
  'DINAMICA CONTROL PLUS N2': ['DINAMICA_CONTROL_PLUS', 'N2'],
  'DINAMICA CONTROL PLUS N3': ['DINAMICA_CONTROL_PLUS', 'N3'],
  'DINAMICA CONTROL TECHO N1': ['DINAMICA_CONTROL_TECHO', 'N1'],
  'DINAMICA CONTROL TECHO N2': ['DINAMICA_CONTROL_TECHO', 'N2'],
  'DINAMICA CONTROL TECHO N3': ['DINAMICA_CONTROL_TECHO', 'N3'],
};

const TARIFFS = ['2.0TD', '3.0TD', '6.1TD'];
const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

// Number of power periods per tariff
const POWER_PERIOD_COUNT = { '2.0TD': 2, '3.0TD': 6, '6.1TD': 6 };

function readPotenciaFromDotSheet(dotSheet) {
  const range = XLSX.utils.decode_range(dotSheet['!ref'] || 'A1');
  
  // Map: "PRODUCT_SLUG:TIER:TARIFF" -> [yearly_rate_P1..P6]
  const result = {};
  const seen = new Set(); // only take first occurrence (any month — values are static)

  for (let R = 0; R <= range.e.r; R++) {
    const keyCell = dotSheet[XLSX.utils.encode_cell({r: R, c: 0})];
    if (!keyCell || keyCell.v == null) continue;
    const fullKey = String(keyCell.v);
    
    // Full key format: "<tariff><month><product>" e.g. "3.0TDMARZO-26DINAMICA N1"
    let tariff = null;
    let rest = fullKey;
    for (const t of TARIFFS) {
      if (fullKey.startsWith(t)) {
        tariff = t;
        rest = fullKey.slice(t.length);
        break;
      }
    }
    if (!tariff) continue;
    
    // Strip month (format: "ENERO-26", "FEBRERO-26", etc.)
    const monthMatch = rest.match(/^[A-ZÁÉÍÓÚÑ]+-\d+/);
    if (!monthMatch) continue;
    const productName = rest.slice(monthMatch[0].length);
    
    const mapping = PRODUCT_NAME_MAP[productName];
    if (!mapping) continue;
    const [slug, tier] = mapping;
    
    const dedupKey = `${slug}:${tier}:${tariff}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    
    // Power values are in columns K-P (0-indexed: 10-15)
    const nPeriods = POWER_PERIOD_COUNT[tariff] ?? 6;
    const yearlyRates = [];
    for (let i = 0; i < nPeriods; i++) {
      const cell = dotSheet[XLSX.utils.encode_cell({r: R, c: 10 + i})];
      const dailyRate = cell && cell.v != null ? Number(cell.v) : null;
      if (dailyRate === null || isNaN(dailyRate) || dailyRate <= 0) {
        yearlyRates.push(null);
      } else {
        yearlyRates.push(Math.round(dailyRate * 365 * 1e10) / 1e10);
      }
    }
    
    result[dedupKey] = yearlyRates;
  }
  
  return result;
}

async function main() {
  const xlsmPath = process.argv[2];
  if (!xlsmPath) {
    console.error('Usage: node fix-potencia-from-dot-sheet.mjs <path-to-xlsm>');
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsmPath, { cellFormula: false, cellNF: false });
  const dotSheet = workbook.Sheets['.'];
  if (!dotSheet) throw new Error('No "." sheet found in workbook');

  const activeSet = await prisma.baseValueSet.findFirst({
    where: { isActive: true }, orderBy: { createdAt: 'desc' },
  });
  if (!activeSet) throw new Error('No active base value set found');
  console.log(`Active set: ${activeSet.id} (${activeSet.name})`);

  const potenciaMap = readPotenciaFromDotSheet(dotSheet);
  console.log(`Found ${Object.keys(potenciaMap).length} product/tariff combinations`);

  const upserts = [];
  for (const [key, yearlyRates] of Object.entries(potenciaMap)) {
    const [slug, tier, tariff] = key.split(':');
    const nPeriods = POWER_PERIOD_COUNT[tariff] ?? 6;
    for (let i = 0; i < Math.min(nPeriods, yearlyRates.length); i++) {
      const rate = yearlyRates[i];
      if (rate === null || rate <= 0) continue;
      const dbKey = `ELEC:INDEX:${slug}:${tier}:${tariff}:${PERIODS[i]}:POTENCIA`;
      upserts.push({ key: dbKey, value: rate });
    }
  }

  console.log(`Upserting ${upserts.length} POTENCIA keys...`);
  
  let count = 0;
  for (const { key, value } of upserts) {
    await prisma.baseValueItem.upsert({
      where: { baseValueSetId_key: { baseValueSetId: activeSet.id, key } },
      create: { baseValueSetId: activeSet.id, key, valueNumeric: value, unit: '€/kW/año' },
      update: { valueNumeric: value },
    });
    count++;
  }

  console.log(`Done: ${count} keys upserted.`);

  // Spot-check a few key values
  const checks = [
    'ELEC:INDEX:DINAMICA:N1:3.0TD:P1:POTENCIA',
    'ELEC:INDEX:DINAMICA_CONTROL_PLUS:N3:3.0TD:P1:POTENCIA',
    'ELEC:INDEX:ESTABLE:N1:3.0TD:P1:POTENCIA',
    'ELEC:INDEX:DINAMICA:N1:6.1TD:P1:POTENCIA',
  ];
  console.log('\nSpot checks:');
  for (const k of checks) {
    const item = await prisma.baseValueItem.findFirst({
      where: { baseValueSetId: activeSet.id, key: k },
    });
    console.log(`  ${k} = ${item?.valueNumeric ?? 'NOT FOUND'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
