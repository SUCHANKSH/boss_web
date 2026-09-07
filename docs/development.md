# Development standards

## New developer setup

Start from the shared GitHub source repository. GitHub stores the application source, committed Prisma schema, migrations, and seed code; it does **not** store any developer's PostgreSQL database or local credentials.

```text
GitHub repository
  -> Prisma schema + committed migrations + seed
  -> developer's local PostgreSQL database
  -> BOSS API
```

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/SUCHANKSH/boss_web.git
   cd boss_web
   ```

2. Verify that Node.js, npm, Git, and PostgreSQL are installed and available. For example, run `node --version`, `npm --version`, `git --version`, and `psql --version`.

3. Install workspace dependencies:

   ```bash
   npm install
   ```

4. Create a PostgreSQL development database named `boss_website` with your normal local PostgreSQL account. For example:

   ```sql
   CREATE DATABASE boss_website;
   ```

5. Copy `.env.example` to `.env` (for example, `Copy-Item .env.example .env` in PowerShell), then set `DATABASE_URL` to your local database, such as `postgresql://<user>:<password>@localhost:5432/boss_website?schema=public`. Set `AUTH_SECRET` to a long random local value; `.env.example` suggests `openssl rand -base64 32`.

   Never commit `.env`, credentials, API keys, or secrets. Each developer normally uses their own local PostgreSQL database; do not use another developer's personal local database as the team workflow.

6. Generate Prisma Client, apply development migrations, seed the database, and confirm migration status:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run db:status
   ```

   Do not create tables manually. The Prisma schema and committed migrations define the database structure.

7. In one terminal, start the API:

   ```bash
   npm run dev:api
   ```

   In another terminal, start the Vite storefront:

   ```bash
   npm run dev:web
   ```

8. Verify `http://localhost:4000/health` and `http://localhost:4000/ready`; both should return HTTP 200. Then open the storefront at `http://localhost:5173` and confirm that its public catalog, including `/products`, loads through the API proxy.

### First-run verification

```text
[ ] Repository cloned
[ ] npm install completed
[ ] Local PostgreSQL running
[ ] boss_website database created
[ ] .env configured
[ ] AUTH_SECRET configured
[ ] Prisma Client generated
[ ] Development migrations applied
[ ] Seed completed
[ ] API starts
[ ] /health returns 200
[ ] /ready returns 200
[ ] Storefront starts
[ ] Public catalog loads
```

### Development, test, and shared environments

`boss_website` is the local development database. `boss_website_test` is the isolated test database: tests must never use development data. The API test setup takes `TEST_DATABASE_URL` or `DATABASE_URL` only as local connection credentials, then forcibly changes the database name to `boss_website_test`. Ensure that test database exists and has the committed migrations applied before running API tests; test data must not affect `boss_website`.

GitHub is the shared source-code repository, not a shared database. Shared staging or production databases are separate environments with their own credentials and deployment process. Local credentials must not be committed.

## Commands

Use `npm run lint`, `npm run format:check`, and `npm run test` for local checks. Tests use isolated `boss_website_test`, never development data.

`npm run db:generate` generates Prisma Client. Use `npm run db:migrate` for local development migrations, `npm run db:seed` to load the repository seed data, and `npm run db:status` to inspect migration status. Use `npm run db:migrate:deploy` when applying already committed migrations in a deployment-oriented environment; it does not create new migrations. `npm run build` builds database, contracts, API, then the storefront. Start compiled API output with `npm run start:api`. GitHub Actions runs formatting, type checking, Prisma validation/generation/migrations against isolated PostgreSQL 18, tests, and the root build.

## Storefront (Phase 3)

`apps/web` is the Vite/React storefront workspace. Run `npm run dev --workspace=@boss/web` alongside the API to develop it, or `npm run build --workspace=@boss/web` for a production bundle. The centralized catalog client uses the `VITE_API_BASE_URL` browser-safe value when set; otherwise it uses same-origin `/api/catalog/*` paths. Vite development proxies `/api` to `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:4000`). Neither variable contains credentials or gives the browser database access.

Run `npm run test --workspace=@boss/web` for schema-validated API-client and storefront-component tests. Storefront routes are `/`, `/products`, `/products/:id`, `/categories`, and `/collections`; category and collection browsing links into the shared product-list route using the API's supported URL filters.

`@boss/contracts` has independent Zod schema tests. Import compiled shared contracts only from `@boss/contracts`; do not import Prisma models into frontend or API request/response contracts.

## Storefront quality checks (Phase 4)

The storefront keeps its visual rules in `apps/web/src/styles.css`: shared color, typography, spacing, and surface tokens; responsive breakpoints at tablet and mobile widths; visible keyboard focus; and stable media aspect-ratio containers. Reusable UI lives in `components.tsx`; page metadata is managed by `seo.ts` from public fields only. Run `npm run test --workspace=@boss/web` for catalog-client, component, navigation, URL-state, and metadata coverage. Manually check the Vite storefront at mobile, tablet, desktop, and wide desktop widths when changing layouts.

