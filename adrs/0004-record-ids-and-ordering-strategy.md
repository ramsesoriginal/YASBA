# ADR 0004: Record IDs and Ordering Strategy

- **Status:** Accepted
- **Date:** 2026-01-16
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 1 (Offline MVP)

---

## Context

YASBA Phase 1 is offline-first (ADR-0001) and uses a deterministic domain model (ADR-0002) with an append-only record log stored in IndexedDB (ADR-0003).

To keep projections deterministic, we must define:

1) How record IDs are generated (uniqueness, stability).
2) A stable ordering rule for projecting records when timestamps collide or records arrive in different physical orders.

This must be true regardless of UI state, persistence ordering, or browser behavior.

---

## Decision

### Record IDs

- Each domain record has a globally unique `id: string`.
- For Phase 1, IDs are generated using the Web Crypto API:
  - `crypto.randomUUID()` (UUID v4).

Rationale:
- zero dependencies
- widely supported in modern browsers
- sufficiently unique for local-only operation
- IDs are stable and persisted as part of the immutable record

Non-goal (Phase 1):
- IDs that encode time or sort lexicographically (e.g. ULID / UUIDv7). We may adopt those later if we need readable ordering or cross-device merge properties.

### Required timestamps / fields

To support deterministic projection and debugging:

- All records MUST include:
  - `id`
  - `createdAt` (ISO-8601 string, UTC recommended)

- `TransactionCreated` MUST include:
  - `occurredAt` (ISO-8601 string; user-intent time)

- Records that are month-scoped (e.g. budgeting) MUST include:
  - `monthKey` in `YYYY-MM` format

---

## Ordering Rule for Projection

When projecting records, we apply a stable order:

1) Primary time:
   - `occurredAt` if present (e.g. transactions)
   - otherwise `createdAt`

2) Secondary time:
   - `createdAt`

3) Final tie-breaker:
   - `id` (lexicographic)

This ensures deterministic projection even when:
- timestamps collide
- storage returns records in an arbitrary order
- multiple records share the same occurredAt/createdAt

---

## Consequences

### Positive
- Deterministic projections across refreshes, browsers, and storage ordering
- Simple, dependency-free ID generation in Phase 1
- Clear contract for future record types (budgeting, corrections, etc.)

### Negative / Trade-offs
- UUID v4 is not time-sortable or human-friendly
- If Phase 2 introduces sync/merge, we may prefer ULID/UUIDv7 and additional ordering constraints

---

## Notes

- Determinism requires that projection code MUST NOT consult:
  - `Date.now()`, random number generators, or IO during projection.
- Time generation (`createdAt`) is allowed at the UI/command boundary, not inside the pure domain projectors.
