# Authentication and authorization

Phase 1 will use opaque, rotating, secure HTTP-only session cookies stored server-side; browser clients never receive long-lived bearer JWTs. Passwords use Argon2id, reset tokens are single-use and hashed, and email verification is required before privileged changes.

Roles are `CUSTOMER`, `ADMIN`, and `SUPER_ADMIN`. Roles grant coarse access; Phase 2 adds named permissions for sensitive admin actions. Every admin mutation writes an `AuditLog` with actor, target, before/after values, request metadata, and timestamp. Require MFA for admin accounts before production launch.

CSRF protection applies to cookie-authenticated mutations. Rate-limit login, reset, signup, and upload-intent routes. CORS permits only configured application origins with credentials.
