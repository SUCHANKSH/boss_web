# System architecture

## Decision

Use an npm-workspaces TypeScript monorepo. Phase 1 starts with a Fastify API and PostgreSQL through Prisma. Future customer web and admin applications are separate Next.js applications in `apps/web` and `apps/admin`; neither is created in Phase 0.

| Concern     | Selection                                                                               | Why / alternatives                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer UI | React + TypeScript + Vite (`apps/web`)                                                  | Implemented public-catalog storefront; browser-safe client validation and lightweight SPA delivery.                                                          |
| Admin UI    | Next.js + React + TypeScript + Tailwind (future)                                        | Admin presentation remains a later phase and is independent from the public storefront.                                                                      |
| API         | Fastify + TypeScript                                                                    | Small, fast, schema-friendly HTTP service. NestJS adds conventions but is more framework weight; Express has fewer guardrails.                               |
| Database    | PostgreSQL + Prisma                                                                     | Transactions and relational integrity fit orders/catalogs; Prisma provides typed queries and migrations. Drizzle is a viable lighter alternative.            |
| Media       | S3-compatible object storage; Cloudflare R2 preferred for public delivery               | Private user uploads and public derivatives can be isolated; Cloudinary remains an option if transformation workflow becomes more valuable than portability. |
| Payments    | Razorpay adapter first, Stripe adapter later                                            | UPI and Indian commerce support. No provider is coupled to order logic.                                                                                      |
| Deployment  | Vercel for Next.js, containerized API on AWS ECS/Fargate or Railway, managed PostgreSQL | Scales independently and is cost-conscious at launch.                                                                                                        |

## Layers and flow

```text
Customer / Admin
       | HTTPS
Next.js web or admin (future) ----- CDN / optimized public media
       | JSON API
Fastify API: routes -> validation -> services -> repositories
       |                    |                 |
PostgreSQL / Prisma      Razorpay, email, shipping, analytics, R2
```

Presentation owns rendering and client interaction. The application layer owns authorization, pricing, state transitions, and integrations. The data layer owns Prisma repositories and transactions. Infrastructure adapters own vendor-specific storage, payment, email, shipping, and observability clients.

## Boundaries

Route handlers contain no business rules. Services depend on interfaces (for example `PaymentProvider`), not Razorpay directly. Database records are never returned without a response mapping. Shared Zod contracts go in `packages/contracts`; do not share API internals with UI apps.

## Deployment and operations

Use dev/staging/production environments with isolated databases, buckets, and credentials. Run migration checks during CI; deploy migrations once before compatible API code. Structured JSON logs include a request ID but never secrets, authentication cookies, payment payloads, or uploaded image URLs. Add Sentry/OpenTelemetry in Phase 1.

## Implemented Phase 1 runtime

`@boss/database` compiles from `packages/database/src` to `packages/database/dist` and exports compiled JavaScript. `npm run build` explicitly builds database, then contracts, then API, preventing the compiled API from resolving TypeScript source. The API uses Prisma, request IDs, structured logging, CORS, security headers, rate limiting, and central error envelopes.

Authentication is opaque, database-backed session authentication. Passwords are hashed using Argon2id; session tokens are stored only as hashes and the browser receives an HTTP-only cookie. Logout deletes the persisted session before clearing the cookie. Roles are `CUSTOMER`, `ADMIN`, and `SUPER_ADMIN`.

## Phase 2.1 database foundation

The catalog remains a modular-monolith domain: reusable artwork feeds many physical products; variants own SKU, money, inventory, and availability. PostgreSQL contains only catalog/media metadata and storage references. Phase 2.1 establishes schema, migration, seed data, integrity indexes, and inventory history only; catalog/admin routes and services remain later Phase 2 work.

## Phase 2.2 contract boundary

`@boss/contracts` is the Zod runtime-validation boundary between future APIs and clients. It compiles to `dist` and exports common primitives, admin-capable catalog contracts, and deliberately restricted public catalog contracts. Prisma models remain persistence-only and are never exposed as API contracts.

## Risks and trade-offs

