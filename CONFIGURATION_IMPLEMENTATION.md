# Configuration Features Implementation Summary

**Date:** April 17, 2026  
**Implementation:** Local Development Environment

This document summarizes the implementation of three key configuration features from the CONFIGURATION_RECOMMENDATIONS.md document:

## Features Implemented

### 1. ✅ Calculation Formula Parameters (IVA & Electricity Tax)

**Schema Changes:**

- Added `ivaRate` field to `SystemConfig` model (default: 0.21 for 21%)
- Added `electricityTaxRate` field to `SystemConfig` model (default: 0.051127 for 5.1127%)

**API:**

- Existing `/api/v1/internal/config/system` endpoints automatically handle new fields

**UI:**

- Added new "Calculation" tab in System Settings
- Input fields for IVA Rate and Electricity Tax Rate with decimal precision
- Values stored as decimals (e.g., 0.21 for 21%, not percentages)

**Translations:**

- English and Spanish translations added for all new UI elements

---

### 2. ✅ Base Values Version Control (Production Flag)

**Schema Changes:**

- Added `isProduction` boolean field to `BaseValueSet` model (default: false)
- Used to mark which version is "production" vs "testing"

**API:**

- Created `/api/v1/internal/base-values/[id]/production` endpoint
- POST method to toggle production flag
- Automatically unmarks other sets in same scope when marking one as production

**UI:**

- Added "Production" column in Base Values list with star icon toggle
- Gold star (⭐) when marked as production
- Outline star (☆) for testing versions
- Click to toggle between production/testing
- Disabled for archived sets

**Logic:**

- Only one base value set can be marked as production per scope
- When marking a set as production, others in same scope (GLOBAL or AGENCY) are automatically unmarked
- This ensures clear version control for calculations

**Translations:**

- Added `colProduction`, `production_tooltip_on`, `production_tooltip_off` keys

---

### 3. ✅ Tariff Availability Toggles (Per Agency)

**Schema Changes:**

- Created new `AgencyTariff` model with:
  - `agencyId` (foreign key to Agency)
  - `tariffType` (string: "ELEC:2.0TD", "GAS:RL01", etc.)
  - `isEnabled` (boolean)
  - Unique constraint on `[agencyId, tariffType]`

**API:**

- Created `/api/v1/internal/agencies/[id]/tariffs` endpoints:
  - GET: List all tariff settings for an agency
  - POST: Create/update single tariff setting (upsert)
  - PUT: Bulk update all tariff settings

**UI:**

- Created `AgencyTariffConfig` component
- Displays checkboxes for all electricity and gas tariffs:
  - **Electricity:** 2.0TD, 3.0TD, 6.1TD
  - **Gas:** RL01-RL06, RLPS1-RLPS6
- Saves configuration in bulk
- Can be integrated into agency edit/detail pages

**Default Behavior:**

- All tariffs are enabled by default if not configured
- Agencies can selectively disable specific tariffs

**Translations:**

- Added `agencyTariffs` namespace with title, descriptions, and labels

---

## Database Migration

**Migration Name:** `20260417143258_add_tariff_config_and_calculation_params`

**Applied Changes:**

- Added `ivaRate` and `electricityTaxRate` to `system_config` table
- Added `isProduction` to `base_value_sets` table
- Created `agency_tariffs` table with proper relations and unique constraints

---

## Usage Examples

### Setting Calculation Parameters

1. Navigate to **Configurations → System Settings**
2. Click the **"Calculation"** tab
3. Set IVA Rate (e.g., 0.21 for 21%)
4. Set Electricity Tax Rate (e.g., 0.051127 for 5.1127%)
5. Click **"Save Changes"**

### Managing Base Value Production Versions

1. Navigate to **Base Values** module
2. Find the base value set you want to mark as production
3. Click the star icon in the **"Production"** column
4. The set is now marked as production (gold star ⭐)
5. Other sets in the same scope are automatically unmarked

### Configuring Agency Tariffs

1. Navigate to an agency's detail/edit page
2. Integrate the `AgencyTariffConfig` component:

   ```tsx
   import { AgencyTariffConfig } from "@/components/ui";

   <AgencyTariffConfig
     agencyId={agency.id}
     token={session.token}
     onNotify={handleNotify}
   />;
   ```

3. Check/uncheck tariffs to enable/disable them
4. Click **"Save"**

---

## Technical Notes

### Decimal Storage

All rate fields use Prisma's `Decimal` type for precision:

- IVA rate: stored as 0.21 (not 21)
- Electricity tax: stored as 0.051127 (not 5.1127)
- UI displays and accepts decimal format

### Production Flag Logic

The production flag works at the scope level:

- **GLOBAL scope:** Only one production set across all agencies
- **AGENCY scope:** One production set per agency

