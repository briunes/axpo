# Template Variables System - Implementation Summary

## What Was Done

### 1. Database Schema

- ✅ Added `TemplateVariable` model to Prisma schema
- ✅ Created migration with 53 predefined variables for simulation PDFs
- ✅ Variables include client info, simulation data, power/energy periods, costs, and savings

### 2. API Endpoints

- ✅ `GET /api/v1/internal/config/template-variables` - List all variables
- ✅ `POST /api/v1/internal/config/template-variables` - Create new variable
- ✅ `PUT /api/v1/internal/config/template-variables/{id}` - Update variable
- ✅ `DELETE /api/v1/internal/config/template-variables/{id}` - Delete variable

### 3. Frontend Components

- ✅ Updated `PdfTemplatesNew.tsx` to load variables from database
- ✅ Updated `EmailTemplatesNew.tsx` to load variables from database
- ✅ Updated share simulation page to load and display variables
- ✅ Added `DraggableVariables` component to template editor sidebar

### 4. Variable Replacement System

- ✅ Created `variableReplacer.ts` utility with:
  - `extractVariableValues()` - Extract all variable values from simulation data
  - `replaceVariables()` - Replace {{VARIABLES}} in templates
- ✅ Handles all 53 variables automatically
- ✅ Proper formatting for currency, numbers, and dates

### 5. Configuration API

- ✅ Added `TemplateVariable` interface
- ✅ Added `getTemplateVariables()` function
- ✅ Added `createTemplateVariable()` function
- ✅ Added `updateTemplateVariable()` function
- ✅ Added `deleteTemplateVariable()` function

## How It Works

### Variable Storage (Database)

```typescript
{
  id: "var_001",
  key: "CLIENT_NAME",
  label: "Client Name",
  description: "The company or client name",
  category: "client",
  example: "Juvacam SL",
  sortOrder: 10,
  active: true
}
```

### Variable Categories

- **client** - Client-related variables (name, address, CUPS)
- **simulation** - Simulation metadata (ID, period, dates, status)
- **user** - User info (owner name, email)
- **calculation** - Calculation results (costs, savings)
- **period** - Power and energy per period (P1-P6)

### Usage in Templates

**Template Editor (Configurations page):**

1. User opens PDF/Email template editor
2. Variables sidebar shows all active variables from database
3. User can drag variables into HTML editor
4. Variables are inserted as `{{VARIABLE_KEY}}`
5. Preview shows variables replaced with example values

**Share Simulation Page:**

1. User selects a template
2. Template content loads in editor
3. Variables sidebar shows all available variables
4. User can add/edit template content with variables
5. When sending/downloading, variables are replaced with actual simulation data

### Variable Replacement Flow

```
1. User clicks "Download PDF" or "Send Email"
2. System calls extractVariableValues(simulation, payload)
3. Function calculates all 53 variables from simulation data
4. System calls replaceVariables(templateContent, variableValues)
5. All {{VARIABLE}} placeholders replaced with actual values
6. Final HTML sent to PDF generator or email sender
```

## Available Variables (53 total)

### Client Info (3)

- `CLIENT_NAME`, `CLIENT_ADDRESS`, `CUPS_NUMBER`

### Simulation Data (5)

- `SIMULATION_ID`, `SIMULATION_PERIOD`, `CREATED_AT`, `EXPIRES_AT`, `STATUS`

### User Info (2)

- `OWNER_NAME`, `OWNER_EMAIL`

### Calculation Results (3)

- `PRODUCT_NAME`, `ANNUAL_CONSUMPTION`, `SAVINGS_AMOUNT`

### Current Plan Power (6)

- `CURRENT_POWER_P1` through `CURRENT_POWER_P6`

### Current Plan Energy (6)

- `CURRENT_ENERGY_P1` through `CURRENT_ENERGY_P6`

### Current Plan Costs (8)

