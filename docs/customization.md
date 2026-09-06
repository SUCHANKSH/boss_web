# Customization architecture

Each customizable product owns a versioned `CustomizationSchema` describing fields, allowed values, conditional rules, price modifiers, and layout references. At configuration time the API validates typed input; uploaded assets are stored privately and referenced by opaque IDs. At checkout, a normalized immutable customization snapshot is written to `OrderItem`.

Custom orders pass through normal payment and shipment flows, with extra `CUSTOMIZATION_REQUIRED` / `IN_PRODUCTION` order states. Production staff never alter the customer’s original snapshot; corrections are additive audited revisions.
