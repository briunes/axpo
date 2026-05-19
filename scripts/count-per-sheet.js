const XLSX = require('xlsx');

const files = [
  ['ABIERTO v23 (April)', 'ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm'],
  ['PRUEBA 18.05 (May)', 'PRUEBA SESION 18.05.2026 (1).xlsm'],
];

const allSections = {};

files.forEach(([label, filename]) => {
  const wb = XLSX.readFile(filename, {type:'file', cellFormula:false});
  console.log('\n=== ' + label + ' ===');
  
  wb.SheetNames.forEach(sn => {
    if (!sn.trim().match(/^(DINAMICA|PERSONALIZADA)/)) return;
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
    if (cnt > 0) {
      if (!allSections[sn]) allSections[sn] = {};
      allSections[sn][label] = cnt;
      console.log('  [' + sn + ']: ' + cnt);
    }
  });
});

console.log('\n=== DIFF (April - May) ===');
Object.entries(allSections).forEach(([sn, counts]) => {
  const a = counts['ABIERTO v23 (April)'] || 0;
  const b = counts['PRUEBA 18.05 (May)'] || 0;
  if (a !== b) console.log('  ' + sn + ': ' + a + ' vs ' + b + ' (diff: ' + (a-b) + ')');
});