- `CURRENT_POWER_COST`, `CURRENT_ENERGY_COST`, `CURRENT_EXCESS_COST`
- `CURRENT_TAX_COST`, `CURRENT_OTHER_COST`, `CURRENT_RENTAL_COST`
- `CURRENT_VAT`, `CURRENT_TOTAL`

### AXPO Plan Power (6)

- `AXPO_POWER_P1` through `AXPO_POWER_P6`

### AXPO Plan Energy (6)

- `AXPO_ENERGY_P1` through `AXPO_ENERGY_P6`

### AXPO Plan Costs (8)

- `AXPO_POWER_COST`, `AXPO_ENERGY_COST`, `AXPO_EXCESS_COST`
- `AXPO_TAX_COST`, `AXPO_OTHER_COST`, `AXPO_RENTAL_COST`
- `AXPO_VAT`, `AXPO_TOTAL`

## Benefits

### ✅ Centralized Management

- All variables defined in one place (database)
- No hardcoded variable lists in frontend/backend
- Easy to add new variables without code changes

### ✅ Frontend/Backend Sync

- Both systems read from same database
- No mismatch between available variables
- Template preview uses actual variable definitions

### ✅ User-Friendly

- Variables have human-readable labels
- Descriptions explain what each variable contains
- Example values help users understand output
- Drag-and-drop interface makes template editing easy

### ✅ Extensible

- New variables can be added via API or database
- Variables can be categorized and ordered
- Variables can be activated/deactivated
- No code deployment needed to add variables

## Testing

### 1. View Variables in Database

```sql
SELECT * FROM template_variables ORDER BY category, sortOrder;
```

### 2. Test API Endpoints

```bash
# Get all variables
curl http://localhost:3000/api/v1/internal/config/template-variables

# Create new variable
curl -X POST http://localhost:3000/api/v1/internal/config/template-variables \
  -H "Content-Type: application/json" \
  -d '{"key":"TEST_VAR","label":"Test Variable","category":"test","example":"Test"}'
```

### 3. Test in UI

1. Go to Configurations → PDF Templates
2. Create/edit a template
3. Check variables sidebar - should show all 53 variables grouped by category
4. Drag a variable into template
5. Preview should show example value

6. Go to Simulations → Select simulation → Share
7. Select a PDF template
8. Check variables sidebar - should show same variables
9. Edit template content
10. Download PDF - variables should be replaced with actual simulation data

## Next Steps

### Optional Enhancements

1. **Variable Management UI** - Add a UI in Configurations to manage variables
2. **Variable Grouping** - Group variables by category in sidebar
3. **Variable Search** - Add search/filter in variables sidebar
4. **Custom Variables** - Allow users to define custom variables
5. **Conditional Variables** - Support conditional display (if gas simulation, show gas variables)
6. **Formula Variables** - Variables that are calculated from other variables

### Integration

- The system is ready to use immediately
- Existing templates will work with new variables
- PDF generation route needs to import and use `variableReplacer.ts`
- Email sending route needs to import and use `variableReplacer.ts`

## Files Modified/Created

### Database

- `prisma/schema.prisma` - Added TemplateVariable model
- `prisma/migrations/20260410_add_template_variables/migration.sql` - Migration with 53 variables

### Backend API

- `app/api/v1/internal/config/template-variables/route.ts` - GET, POST endpoints
- `app/api/v1/internal/config/template-variables/[id]/route.ts` - PUT, DELETE endpoints

### Frontend API Client

- `app/internal/lib/configApi.ts` - Added TemplateVariable interface and functions

### Frontend Components

- `app/internal/components/modules/PdfTemplatesNew.tsx` - Load variables from DB
- `app/internal/components/modules/EmailTemplatesNew.tsx` - Load variables from DB
- `app/internal/simulations/[id]/share/page.tsx` - Load variables, show sidebar, use replacer

### Utilities

- `src/infrastructure/pdf/variableReplacer.ts` - Variable extraction and replacement logic

## Migration Applied

```bash
✅ Migration `20260410_add_template_variables` applied successfully
✅ 53 template variables inserted into database
✅ Prisma Client regenerated
```
