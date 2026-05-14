const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {cellFormula:false, cellNF:false});

// Find which rows in the "." sheet correspond to DINAMICA N1 potencia
const dotSheet = wb.Sheets['.'];
if (!dotSheet) { console.log('No dot sheet found'); process.exit(1); }

// Look for cells that reference DINAMICA N1 power values
// Row 1645 is PERSONALIZADA INDEX total, let's find DINAMICA N1 rows
// From previous analysis R1449 or similar
// Let's search for the DINAMICA N1 total and surrounding rows

// Read the dot sheet around row 1400-1470 (area where DINAMICA N1 calc should be)
const range = XLSX.utils.decode_range(dotSheet['!ref'] || 'A1');
console.log('Dot sheet range:', dotSheet['!ref']);

// Find rows with "DINAMICA N1" label or total values
for (let R = 0; R <= Math.min(range.e.r, 1700); R++) {
  for (let C = 0; C <= Math.min(range.e.c, 5); C++) {
    const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:C})];
    if (cell && cell.v != null && String(cell.v).includes('DINAMICA N1')) {
      console.log(`R${R+1}C${C+1}: ${cell.v}`);
    }
  }
}
