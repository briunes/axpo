# Security Audit Report

Date: 2026-06-08

## Executive Summary

The audit found several critical authorization gaps in internal API routes, an
unprotected cron execution failure mode, unrestricted invoice uploads, and an
SSRF-capable PDF rendering path. These issues were fixed in the application.

The repository also contains credentials and real-looking invoice/customer
artifacts in tracked files. Those values must be treated as compromised because
removing them from the current tree does not remove them from Git history.

## Fixed Findings

### Critical: Missing authentication on internal administration routes

Several `/api/v1/internal/*` routes performed reads or mutations without
calling `requireAuth`.

Fixed routes:

- Email template list/create/read/update/delete
- PDF template list/create/read/update/delete
- Template variable list/create/update/delete
- Agency tariff read/create/update
- Base-value production selection
- System cron configuration read/update
- User preference read/update

The configuration routes now require the `section.configurations` permission.
Agency and base-value mutations use their existing RBAC permissions/roles.
Preferences are restricted to the user or an elevated administrator.

### Critical: Invoice upload and download IDOR

An unauthenticated caller could upload or replace an invoice for any known
simulation ID, and invoice files could be downloaded without authorization.

Both routes now require authentication, the simulations permission, and
`SimulationService.assertSimulationAccess`, which enforces administrator,
agency, or owner scope.

Uploads are now limited to PDF, JPEG, PNG, or WebP files with a maximum size of
15 MB. Stored filenames are sanitized before use in response headers.

### High: Cron endpoint failed open

The expiration endpoint previously executed without authentication whenever
`CRON_SECRET` was missing. It now fails closed and returns 401 unless a
configured secret exactly matches the bearer token.

### High: PDF renderer SSRF and object-level access

The internal PDF generator accepted caller-provided HTML, allowing Chromium to
request localhost, private-network, link-local, or cloud metadata resources.
It also did not verify access to the requested simulation object.

The route now calls `assertSimulationAccess` and intercepts Chromium requests,
blocking local/private/link-local/metadata destinations and non-HTTP schemes
other than safe document schemes.

### Medium: Deliberate error route exposed

The test-error endpoint could be invoked in deployed environments to create
errors and log records. It is now unavailable in production and restricted to
`SYS_ADMIN` in non-production environments.

### Medium: Missing baseline browser security headers

Global headers now include:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

### Critical: Sentry token added to example configuration

The exposed Sentry auth token was replaced with a placeholder. It still needs
to be revoked because it may exist in local Git objects, remotes, CI logs, or
other clones.

### High: OTP and display-PIN material stored without protection

OTP codes are now generated with `crypto.randomInt`, stored as keyed HMAC
digests, and compared in constant time. Plaintext OTP values are only held long
enough to send the email.

New and rotated `User.pinCurrent` values and new `Simulation.pinSnapshot`
values are now encrypted with AES-256-GCM using `SECURITY_DATA_KEY` before
database storage. API responses decrypt them only for authorized internal
users. Existing plaintext values remain readable for compatibility and require
a one-time production data migration.

### High: Weak per-flow abuse controls

Dedicated low rate limits were added to login, OTP verification, forgot/reset
password, setup password, magic-link request/verification, public PIN access,
public initialization, and unauthenticated client error reporting.

Client error reports now have bounded schemas to prevent oversized Sentry and
database submissions.

### Medium: Public metadata and IP retention

Pre-PIN owner emails are now masked. Public access attempts and audit events
store a keyed IP fingerprint instead of the raw forwarded IP address.

### Medium: JWT algorithm ambiguity

Internal and public JWT signing/verification is now explicitly pinned to
`HS256`.

### High: Supabase Data API credential validation

API database mode was configured with an `sb_publishable_...` key. Supabase
maps that credential to the low-privilege `anon` database role, causing schema
permission errors and tempting operators to grant excessive privileges to a
public credential.

