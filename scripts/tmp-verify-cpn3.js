const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {cellFormula:false, cellNF:false});
const dotSheet = wb.Sheets['.'];

// Find 3.0TD MARZO-26 DINAMICA CONTROL PLUS N3 row
const range = XLSX.utils.decode_range(dotSheet['!ref'] || 'A1');
for (let R = 0; R <= range.e.r; R++) {
  const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:0})];
  if (cell && cell.v && String(cell.v).includes('3.0TDMARZO-26DINAMICA CONTROL PLUS N3')) {
    const vals = [];
    for (let c=0; c<=16; c++) {
      const c2 = dotSheet[XLSX.utils.encode_cell({r:R, c})];
      vals.push(c2 && c2.v != null ? c2.v : '');
    }
    console.log(`R${R+1} - ${cell.v}:`);
    console.log('  Energy (E-J):', vals.slice(4, 10));
    console.log('  Power  (K-P):', vals.slice(10, 16));
  }
}

// Also check what potencia the 3.0TD row of DINAMICA CONTROL PLUS N3 sheet has
const sh = wb.Sheets['DINAMICA CONTROL PLUS N3'];
const shRange = XLSX.utils.decode_range(sh['!ref'] || 'A1');
let inPot = false;
console.log('\nDINAMICA CONTROL PLUS N3 POTENCIA section:');
for (let R = shRange.s.r; R <= shRange.e.r; R++) {
  const lbl = sh[XLSX.utils.encode_cell({r:R, c:1})];
  const labelRaw = lbl && lbl.v != null ? String(lbl.v).trim() : '';
  if (!inPot) { if (labelRaw.toUpperCase() === 'POTENCIA') inPot = true; continue; }
  if (!['2.0TD','3.0TD','6.1TD'].includes(labelRaw.toUpperCase())) {
    if (labelRaw !== '') break; continue;
  }
  const vals = [];
  for (let c=2; c<=7; c++) {
    const cell = sh[XLSX.utils.encode_cell({r:R, c})];
    vals.push(cell && cell.v != null ? cell.v : null);
  }
  const yearly = vals.map(x => x != null ? Math.round(x * 365 * 1e10) / 1e10 : null);
  console.log(`  ${labelRaw}: yearly=${JSON.stringify(yearly)}`);
}
