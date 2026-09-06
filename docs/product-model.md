# Product, variant, and media model

`Artwork -> Product -> ProductVariant -> SKU -> Inventory` is the central commercial chain. Example: an `Attack on Titan` artwork can power a poster product and a framed-poster product; their A3 variants have distinct SKU, price, attributes, media, and stock.

Product attributes are variant JSON such as `{ "size": "A3", "frame": "black" }`, constrained by product-type rules in the service layer. This supports new formats without schema migrations while preserving a normalized stock ledger. Never derive a SKU from a mutable display name.

Public catalog media uses separate object prefixes and is cacheable. Customer uploads use private prefixes, short-lived signed URLs, malware/type/size validation, and retention/deletion jobs. Store original, derivative/thumbnail references, dimensions, MIME type, checksum, ownership, and lifecycle state.

Phase 2.1 adds variant currency (default `INR`), lifecycle-ready product/artwork/collection metadata, and ordered media purposes (`MASTER`, `THUMBNAIL`, `GALLERY`, `MOCKUP`, `BANNER`). Inventory remains one-to-one with the variant; `InventoryAdjustment` records append-only stock deltas for future transactional admin adjustments.
