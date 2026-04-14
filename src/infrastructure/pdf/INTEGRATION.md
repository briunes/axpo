# PDF Template Integration Guide

## Quick Start

The PDF template system has been created with the following structure:

```
src/infrastructure/pdf/
├── simulation-template.html     # HTML template with {{VARIABLES}}
├── simulationPdfGenerator.ts    # TypeScript module for data processing
├── example-usage.ts             # Example/test file
└── README.md                    # Complete documentation
```

## What's Included

### 1. HTML Template (`simulation-template.html`)

- Fully styled HTML template matching the design in your image
- Two-column comparison layout (Current Plan vs AXPO Plan)
- Period breakdown (P1-P6) for power and energy
- Cost breakdown section with all line items
- Responsive grid layouts
- Print-optimized styles

### 2. Template Generator (`simulationPdfGenerator.ts`)

- `extractTemplateVariables()` - Extracts data from simulation and formats it
- `replaceTemplateVariables()` - Replaces {{VARIABLES}} in HTML
- `generateSimulationHtml()` - Complete workflow to generate HTML
- Full TypeScript types for all variables

### 3. Documentation (`README.md`)

- Complete list of all template variables
- Usage examples
- Integration guide for PDF libraries
- Customization instructions
- Testing checklist

## Next Steps

### Step 1: Install a PDF Generation Library

Choose one of these options:

**Option A: Puppeteer (Recommended)**

```bash
pnpm add puppeteer
pnpm add -D @types/node
```

**Option B: wkhtmltopdf**

```bash
brew install wkhtmltopdf  # macOS
pnpm add wkhtmltopdf
```

### Step 2: Update the PDF Route

Update `app/api/v1/internal/simulations/[id]/pdf/route.ts`:

```typescript
import { generateSimulationHtml } from "@/infrastructure/pdf/simulationPdfGenerator";
import type { SimulationPayload } from "@/domain/types/simulation";
import puppeteer from "puppeteer";

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

    // Get latest version with full simulation data
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
      include: {
        simulation: {
          include: {
            client: true,
            ownerUser: true,
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

    // Convert HTML to PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=simulacion-${simulation.id}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  },
);
```

### Step 3: Test the Template

Run the example to generate test HTML:

```bash
# Add to package.json scripts:
"test:pdf": "tsx src/infrastructure/pdf/example-usage.ts"

# Then run:
pnpm run test:pdf
```

This will create `test-output.html` that you can open in a browser to preview.

### Step 4: Verify with Real Data

Test with a real simulation:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/internal/simulations/YOUR_SIM_ID/pdf \
  --output test-simulation.pdf
```

## Template Variables Reference

All variables in the template:

### Basic Info

- `{{CLIENT_NAME}}` - Client name
- `{{CLIENT_ADDRESS}}` - Full address
- `{{CUPS_NUMBER}}` - CUPS identifier
- `{{SIMULATION_PERIOD}}` - Date range
- `{{ANNUAL_CONSUMPTION}}` - Annual kWh
- `{{PRODUCT_NAME}}` - Product name

### Current Plan

- `{{CURRENT_POWER_P1}}` to `{{CURRENT_POWER_P6}}` - Power (kW)
- `{{CURRENT_ENERGY_P1}}` to `{{CURRENT_ENERGY_P6}}` - Energy (kWh)
- `{{CURRENT_POWER_COST}}`, `{{CURRENT_ENERGY_COST}}`, etc. - Costs
- `{{CURRENT_TOTAL}}` - Total cost

### AXPO Plan

- `{{AXPO_POWER_P1}}` to `{{AXPO_POWER_P6}}` - Power (kW)
- `{{AXPO_ENERGY_P1}}` to `{{AXPO_ENERGY_P6}}` - Energy (kWh)
- `{{AXPO_POWER_COST}}`, `{{AXPO_ENERGY_COST}}`, etc. - Costs
- `{{AXPO_TOTAL}}` - Total cost

### Savings

- `{{SAVINGS_AMOUNT}}` - Amount saved

## Customization

### Change Logo

Replace the SVG in the header section of `simulation-template.html`:

```html
<div style="text-align: right;">
  <img src="path/to/axpo-logo.png" alt="AXPO" style="width: 120px;" />
