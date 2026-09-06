# API architecture

Current endpoints use the paths documented below (there is no `/api/v1` prefix); `/health` remains infrastructure-only. JSON responses use resource objects. Errors always follow:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Invalid request", "requestId": "..." } }
```

## Implemented Phase 1 endpoints

Responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "requestId" } }`.

| Endpoint                  | Access               | Behavior                                                                                  |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `GET /health`             | Public               | API process liveness; does not query PostgreSQL.                                          |
| `GET /ready`              | Public               | Executes a Prisma database query; success proves PostgreSQL connectivity.                 |
| `POST /api/auth/register` | Public, rate limited | Validates email/password, creates a customer, and sets an HTTP-only session cookie.       |
| `POST /api/auth/login`    | Public, rate limited | Validates credentials and sets an HTTP-only session cookie.                               |
| `POST /api/auth/logout`   | Public               | Deletes the persisted current session when present and clears the cookie; safe to repeat. |
| `GET /api/auth/me`        | Session required     | Returns safe user fields: id, email, name, role.                                          |

Validation failures return `400`, authentication failures `401`, authorization failures `403`, duplicate conflicts `409`, and unknown failures `500`. Every request receives `X-Request-Id`. The listed catalog/order groups below are future architecture only and are not implemented in Phase 1.

## Shared catalog contracts

Phase 2.2 defines, but does not implement, catalog endpoints. `@boss/contracts` provides Zod contracts for CUID identifiers, lowercase slugs, page/limit pagination (default 20, maximum 100), allow-listed sorting, INR integer-minor-unit money, lifecycle states, media metadata, inventory adjustment requests, and catalog create/update/list requests. Admin contracts may represent internal catalog fields; public product/category/collection contracts intentionally exclude artwork rights, internal notes, audit data, and inventory history.

| Group                                                   | Public operations                                   | Protected operations                            |
| ------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `/auth`                                                 | register, login, password reset, email verification | logout, session refresh                         |
| `/categories`, `/collections`, `/artworks`, `/products` | list and get by slug                                | admin create/update/archive                     |
| `/variants`, `/inventory`                               | variant availability                                | admin inventory adjustment                      |
| `/cart`, `/wishlist`, `/customizations`                 | customer state                                      | customer state / signed upload intent           |
| `/orders`, `/payments`, `/shipments`                    | customer’s own orders                               | admin state transitions; verified webhooks      |
| `/reviews`, `/coupons`, `/recommendations`              | discovery / eligible actions                        | moderation and rule management                  |
| `/admin`                                                | none                                                | permission-protected management and audit views |

Use cursor pagination, explicit field allow-lists, idempotency keys for checkout/payment creation, and an `Idempotency-Key` header for state-changing retryable operations. `PATCH` changes partial mutable fields; archive replaces destructive delete for catalog records. API versions are additive until a documented deprecation window.

## Public catalog API (Phase 2.5)

The following read-only endpoints are public: no session is required. They use the common `{ "success": true, "data": ... }` envelope; validation and missing-resource errors use the existing safe error envelope.

| Endpoint                                 | Behavior                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/catalog/categories`            | Lists active categories only. Supports standard page/limit and the shared category sort/filter contract.                                                                                           |
| `GET /api/catalog/categories/:id`        | Returns an active category or `404`.                                                                                                                                                               |
| `GET /api/catalog/collections`           | Lists active `ACTIVE` collections only, with standard pagination.                                                                                                                                  |
| `GET /api/catalog/collections/:id`       | Returns a public collection or `404`.                                                                                                                                                              |
| `GET /api/catalog/products`              | Lists `ACTIVE` products. Supports page/limit, allow-listed `name`, `createdAt`, `updatedAt`, `sortOrder`, or lowest-active-variant `price` sorting, plus `category` and `collection` slug filters. |
| `GET /api/catalog/products/:id`          | Returns an `ACTIVE` product or `404`.                                                                                                                                                              |
| `GET /api/catalog/products/:id/variants` | Returns public active variants for an `ACTIVE` product.                                                                                                                                            |
| `GET /api/catalog/products/:id/media`    | Returns public media metadata for an `ACTIVE` product.                                                                                                                                             |

Pagination is `{ page, limit, total, totalPages }` with page 1/limit 20 by default and a maximum limit of 100. Invalid IDs, filters, page/limit values, sort fields, and sort directions return `400`; non-public or absent records return `404` to avoid leaking lifecycle state.

Public projections are allow-lists validated with the shared Zod public contracts. They exclude SKUs, inventory and adjustment history, product lifecycle and internal notes, artwork rights, media storage keys/checksums/metadata, audit information, and all Prisma-only fields. Variants expose validated JSON attributes and INR minor-unit price objects; media remains URL/metadata only—there is no upload, binary storage, image processing, or CDN API.

## Phase 2.3 service-only catalog implementation

The internal `CatalogService` implements category, collection, artwork, product, variant, media-reference, and inventory operations behind the Phase 2.4 and 2.5 adapters. Lifecycle changes are constrained to `DRAFT -> ACTIVE/ARCHIVED`, `ACTIVE -> ARCHIVED`, and `ARCHIVED -> DRAFT`. Catalog records are archived/deactivated rather than destructively removed; media deletion is a soft delete. Inventory changes use one database transaction and append an immutable adjustment record only after the guarded inventory update succeeds.

## Phase 2.4 Admin Catalog API

`/api/admin/*` is implemented for authenticated `ADMIN` and `SUPER_ADMIN` sessions only. It provides create/list/get/update/archive operations for categories, collections, artwork, products and variants; metadata-only media create/get/update/delete; product category/collection assignment; and variant inventory/history operations. Responses use the standard success envelope and contract-validated admin projections. Pagination defaults to page 1/limit 20 and caps at 100; category and product list filters/sorts are limited to the shared contracts. Invalid input is `400`, missing records `404`, duplicate values `409`, unauthenticated access `401`, and customer access `403`.

`AuditLog` remains a schema foundation: catalog mutation audit-writing is explicitly deferred to the future administrative/audit design, so Phase 2.4 does not introduce a second audit subsystem.
