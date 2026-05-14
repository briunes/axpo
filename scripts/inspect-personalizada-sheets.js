const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {type:'file', cellFormula: true});

// List all sheet names
console.log('=== All sheet names ===');
wb.SheetNames.forEach(n => console.log(' -', JSON.stringify(n)));

// Inspect PERSONALIZADA INDEX sheet - key rows around row 47 (Z47 is the price ref)
const piSheet = wb.Sheets['PERSONALIZADA INDEX'];
if (!piSheet) { console.log('No PERSONALIZADA INDEX sheet'); process.exit(); }

console.log('\n=== PERSONALIZADA INDEX sheet rows 40-70, cols A-AJ ===');
const ref = piSheet['!ref'];
const range = XLSX.utils.decode_range(ref);
for (let R = 38; R <= 70; R++) {
  const row = [];
  for (let C = 0; C <= 38; C++) {
    const cell = piSheet[XLSX.utils.encode_cell({r:R, c:C})];
    row.push(cell && cell.v != null ? String(cell.v).substring(0,14) : '');
  }
  if (row.some(v => v !== '')) console.log('R'+(R+1)+':', row.join(' | '));
}

// Also check Z47 specifically
const cellZ47 = piSheet[XLSX.utils.encode_cell({r:46, c:25})]; // Z=25
console.log('\nZ47:', JSON.stringify(cellZ47));

// Check rows 60-70 for power (POTENCIA section)
console.log('\n=== PERSONALIZADA INDEX rows 60-70 ===');
for (let R = 58; R <= 70; R++) {
  const row = [];
  for (let C = 0; C <= 10; C++) {
    const cell = piSheet[XLSX.utils.encode_cell({r:R, c:C})];
    row.push(cell && cell.v != null ? String(cell.v).substring(0,14) : '');
  }
  if (row.some(v => v !== '')) console.log('R'+(R+1)+':', row.join(' | '));
}
