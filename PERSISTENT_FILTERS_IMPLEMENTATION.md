# DataTable Persistent Filters & Sort Implementation

## Overview

All DataTable instances now have persistent filters and sort/order state that is automatically saved to localStorage and restored on page reload or navigation.

## Changes Made

### 1. DataTable Component (`app/internal/components/ui/DataTable.tsx`)

#### New Helper Functions

- `loadTableState(tableId)`: Loads persisted filter/sort state from localStorage
- `saveTableState(tableId, state)`: Saves the current filter/sort state to localStorage

#### New State Interface

```typescript
interface TablePersistentState {
  search: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  pageSize?: number;
}
```

#### Persistence Logic

- Added `useEffect` that automatically saves the component's search, sort, and pagination state to localStorage whenever these values change
- Stores data with key pattern: `axpo_dt_state_{tableId}`
- Only persists when `tableId` prop is provided (non-table instances are unaffected)

### 2. State Management Hooks

Updated the following hooks to load persisted state on initialization:

#### `app/internal/components/hooks/useUsers.ts`

- Loads persisted sort column, sort direction, and search from localStorage
- Key: `axpo_dt_state_users`
- Default sort: `createdAt`, `desc`

#### `app/internal/components/hooks/useClients.ts`

- Loads persisted sort column, sort direction, and search from localStorage
- Key: `axpo_dt_state_clients`
- Default sort: `name`, `asc`

#### `app/internal/components/hooks/useAgencies.ts`

- Loads persisted sort column, sort direction, and search from localStorage
- Key: `axpo_dt_state_agencies`
- Default sort: `createdAt`, `desc`

#### `app/internal/components/hooks/useSimulations.ts`

- Loads persisted sort column, sort direction, and search from localStorage
- Key: `axpo_dt_state_simulations`
- Default sort: `updatedAt`, `desc`

#### `app/internal/components/hooks/useBaseValues.ts`

- Loads persisted sort column, sort direction, and search from localStorage
- Key: `axpo_dt_state_base-values`
- Default sort: `updatedAt`, `desc`

## Data Flow

### When User Interacts with Table

1. User changes search, sort, or page size
2. Module hook updates state
3. DataTable receives new props
4. DataTable automatically saves state to localStorage

### When Page Loads

1. Module hook initializes
2. Hook loads persisted state from localStorage
3. Hook initializes with persisted values instead of defaults
4. DataTable receives initial props with persisted values
5. User sees their previous filters/sort preserved

## Affected Modules

### Primary (With Persistent Hooks)

- ✅ Users Module (`UsersModule.tsx`, `useUsers.ts`)
- ✅ Clients Module (`ClientsModule.tsx`, `useClients.ts`)
- ✅ Agencies Module (`AgenciesModule.tsx`, `useAgencies.ts`)
- ✅ Simulations Module (`SimulationsModule.tsx`, `useSimulations.ts`)
- ✅ Base Values Module (`BaseValuesModule.tsx`, `useBaseValues.ts`)

### Secondary (Local State - No Persistence)

- ℹ️ CronLogsPanel - No tableId provided, no persistence needed
- ℹ️ OcrLogsPanel - No tableId provided, no persistence needed
- ℹ️ EmailLogsModule - Local state only
- ℹ️ AdminAnalyticsView - Analytics display only
- ℹ️ AgentAnalyticsView - Analytics display only

## Storage Details

### localStorage Keys Format

- `axpo_dt_hidden_cols_{tableId}` - Column visibility (existing feature)
- `axpo_dt_state_{tableId}` - Search, sort, and page size (new feature)

### Example Stored State

```json
{
  "search": "john",
  "sortColumn": "createdAt",
  "sortDirection": "desc",
  "pageSize": 50
}
```

## Clearing Persisted State

If you need to clear persisted state for a specific table, use browser DevTools:

```javascript
localStorage.removeItem("axpo_dt_state_users");
localStorage.removeItem("axpo_dt_state_clients");
localStorage.removeItem("axpo_dt_state_agencies");
localStorage.removeItem("axpo_dt_state_simulations");
localStorage.removeItem("axpo_dt_state_base-values");
```

## Backward Compatibility

- Tables without a `tableId` prop are not affected
- Existing column visibility persistence (`axpo_dt_hidden_cols_*`) is preserved
- Users will see default values if localStorage is cleared or data is corrupted
- No breaking changes to component API

## Browser Support

Persistence requires localStorage support. All modern browsers support this feature. Falls back gracefully to defaults if localStorage is unavailable.

## Testing Recommendations

1. ✅ Navigate to Users module, apply filters/sort, refresh page → filters should persist
2. ✅ Navigate to Clients module, change sort, go to another page, come back → sort should persist
3. ✅ Search for text, navigate away and back → search text should persist
4. ✅ Change page size, reload page → page size should persist
5. ✅ Clear browser localStorage → should reset to defaults
