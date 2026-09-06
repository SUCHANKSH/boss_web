# ADR 0001: Start with a modular monolith

Status: accepted. The catalog, orders, payment abstraction, and admin APIs will ship as modules inside one Fastify deployment. Transactional consistency, low operational cost, and simpler AI-assisted change review outweigh premature independent deployment. Modules may be extracted only when independently scaling or owning a vendor integration provides measurable value.