API mode now rejects publishable keys and legacy JWTs whose role is not
`service_role` before sending a request. Runtime permission errors include an
actionable key/migration hint, tests cover both rejected credential types, and
the environment documentation explicitly requires an `sb_secret_...` key or
legacy `service_role` JWT.

Deployment still requires replacing the current publishable value in
`SUPABASE_SECRET_KEY` with a backend-only secret key from Supabase Settings >
API Keys. Do not grant database access to `anon` to make the adapter work.

### High: Supabase API relation includes omitted scalar fields

The Data API adapter translated Prisma `include` queries into relation-only
PostgREST selections. Calls such as `emailTemplate.findUnique({ include:
{ translations: true } })` therefore omitted scalar fields including `active`,
causing active OTP templates to be treated as inactive.

API-mode `include` queries now select all model scalar fields plus requested
relations, matching Prisma behavior. A regression test covers the email
template flow, and the corrected query was verified against the live Data API.

### High: API-mode login session transaction unsupported

OTP verification created and enforced user sessions inside an interactive
Prisma transaction. The Data API adapter deliberately cannot emulate
multi-request transactions, so API-mode OTP verification failed after the OTP
was consumed.

API mode now calls a scoped PostgreSQL function that atomically replaces an
existing device session, enforces the per-user device limit, creates the new
session, and returns auto-kicked session IDs. The function serializes
concurrent logins per user with a transaction advisory lock. Direct mode keeps
the existing Prisma transaction.

The migration was deployed to the configured Supabase project and verified in
a forced-rollback transaction, confirming correct return data and no retained
test state.

### High: API-mode list query parity and render loop

Several list views failed in API mode because Prisma relation `_count`
selections were sent to PostgREST as nonexistent columns, Data API timestamps
remained strings instead of Prisma-compatible `Date` objects, and the agency
users relation was ambiguous among three foreign keys. Embedded relation
filters were also omitted.

The adapter now hydrates scalar and nested `DateTime` fields using Prisma model
metadata, calculates requested relation counts with batched child queries,
disambiguates the agency membership relation, and applies embedded filters,
ordering, and pagination. Live read-only checks passed for agencies, base-value
sets, audit logs, and cron logs.

Failed list requests also exposed a frontend state loop: the shared data table
cleared selection whenever the `rows` array reference changed, even when each
new array represented the same empty result. Selection reset now depends on a
stable row-ID signature and avoids no-op state updates.

### High: API-mode analytics used unsupported SQL operations

The analytics overview used Prisma `groupBy` and raw SQL queries. Those
operations cannot be represented by the PostgREST adapter, causing the
analytics page to fail and leaving sibling promises to emit additional
unhandled Data API errors.

API mode now uses a dedicated analytics path that loads period-scoped
simulations, latest payload versions, and access attempts through supported
Data API queries, then computes KPIs, trends, energy and tariff metrics, and
agency/user breakdowns in application code. Direct mode retains its existing
database-side aggregations. The exact live Data API query shapes were verified
against the configured Supabase project.

### High: API-mode OTP timestamps shifted by server timezone

Prisma `DateTime` columns are stored as PostgreSQL `timestamp without time
zone` and interpreted as UTC by Prisma. PostgREST returns those values without
a timezone suffix, so JavaScript parsed them in the server's local
`Europe/Lisbon` timezone. During daylight-saving time, freshly issued OTP
sessions therefore appeared one hour old and immediately expired.

The adapter now interprets zone-less Prisma `DateTime` values as UTC while
preserving timestamps that already include a timezone. Live API and direct
Prisma reads now match exactly, and the affected OTP session correctly
evaluates as unexpired.

### High: API-mode user self-relations failed

The users list selects `createdByUser` and `updatedByUser`, both self-relations
on the `users` table. PostgREST did not expose the foreign-key constraint hints
in a form that produced Prisma's many-to-one object shape; the constraint-name
hint failed schema lookup, while the accepted column hint resolved in the
reverse direction.

