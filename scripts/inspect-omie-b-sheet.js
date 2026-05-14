const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {type:'file', cellFormula: true});

const sheet = wb.Sheets['PERSONALIZADA OMIE + B '];
if (!sheet) { console.log('Sheet not found; sheets:', wb.SheetNames); process.exit(); }

console.log('=== PERSONALIZADA OMIE + B sheet rows 40-70, cols A-AJ ===');
const ref = sheet['!ref'];
const range = XLSX.utils.decode_range(ref);
for (let R = 40; R <= 70; R++) {
  const row = [];
  for (let C = 0; C <= 38; C++) {
    const cell = sheet[XLSX.utils.encode_cell({r:R, c:C})];
    row.push(cell && cell.v != null ? String(cell.v).substring(0,14) : '');
  }
  if (row.some(v => v !== '')) console.log('R'+(R+1)+':', row.join(' | '));
}

// Check the specific formula cell referenced in the dot sheet:
// 'PERSONALIZADA OMIE + B '!$X$44:$AE$56 → but let's see if Precio TE section
// is similar to DINAMICA or different
// R1237 energy formula uses cols X(23)-AE(30) for 3.0TD
// Let's compare with DINAMICA format: 3.0TD uses cols 25-30 (Z-AE)
// Let's print col headers at R44 (index 43)
console.log('\n=== Row 44 headers (0-indexed R43) ===');
for (let C = 0; C <= 50; C++) {
  const cell = sheet[XLSX.utils.encode_cell({r:43, c:C})];
  if (cell && cell.v != null) console.log('Col '+C+' ('+String.fromCharCode(C<26?65+C:65+Math.floor(C/26)-1)+String.fromCharCode(C<26?'':65+C%26)+'): '+cell.v);
}
