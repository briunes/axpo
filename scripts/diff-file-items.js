const XLSX = require('xlsx');
// Replicate the parser logic to count items per section

var MONTH_MAP = {ENERO:'01',FEBRERO:'02',MARZO:'03',ABRIL:'04',MAYO:'05',JUNIO:'06',JULIO:'07',AGOSTO:'08',SEPTIEMBRE:'09',OCTUBRE:'10',NOVIEMBRE:'11',DICIEMBRE:'12'};

function parseSpanishMonthYear(s) {
  var parts = s.trim().toUpperCase().split(/[\s\-]+/);
  if (parts.length < 2) return null;
  var mon = MONTH_MAP[parts[0]];
  if (!mon) return null;
  var yr = parts[1];
  if (yr.length === 2) yr = '20' + yr;
  return yr + '-' + mon;
}

function countDinamica(sheet, product, tier) {
  var count = 0;
  var ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  var inSection = false;
  // PRECIO_TE_COLS: 3 tariffs x 6 periods = 18 cols
  var PRECIO_TE_COLS = [
    {tariff:'2.0TD', periods:['P1','P2','P3'], cols:[5,6,7,8,9,10]}, // actually just 3
    {tariff:'3.0TD', periods:['P1','P2','P3','P4','P5','P6'], cols:[12,13,14,15,16,17]},
    {tariff:'6.1TD', periods:['P1','P2','P3','P4','P5','P6'], cols:[19,20,21,22,23,24]},
  ];
  for (var R = ref.s.r; R <= ref.e.r; R++) {
    var lc = sheet[XLSX.utils.encode_cell({r:R, c:4})];
    var label = lc && lc.v ? String(lc.v).trim().toUpperCase() : '';
    if (!inSection) {
      if (label.startsWith('PRECIO TE')) { inSection = true; }
      continue;
    }
    var isPromedio = label.includes('PROMEDIO');
    var monthKey = isPromedio ? null : parseSpanishMonthYear(label);
    if (!isPromedio && monthKey === null) continue;
    for (var ti = 0; ti < PRECIO_TE_COLS.length; ti++) {
      var t = PRECIO_TE_COLS[ti];
      for (var pi = 0; pi < t.periods.length; pi++) {
        var c = sheet[XLSX.utils.encode_cell({r:R, c:t.cols[pi]})];
        if (c && c.v != null && parseFloat(c.v) > 0) count++;
      }
    }
    if (isPromedio) break;
  }
  return count;
}

function countSheet(wb, sheetName, isGas) {
  var sheet = wb.Sheets[sheetName];
  if (!sheet) return {found: false};
  var ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  // Just count non-empty cells in the data area as a proxy
  var count = 0;
  for (var R = ref.s.r; R <= ref.e.r; R++) {
    for (var C = ref.s.c; C <= Math.min(ref.e.c, 30); C++) {
      var cell = sheet[XLSX.utils.encode_cell({r:R, c:C})];
      if (cell && cell.v != null && typeof cell.v === 'number' && cell.v > 0) count++;
    }
  }
  return {found: true, nonEmptyNumeric: count};
}

var files = {
  'ABIERTO v23 (April)': 'ABIERTO SIMULADOR AXPO 22.04.2026 (Pen, Islas) 1_v23.xlsm',
  'PRUEBA 18.05 (May)':  'PRUEBA SESION 18.05.2026 (1).xlsm',
};

var sheetsToDiff = [
  'BASE DE DATOS FIJO',
  'BASE DE DATOS INDEX',
  'PRECIOS FIJOS GAS',
  'PRECIOS INDEX GAS',
  'MIBGAS Indexes',
];

Object.keys(files).forEach(function(label) {
  var wb = XLSX.readFile(files[label], {type:'file', cellFormula:false});
  console.log('\n=== ' + label + ' ===');
  sheetsToDiff.forEach(function(sn) {
    var r = countSheet(wb, sn);
    console.log('  ' + sn + ': ' + (r.found ? r.nonEmptyNumeric + ' numeric cells' : 'NOT FOUND'));
  });
  // Count DINAMICA sheets
  var dinamicaTotal = 0;
  wb.SheetNames.forEach(function(sn) {
    if (sn.trim().startsWith('DINAMICA') || sn.trim().startsWith('PERSONALIZADA')) {
      var sheet = wb.Sheets[sn];
      var r = countSheet(wb, sn);
      dinamicaTotal += r.nonEmptyNumeric;
    }
  });
  console.log('  All DINAMICA+PERSONALIZADA sheets total numeric cells: ' + dinamicaTotal);
});
