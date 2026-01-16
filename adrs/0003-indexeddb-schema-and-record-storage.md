# ADR 0003: IndexedDB Schema, Versioning, and Record Storage

- **Status:** Accepted
- **Date:** 2026-01-16
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 1 (Offline MVP)

---

## Context

Phase 1 is offline-only. Per ADR-0001 (Offline-first), local persistence is the source of truth. Per ADR-0002 (Deterministic domain model), all user-visible financial state must be derivable deterministically from immutable records via pure projection functions.

We need a persistence shape that:
- stores immutable domain records durably on-device
- supports schema evolution (migrations)
- does not compromise determinism (no hidden mutable “truth” tables)
- remains simple enough for Phase 1

---

## Decision

Use **IndexedDB** as the offline database with an **append-only** record store.

### Database
- Name: `yasba`
- Versioned via IndexedDB schema version (integer)
- Upgrades handled in `onupgradeneeded` with explicit migrations

### Object stores

1) `records`
- Purpose: append-only storage of domain records (immutable)
- Key: `id` (string)
- Value: the full serialized domain record (JSON-friendly)

Recommended indexes (not all required on day 1; create as needed):
- `byCreatedAt` on `createdAt`
- `byOccurredAt` on `occurredAt` (where present)
- `byType` on `type`
- `byMonthKey` on `monthKey` (where present)
- `byCategoryId` on `categoryId` (where present)

2) `meta`
- Purpose: store db metadata
- Key: string (e.g. `schemaVersion`, `createdAt`)
- Value: JSON-friendly small objects

---

## Record Storage Rules

- Domain records are **immutable**.
- **No updates** to existing records in Phase 1.
- “Edits” are modeled as **new records** (e.g. correction/void) in later slices.
- Any derived/cached data (if introduced later) is **rebuildable** from `records` and must not become authoritative.

---

## Determinism & Ordering

Projection order must be deterministic even when timestamps collide.

The domain projection layer must define a stable ordering rule (documented in a dedicated ADR if needed). The persistence layer must store the fields required to apply that rule (e.g. `occurredAt`, `createdAt`, `id`).

---

## Consequences

### Positive
- Fully offline operation with a clear source of truth
- Deterministic rebuilds of app state from immutable records
- Straightforward migrations (IndexedDB versions)
- Phase 2 readiness (records can sync later)

### Negative / Trade-offs
- Reads can grow over time as records accumulate
- Requires explicit migration discipline from day one
- Index selection must be managed carefully to avoid premature complexity

---

## Notes / Non-Goals (Phase 1)

- No server sync, no multi-user, no conflict resolution
- No compaction required for Phase 1 (can be added later as a non-authoritative optimization)
