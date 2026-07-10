# Copilot Instructions for AXPO

## Big Picture

- This is a single Next.js App Router project that serves both internal UI and API endpoints.
- Internal UI routes live under `app/internal/*` and are wrapped by `app/internal/layout.tsx` + `app/internal/components/InternalWorkspace.tsx`.
- API routes live in `app/api/v1/internal/*` (authenticated/RBAC) and `app/api/v1/public/*` (token+PIN/public flows).
- Keep route handlers thin; business logic belongs in `src/application/services/*`.
- Use `src/infrastructure/*` for adapters/integrations (Prisma, PDF/OCR, Swagger, uploads).
- Domain types/errors are centralized in `src/domain/*`.

## API Route Pattern (Use Existing Middleware)

- Wrap handlers with `withErrorHandler` from `src/application/middleware/errorHandler.ts`.
- Return data using `ResponseHandler.ok/error/paginated` from `src/application/middleware/response.ts`.
- For protected internal routes: call `requireAuth(request)` then `assertPermission(auth, "...")`.
- Validate request payloads with Zod in the route file (see `app/api/v1/internal/auth/login/route.ts`).
- Apply rate limits on auth/public endpoints using `applyRateLimitShared` + `getClientRateLimitKey`.
- Keep Swagger JSDoc blocks in route handlers; OpenAPI is generated from these comments.

## Auth, Sessions, and Security

- Internal auth is Bearer JWT with session validation (`src/application/middleware/auth.ts`).
- Access tokens can be refreshed per request via `x-access-token` header; frontend must honor it.
- Frontend session storage keys are in `app/internal/lib/authSession.ts`.
- Middleware (`middleware.ts`) enforces CORS, maintenance mode redirect, legacy QLD host redirect, and Swagger Basic Auth.
- Prefer soft-delete semantics (`isDeleted`, `deletedAt`) used across Prisma models.

## Data and Persistence

- Always import DB client from `src/infrastructure/database/prisma.ts` (do not instantiate `PrismaClient` ad hoc).
- DB mode is controlled by `DB_CONNECTION_MODE` (`direct` or `api`) in `src/infrastructure/database/databaseMode.ts`.
- Prisma schema is large and audit-oriented (`prisma/schema.prisma`); check model indexes and relation names before editing.
- Simulation writes usually create new `SimulationVersion` snapshots rather than mutating historical payloads.

## Internal Frontend Conventions

- UI stack: MUI + TanStack Query (`app/internal/providers.tsx`).
- Reuse `DataTable` in `app/internal/components/ui/DataTable.tsx` for admin CRUD grids.
- DataTable persists hidden columns and filter/sort/page/density in `localStorage` (`axpo_dt_hidden_cols_*`, `axpo_dt_state_*`).
- Permission keys are centrally defined in `app/internal/lib/permissionsDefinitions.ts`; reuse existing keys before adding new ones.

## Developer Workflows

- Package manager is `pnpm` (see `package.json` and lockfile).
- Local run commands: `pnpm dev` (uses `.env.local.example`), `pnpm dev:dev`, `pnpm dev:preview`.
- Quality commands: `pnpm type-check`, `pnpm test`, `pnpm test:security`, `pnpm lint`.
- Build runs codegen steps automatically: `pnpm build` runs Postman sync + OpenAPI generation + Prisma generate + Next build.

## Integrations and Runtime Constraints

- Sentry is wired via `instrumentation.ts` and `next.config.mjs` (`withSentryConfig`).
- Long-running/PDF/OCR endpoints have elevated Vercel limits in `vercel.json`; preserve these when touching those routes.
- Shared rate limiting uses Upstash Redis when env vars are set; otherwise in-memory fallback (development/test).
- File uploads and blobs use Vercel Blob and upload limit helpers (`src/infrastructure/uploads/uploadLimits.ts`).
- When adding endpoints, follow existing `app/api/v1/internal/.../route.ts` or `app/api/v1/public/.../route.ts` foldering.
- Preserve API envelope shape (`success`, `data/error`, `timestamp`, `appVersion`) for frontend compatibility.
- Prefer extending existing services/middleware over creating parallel abstractions.
