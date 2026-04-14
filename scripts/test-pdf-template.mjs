#!/usr/bin/env node
/**
 * Test script for PDF template generation
 * 
 * This script generates a test HTML file from the PDF template
 * using mock simulation data. Run this to verify the template works.
 * 
 * Usage:
 *   node scripts/test-pdf-template.mjs
 *   # or
 *   pnpm test:pdf-template
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock simulation data matching the image
const mockSimulation = {
  id: "sim-test-001",
  cupsNumber: "ES0031352682800001VB",
  client: {
    name: "Juvacam SL",
    address: "C de los Dominicos, 6",
    postalCode: "47001",
    city: "Valladolid",
  },
};

const mockPayload = {
  electricity: {
    tarifaAcceso: "3.0TD",
    potenciaContratada: {
      P1: 0.0851,
      P2: 0.0851,
      P3: 0.0851,
      P4: 0.0851,
      P5: 0.0851,
      P6: 0.0851,
    },
    consumo: {
      P1: 120,
      P2: 150,
      P3: 180,
      P4: 0,
      P5: 0,
      P6: 200,
    },
    periodo: {
      fechaInicio: "2025-11-30",
      fechaFin: "2025-12-31",
      dias: 31,
    },
    facturaActual: 36272.36,
    extras: {
      alquilerEquipoMedida: 15.50,
      otrosCargos: 25.00,
    },
  },
  results: {
    calculatedAt: "2025-12-01T15:30:00Z",
    baseValueSetId: "base-001",
    electricity: [
      {
        productKey: "ESTABLE:N1",
        productLabel: "Personalizada Index",
        totalFactura: 31272.38,
        ahorro: 5000.00,
        desglose: {
          terminoPotencia: 2123.86,
          terminoEnergia: 22304.70,
          excesoPotencia: 0,
          extras: 40.50,
          impuestoElectrico: 1256.47,
          iva: 5427.44,
        },
      },
    ],
  },
};

// Helper functions
function formatCurrency(value) {
  if (!value) return "—";
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatNumber(value, decimals = 4) {
  if (value === undefined || value === null) return "—";
  return value.toFixed(decimals).replace(".", ",");
}

function getPeriodValue(periodMap, period, decimals = 4) {
  if (!periodMap) return "—";
  const value = periodMap[period];
  return value !== undefined ? formatNumber(value, decimals) : "—";
}

// Extract variables from mock data
function extractVariables() {
  const electricity = mockPayload.electricity;
  const result = mockPayload.results.electricity[0];
  
  const totalConsumption = Object.values(electricity.consumo).reduce((a, b) => a + b, 0);
  const annualConsumption = totalConsumption * 12;
  
  const currentTotal = electricity.facturaActual;
  const axpoTotal = result.totalFactura;
  const savings = result.ahorro;
  
  // Current plan costs (estimated)
  const currentPowerCost = currentTotal * 0.35;
  const currentEnergyCost = currentTotal * 0.40;
  const currentExcessCost = currentTotal * 0.05;
  const currentTaxCost = currentTotal * 0.05;
  const currentOtherCost = currentTotal * 0.03;
  const currentRentalCost = electricity.extras.alquilerEquipoMedida;
  const currentVat = currentTotal * 0.12;
  
  // AXPO costs
  const axpoDesglose = result.desglose;
  
  return {
    CLIENT_NAME: mockSimulation.client.name,
    CLIENT_ADDRESS: `${mockSimulation.client.address}, ${mockSimulation.client.postalCode} ${mockSimulation.client.city}`,
    CUPS_NUMBER: mockSimulation.cupsNumber,
    SIMULATION_PERIOD: `${electricity.periodo.fechaInicio} — ${electricity.periodo.fechaFin}`,
    ANNUAL_CONSUMPTION: formatNumber(annualConsumption, 0),
    PRODUCT_NAME: result.productLabel,
    
    // Current plan power
    CURRENT_POWER_P1: getPeriodValue(electricity.potenciaContratada, "P1"),
    CURRENT_POWER_P2: getPeriodValue(electricity.potenciaContratada, "P2"),
    CURRENT_POWER_P3: getPeriodValue(electricity.potenciaContratada, "P3"),
    CURRENT_POWER_P4: getPeriodValue(electricity.potenciaContratada, "P4"),
    CURRENT_POWER_P5: getPeriodValue(electricity.potenciaContratada, "P5"),
    CURRENT_POWER_P6: getPeriodValue(electricity.potenciaContratada, "P6"),
    
    // Current plan energy
    CURRENT_ENERGY_P1: getPeriodValue(electricity.consumo, "P1", 0),
    CURRENT_ENERGY_P2: getPeriodValue(electricity.consumo, "P2", 0),
    CURRENT_ENERGY_P3: getPeriodValue(electricity.consumo, "P3", 0),
    CURRENT_ENERGY_P4: getPeriodValue(electricity.consumo, "P4", 0),
    CURRENT_ENERGY_P5: getPeriodValue(electricity.consumo, "P5", 0),
    CURRENT_ENERGY_P6: getPeriodValue(electricity.consumo, "P6", 0),
    
    // Current plan costs
    CURRENT_POWER_COST: formatCurrency(currentPowerCost),
    CURRENT_ENERGY_COST: formatCurrency(currentEnergyCost),
    CURRENT_EXCESS_COST: formatCurrency(currentExcessCost),
    CURRENT_TAX_COST: formatCurrency(currentTaxCost),
    CURRENT_OTHER_COST: formatCurrency(currentOtherCost),
    CURRENT_RENTAL_COST: formatCurrency(currentRentalCost),
    CURRENT_VAT: formatCurrency(currentVat),
    CURRENT_TOTAL: formatCurrency(currentTotal),
    
    // AXPO plan power (same as current)
    AXPO_POWER_P1: getPeriodValue(electricity.potenciaContratada, "P1"),
    AXPO_POWER_P2: getPeriodValue(electricity.potenciaContratada, "P2"),
    AXPO_POWER_P3: getPeriodValue(electricity.potenciaContratada, "P3"),
    AXPO_POWER_P4: getPeriodValue(electricity.potenciaContratada, "P4"),
    AXPO_POWER_P5: getPeriodValue(electricity.potenciaContratada, "P5"),
    AXPO_POWER_P6: getPeriodValue(electricity.potenciaContratada, "P6"),
    
    // AXPO plan energy (same as current)
    AXPO_ENERGY_P1: getPeriodValue(electricity.consumo, "P1", 0),
    AXPO_ENERGY_P2: getPeriodValue(electricity.consumo, "P2", 0),
    AXPO_ENERGY_P3: getPeriodValue(electricity.consumo, "P3", 0),
    AXPO_ENERGY_P4: getPeriodValue(electricity.consumo, "P4", 0),
    AXPO_ENERGY_P5: getPeriodValue(electricity.consumo, "P5", 0),
    AXPO_ENERGY_P6: getPeriodValue(electricity.consumo, "P6", 0),
    
    // AXPO plan costs
    AXPO_POWER_COST: formatCurrency(axpoDesglose.terminoPotencia),
    AXPO_ENERGY_COST: formatCurrency(axpoDesglose.terminoEnergia),
    AXPO_EXCESS_COST: formatCurrency(axpoDesglose.excesoPotencia),
    AXPO_TAX_COST: formatCurrency(axpoDesglose.impuestoElectrico),
    AXPO_OTHER_COST: formatCurrency(axpoDesglose.extras),
    AXPO_RENTAL_COST: formatCurrency(electricity.extras.alquilerEquipoMedida),
    AXPO_VAT: formatCurrency(axpoDesglose.iva),
    AXPO_TOTAL: formatCurrency(axpoTotal),
    
    // Savings
    SAVINGS_AMOUNT: formatCurrency(savings),
  };
}

// Main function
function generateTestPdf() {
  console.log('🔧 Generating test PDF HTML...\n');
  
  try {
    // Read template
    const templatePath = path.join(__dirname, '..', 'src', 'infrastructure', 'pdf', 'simulation-template.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    
    // Extract variables
    const variables = extractVariables();
    
    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
    });
    
    // Save output
    const outputPath = path.join(__dirname, 'test-pdf-output.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    
    console.log('✅ Test HTML generated successfully!\n');
    console.log(`📄 Output file: ${outputPath}\n`);
    console.log('📊 Template Variables:');
    console.log('─────────────────────────────────────────');
    Object.entries(variables).forEach(([key, value]) => {
      const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
      console.log(`   ${key.padEnd(25)} → ${displayValue}`);
    });
    console.log('\n💡 Open the HTML file in a browser to preview the layout.');
    console.log('   You can then print to PDF or use a tool like Puppeteer.\n');
    
  } catch (error) {
    console.error('❌ Error generating test PDF:', error.message);
    console.error('\n📁 Make sure the template file exists at:');
    console.error('   src/infrastructure/pdf/simulation-template.html\n');
    process.exit(1);
  }
}

// Run
generateTestPdf();
