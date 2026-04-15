/**
 * Example usage of the PDF template system
 *
 * This file demonstrates how to generate a PDF from simulation data.
 * Run this file to test the template generation.
 */

import {
  generateSimulationHtml,
  extractTemplateVariables,
} from "./simulationPdfGenerator";
import * as fs from "fs";
import * as path from "path";
import type { SimulationPayload } from "@/domain/types/simulation";

// Mock simulation data based on the image provided
const mockSimulation = {
  id: "sim-001",
  status: "SHARED",
  cupsNumber: "ES0031352682800001VB",
  createdAt: "2025-11-30T10:00:00Z",
  expiresAt: "2026-01-31T23:59:59Z",
  client: {
    id: "client-001",
    name: "Juvacam SL",
    address: "C de los Dominicos, 6",
    postalCode: "47001",
    city: "Valladolid",
    contactEmail: "contact@juvacam.com",
  },
  ownerUser: {
    id: "user-001",
    fullName: "María García",
    email: "maria.garcia@fiva.com",
  },
};

const mockPayload: SimulationPayload = {
  schemaVersion: "1",
  type: "ELECTRICITY",

  electricity: {
    tarifaAcceso: "3.0TD",
    zonaGeografica: "Peninsula",
    perfilCarga: "NORMAL",

    // Contracted power (kW) for each period
    potenciaContratada: {
      P1: 0.0851,
      P2: 0.0851,
      P3: 0.0851,
      P4: 0.0851,
      P5: 0.0851,
      P6: 0.0851,
    },

    // Excess power (if any)
    excesoPotencia: 0,

    // Energy consumption (kWh) for the billing period
    consumo: {
      P1: 120,
      P2: 150,
      P3: 180,
      P4: 0,
      P5: 0,
      P6: 200,
    },

    // Billing period
    periodo: {
      fechaInicio: "2025-11-30",
      fechaFin: "2025-12-31",
      dias: 31,
    },

    // Current invoice total (from client's actual bill)
    facturaActual: 36272.36,

    // Extra charges
    extras: {
      reactiva: 0,
      alquilerEquipoMedida: 15.5,
      otrosCargos: 25.0,
    },
  },

  // Calculation results
  results: {
    calculatedAt: "2025-12-01T15:30:00Z",
    baseValueSetId: "base-values-001",

    electricity: [
      {
        productKey: "ESTABLE:N1",
        productLabel: "ESTABLE N1 (Personalizada Index)",
        commodity: "ELECTRICITY",
        pricingType: "INDEXED",
        totalFactura: 31272.38,
        ahorro: 5000.0,
        pctAhorro: 13.78,
        ahorroAnual: 58885.87,

        desglose: {
          terminoEnergia: 22304.7,
          terminoPotencia: 2123.86,
          excesoPotencia: 0,
          terminoFijo: 0,
          extras: 40.5,
          impuestoElectrico: 1256.47,
          impuestoHidrocarburo: 0,
          iva: 5427.44,
        },
      },
      // Additional product options could be here
      {
        productKey: "DINAMICA:N2",
        productLabel: "DINAMICA N2",
        commodity: "ELECTRICITY",
        pricingType: "INDEXED",
        totalFactura: 32100.0,
        ahorro: 4172.36,
        pctAhorro: 11.5,
        ahorroAnual: 50681.1,

        desglose: {
          terminoEnergia: 23000.0,
          terminoPotencia: 2200.0,
          excesoPotencia: 0,
          terminoFijo: 0,
          extras: 40.5,
          impuestoElectrico: 1300.0,
          impuestoHidrocarburo: 0,
          iva: 5559.5,
        },
      },
    ],
  },

  // Selected offer for this simulation
  selectedOffer: {
    productKey: "ESTABLE:N1",
    commodity: "ELECTRICITY",
    pricingType: "INDEXED",
    selectedAt: "2025-12-01T15:30:00Z",
  },
};

/**
 * Generate and save test HTML output
 */
function generateTestHtml() {
  console.log("🔧 Generating PDF HTML from template...");
  console.log(`   Simulation ID: ${mockSimulation.id}`);
  console.log(`   Client: ${mockSimulation.client.name}`);
  console.log(`   CUPS: ${mockSimulation.cupsNumber}`);
  console.log("");

  try {
    // Generate HTML with populated variables
    const html = generateSimulationHtml(mockSimulation, mockPayload);

    // Save to output file
    const outputPath = path.join(__dirname, "test-output.html");
    fs.writeFileSync(outputPath, html, "utf-8");

    console.log("✅ HTML generated successfully!");
    console.log(`   Output file: ${outputPath}`);
    console.log("");
    console.log(
      "📄 You can open this file in a browser to preview the PDF layout.",
    );
    console.log("   Or use a tool like Puppeteer to convert it to PDF.");
    console.log("");

    // Also output the extracted variables for inspection
    const variables = extractTemplateVariables(mockSimulation, mockPayload);
    console.log("📊 Extracted Variables:");
    console.log("─────────────────────────────────────────");
    Object.entries(variables).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  } catch (error) {
    console.error("❌ Error generating HTML:", error);
    throw error;
  }
}

/**
 * Example of custom variable manipulation
 */
function generateCustomHtml() {
  console.log("\n🎨 Generating custom HTML with modified variables...");

  const {
    loadHtmlTemplate,
    extractTemplateVariables,
    replaceTemplateVariables,
  } = require("./simulationPdfGenerator");

  // Load template
  const template = loadHtmlTemplate();

  // Extract variables
  const variables = extractTemplateVariables(mockSimulation, mockPayload);

  // Customize variables
  variables.CLIENT_NAME = "Custom Company Name SL";
  variables.SAVINGS_AMOUNT = "10.000,00";

  // Replace variables
  const customHtml = replaceTemplateVariables(template, variables);

  // Save custom output
  const customOutputPath = path.join(__dirname, "test-output-custom.html");
  fs.writeFileSync(customOutputPath, customHtml, "utf-8");

  console.log("✅ Custom HTML generated!");
  console.log(`   Output file: ${customOutputPath}`);
}

// Run the example
if (require.main === module) {
  generateTestHtml();
  // Uncomment to test custom variables:
  // generateCustomHtml();
}

export { generateTestHtml, generateCustomHtml };
