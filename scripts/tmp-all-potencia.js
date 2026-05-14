const XLSX = require('xlsx');
const wb = XLSX.readFile('PRUEBA SESION 14.05.2026.xlsm', {cellFormula:false, cellNF:false});
const dotSheet = wb.Sheets['.'];
const range = XLSX.utils.decode_range(dotSheet['!ref'] || 'A1');

// Read all 3.0TD MARZO-26 rows and their power values (cols K-P, indices 10-15)
const rows3TD = [];
for (let R = 0; R <= range.e.r; R++) {
  const cell = dotSheet[XLSX.utils.encode_cell({r:R, c:0})];
  if (cell && cell.v && String(cell.v).startsWith('3.0TDMARZO-26')) {
    const product = String(cell.v).replace('3.0TDMARZO-26','');
    const power = [];
    for (let c=10; c<=15; c++) {
      const pc = dotSheet[XLSX.utils.encode_cell({r:R, c})];
      power.push(pc && pc.v != null ? Number(pc.v) : 0);
    }
    const potTerm = power.reduce((s, p) => s + p * 45 * (31/365), 0);
    rows3TD.push({ product, power: power.map(p => Math.round(p*365*1e6)/1e6), potTerm: potTerm.toFixed(2) });
  }
}

console.log('3.0TD MARZO-26 power values from dot sheet:');
for (const r of rows3TD) {
  console.log(`  ${r.product}: pot_term=${r.potTerm} daily_P1=${r.power[0]?.toFixed(5)}`);
}
