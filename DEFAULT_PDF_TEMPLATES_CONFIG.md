# Default PDF Templates Configuration

This document outlines the implementation of default PDF template configuration for the AXPO Simulator application.

## Overview

The system supports configuring default PDF templates at a system-wide level. This allows administrators to set which PDF templates should be used by default when sharing simulations based on the commodity type (gas or electricity).

## Configuration Options

Two configuration settings are available in the System Business Settings:

### 1. Default Gas Template

- **Field:** `defaultPdfTemplateGasId`
- **Description:** The PDF template used by default for gas simulations
- **Usage:** When sharing a gas simulation, this template will be selected by default
- **Filter:** Only shows PDF templates with `commodity = "GAS"` or no commodity specified

### 2. Default Electricity Template

- **Field:** `defaultPdfTemplateElectricityId`
- **Description:** The PDF template used by default for electricity simulations
- **Usage:** When sharing an electricity simulation, this template will be selected by default
- **Filter:** Only shows PDF templates with `commodity = "ELECTRICITY"` or no commodity specified

## Database Schema Changes

The following fields were added to the `SystemConfig` model in `schema.prisma`:

```prisma
model SystemConfig {
  // ... existing fields ...

  // PDF template settings for simulations
  defaultPdfTemplateGasId      String?  // Default PDF template for gas simulations
  defaultPdfTemplateElectricityId String? // Default PDF template for electricity simulations

  // ... rest of fields ...
}
```

### Migrations

Two migrations were created:

1. `20260421150016_add_default_pdf_template_configs` - Added the PDF template configuration fields
2. `20260421150633_remove_default_pdf_template_shared` - Removed the shared template field (no longer needed)

````

## UI Changes

### Configuration Page

A new tab "PDF Templates" has been added to the System Business Settings section:

**Navigation Path:**
Internal Panel → Configurations → System & Business Logic → PDF Templates

The tab includes:

- Title and description explaining the purpose
- Two dropdown selects for choosing default templates (Gas and Electricity)
- Each dropdown filters templates appropriately by commodity type
- Save and Reset buttons (shared with other tabs)

### Translation Keys Added

**English (`en`):**

- `systemSettings.tabPdfDefaults`: "PDF Templates"
- `systemSettings.titlePdfDefaults`: "Default PDF Templates"
- `systemSettings.titlePdfDefaultsDesc`: "Configure which PDF templates are used by default when sharing simulations"
- `systemSettings.fieldDefaultPdfGas`: "Default Gas Template"
- `systemSettings.fieldDefaultPdfGasDesc`: "PDF template used by default for gas simulations"
- `systemSettings.fieldDefaultPdfElectricity`: "Default Electricity Template"
- `systemSettings.fieldDefaultPdfElectricityDesc`: "PDF template used by default for electricity simulations"

**Spanish (`es`):**

- `systemSettings.tabPdfDefaults`: "Plantillas PDF"
- `systemSettings.titlePdfDefaults`: "Plantillas PDF Predeterminadas"
- `systemSettings.titlePdfDefaultsDesc`: "Configura qué plantillas PDF se usan por defecto al compartir simulaciones"
- `systemSettings.fieldDefaultPdfGas`: "Plantilla Predeterminada para Gas"
- `systemSettings.fieldDefaultPdfGasDesc`: "Plantilla PDF usada por defecto para simulaciones de gas"
- `systemSettings.fieldDefaultPdfElectricity`: "Plantilla Predeterminada para Electricidad"
- `systemSettings.fieldDefaultPdfElectricityDesc`: "Plantilla PDF usada por defecto para simulaciones de electricidad"

## API Changes

No new API endpoints were required. The existing endpoints handle the fields automatically:

- **GET** `/api/v1/internal/config/system` - Returns the configuration including the PDF template fields
- **PUT** `/api/v1/internal/config/system` - Updates the configuration including the PDF template fields
- **GET** `/api/v1/internal/config/pdf-templates` - Used to load available PDF templates for the dropdowns

## Files Modified

1. **Database Schema:**
   - `prisma/schema.prisma` - Added three new fields to SystemConfig model

2. **Frontend Components:**
   - `app/internal/components/modules/SystemBusinessSettings.tsx` - Added PDF defaults tab and logic
   - `app/internal/components/modules/configurations.css` - Added `.settings-panel-description` style

3. **Translations:**
   - `src/lib/translations.ts` - Added English and Spanish translations for new fields

4. **Migrations:**
   - Created `prisma/migrations/20260421150016_add_default_pdf_template_configs/migration.sql`

## Usage Instructions

### For Administrators

1. Navigate to **Internal Panel** → **Configurations**
2. Select the **System & Business Logic** tab
3. Click on the **PDF Templates** sub-tab
4. Configure the desired default templates:
   - **Default Gas Template**: Specific to gas simulations
   - **Default Electricity Template**: Specific to electricity simulations
5. Click **Save Changes**

### For Developers

When implementing simulation sharing logic, you can retrieve these default values from the system configuration:

```typescript
const config = await prisma.systemConfig.findFirst();
const defaultGasTemplate = config.defaultPdfTemplateGasId;
const defaultGasTemplate = config.defaultPdfTemplateGasId;
const defaultElectricityTemplate = config.defaultPdfTemplateElectricityId;
````

## Future Enhancements

Potential improvements for this feature:

1. **Auto-select based on commodity type**: When sharing a simulation, automatically pre-select the appropriate template based on the simulation's commodity type
2. **Template preview**: Show a preview of the selected template
3. **Validation**: Ensure selected templates are active and not deleted
4. **Default email templates**: Similar configuration for email templates
5. **Agency-level overrides**: Allow agencies to override system-wide defaults

## Testing

To test the feature:

1. Ensure you have PDF templates created in the system (with different commodity types)
2. Navigate to the System Business Settings → PDF Templates tab
3. Select templates for gas and electricity categories
4. Save the configuration
5. Verify the settings persist after page reload
6. (Future) Test that simulation sharing uses the configured defaults

## Notes

- Both fields are optional (can be set to null/empty)
- Setting a value to empty means no default template is selected
- The dropdowns filter templates appropriately:
  - Gas: Shows only templates with `commodity = "GAS"` or no commodity
  - Electricity: Shows only templates with `commodity = "ELECTRICITY"` or no commodity
- Changes are saved to the database immediately when clicking "Save Changes"
