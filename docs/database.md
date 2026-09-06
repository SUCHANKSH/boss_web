# Database architecture

The canonical schema is [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma). Money is integer paise with ISO currency codes; timestamps are UTC.

## Core relations

```text
Artwork 1--* Product 1--* ProductVariant 1--0..1 Inventory
                    |                 \
                    |                  *--* OrderItem (snapshot price/name/SKU)
                    *--* Category and Collection
User 1--* Address, Order, WishlistItem
Order 1--* OrderItem and Payment
```

An artwork is a reusable design asset. A product is a sellable presentation or format (for example, framed poster), while a variant is the purchasable SKU (A3 / black frame). Artwork is optional for custom-only products. SKU and inventory belong to the variant, never the artwork.

Categories are a self-referencing, database-driven tree; collections may map to multiple categories. Do not encode category names in application logic.

`OrderItem` retains immutable sale-time data, including structured `customization`, so later catalog edits cannot change history. `CustomizationSchema.fields` is a versioned field definition; input is validated against its recorded version before an order is placed. Use pre-signed private upload keys for customer source files; never attach them to public `Media`.

Implemented authentication tables are `Session`, `PasswordResetToken`, and `EmailVerificationToken`. Future tables include carts, shipment/tracking events, coupons/redemptions, reviews, recommendations, recently viewed events, media derivatives, and webhooks.

## Local and test databases

Local development uses PostgreSQL on `localhost:5432` with database `boss_website`, configured only in the uncommitted root `.env`. Integration tests use isolated `boss_website_test`; CI uses an ephemeral PostgreSQL 18 service and never accesses local data. Migration `20260902180446_init` is applied. Use `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:status`, `npm run db:generate`, and `npm run db:seed`; `db:reset` is development-only.

## Phase 2.1 catalog foundation

Migration `20260904162357_phase_2_1_catalog_database_foundation` adds artwork and collection lifecycles, product publishing/SEO/display metadata, explicit variant currency and timestamps, category/collection timestamps and SEO fields, and provider-agnostic media metadata. Media retains references only—never binary files—and can attach to artwork, product, variant, category, or collection with a purpose and sort order.

`InventoryAdjustment` is append-only stock history linked to `Inventory`, with a delta, reason, optional actor/reference, and timestamp. Product and artwork remain separate; an artwork can power multiple products, while each unique variant owns its SKU, pricing, inventory, and media. Query indexes support active product listings, artwork/product retrieval, active variant loading, category/collection mappings, ordered media, adjustment history, and audit timelines.
