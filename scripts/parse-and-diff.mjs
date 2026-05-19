import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// We'll use tsx to run the TypeScript parser against both files
// by temporarily pointing the parser at each file

const files = {
  'ABIERTO v23 (April)': 'ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm',
  'PRUEBA 18.05 (May)':  'PRUEBA SESION 18.05.2026 (1).xlsm',
};

for (const [label, filename] of Object.entries(files)) {
  const result = execSync(`node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile(${JSON.stringify(filename)}, {type:'file',cellFormula:false});

// Count items per DINAMICA sheet individually
wb.SheetNames.filter(s => s.trim().startsWith('DINAMICA') || s.trim().startsWith('PERSONALIZADA')).forEach(sn => {
  const sheet = wb.Sheets[sn];
  if (!sheet) return;
  const ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  let cnt = 0;
  for (let R = ref.s.r; R <= ref.e.r; R++) {
    for (let C = ref.s.c; C <= ref.e.c; C++) {
      const cell = sheet[XLSX.utils.encode_cell({r:R, c:C})];
      if (cell && cell.v != null && typeof cell.v === 'number' && cell.v > 0) cnt++;
    }
  }
  if (cnt > 0) console.log(sn + ': ' + cnt);
});
"`, {encoding:'utf8'});
  console.log(`\n=== ${label} ===`);
  console.log(result);
}
