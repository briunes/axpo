# Product Registry — Architecture Plan

> Created: 20 May 2026
> Status: Planned — not yet implemented

---

## Problem

The system has hardcoded product definitions in multiple places. When AXPO adds a new product to the Excel file (e.g. `1P PLUS SSCC LIBRES`), it is silently ignored by the calculator and never shown in the frontend, even if its prices were successfully parsed and stored in the database.

### Where products are currently hardcoded

| File                                                          | What is hardcoded                                                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/excel/axpo-parser.ts`                     | `FIJO_PRODUCT_NAMES`, `INDEX_PRODUCT_MAP`, `GAS_FIJO_PRODUCT_MAP`, `GAS_INDEX_PRODUCT_MAP`, `DINAMICA_SHEET_MAP` — allowlists that silently drop unknown products |
| `src/application/services/calculationService.ts`              | `ELEC_FIJO_PRODUCTS`, `ELEC_INDEX_PRODUCTS`, `GAS_FIJO_PRODUCTS`, `GAS_INDEX_PRODUCTS` — arrays that control which products the calculator actually runs          |
| `src/application/services/calculationService.ts`              | `ELEC_PRODUCT_LABELS`, `GAS_PRODUCT_LABELS` — display names                                                                                                       |
| `src/application/services/calculationService.ts`              | `isEligibleSinglePeriodProduct()` — consumption eligibility rules hardcoded per slug                                                                              |
| `src/domain/types/simulation.ts`                              | `ElecFijoProduct`, `ElecIndexProduct`, `GasFijoProduct`, `GasIndexProduct` — TypeScript union types                                                               |
| `app/api/v1/internal/simulations/[id]/price-history/route.ts` | `PRODUCT_LABELS`, `GAS_PRODUCT_LABELS` — display names duplicated                                                                                                 |

---

## What was already fixed (20 May 2026)

The **parser** (`axpo-parser.ts`) was updated to be dynamic:

- `parseFijo()` — auto-slugs unknown product names instead of dropping them (e.g. `"1P PLUS SSCC LIBRES (Periodo Único)"` → `"1P_PLUS_SSCC_LIBRES"`)
- `parseIndex()` — same for indexed electricity products
- `parseGasFijo()` / `parseGasIndex()` — same for gas products
- `parseAxpoExcel()` — auto-detects DINAMICA-like sheets by name pattern (`/^(.+?)\s+(N[123])$/`) instead of only processing sheets in the hardcoded `DINAMICA_SHEET_MAP`

**Result**: prices for any new product in the Excel are now stored in the DB automatically. However the calculator still won't use them because of the remaining hardcoded lists above.

---

## Proposed Solution: DB-driven Product Registry

### New database table: `ProductDefinition`

```prisma
model ProductDefinition {
  id          String   @id @default(cuid())
  slug        String   @unique   // e.g. "1P_PLUS_SSCC_LIBRES"
  label       String             // e.g. "1P Plus SSCC Libres" — shown in UI
  commodity   String             // "ELECTRICITY" | "GAS"
  type        String             // "FIJO" | "INDEX"
  enabled     Boolean  @default(false)  // must be explicitly enabled — safe default
  singlePeriod Boolean @default(false)  // true = all energy periods use P1 price (1P products)
  sortOrder   Int      @default(0)      // controls display order in results

  // Eligibility rules — all nullable, null means no restriction
  minAnnualConsumption  Float?   // kWh/year — only show above this
  maxAnnualConsumption  Float?   // kWh/year — only show below this
  allowedTariffs        String?  // JSON array e.g. ["2.0TD","3.0TD"] — null = all tariffs

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  autoDetected Boolean @default(false)  // true = was auto-found by parser, not manually added
}
```

### Auto-detection on import

When the parser encounters a new product slug that doesn't exist in `ProductDefinition`, it should:

1. Create a new `ProductDefinition` row with `enabled = false` and `autoDetected = true`
2. Auto-detect `singlePeriod` from the slug/label containing `"1P"` or `"SSCC"`
3. Continue storing the prices normally

This means after every Excel import, admins see a notification: _"2 new products detected — review and enable them in Product Settings"_

### Calculator changes

Replace the hardcoded arrays with a DB query at calculation time:

```ts
// Instead of:
const ELEC_FIJO_PRODUCTS = ["ESTABLE", "ESTABLE_PLUS", ...] as const;

