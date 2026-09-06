# BOSS Website

Foundation monorepo for a premium pop-culture merchandise and collectibles platform.

## Phase 0 scope

This repository deliberately contains architecture, documentation, shared contracts, a PostgreSQL schema, and a minimal API health check only. It does not contain storefront, catalog, cart, checkout, payment, or admin product features.

## Prerequisites

- Node.js 22+
- PostgreSQL 16+

## Start locally

1. Copy `.env.example` to `.env` and set local values.
2. Run `npm install`.
3. Run `npm run db:generate`.
4. Create the database and run `npm run db:migrate` after Phase 1 introduces the first migration.
5. Run `npm run dev:api` and visit `http://localhost:4000/health`.

See [docs/development.md](docs/development.md) for conventions and [docs/architecture.md](docs/architecture.md) for the Phase 0 design.
