# Merge and production authorization

- Never automatically merge branches or pull requests, especially into `main` or production.
- Only perform a merge when Bruno explicitly instructs you to perform that specific merge. “Send to prod,” “release,” “deploy,” and similar requests do not authorize a merge.
- Branch creation, analysis, implementation, checks, and pull request preparation are allowed within the requested scope. Stop before merging unless explicitly instructed to merge.
- Never bypass this rule through direct pushes, auto-merge, deployments, or promotions into production. Production actions require explicit authorization for the specific action.
- Read this rule before taking action. Past merge approval does not authorize future merges.

# Protected calculation and pricing behavior

- Treat simulation calculations, price resolution, and base-value imports as protected business-critical behavior.
- Do not modify calculation or pricing behavior unless Bruno explicitly asks for that specific calculation change. A general request such as “fix this,” “clean up,” “refactor,” “update dependencies,” or “resolve tests” is not authorization to change calculation behavior.
- Protected areas include, at minimum:
  - `src/application/services/calculationService.ts`
  - `src/application/services/simulationCalculationRunner.ts`
  - `src/infrastructure/excel/axpo-parser.ts`
  - `src/lib/indexedElectricityHistory.ts`
  - `src/lib/selectedProductEnergyHistory.ts`
  - calculation-related base-value migrations, API routes, PDF/history price rendering, and their tests
- Also treat indirect changes as protected when they can alter inputs, defaults, key formats, lookup precedence, fallback order, tariff/profile/zone selection, billing periods, rounding, taxes, totals, eligibility, or persisted calculation payloads.
- For work outside this protected scope, preserve these files and behaviors unchanged. If a requested task appears to require touching them, stop and ask Bruno for explicit permission, naming the files and expected behavioral impact.
- Never include opportunistic refactors, formatting-only rewrites, broad type cleanups, or unrelated fixes in protected calculation files.

## Requirements when a calculation change is explicitly authorized

- Establish the current behavior and the intended business result before editing. Check the active base-value key shape when lookup or import behavior is involved.
- Keep the patch minimal and isolated. Do not change fallback precedence or legacy compatibility without an explicit reason documented in the code or tests.
- Add or update regression tests that fail before the fix and pass afterward. Do not weaken or rewrite existing expectations merely to make a changed implementation pass; verify the expected value against the source workbook or an explicitly supplied business example.
- Test every affected dimension, including relevant combinations of NORMAL/DIURNO profile, Peninsula/Canarias/Baleares zone, 2.0TD/3.0TD/6.1TD tariff, product/tier, billing month, and legacy/current base-value formats.
- Run the focused calculation tests and related history/PDF tests before handing off. Report any test or type-check failure, including whether it predates the change.
- In the final handoff, explicitly list calculation files changed, behavior before and after, evidence used to validate the result, and checks run.
- These requirements do not authorize a merge or deployment; the merge and production authorization rules above still apply.
