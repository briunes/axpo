const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 18.05.2026 (1).xlsm', {type:'file', cellFormula:false});

function dumpSheet(name, maxRow) {
  maxRow = maxRow || 80;
  const sheet = wb.Sheets[name];
  if (!sheet) { console.log('Sheet not found: ' + name); return; }
  console.log('\n=== ' + name + ' ===');
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
  for (let R = 0; R < Math.min(maxRow, range.e.r + 1); R++) {
    const row = [];
    for (let C = 0; C <= Math.min(20, range.e.c); C++) {
      const addr = XLSX.utils.encode_cell({r:R, c:C});
      const cell = sheet[addr];
      row.push(cell ? cell.v : null);
    }
    const nonNull = row.map(function(v,i) { return v != null ? [i, v] : null; }).filter(Boolean);
    if (nonNull.length) console.log('  R' + (R+1) + ': ' + JSON.stringify(nonNull));
  }
}

dumpSheet('COMPARATIVA LIBRE LUZ');
dumpSheet('COMPARATIVA LIBRE GAS');
