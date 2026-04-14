# Simulation PDF Template System

This document describes the PDF template system for generating simulation reports.

## Overview

The PDF generation system consists of:

1. **HTML Template** - A styled HTML template with placeholder variables
2. **Template Generator** - TypeScript module to populate variables with simulation data
3. **PDF Renderer** - Converts HTML to PDF (integration needed)

## Files

- `simulation-template.html` - HTML template with styling and placeholder variables
- `simulationPdfGenerator.ts` - TypeScript module for data extraction and variable replacement

## Template Variables

All variables use the format `{{VARIABLE_NAME}}` and are replaced with actual data during generation.

### Client Information

- `{{CLIENT_NAME}}` - Client/company name
- `{{CLIENT_ADDRESS}}` - Full client address
- `{{CUPS_NUMBER}}` - CUPS identifier

### Simulation Metadata

- `{{SIMULATION_PERIOD}}` - Period of simulation (e.g., "30/11/2025 — 31/12/2025")
- `{{ANNUAL_CONSUMPTION}}` - Estimated annual consumption in kWh
- `{{PRODUCT_NAME}}` - Selected product name

### Current Plan - Contracted Power (kW)

- `{{CURRENT_POWER_P1}}` through `{{CURRENT_POWER_P6}}` - Power for periods P1-P6

### Current Plan - Energy Consumption (kWh)

- `{{CURRENT_ENERGY_P1}}` through `{{CURRENT_ENERGY_P6}}` - Energy for periods P1-P6

### Current Plan - Cost Breakdown

- `{{CURRENT_POWER_COST}}` - Power term cost
- `{{CURRENT_ENERGY_COST}}` - Energy term cost
- `{{CURRENT_EXCESS_COST}}` - Excess power charges
- `{{CURRENT_TAX_COST}}` - Tax charges
- `{{CURRENT_OTHER_COST}}` - Other charges
- `{{CURRENT_RENTAL_COST}}` - Equipment rental
- `{{CURRENT_VAT}}` - VAT amount
- `{{CURRENT_TOTAL}}` - Total current invoice

### AXPO Plan - Same structure as Current Plan

- `{{AXPO_POWER_P1}}` through `{{AXPO_POWER_P6}}`
- `{{AXPO_ENERGY_P1}}` through `{{AXPO_ENERGY_P6}}`
- `{{AXPO_POWER_COST}}`, `{{AXPO_ENERGY_COST}}`, etc.
- `{{AXPO_TOTAL}}` - Total AXPO proposal

### Savings

- `{{SAVINGS_AMOUNT}}` - Calculated savings (Current - AXPO)

## Usage

### Basic Usage

```typescript
import { generateSimulationHtml } from "@/infrastructure/pdf/simulationPdfGenerator";

// Get simulation and payload data
const simulation = await getSimulation(id);
const payload: SimulationPayload = simulation.versions[0].payloadJson;

// Generate HTML with replaced variables
const html = generateSimulationHtml(simulation, payload);

// Convert to PDF (requires PDF library integration)
const pdf = await htmlToPdf(html);
```

### Custom Variable Replacement

```typescript
import {
  loadHtmlTemplate,
  extractTemplateVariables,
  replaceTemplateVariables,
} from "@/infrastructure/pdf/simulationPdfGenerator";

// Load template
const template = loadHtmlTemplate();

// Extract variables from data
const variables = extractTemplateVariables(simulation, payload);

// Optionally modify variables
variables.CLIENT_NAME = "Custom Client Name";

// Replace variables
const html = replaceTemplateVariables(template, variables);
```

## Integration with PDF Generation

To convert the HTML to PDF, you can use libraries like:

### Option 1: Puppeteer (Chromium-based)

```typescript
import puppeteer from "puppeteer";

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({
    format: "A4",
    margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    printBackground: true,
  });
  await browser.close();
  return pdf;
}
```

### Option 2: wkhtmltopdf (via node-wkhtmltopdf)

```typescript
import wkhtmltopdf from "wkhtmltopdf";
import { promisify } from "util";

async function htmlToPdf(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    wkhtmltopdf(html, { pageSize: "A4" })
      .on("data", (chunk) => buffers.push(chunk))
      .on("end", () => resolve(Buffer.concat(buffers)))
      .on("error", reject);
  });
}
```

