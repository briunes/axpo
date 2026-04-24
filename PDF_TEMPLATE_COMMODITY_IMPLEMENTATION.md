# PDF Template Commodity Filter Implementation

## Summary

This implementation adds the ability to filter PDF templates for simulation sharing based on whether the simulation is for **gas** or **electricity**. Templates must be tagged with a specific commodity type (ELECTRICITY or GAS), and only templates matching the simulation's type will be shown when sharing.

## Important: No "BOTH" Option

**Simulations and templates must be specifically for either ELECTRICITY or GAS.** The "BOTH" option has been removed to ensure clear categorization and proper template matching.

## Changes Made

### 1. Database Schema Changes

**File:** `prisma/schema.prisma`

- Added `commodity` field to `PdfTemplate` model (nullable String)
- Values: `"ELECTRICITY"` or `"GAS"` only
- Defaults to `null` which is treated as `"ELECTRICITY"`

**Migration:** `20260421142219_add_commodity_to_pdf_templates`

- Adds the `commodity` column to `pdf_templates` table
- Existing templates updated to `"ELECTRICITY"` via migration script

### 2. TypeScript Type Updates

**File:** `app/internal/lib/configApi.ts`

- Updated `PdfTemplate` interface to include optional `commodity` field

**File:** `src/domain/types/simulation.ts`

- Updated `SimulationPayload.type` to only allow `"ELECTRICITY" | "GAS"`
- Removed `"BOTH"` option

### 3. UI Component Updates

**File:** `app/internal/components/modules/PdfTemplatesNew.tsx`

- Added commodity dropdown selector in template creation/edit form (ELECTRICITY or GAS only)
- Added commodity column in templates table display
- Visual indicators: ⚡ for Electricity, 🔥 for Gas
- Default value: `"ELECTRICITY"`

### 4. Simulation Form Updates

**Files Updated:**

- `app/internal/simulations/new/page.tsx`
- `app/internal/components/modules/SimulationForm.tsx`
- `app/internal/components/modules/SimulationFormPanel.tsx`

**Changes:**

- Removed "BOTH" button from simulation type selector
- Users must choose either ELECTRICITY or GAS
- Forms show only the relevant input fields for the selected type

### 5. Template Filtering Logic

**File:** `app/internal/simulations/[id]/share/page.tsx`

- Extracts simulation type from `payload.type` field
- Filters PDF templates based on exact commodity match:
  - Only templates with matching `commodity` value are shown
  - No fallback to "BOTH" option

**File:** `app/internal/simulations/[id]/components/ShareSimulationView.tsx`

- Same filtering logic applied to the alternative share view component

### 6. Seed Script Updates

**Files Updated:**

- `scripts/seed-runtime.mjs` - Updated default templates with `commodity: "ELECTRICITY"`
- `scripts/seed-configurations.mjs` - Updated default templates with `commodity: "ELECTRICITY"`
- `scripts/seed-price-history-template.mjs` - Updated price history template with `commodity: "ELECTRICITY"`

**Modified Script:** `scripts/update-template-commodity.mjs`

- Migration helper to set `commodity: "ELECTRICITY"` for existing templates

### 7. Translation Updates

**File:** `src/lib/translations.ts`

**English (en):**

- `fieldCommodity`: "Commodity"
- `colCommodity`: "Commodity"
- `commodityElectricity`: "Electricity Only"
- `commodityGas`: "Gas Only"

**Spanish (es):**

- `fieldCommodity`: "Suministro"
- `colCommodity`: "Suministro"
- `commodityElectricity`: "Solo Electricidad"
- `commodityGas`: "Solo Gas"

## Filtering Logic Flow

1. **Simulation Type Detection:**
   - Read `simulation.payloadJson.type` field
   - Possible values: `"ELECTRICITY"` or `"GAS"`
   - Defaults to `"ELECTRICITY"` if not specified

2. **Template Filtering:**

   ```typescript
   const filteredPdfTemplates = pdfTpl.filter((t) => {
     if (!t.active) return false;
     if (t.type !== "simulation-output" && t.type !== "simulation-detailed")
       return false;

     // Commodity filtering - must match exactly
     return t.commodity === simulationType;
   });
   ```

3. **Template Availability Matrix:**
   | Simulation Type | Template Commodity | Shown? |
   |----------------|-------------------|--------|
   | ELECTRICITY | ELECTRICITY | ✅ |
   | ELECTRICITY | GAS | ❌ |
   | GAS | ELECTRICITY | ❌ |
   | GAS | GAS | ✅ |

## Usage

### Creating a Template for Specific Commodity

1. Navigate to **Configurations → PDF Templates**
2. Click **+ New Template**
3. Fill in name, type, and description
4. Select **Commodity** from dropdown:
   - **Electricity Only**: Template only shown for electricity simulations
   - **Gas Only**: Template only shown for gas simulations
5. Add HTML content and save

### Creating a Simulation

1. Navigate to **Simulations → New Simulation**
2. Select commodity type:
   - **⚡ ELECTRICITY**: For electricity simulations only
   - **🔥 GAS**: For gas simulations only
3. Fill in relevant form fields (electricity or gas specific)
4. Calculate and save

### Sharing a Simulation

When sharing a simulation:

1. System automatically detects simulation type from payload
2. Only templates matching the simulation's exact commodity are shown
3. User selects from filtered template list
4. Generates PDF or sends email with selected template

## Backward Compatibility

- Existing templates without `commodity` field are treated as `"ELECTRICITY"`
- Migration script automatically updates all existing templates to `"ELECTRICITY"`
- Templates need to be manually updated to `"GAS"` if they should be used for gas simulations
- Existing simulations without a `type` field default to `"ELECTRICITY"`

## Testing Checklist

- [x] Database migration applied successfully
- [x] Existing templates updated with commodity field
- [x] UI shows commodity field in template editor (ELECTRICITY or GAS only)
- [x] UI shows commodity column in templates table
- [x] Template filtering works for ELECTRICITY simulations
- [x] Template filtering works for GAS simulations
- [x] BOTH option removed from all forms
- [x] Simulations must be ELECTRICITY or GAS only
- [x] Translations display correctly in English and Spanish
- [x] No TypeScript errors
- [x] Development server runs without errors
