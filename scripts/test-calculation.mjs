#!/usr/bin/env node
/**
 * Test script to verify calculation endpoint matches Excel logic
 * Run: node scripts/test-calculation.mjs
 */

const BASE_URL = 'http://localhost:3000';

// Test data exactly from Excel PETICION DATOS LUZ (FEBRERO-26)
const testPayload = {
  electricity: {
    tarifaAcceso: "2.0TD",
    zonaGeografica: "Peninsula",
    perfilCarga: "NORMAL",
    consumo: {
      P1: 468,
      P2: 449,
      P3: 1023,
      P4: 0,
      P5: 0,
      P6: 0
    },
    potenciaContratada: {
      P1: 9.86,
      P2: 9.86,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0
    },
    excesoPotencia: {
      P1: 0,
      P2: 0,
      P3: 0
    },
    periodo: {
      fechaInicio: "2026-02-01",
      fechaFin: "2026-02-28",
      dias: 28
    },
    facturaActual: 493.79,
    // OMIE prices from Excel COMPARATIVA LUZ FEBRERO-26 row 48 (DINAMICA N1)
    omieEstimado: {
      P1: 0.17623088364033698,
      P2: 0.10728797576897793,
      P3: 0.079728736723209598,
      P4: 0,
      P5: 0,
      P6: 0
    },
    extras: {
      reactiva: 0,
      alquilerEquipoMedida: 1.3,
      otrosCargos: 0
    }
  }
};

// Expected results from Excel COMPARATIVA LUZ sheet
const expectedResults = {
  "DINAMICA N1": {
    total: 299.79537695285535,
    ahorro: 193.99462304714467,
    pctAhorro: 39.286867503826456,
    ahorroAnual: 2327.9354765657363,
    // From COMPARATIVA LUZ rows 40-49
    terminoPotencia: 22.27185563243835,
    terminoEnergia: 212.21085233179221,
    excesos: 0,
    impuestoElectrico: 11.982066376972183,
    alquiler: 1.3,
    iva: 52.030602611652576
  },
  "DINAMICA N2": {
    total: 259.689473928861,
    ahorro: 234.10052607113886
  },
  "DINAMICA N3": {
    total: 247.18925805817219,
    ahorro: 246.60074194182783
  }
};