### Option 3: pdf-lib (for more control)

For complex layouts or when you need to add interactive elements.

## Updating the PDF Route

Update the existing PDF route to use this new template system:

```typescript
// app/api/v1/internal/simulations/[id]/pdf/route.ts

import { generateSimulationHtml } from "@/infrastructure/pdf/simulationPdfGenerator";
import puppeteer from "puppeteer"; // or your preferred PDF library

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
      include: {
        simulation: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!latestVersion) {
      throw new ValidationError("No simulation version found");
    }

    // Generate HTML from template
    const html = generateSimulationHtml(
      latestVersion.simulation,
      latestVersion.payloadJson as SimulationPayload,
    );

    // Convert to PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=simulation-${simulation.id}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  },
);
```

## Customization

### Styling

All styles are contained in the `<style>` section of the HTML template. Key style classes:

- `.header` - Top section with greeting and logo
- `.plan-card` - Container for each pricing plan
- `.plan-card.axpo` - Special styling for AXPO plan (green border)
- `.period-grid` - Grid layout for P1-P6 periods
- `.cost-breakdown` - Cost line items
- `.savings-badge` - Highlighted savings indicator

### Adding New Variables

1. Add the variable to the `PdfTemplateVariables` interface
2. Update `extractTemplateVariables()` to populate it
3. Add `{{VARIABLE_NAME}}` to the HTML template

### Multi-language Support

For multi-language PDFs, you can:

1. Create language-specific templates (`simulation-template-es.html`, `simulation-template-en.html`)
2. Or use a template engine with i18n support
3. Or replace text labels as variables

## Data Flow

```
Simulation Data (Database)
         ↓
extractTemplateVariables() - Extract and format data
         ↓
PdfTemplateVariables (Structured data)
         ↓
replaceTemplateVariables() - Replace {{VARS}} in HTML
         ↓
HTML with actual data
         ↓
PDF Library (Puppeteer/wkhtmltopdf) - Render to PDF
         ↓
PDF Buffer (Binary)
```

## Testing

Create a test script to verify template generation:

```typescript
// scripts/test-pdf-generation.mjs
import { generateSimulationHtml } from "./src/infrastructure/pdf/simulationPdfGenerator";
import fs from "fs";

// Mock simulation data
const mockSimulation = {
  id: "sim-123",
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
    consumo: { P1: 100, P2: 150, P3: 200 },
    periodo: { fechaInicio: "2025-11-30", fechaFin: "2025-12-31", dias: 31 },
    facturaActual: 36272.36,
    extras: { alquilerEquipoMedida: 10 },
  },
  results: {
    electricity: [
      {
        productKey: "ESTABLE:N1",
        productLabel: "ESTABLE N1",
        totalFactura: 31272.38,
        ahorro: 5000,
        desglose: {
          terminoPotencia: 2123.86,
          terminoEnergia: 22304.7,
          extras: 150.9,
          impuestoElectrico: 1256.47,
          iva: 5427.44,
        },
      },
    ],
  },
};

// Generate HTML
const html = generateSimulationHtml(mockSimulation, mockPayload);

// Save to file for inspection
fs.writeFileSync("test-output.html", html);
console.log("HTML generated successfully: test-output.html");
```

## Production Checklist

- [ ] Install PDF generation library (Puppeteer recommended)
- [ ] Update PDF route handler to use new template system
- [ ] Test with real simulation data
- [ ] Verify all periods (P1-P6) display correctly
- [ ] Test with different tariffs (2.0TD, 3.0TD, 6.1TD)
- [ ] Verify currency formatting
- [ ] Test print layout (A4 page size)
- [ ] Add error handling for missing data
- [ ] Configure PDF generation timeout
- [ ] Add logging for PDF generation
- [ ] Set up monitoring for PDF generation failures

## Known Limitations

1. Current template assumes electricity simulations only (gas not yet supported)
2. Logo is a placeholder SVG (replace with actual AXPO logo)
3. "Current plan" cost breakdown is estimated (not actual breakdown from original invoice)
4. Template is fixed layout (not responsive for different page sizes)

## Future Enhancements

- Support for gas simulations
- Multi-page support for detailed breakdowns
- Charts and graphs for consumption patterns
- Client signature section for contracts
- QR code with public simulation link
- Watermark for draft/expired simulations
- Custom branding per agency
