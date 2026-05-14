const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {type:'file', cellFormula: true});
const dotSheet = wb.Sheets['.'];

// Row 1201 = 3.0TDMARZO-26PERSONALIZADA INDEX (0-indexed: 1200)
// Row 1237 = 3.0TDMARZO-26PERSONALIZADA OMIE + B (0-indexed: 1236)

console.log('=== 3.0TDMARZO-26PERSONALIZADA INDEX (R1201) cols A-P ===');
for (let C = 0; C <= 15; C++) {
  const cell = dotSheet[XLSX.utils.encode_cell({r:1200, c:C})];
  if (cell) console.log('Col '+ String.fromCharCode(65+C)+':', JSON.stringify(cell));
}

console.log('\n=== 3.0TDMARZO-26PERSONALIZADA OMIE + B (R1237) cols A-P ===');
for (let C = 0; C <= 15; C++) {
  const cell = dotSheet[XLSX.utils.encode_cell({r:1236, c:C})];
  if (cell) console.log('Col '+ String.fromCharCode(65+C)+':', JSON.stringify(cell));
}

// Also check the simulator output section for personalizada
// The simulator calc block for personalizada index
console.log('\n=== Looking for personalizada calc block in dot sheet (R1640+) ===');
for (let R = 1640; R <= 1700; R++) {
  const row = [];
  for (let C = 0; C <= 15; C++) {
    const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:C})];
    row.push(cell && cell.v != null ? String(cell.v).substring(0,20) : '');
  }
  if (row.some(v => v !== '')) console.log('R'+(R+1)+':', row.join(' | '));
}
