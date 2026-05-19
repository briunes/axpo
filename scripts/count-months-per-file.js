const XLSX = require('xlsx');
const MONTH_MAP = {ENERO:'01',FEBRERO:'02',MARZO:'03',ABRIL:'04',MAYO:'05',JUNIO:'06',JULIO:'07',AGOSTO:'08',SEPTIEMBRE:'09',OCTUBRE:'10',NOVIEMBRE:'11',DICIEMBRE:'12'};

function countMonthRows(sheet) {
  let count = 0;
  const ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  for (let R = 0; R <= ref.e.r; R++) {
    const cell = sheet[XLSX.utils.encode_cell({r:R, c:0})];
    if (cell && cell.v) {
      const s = String(cell.v).trim().toUpperCase();
      const parts = s.split(/[\s\-]+/);
      if (parts.length >= 2 && MONTH_MAP[parts[0]]) count++;
    }
  }
  return count;
}

const files = {
  'ABIERTO v23': 'ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm',
  'PRUEBA 18.05': 'PRUEBA SESION 18.05.2026 (1).xlsm',
};

Object.entries(files).forEach(function(entry) {
  var label = entry[0], path = entry[1];
  var wb = XLSX.readFile(path, {type:'file', cellFormula:false});
  var sheet = wb.Sheets['DINAMICA N1'];
  var rows = countMonthRows(sheet);
  console.log(label + ' -> DINAMICA N1 month rows: ' + rows);

  // also count items in BASE DE DATOS FIJO
  var fijoSheet = wb.Sheets['BASE DE DATOS FIJO'];
  var fijoRef = XLSX.utils.decode_range(fijoSheet['!ref'] || 'A1:A1');
  console.log('  BASE DE DATOS FIJO last row: ' + (fijoRef.e.r + 1));

  // count MIBGAS rows
  var mibSheet = wb.Sheets['MIBGAS Indexes'];
  if (mibSheet) {
    var mibRef = XLSX.utils.decode_range(mibSheet['!ref'] || 'A1:A1');
    var mibCount = 0;
    for (var R = 0; R <= mibRef.e.r; R++) {
      var c = mibSheet[XLSX.utils.encode_cell({r:R, c:0})];
      if (c && c.v != null) mibCount++;
    }
    console.log('  MIBGAS Indexes non-empty rows: ' + mibCount);
  }
});