## Phase 2.3 catalog service boundary

`CatalogService` is the Phase 2.3 application layer. It owns catalog validation, category hierarchy protection, lifecycle transitions, product/category/collection relationships, SKU and price checks, metadata-only media references, and transactional inventory adjustments. It has no Fastify route registration: admin APIs and public catalog APIs remain deferred.

Public projection functions are a separate allow-list boundary. They map loaded catalog records to the Phase 2.2 public Zod contracts and exclude artwork rights, internal notes, inventory history, audit data, and Prisma implementation details. Media is reference metadata only; upload, storage, CDN, and transformation integrations are not implemented.

## Phase 2.4 Admin HTTP boundary

Admin Fastify routes are thin adapters over `CatalogService`. They authenticate database-backed sessions, require `ADMIN` or `SUPER_ADMIN`, validate shared Zod inputs, and map records through allow-listed admin projections before returning the common envelope. They never query Prisma directly. AuditLog persistence remains deferred: the model is retained for the future administrative audit policy, rather than creating ad-hoc catalog audit behavior now.

## Phase 2.5 public catalog boundary

Public Fastify adapters under `/api/catalog` are unauthenticated, read-only adapters over `CatalogService`; they contain no Prisma calls. Service queries enforce public visibility: active categories, active collections in `ACTIVE` lifecycle state, and `ACTIVE` products only. Hidden related categories and collections are omitted from public products. A separate contract-validated projection layer exposes only public product, category, collection, variant, and media fields. It validates persistence JSON as `unknown` before exposing it and deliberately omits SKU, inventory, operational metadata, media storage details, audit data, lifecycle state, and artwork rights. Media is URL metadata only; upload, storage, CDN, and image-processing integration remain out of scope.

## Phase 3 storefront boundary

`apps/web` is a React/Vite storefront. Its routes call one schema-validated catalog client, which makes browser-safe requests only to `/api/catalog/*`; it never imports Prisma or database packages. Shared `@boss/contracts` schemas parse public response envelopes at the client boundary. Product cards, gallery, variants, pagination, filters, and sorting use only public projections. The Vite development proxy is a local development convenience; it does not bypass the public API or expose backend credentials.

## Phase 4 storefront quality boundary

Phase 4 retains the Vite/React public-catalog architecture and adds presentation-only refinement: a responsive app shell, shared product grid/card/gallery/state components, URL-backed catalog controls, runtime document metadata, and public-field-only product structured data. The browser makes no database calls and has one centralized API client. Product detail uses its existing public detail projection for media and variants, avoiding redundant subordinate requests. SEO is client-side metadata appropriate to this SPA; server-rendered SEO, image optimization infrastructure, analytics, authentication, and commerce remain out of scope.

## Phase 5 commerce foundation (in progress)

Phase 5 reuses opaque database-backed sessions for customer-owned commerce. The initial cart boundary is `React/Vite -> typed commerce client (future UI) -> /api/cart -> CartService -> PostgreSQL`. Cart APIs require a `CUSTOMER` session, resolve current catalog variant prices server-side, validate active variants and tracked inventory server-side, and persist only cart snapshots. A cart is explicitly non-historical; orders and payment processing remain separate Phase 5 work and must create immutable transactional snapshots before a phase can be considered complete.

Phase 5.2 adds a backend-only checkout boundary. `POST /api/checkout` runs at serializable PostgreSQL isolation, revalidates current cart prices and active variants, conditionally decrements tracked inventory, snapshots order items and address data, creates a pending payment foundation record, converts the cart, and persists a customer-scoped idempotency operation in one transaction. Conditional stock updates plus serializable transactions prevent both competing checkouts from consuming the same tracked unit. Payment providers, webhooks, and payment confirmation are not implemented.

Prisma accelerates development but complex reporting may later need SQL views. A modular monolith is intentionally chosen over microservices; extract workers/search only after measurable load or operational need. R2 avoids common egress cost but has AWS compatibility differences. Product attributes and customization schemas use JSON for controlled flexibility, validated in application code.
