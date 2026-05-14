const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {type:'file', cellFormula: true});
const dotSheet = wb.Sheets['.'];

// Find PERSONALIZADA INDEX and OMIE+B in the dot sheet
console.log('=== Finding PERSONALIZADA entries ===');
const ref = dotSheet['!ref'];
const range = XLSX.utils.decode_range(ref);
for (let R = 0; R < range.e.r; R++) {
  for (let C = 0; C <= 3; C++) {
    const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:C})];
    if (cell && cell.v && String(cell.v).toUpperCase().includes('PERSONALIZADA')) {
      console.log('R'+(R+1)+' C'+(C+1)+' ('+String.fromCharCode(65+C)+'):', cell.v);
    }
  }
}