When toggling production ON for a set:

```typescript
// Automatically unmarks others in same scope
if (isProduction) {
  await prisma.baseValueSet.updateMany({
    where: {
      scopeType: baseValueSet.scopeType,
      agencyId: baseValueSet.agencyId, // Only for AGENCY scope
      id: { not: baseValueSetId },
      isProduction: true,
    },
    data: { isProduction: false },
  });
}
```

### Tariff Type Format

Tariff types follow the naming convention:

- Electricity: `ELEC:{code}` (e.g., `ELEC:2.0TD`)
- Gas: `GAS:{code}` (e.g., `GAS:RL01`)

This matches the key naming in `BaseValueItem`:

```
ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA
GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:ENERGIA
```

---

## Integration Points

### For Calculation Service

The calculation service can now:

1. Retrieve IVA and electricity tax rates from `SystemConfig`
2. Use `isProduction = true` base value sets for production calculations
3. Check `AgencyTariff` to validate if a tariff is enabled for an agency

Example query:

```typescript
// Get production base value set for agency
const productionSet = await prisma.baseValueSet.findFirst({
  where: {
    scopeType: "AGENCY",
    agencyId: agencyId,
    isProduction: true,
    isActive: true,
    isDeleted: false,
  },
});

// Check if tariff is enabled
const tariffEnabled = await prisma.agencyTariff.findUnique({
  where: {
    agencyId_tariffType: {
      agencyId: agencyId,
      tariffType: "ELEC:2.0TD",
    },
  },
});
// If not found, default to enabled
const isEnabled = tariffEnabled?.isEnabled ?? true;
```

---

## Files Modified/Created

### Schema

- `prisma/schema.prisma` - Added fields and AgencyTariff model
- Migration: `prisma/migrations/20260417143258_add_tariff_config_and_calculation_params/`

### API Routes

- `app/api/v1/internal/agencies/[id]/tariffs/route.ts` (created)
- `app/api/v1/internal/base-values/[id]/production/route.ts` (created)
- `app/api/v1/internal/config/system/route.ts` (updated - auto-handles new fields)

### Components

- `app/internal/components/modules/SystemSettingsNew.tsx` (updated)
- `app/internal/components/modules/BaseValuesModule.tsx` (updated)
- `app/internal/components/ui/AgencyTariffConfig.tsx` (created)
- `app/internal/components/ui/index.ts` (updated - export)

### Hooks & API Client

- `app/internal/components/hooks/useBaseValues.ts` (updated)
- `app/internal/lib/internalApi.ts` (updated - added toggleProduction function)

### Translations

- `src/lib/translations.ts` (updated - EN & ES)

---

## Next Steps

### Recommended Enhancements

1. **UI Integration for Agency Tariffs:**
   - Add tariff configuration tab to agency edit page
   - Show tariff availability in agency list/detail views

2. **Validation in Simulation Creation:**
   - Check if selected tariff is enabled for agency
   - Show warning/error if disabled tariff is selected

3. **Calculation Service Integration:**
   - Update calculation formulas to use `ivaRate` and `electricityTaxRate` from SystemConfig
   - Prioritize production base value sets in calculations
   - Respect agency tariff availability settings

4. **Audit Trail:**
   - Log when production flags are toggled
   - Track tariff configuration changes
   - Record calculation parameter updates

5. **Documentation:**
   - Update API documentation (OpenAPI/Swagger)
   - Add admin user guide for these features
   - Create calculation formula documentation referencing these parameters

---

## Testing Checklist

- [x] Database migration applied successfully
- [x] Prisma client regenerated
- [x] System settings UI displays new calculation tab
- [x] IVA and electricity tax fields accept decimal values
- [x] Base values list shows production column with star toggle
- [x] Toggling production flag updates database
- [x] Agency tariff config component renders correctly
- [x] Tariff checkboxes save/load properly
- [x] All translations display correctly (EN/ES)
- [ ] Calculation service uses new parameters (pending integration)
- [ ] Agency edit page includes tariff config (pending integration)
- [ ] Validation prevents disabled tariffs in simulations (pending)

---

## Configuration Recommendations Status

From [CONFIGURATION_RECOMMENDATIONS.md](./CONFIGURATION_RECOMMENDATIONS.md):

### Phase 1 (Critical) - COMPLETED ✅

1. **Base values management** ✅
   - ✅ Tariff availability per agency
   - ✅ Calculation constants (IVA, electricity tax)
   - ✅ Base values version control (production flag)

### Remaining Priorities

**Phase 1 (Still Needed):**

- Agency-level margin overrides
- Validation rules for simulations (min/max consumption)
- Security settings (password policy, session timeout)

**Phase 2 & 3:** See original document for full list.
