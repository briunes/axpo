# AXPO Simulator Backend Guide

## Current Status (M2 Candidate Baseline)

As of March 12, 2026, the backend includes:

- Internal API routes under `backend/app/api/v1/internal/*` with RBAC-protected flows.
- Public token + PIN routes under `backend/app/api/v1/public/*`.
- Internal frontend routes under `backend/app/internal/*` served by the same Next.js app and exposed at root paths (`/`, `/login`, `/simulations`, `/users`, `/agencies`, `/analytics`).
- Two-step public access session flow:
  - `POST /api/v1/public/simulations/access`
  - `GET /api/v1/public/simulations/{token}`
- Prisma schema and baseline migration at `backend/prisma/migrations/20260312_initial/migration.sql`.
- Security, contract, structure, and migration guard tests.
- OpenAPI route inventory checks for security-critical and MVP endpoints.

## Run Locally

### Prerequisites

- Node.js 18+
- PostgreSQL 16+

### Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `DATABASE_URL` and required environment values in `.env`.

### Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Start

```bash
npm run dev
```

Internal frontend entrypoint:

- `http://localhost:3000/login`

### API Documentation (Swagger/OpenAPI)

The backend provides comprehensive API documentation via Swagger UI:

**Internal API Documentation:**

- URL: `http://localhost:3000/api/v1/internal/docs`
- Protected with Basic Auth (credentials from `SWAGGER_BASIC_AUTH` env var)
- OpenAPI spec: `http://localhost:3000/api/v1/internal/openapi`
- Covers all internal RBAC-protected endpoints

**Public API Documentation:**

- URL: `http://localhost:3000/api/v1/docs`
- OpenAPI spec: `http://localhost:3000/api/v1/openapi`
- Covers public token+PIN endpoints

**Regenerate OpenAPI specs:**

```bash
npm run openapi:generate
```

The OpenAPI specs are automatically regenerated during the build process.

## Validation Commands (M2 Gate)

```bash
cd backend
npm run type-check
CI=true npx jest --runInBand --no-watchman
```

## Key Evidence Files

- Security mapping: `docs/security/m2-security-evidence-mapping.md`
- Security plan: `docs/security/security-test-plan-m2.md`
- OpenAPI guard: `backend/src/infrastructure/__tests__/openapi.contract.test.ts`
- Migration guard: `backend/src/infrastructure/__tests__/prismaMigration.guard.test.ts`
- Public-flow integration test: `backend/src/application/public/__tests__/publicAccessFlow.integration.test.ts`
- Baseline migration: `backend/prisma/migrations/20260312_initial/migration.sql`

## Architecture Notes

- Canonical backend Next.js app root is `backend/app`.
- Technical docs must reference `backend/app/...` paths.
- No hard deletes are allowed for simulations and core auditable entities.
- PIN values are stored as hashes; public flow validates against persisted snapshots.

## Known MVP Limitation

- Public rate limiting is in-memory for MVP speed. It is not horizontally shared across instances and must be replaced with distributed state for post-MVP scaling.

## Scope Guard

Excluded from M2 by design:

- CRM integration
- Advanced OCR training
- Advanced dashboards
- ISO compliance layer