</div>
```

### Change Colors

Update CSS variables in the `<style>` section:

```css
.greeting {
  color: #e91e63; /* Primary pink color */
}

.plan-header.axpo {
  background-color: #4caf50; /* AXPO green */
}
```

### Add More Sections

Add new HTML sections before the footer:

```html
<div class="additional-section">
  <h3>Additional Information</h3>
  <p>{{CUSTOM_VARIABLE}}</p>
</div>
```

Then add the variable to `PdfTemplateVariables` interface.

## Production Deployment

### Performance Optimization

1. **Cache Puppeteer instance** (don't launch/close for each PDF)
2. **Use serverless PDF service** (e.g., AWS Lambda with Chrome)
3. **Queue PDF generation** for large batches
4. **Set timeouts** to prevent hanging requests

### Error Handling

```typescript
try {
  const html = generateSimulationHtml(simulation, payload);
  const pdf = await htmlToPdf(html);
  return new NextResponse(pdf, { ... });
} catch (error) {
  console.error("PDF generation failed:", error);

  // Fallback to simple PDF
  const fallbackPdf = buildSimplePdf([
    `Simulation ${simulation.id}`,
    `Error: Could not generate detailed PDF`,
  ]);

  return new NextResponse(fallbackPdf, { ... });
}
```

### Monitoring

Log PDF generation metrics:

```typescript
const startTime = Date.now();
const pdf = await generatePdf(html);
const duration = Date.now() - startTime;

console.log(`PDF generated in ${duration}ms for simulation ${id}`);

// Alert if generation takes too long
if (duration > 10000) {
  console.warn(`Slow PDF generation: ${duration}ms`);
}
```

## Troubleshooting

### Issue: "Cannot find template file"

Make sure the template file is included in the build:

```javascript
// next.config.mjs
export default {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.html$/,
      type: "asset/source",
    });
    return config;
  },
};
```

### Issue: "Variables not replaced"

Check that variable names match exactly (case-sensitive):

- Template: `{{CLIENT_NAME}}`
- Variable: `CLIENT_NAME` (not `client_name`)

### Issue: "PDF styles not rendering"

Use Puppeteer with `printBackground: true`:

```typescript
const pdf = await page.pdf({
  printBackground: true, // Important!
  format: "A4",
});
```

### Issue: "Puppeteer timeout"

Increase timeout and use faster page load strategy:

```typescript
await page.setContent(html, {
  waitUntil: "domcontentloaded", // Faster than 'networkidle0'
  timeout: 60000,
});
```

## Examples

### Generate PDF for a specific simulation

```typescript
import { generateSimulationHtml } from "@/infrastructure/pdf/simulationPdfGenerator";
import { getSimulationById } from "@/application/services/simulationService";

const simulation = await getSimulationById("sim-123");
const html = generateSimulationHtml(simulation.data, simulation.payload);
// Convert to PDF...
```

### Preview in browser (development)

```typescript
// Add a preview route for development
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const simulation = await getSimulation(id);
  const html = generateSimulationHtml(simulation.data, simulation.payload);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
```

Visit: `http://localhost:3000/api/v1/internal/simulations/preview?id=sim-123`

## Support

For issues or questions:

1. Check the README.md for detailed documentation
2. Review example-usage.ts for working examples
3. Test with the test script: `pnpm run test:pdf`
4. Verify template variables are populated correctly

## File Locations

```
backend/
├── src/
│   └── infrastructure/
│       └── pdf/
│           ├── simulation-template.html       ← HTML template
│           ├── simulationPdfGenerator.ts      ← Generator logic
│           ├── example-usage.ts               ← Test/example
│           ├── README.md                      ← Full documentation
│           └── INTEGRATION.md                 ← This file
└── app/
    └── api/
        └── v1/
            └── internal/
                └── simulations/
                    └── [id]/
                        └── pdf/
                            └── route.ts       ← Update this file
```
