const XLSX = require('xlsx');
const MONTH_MAP = {ENERO:'01',FEBRERO:'02',MARZO:'03',ABRIL:'04',MAYO:'05',JUNIO:'06',JULIO:'07',AGOSTO:'08',SEPTIEMBRE:'09',OCTUBRE:'10',NOVIEMBRE:'11',DICIEMBRE:'12'};

function countDinamicaRows(sheet) {
  var count = 0;
  var months = [];
  var ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  var inSection = false;
  for (var R = ref.s.r; R <= ref.e.r; R++) {
    var cell = sheet[XLSX.utils.encode_cell({r:R, c:4})];
    var label = cell && cell.v ? String(cell.v).trim().toUpperCase() : '';
    if (!inSection) {
      if (label.startsWith('PRECIO TE')) inSection = true;
      continue;
    }
    if (label.includes('PROMEDIO')) break;
    var parts = label.split(/[\s\-]+/);
    if (parts.length >= 2 && MONTH_MAP[parts[0]]) {
      count++;
      months.push(label);
    }
  }
  return {count: count, months: months};
}

var files = {
  'ABIERTO v23 (April)': 'ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm',
  'PRUEBA 18.05 (May)':  'PRUEBA SESION 18.05.2026 (1).xlsm',
};

Object.keys(files).forEach(function(label) {
  var wb = XLSX.readFile(files[label], {type:'file', cellFormula:false});
  var result = countDinamicaRows(wb.Sheets['DINAMICA N1']);
  console.log(label + ' -> DINAMICA N1: ' + result.count + ' monthly price rows');
  console.log('  Months: ' + result.months.join(', '));
});
