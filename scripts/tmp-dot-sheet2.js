const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {cellFormula:false, cellNF:false});
const dotSheet = wb.Sheets['.'];

// Row 171 (0-indexed: 170) = 3.0TD MARZO-26 DINAMICA N1
// Let's read ALL cells in that row
const R = 170; // 0-indexed
const range = XLSX.utils.decode_range(dotSheet['!ref']);
const rowData = {};
for (let C = 0; C <= range.e.c; C++) {
  const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:C})];
  if (cell && cell.v != null) {
    rowData[XLSX.utils.encode_cell({r:0, c:C}).replace(/\d+/,'')] = cell.v;
  }
}
console.log('Row 171 (3.0TD MARZO-26 DINAMICA N1):');
console.log(JSON.stringify(rowData, null, 2));

// Also look at row 172 onwards to find where potencia values are
for (let r = 170; r <= 195; r++) {
  const vals = [];
  for (let c = 0; c <= 30; c++) {
    const cell = dotSheet[XLSX.utils.encode_cell({r, c})];
    vals.push(cell && cell.v != null ? cell.v : '');
  }
  const nonEmpty = vals.filter(v => v !== '');
  if (nonEmpty.length > 0) console.log(`R${r+1}:`, vals.slice(0,20));
}