async function testCalculation() {
  console.log('🧪 Testing Calculation Endpoint vs Excel Logic\n');
  console.log('📊 Input Data (FEBRERO-26, 2.0TD):');
  console.log('  - Consumo P1/P2/P3:', testPayload.electricity.consumo.P1, '/', testPayload.electricity.consumo.P2, '/', testPayload.electricity.consumo.P3, 'kWh');
  console.log('  - Potencia P1/P2:', testPayload.electricity.potenciaContratada.P1, '/', testPayload.electricity.potenciaContratada.P2, 'kW');
  console.log('  - OMIE P1/P2/P3:', testPayload.electricity.omieEstimado.P1.toFixed(6), '/', testPayload.electricity.omieEstimado.P2.toFixed(6), '/', testPayload.electricity.omieEstimado.P3.toFixed(6), '€/kWh');
  console.log('  - Días:', testPayload.electricity.periodo.dias);
  console.log('  - Factura actual:', testPayload.electricity.facturaActual, '€\n');

  try {
    // First, we need to authenticate and get a token
    console.log('🔐 Note: This test requires authentication.');
    console.log('   Please manually test via the UI or provide auth token.\n');

    // Manual calculation based on Excel formulas
    console.log('📐 Manual Calculation (Excel Formula):');
    const consumo = testPayload.electricity.consumo;
    const potencia = testPayload.electricity.potenciaContratada;
    const omie = testPayload.electricity.omieEstimado;
    const dias = testPayload.electricity.periodo.dias;
    
    // DINAMICA N1 margins from Excel "." sheet row 87 (2.0TDFEBRERO-26DINAMICA N1)
    // Energy margins (MARGEN): P1=0.03, P2=0.03, P3=0.03 (from BASE DE DATOS INDEX row 80)
    const margenN1 = { P1: 0.03, P2: 0.03, P3: 0.03 };
    
    // Power prices from Excel "." sheet row 87: K='7.5902501369863012E-2', L='1.9874602739726028E-3'
    const potPriceN1 = { P1: 0.075902501369863012, P2: 0.0019874602739726028 };

    // Energy cost = Σ(consumption × (OMIE + margin))
    const terminoEnergia = 
      consumo.P1 * (omie.P1 + margenN1.P1) +
      consumo.P2 * (omie.P2 + margenN1.P2) +
      consumo.P3 * (omie.P3 + margenN1.P3);

    // Power cost = Σ(contractedPower × powerPrice × dias/365)
    const terminoPotencia = 
      potencia.P1 * potPriceN1.P1 * (dias / 365) +
      potencia.P2 * potPriceN1.P2 * (dias / 365);

    const reactiva = 0;
    const baseImponible = terminoEnergia + terminoPotencia + reactiva;
    const impuestoElectrico = baseImponible * 0.0511269;
    const alquiler = 1.3;
    const otrosCargos = 0;
    const baseIVA = baseImponible + impuestoElectrico + alquiler + otrosCargos;
    const iva = baseIVA * 0.21;
    const total = baseIVA + iva;
    const ahorro = testPayload.electricity.facturaActual - total;
    const pctAhorro = (ahorro / testPayload.electricity.facturaActual) * 100;
    const ahorroAnual = ahorro * (365 / dias);

    console.log('  Término Energía:', terminoEnergia.toFixed(2), '€');
    console.log('    (P1:', consumo.P1, '×', (omie.P1 + margenN1.P1).toFixed(6), '=', (consumo.P1 * (omie.P1 + margenN1.P1)).toFixed(2), '€)');
    console.log('    (P2:', consumo.P2, '×', (omie.P2 + margenN1.P2).toFixed(6), '=', (consumo.P2 * (omie.P2 + margenN1.P2)).toFixed(2), '€)');
    console.log('    (P3:', consumo.P3, '×', (omie.P3 + margenN1.P3).toFixed(6), '=', (consumo.P3 * (omie.P3 + margenN1.P3)).toFixed(2), '€)');
    console.log('  Término Potencia:', terminoPotencia.toFixed(2), '€');
    console.log('    (P1:', potencia.P1, '×', potPriceN1.P1.toFixed(6), '× 28/365 =', (potencia.P1 * potPriceN1.P1 * (dias/365)).toFixed(2), '€)');
    console.log('    (P2:', potencia.P2, '×', potPriceN1.P2.toFixed(6), '× 28/365 =', (potencia.P2 * potPriceN1.P2 * (dias/365)).toFixed(2), '€)');
    console.log('  Base Imponible:', baseImponible.toFixed(2), '€');
    console.log('  Impuesto Eléctrico (5.11%):', impuestoElectrico.toFixed(2), '€');
    console.log('  Alquiler:', alquiler.toFixed(2), '€');
    console.log('  Base IVA:', baseIVA.toFixed(2), '€');
    console.log('  IVA (21%):', iva.toFixed(2), '€');
    console.log('  ─────────────────────────────');
    console.log('  TOTAL FACTURA:', total.toFixed(2), '€');
    console.log('  AHORRO:', ahorro.toFixed(2), '€', `(${pctAhorro.toFixed(2)}%)`);
    console.log('  AHORRO ANUAL:', ahorroAnual.toFixed(2), '€\n');

    // Compare with Excel
    const expected = expectedResults["DINAMICA N1"];
    console.log('📊 Comparison with Excel COMPARATIVA LUZ:');
    console.log('  Expected Total:  ', expected.total.toFixed(2), '€');
    console.log('  Calculated Total:', total.toFixed(2), '€');
    console.log('  Difference:      ', Math.abs(expected.total - total).toFixed(2), '€');
    console.log('');
    console.log('  Expected Ahorro: ', expected.ahorro.toFixed(2), '€');
    console.log('  Calculated Ahorro:', ahorro.toFixed(2), '€');
    console.log('  Difference:      ', Math.abs(expected.ahorro - ahorro).toFixed(2), '€\n');

    const tolerance = 0.01; // 1 cent tolerance
    if (Math.abs(expected.total - total) < tolerance) {
      console.log('✅ PASS: Calculation matches Excel within tolerance!');
    } else {
      console.log('❌ FAIL: Calculation does not match Excel');
      console.log('\n🔍 Detailed Component Comparison:');
      console.log('  Término Energía  - Expected:', expected.terminoEnergia.toFixed(2), '€, Got:', terminoEnergia.toFixed(2), '€');
      console.log('  Término Potencia - Expected:', expected.terminoPotencia.toFixed(2), '€, Got:', terminoPotencia.toFixed(2), '€');
      console.log('  Impuesto Eléct.  - Expected:', expected.impuestoElectrico.toFixed(2), '€, Got:', impuestoElectrico.toFixed(2), '€');
      console.log('  IVA              - Expected:', expected.iva.toFixed(2), '€, Got:', iva.toFixed(2), '€');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testCalculation();