// Do:
const products = await prisma.productDefinition.findMany({
  where: { commodity: "ELECTRICITY", type: "FIJO", enabled: true }
});
```

The eligibility check `isEligibleSinglePeriodProduct()` gets replaced by evaluating the stored `minAnnualConsumption` / `maxAnnualConsumption` / `allowedTariffs` fields from the registry row.

The `singlePeriod` flag replaces the hardcoded `product === "1P_PLUS"` checks.

Labels come from `product.label` instead of `ELEC_PRODUCT_LABELS[slug]`.

---

## Admin UI Section: "Product Settings" (or "Gestão de Produtos")

New page under the internal admin area with:

### Product list table

- Columns: Label | Slug | Commodity | Type | Enabled | Single Period | Consumption range | Tariffs | Auto-detected
- Toggle `enabled` inline
- Edit button → opens a slide panel

### Edit panel fields

| Field           | Input type        | Notes                                   |
| --------------- | ----------------- | --------------------------------------- |
| Label           | text              | Display name shown to agents/clients    |
| Slug            | text (read-only)  | Set by parser, not editable             |
| Commodity       | select            | ELECTRICITY / GAS                       |
| Type            | select            | FIJO / INDEX                            |
| Enabled         | toggle            | Controls whether calc runs this product |
| Single Period   | toggle            | Apply P1 price to all energy periods    |
| Min consumption | number (kWh/year) | Leave empty = no minimum                |
| Max consumption | number (kWh/year) | Leave empty = no maximum                |
| Allowed tariffs | multi-select      | 2.0TD, 3.0TD, 6.1TD — empty = all       |
| Sort order      | number            | Lower = shown first in results          |

### "New products" alert banner

When `autoDetected = true` and `enabled = false` exist, show a banner on the base values import page and the product settings page:

> "3 new products were detected in the last import. Review them in Product Settings."

### Preview tool (nice to have)

A form at the bottom of the page:

- Input: tariff, annual consumption
- Output: list of products that would be shown for those inputs, with enabled/disabled reason

---

## Implementation Steps (ordered)

- [ ] **1. Prisma migration** — add `ProductDefinition` table
- [ ] **2. Seed existing products** — create a seed script that inserts all currently known products with `enabled = true` and correct labels/rules, so nothing breaks when switching over
- [ ] **3. Update parser** — after storing base values, upsert `ProductDefinition` rows for any slug not yet registered (with `enabled = false`, `autoDetected = true`)
- [ ] **4. Update `calculationService`** — replace `ELEC_FIJO_PRODUCTS` etc. with DB queries; replace `isEligibleSinglePeriodProduct()` with rule evaluation from the registry; replace label maps with `product.label`
- [ ] **5. Update TypeScript types** — `ElecFijoProduct` / `ElecIndexProduct` etc. can be relaxed to `string` since products are now dynamic; remove the strict union types or keep them only for known legacy slugs
- [ ] **6. Remove hardcoded label maps** — `ELEC_PRODUCT_LABELS`, `GAS_PRODUCT_LABELS` in both `calculationService.ts` and `price-history/route.ts`
- [ ] **7. Build admin UI** — "Product Settings" page with the table and edit panel described above
- [ ] **8. Add new-products notification** — banner on import page and product settings page

---

## Risks & Mitigations

| Risk                                                    | Mitigation                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| New product auto-enabled shows wrong results to clients | Default `enabled = false` — explicit opt-in required                                                               |
| `singlePeriod` wrong on a new product                   | Auto-detect from slug containing "1P"; admin can override                                                          |
| Calculator performance (DB query on every simulation)   | Cache the product list in memory with a short TTL (e.g. 5 minutes) or load once per request at the API route level |
| Existing tests break when product arrays change         | Seed script ensures all current products exist in test DB with same settings                                       |
| Type safety lost by removing union types                | Keep union types for the known set; allow `string` as a fallback — or generate union type from DB at build time    |