Set optional `VITE_SITE_ORIGIN` to the deployed public storefront origin for canonical URLs. It is browser-safe and must not contain credentials. The client updates title, description, canonical, Open Graph title/description, and safe product JSON-LD at runtime; it does not add an SEO service or backend endpoint.

## Commerce cart foundation (Phase 5 in progress)

### Phase 5.1

The committed migration `20260906133000_phase_5_commerce_cart` adds the persistent authenticated-customer cart foundation. The protected endpoints are `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`, and `DELETE /api/cart`. They accept variant IDs and quantities only: prices, subtotals, and availability are calculated by the API.

### Phase 5.2

Checkout and customer order retrieval are implemented through protected endpoints: `POST /api/checkout`, `GET /api/orders`, and `GET /api/orders/:id`. Checkout accepts a shipping-address snapshot and idempotency key only. Customer authentication is required; prices and inventory are server-authoritative. It runs in a serializable PostgreSQL transaction, conditionally decrements tracked stock, creates immutable order and item snapshots, converts the cart, and creates a `PENDING_PAYMENT` order with a `PENDING` payment foundation. Transactional failure rolls back the cart, order, inventory, and idempotency changes. Retrying the same key and request safely returns the existing checkout; conflicting reuse is rejected. Payment providers, webhooks, payment collection, and a customer commerce UI are not implemented.

### Phase 5.3 inventory transaction hardening

The Phase 5.3 migration adds `ORDER_CHECKOUT` as an inventory-adjustment reason. For tracked items, checkout decrements inventory inside the same serializable PostgreSQL transaction as order creation, cart conversion, and idempotency recording. The conditional decrement prevents overselling and protects concurrent checkouts. A rollback keeps inventory, order, cart, idempotency, and inventory-history changes atomic.

Committed tracked checkout mutations create `InventoryAdjustment` history records with the `ORDER_CHECKOUT` reason and the order as their reference. An idempotent retry reuses the completed checkout rather than creating another inventory mutation or history row; failed transactions leave no committed checkout-history row. Relevant integrity mechanisms include the unique inventory-to-variant relationship, the inventory-history index on `[inventoryId, createdAt]`, the checkout operation's unique `[userId, idempotencyKey]` constraint, and its unique order reference.

Phase 5.3 verification uses the compiled API and PostgreSQL: an exact-stock checkout must produce one `ORDER_CHECKOUT` record, an idempotent retry must not add another decrement or history row, and an insufficient-stock checkout must leave the cart active without an order or checkout-history mutation. Disposable verification data must be cleaned up afterward.

## Phase 2.3 service tests

Catalog service tests execute directly against the isolated `boss_website_test` database. Before running them, apply migrations there, then run the API workspace tests with `DATABASE_URL` set to that test database. Do not point tests at `boss_website`. The tests cover hierarchy and relationship validation, public projections, media metadata references, inventory adjustment rollback, and existing Phase 1 HTTP integration behavior.

Admin and public-catalog HTTP integration tests also run only against `boss_website_test`; the Vitest setup derives a test URL from local credentials but forces that database name. Run `npm test` for contracts, Phase 1 API, catalog service, Admin API, and public catalog coverage. Public endpoints are tested through the real Fastify -> validation -> CatalogService -> PostgreSQL -> projection pipeline, including lifecycle hiding and public-field exclusion.

The public catalog read API is `/api/catalog/categories`, `/api/catalog/collections`, and `/api/catalog/products`, with `:id`, product `:id/variants`, and product `:id/media` detail endpoints. It requires no session. Use the shared page/limit convention (default 1/20, maximum 100), allow-listed sorts, and category/collection slug filters; it intentionally has no write operations, search, binary-media handling, or public inventory history.

## Phase 5.2 checkout verification

`POST /api/checkout`, `GET /api/orders`, and `GET /api/orders/:id` require the existing customer session. Checkout accepts a shipping-address snapshot and idempotency key only; totals, prices, inventory, customer IDs, and statuses are never client-authoritative. The checkout transaction uses serializable PostgreSQL isolation and a conditional tracked-stock decrement. Price, inventory, or transaction failures roll back order, item, inventory, cart, and idempotency writes together. Orders start `PENDING_PAYMENT` with a `PENDING` payment foundation; payment providers, webhooks, and payment collection are not implemented.

## Rules

- TypeScript strict mode; no `any`, unchecked external input, or hidden side effects.
- Validate input at route boundaries with Zod and enforce critical invariants again in services and database transactions.
- Use `camelCase` for variables/functions, `PascalCase` for types/classes, kebab-case filenames, and plural route resources.
- Keep routes thin; services coordinate rules; repositories own persistence; adapters own vendor SDKs.
- Prefer explicit domain errors with status, stable code, safe message, and optional server-only cause.
- No secrets in source, logs, tests, client bundles, or error responses.
- Unit-test services, integration-test routes/database, and use Playwright for future critical end-to-end flows.

## Git workflow

Protect `main`; create short-lived `feature/*`, `fix/*`, and `chore/*` branches. PRs require lint, tests, migration review, and a concise conventional commit (`feat:`, `fix:`, `docs:`, `chore:`). Squash merge unless preserving individual commits is meaningful.
