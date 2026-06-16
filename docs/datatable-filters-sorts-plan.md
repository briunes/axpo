# Datatable filters & sorting audit plan

## Goal

Standardize the list screens in the internal workspace so each datatable exposes:

- the filters users actually need for day-to-day work
- sort options that match visible columns
- only server-backed behavior for paginated tables

## Current audit summary

### Simulations

**Current filters**

- Search
- Owner
- Client
- CUPS
- Status
- Show archived

**Current sort UI**

- None exposed in the table

**Backend support already present**

- `orderBy`
- `sortDir`
- `search`
- `ownerUserId`
- `clientId`
- `cups`
- `status`

**Recommended additions**

- Sort by `updatedAt`
- Sort by `createdAt`
- Sort by `expiresAt`
- Sort by `status`
- Optionally sort by `pinSnapshot`
- Later: filters for commodity and date range

**Implementation priority**

- High

### Users

**Current filters**

- Search
- Role
- Agency
- Show archived

**Current sort UI**

- Name
- Created
- Updated

**Backend support already present**

- Search
- Role
- Agency
- Archived
- Sort by `createdAt`, `fullName`, `email`, `role`

**Gap found**

- UI exposes `updatedAt` sorting but API currently does not whitelist it

**Recommended additions**

- Add backend support for `updatedAt`
- Add active/inactive filter
- Later: sort by status and agency if API support is extended

**Implementation priority**

- High

### Agencies

**Current filters**

- Search
- Show archived

**Current sort UI**

- Name
- Created
- Updated

**Backend support already present**

- Search
- Archived
- Sort by `name`, `createdAt`, `updatedAt`

**Recommended additions**

- Active/inactive filter
- City/province filter
- Commercial users count sort/filter

**Implementation priority**

- Medium

### Clients

**Current filters**

- Search
- Agency
- Show archived

**Current sort UI**

- Company name
- Created
- Updated

**Backend support already present**

- Search
- Agency
- Archived
- Sort by `name`, `createdAt`, `updatedAt`

**Recommended additions**

- Active/inactive filter
- CIF filter
- Province/country filter
- Contact present/missing filter

**Implementation priority**

- Medium

### Base values

**Current filters**

- Search
- Show archived

**Current sort UI**

- Name

**Backend support already present**

- Search
- Archived
- Sort by `name`, `updatedAt`, `createdAt`, `version`

**Recommended additions**

- Expose sort by `createdAt`
- Expose sort by `version`
- Expose sort by `updatedAt` if/when column is shown
- Later: filters for scope, production, active/draft

**Implementation priority**

- High

### Logs

#### Audit logs

**Current filters**

- Search
- Event type
- From date
- To date

**Current sort UI**

- None

**Recommended additions**

- Sort by timestamp
- Filter by actor and target type

**Implementation priority**

- Medium

#### Email logs

**Current filters**

- Search
- Status
- Trigger type
- From date
- To date

**Current sort UI**

- Sent date only in practice

**Recommended additions**

- Template filter
- Related simulation/user filter
- Sort by recipient, status, duration

**Implementation priority**

- Medium

#### Cron logs

**Current filters**

- None

**Current sort UI**

- None

**Recommended additions**

- Status filter
- Trigger source filter
- Date range filter
- Sort by timestamp and duration

**Implementation priority**

- Medium

### Analytics

**Current filters**

- Period selector
- Agency selector for drill-down

**Current sort UI**

- Analytics tables mark some columns as sortable, but sorting is not wired

**Recommended additions**

- Wire client-side sorting for analytics summary tables
- Later: add status/user filters if analytics API expands

**Implementation priority**

- Medium

## Implementation phases

### Phase 1: safe wins with existing API

- Simulations: expose safe sortable columns and harden API with an allowlist
- Users: add `updatedAt` to API allowlist so current UI behaves correctly
- Base values: expose existing backend-supported sort columns

### Phase 2: add missing backend filters

- Users active/inactive filter
- Clients active/inactive and CIF filters
- Agencies active/inactive and location filters
- Simulations commodity/date filters

### Phase 3: logs and analytics polish

- Audit and cron sorting/filter controls
- Email logs richer filters
- Analytics table sorting

## Status

### Started in this change

- Document created
- Simulations sort UI wired for `status`, `pinSnapshot`, `expiresAt`, `createdAt`, and `updatedAt`
- Simulations API `orderBy` hardened with an allowlist for safe sortable fields
- Users API updated to support `updatedAt` sorting
- Users table `Name` sorting aligned to backend `fullName` field
- Users table `Role` sorting enabled
- Base values table now exposes backend-supported sorting for `version` and `createdAt`
