const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {cellFormula:false, cellNF:false});

function readPotencia(sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh) return null;
  const range = XLSX.utils.decode_range(sh['!ref'] || 'A1');
  let inPot = false;
  const result = {};
  for (let R = range.s.r; R <= range.e.r; R++) {
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
    result[labelRaw] = vals;
  }
  return result;
}

const sheets = ['DINAMICA N1', 'DINAMICA CONTROL PLUS N3'];
for (const s of sheets) {
  const p = readPotencia(s);
  console.log(`\n${s}:`);
  for (const [k,v] of Object.entries(p)) {
    const yearly = v.map(x => x != null ? Math.round(x * 365 * 1e10) / 1e10 : null);
    const pot31 = yearly.reduce((a,b) => a + (b||0) * 45 * (31/365), 0);
    console.log(`  ${k}: daily=${JSON.stringify(v)}`);
    console.log(`      yearly=${JSON.stringify(yearly)}`);
    console.log(`      potencia_term_31d_45kW=${pot31.toFixed(4)}`);
  }
}
