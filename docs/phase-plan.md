# Phase plan

| Phase | Scope                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| 0     | Architecture, workspace, environment template, contracts, schema, API health bootstrap                               |
| 1     | Complete — database client, migration/seed, error/auth middleware, isolated tests, CI, and compiled API verification |
| 2     | Catalog and admin backend                                                                                            |
| 3     | Frontend design system                                                                                               |
| 4     | Storefront UX refinement and production polish                                                                       |
| 5     | Category and product experience                                                                                      |
| 6     | Cart and wishlist                                                                                                    |
| 7     | Customization workflow                                                                                               |
| 8     | Checkout, payments, orders, shipping                                                                                 |
| 9     | Customer accounts                                                                                                    |
| 10    | Admin dashboard                                                                                                      |
| 11    | Search, recommendations, analytics, NFC extensions                                                                   |
| 12    | Production hardening and deployment                                                                                  |

## Phase 1 delivered scope

Prisma Client, migration `20260902180446_init`, seed data, request IDs, error envelopes, session persistence, authentication endpoints, health/readiness checks, integration tests, CI, and compiled build order are implemented. Password-reset/email-verification tables are foundations only. Catalog-facing UI, payments, carts, and admin screens remain later-phase work.

## Phase 2.2 delivered scope

Shared Zod API contracts for catalog/admin/public boundaries are implemented in `packages/contracts`; no catalog services or HTTP routes are implemented. Phase 2.3 is catalog services, followed by admin and public API phases.

## Phase 2.3 delivered scope

Catalog services now implement category hierarchy safety, collections, reusable artwork, products, variants, SKU/price validation, metadata-only media references, public-safe projections, and transactional append-only inventory adjustments. No catalog HTTP routes, admin APIs, public catalog APIs, frontend, storage integration, or audit subsystem were added. AuditLog remains an existing schema foundation and catalog audit logging is intentionally deferred. Phase 2.4 (Admin APIs) and Phase 2.5 (Public Catalog APIs) remain deferred.

## Phase 2.4 delivered scope

Authenticated, role-protected Admin catalog HTTP adapters are implemented under `/api/admin`. They expose the existing catalog service through validated requests and allow-listed admin response projections. Public catalog APIs remain Phase 2.5. AuditLog writing remains deferred to the future administrative audit policy; the existing model is preserved without a competing audit subsystem.

## Phase 2.5 delivered scope

Unauthenticated, read-only public catalog adapters are implemented under `/api/catalog` for active categories, public collections, active products, product variants, and product media metadata. Shared Zod query contracts enforce bounded pagination, allow-listed sorting, and category/collection filtering. Contract-validated public projections omit internal/admin fields and non-public lifecycle records resolve as `404`. Public write APIs, search, frontend work, media upload/storage/CDN integration, carts, checkout, payments, orders, reviews, recommendations, and audit-writing remain out of scope.

## Phase 3 delivered scope

The React/Vite storefront in `apps/web` consumes the public catalog API through a centralized, shared-schema-validated client. It provides responsive shell, home, category/collection browsing, product listing with API-supported pagination/filtering/sorting, and product-detail media/variant presentation. It intentionally has no authentication, commerce actions, search, storage/upload, reviews, analytics, or admin interface.

## Phase 4 delivered scope

The existing storefront has refined visual hierarchy, reusable product presentation, responsive navigation, stable media treatment, skeleton/empty/error/not-found states, URL-backed catalog controls, and runtime SEO metadata. Accessibility includes landmarks, a skip link, labeled controls, keyboard-visible focus, active navigation, an Escape-close mobile menu, accessible gallery controls, and image fallback/alt behavior. The Phase 2.5 API remains the sole data source; no backend endpoints, business features, analytics, storage/CDN, identity, commerce, search, or admin UI were added.

## Phase 5.2 delivered scope

Backend-only checkout conversion is implemented for authenticated customer carts. It creates immutable order/item/address snapshots and a pending payment foundation, converts the cart, and conditionally decrements tracked inventory inside a serializable PostgreSQL transaction. Customer-scoped idempotency replays the same checkout safely and rejects conflicting reuse. Payment integration, frontend commerce, shipping, tax, discounts, and fulfillment remain deferred.
