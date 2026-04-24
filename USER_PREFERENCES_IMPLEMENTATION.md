# User Preferences System Implementation

**Created:** 17 de abril de 2026  
**Status:** ✅ Complete (System Defaults + User Overrides)  
**Phase 1:** System-level defaults ✅  
**Phase 2:** User-level overrides ✅

---

## Overview

The user preferences system allows administrators to set system-wide defaults for display and formatting preferences. Individual users can override these defaults with their personal preferences in their profile page or when admins edit a user.

---

## ✅ Phase 1: System-Level Defaults (COMPLETE)

### Database Schema

**SystemConfig Model** - Added default preference fields:

- `defaultDateFormat` - String (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
- `defaultTimeFormat` - String (12h, 24h)
- `defaultTimezone` - String (Europe/Madrid, UTC, etc.)
- `defaultNumberFormat` - String (eu: 1.234,56 | us: 1,234.56)
- `defaultItemsPerPage` - Int (pagination default)

**UserPreferences Model** - Created for future user overrides:

- `userId` - Foreign key to User (unique)
- `dateFormat` - String (nullable, inherits from system if null)
- `timeFormat` - String (nullable)
- `timezone` - String (nullable)
- `numberFormat` - String (nullable)
- `itemsPerPage` - Int (nullable)

### Migration

```bash
Migration: 20260417150313_add_user_preferences
```

### UI Implementation

**Location:** Configurations → System Settings → **User Preferences** tab

**Available Options:**

1. **Date Format**
   - DD/MM/YYYY (17/04/2026) - European
   - MM/DD/YYYY (04/17/2026) - US
   - YYYY-MM-DD (2026-04-17) - ISO

2. **Time Format**
   - 24-hour (14:30)
   - 12-hour (2:30 PM)

3. **Timezone**
   - Europe/Madrid (CET/CEST)
   - Europe/London (GMT/BST)
   - Europe/Paris, Berlin, etc.
   - America/New_York, Chicago, Los_Angeles
   - UTC

4. **Number Format**
   - European (1.234,56) - comma as decimal separator
   - US/UK (1,234.56) - dot as decimal separator

5. **Items Per Page**
   - Range: 5-100 rows per table page

### API Changes

**GET /api/v1/internal/config/system**

- Returns all system config including new preference defaults

**PUT /api/v1/internal/config/system**

- Updates system config including preference defaults
- Body accepts: `defaultDateFormat`, `defaultTimeFormat`, `defaultTimezone`, `defaultNumberFormat`, `defaultItemsPerPage`

### Translations

Added to both English and Spanish:

- `systemSettings.tabPreferences`
- `systemSettings.titlePreferences`
- `systemSettings.preferencesDescription`
- `systemSettings.fieldDateFormat` (+ Desc)
- `systemSettings.fieldTimeFormat` (+ Desc)
- `systemSettings.fieldTimezone` (+ Desc)
- `systemSettings.fieldNumberFormat` (+ Desc)
- `systemSettings.fieldItemsPerPage` (+ Desc)

---

## 🔄 Phase 2: User-Level Overrides (TODO)

### User Profile Page

Add "Preferences" tab to `/internal/profile` with:

- Same preference options as system defaults
- Show current effective values (user override OR system default)
- "Reset to System Default" button per field
- Save button to persist user preferences

### User Edit Page (Admin)

Add "Preferences" tab to `/internal/users/[id]/edit` with:

- Same options as profile
- Allows admins to configure preferences for specific users
- Show inherited vs overridden values

### API Endpoints (To Create)

**GET /api/v1/internal/users/[id]/preferences**

- Returns user preferences merged with system defaults

**PUT /api/v1/internal/users/[id]/preferences**

- Updates or creates user preferences
- Body: `{ dateFormat?, timeFormat?, timezone?, numberFormat?, itemsPerPage? }`
- Null values = use system default

### Preference Resolution Logic

```typescript
function getUserPreferences(userId: string) {
  const systemDefaults = await getSystemConfig();
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  return {
    dateFormat: userPrefs?.dateFormat ?? systemDefaults.defaultDateFormat,
    timeFormat: userPrefs?.timeFormat ?? systemDefaults.defaultTimeFormat,
    timezone: userPrefs?.timezone ?? systemDefaults.defaultTimezone,
    numberFormat: userPrefs?.numberFormat ?? systemDefaults.defaultNumberFormat,
    itemsPerPage: userPrefs?.itemsPerPage ?? systemDefaults.defaultItemsPerPage,
  };
}
```

### Display Helper Functions (To Create)

Create utility functions that respect user preferences:

- `formatDate(date, userPrefs)` - Format dates according to user's preference
- `formatTime(date, userPrefs)` - Format time according to user's preference
- `formatNumber(num, userPrefs)` - Format numbers with correct separators
- `formatCurrency(amount, userPrefs)` - Format currency amounts

---

## Configuration Recommendations Status

Updated `CONFIGURATION_RECOMMENDATIONS.md`:

- Marked tariff configuration features as ✅ DONE
- Added user preferences as 🔄 In Progress
- Phase 1 (system defaults) complete
- Phase 2 (user overrides) pending

---

## Testing Checklist

### Phase 1 ✅

- [x] System config loads with default preference values
- [x] Preferences tab displays in System Settings
- [x] All dropdown options are correct
- [x] Save button persists changes to database
- [x] Preferences survive server restart
- [x] Translations work in both EN and ES

### Phase 2 (Pending)

- [ ] User can access preferences in profile page
- [ ] User preferences override system defaults
- [ ] Null user preferences fall back to system defaults
- [ ] Admin can set preferences for other users
- [ ] Display functions respect user preferences
- [ ] Date/time/number formatting works correctly