The adapter now handles these two relations as batched manual joins. It fetches
referenced users once per relation, returns object-or-null values matching
Prisma, and removes helper foreign-key fields that were not explicitly
selected. The exact users list query passed against live Supabase data.

### High: Remaining API-mode mutations used Prisma transactions

Agency edits, user edits, base-value item replacement/import replacement, and
base-value activation still called Prisma transactions. These operations
failed in API mode and could not be safely converted to sequential REST writes
because partial completion would leave inconsistent tariffs, preferences, or
pricing data.

Four scoped PostgreSQL functions now provide atomic API-mode mutations:

- Agency update with tariff upserts
- User update with preference upsert
- Base-value item replacement
- Base-value-set activation

Direct mode retains the existing Prisma transactions. The migration was
deployed, all functions were verified through the Data API with nonexistent
targets, and all four were executed together in a forced-rollback database
test that confirmed no retained data changes.

## Open Findings

### Critical: Committed credentials

Tracked files including `.env.dev`, `vars`, and `vars prod` contain live-looking
database URLs, JWT secrets, Swagger credentials, and a Sentry auth token.
`.env.example` also contains a non-placeholder database URL.

Required response:

1. Rotate database passwords, JWT secrets, Swagger passwords, and Sentry tokens.
2. Replace tracked secret files with placeholder-only templates.
3. Remove the files from Git tracking.
4. Purge secrets from repository history with `git filter-repo` or BFG.
5. Force-push the rewritten history and require fresh clones.

`vars` and `vars prod` were added to `.gitignore`, but they remain tracked until
explicitly removed from the index and history.

### Critical: Customer data committed to Git

The repository tracks many invoice PDFs, images, ZIP files, and spreadsheets
whose names and contents appear to contain customer, billing, tax, address, and
energy-consumption data.

These artifacts should be moved to access-controlled test storage, replaced
with synthetic fixtures, removed from Git tracking, and purged from history.
A privacy/incident review is recommended to determine whether notification or
other regulatory action is required.

### High: Legacy plaintext PIN migration

New display PIN values are encrypted, but existing database rows are left
unchanged to avoid corrupting production data without an approved database
operation. Run a one-time migration after setting a stable
`SECURITY_DATA_KEY`, then verify and remove legacy plaintext fallback support.

### High: Authentication rate limiting is process-local

The rate limiter uses an in-memory `Map`. In serverless or multi-instance
deployments, limits can be bypassed by hitting different instances, and state
is lost on restart. Client identity also relies on forwarded headers.

Dedicated thresholds are now applied, but enforcement must move to a shared
store such as Redis/Upstash for multi-instance reliability. Configure trusted
proxy IP extraction at the hosting layer.

### High: JWTs stored in localStorage

Internal access tokens are persisted in `localStorage`. Any successful XSS can
read and exfiltrate them.

Prefer `HttpOnly`, `Secure`, `SameSite` cookies with CSRF protection, or keep
short-lived access tokens only in memory with a rotating HttpOnly refresh
cookie.

### Medium: No enforced Content Security Policy

A strict CSP was not added because the current UI and template/editor flows
need an inventory of inline scripts/styles and external origins first. Add a
report-only CSP, fix violations, then enforce it.

### Low: Remaining pre-PIN metadata

The public initialization endpoint still returns owner name and agency to
anyone holding a high-entropy public token. The email is masked. Remove the
remaining metadata too if the public UI does not require it.

### Medium: Dependency advisory scan incomplete

`pnpm audit` could not query the npm advisory service because network access
was unavailable, and the requested escalation was not approved. Dependency
versions were therefore reviewed only statically. Run the audit in an approved
CI environment and triage high/critical advisories.

## Verification

- `pnpm type-check`: passed
- Full security suite: 14 suites, 38 tests passed
- Complete Jest suite: 22 suites, 64 tests passed
- `git diff --check`: passed
