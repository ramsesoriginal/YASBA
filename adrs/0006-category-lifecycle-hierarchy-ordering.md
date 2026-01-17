# ADR 0006: Category Lifecycle, Hierarchy, and Ordering (Phase 1)

- **Status:** Accepted
- **Date:** 2026-01-17
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 1 (Offline MVP)

---

## Context

YASBA uses an offline-first, append-only record log (ADR-0001, ADR-0003) and a deterministic domain model (ADR-0002) with stable ordering rules (ADR-0004).

Categories are referenced by stable IDs from other records (transactions, budgeting). In real budgeting workflows, categories need to evolve:

- rename categories
- archive categories (hide from day-to-day use without losing history)
- change ordering for usability
- create subcategories / hierarchy

These changes must remain deterministic, append-only, and UI/persistence agnostic.

---

## Decision

### 1) Categories are stable entities referenced by ID

- A category is created once via `CategoryCreated { categoryId, name }`.
- All subsequent changes MUST be expressed as additional immutable records.
- Category IDs are never reused.

### 2) Rename semantics (append-only)

Introduce:

- `CategoryRenamed { categoryId, name }`

Resolution:
- The **effective category name** is the latest name for that `categoryId` across:
  - initial `CategoryCreated.name`
  - subsequent `CategoryRenamed.name`
- “Latest” is defined by the global deterministic ordering rules (ADR-0004).

### 3) Archive semantics (append-only)

Introduce:

- `CategoryArchived { categoryId, archived: boolean }`

Resolution:
- The effective archive state is the latest `archived` flag by deterministic ordering (ADR-0004).
- Archived categories are **hidden by default** in interactive UI pickers and category lists, but:
  - MUST remain resolvable by ID for historical transactions and reports
  - MUST remain part of projections where referenced (no dangling references)

Notes:
- Phase 1 UI will primarily emit `archived: true`.
- Allowing `archived: false` keeps the model simple and supports unarchive later without introducing another record type.

### 4) Ordering semantics (explicit snapshot)

Introduce:

- `CategoryReordered { orderedCategoryIds: CategoryId[] }`

Resolution:
- If an ordering snapshot exists, categories are displayed in the specified order.
- Categories not present in the snapshot (newly created) appear at the end in a stable fallback order.
- If no snapshot exists, fallback display order is stable (e.g. by name, then id).

Rationale:
- Ordering is a UI concern but must be stable across reloads and independent of storage iteration order.
- A snapshot record is simple, deterministic, and avoids complex “move up/down” semantics in the domain model.

### 5) Subcategories / hierarchy (Phase 1 model, implemented later)

Subcategories are modeled as categories with an optional parent relationship.

Introduce (for implementation in Slice 4.3):

- `CategoryReparented { categoryId, parentCategoryId?: CategoryId }`

Resolution:
- The effective parent is the latest parent assignment for the category ID.
- A missing parent means “top-level category”.

Notes:
- Phase 1 will not implement cross-parent ordering semantics beyond:
  - parent ordering (via `CategoryReordered`)
  - child ordering can be added later via a per-parent reorder record if needed
- Cycles are invalid (a category cannot be its own ancestor); enforcement is a domain invariant.

---

## Consequences

### Positive
- Category management becomes deterministic and replayable
- History is preserved (archiving does not delete)
- Ordering is explicit and stable
- Subcategories can be introduced without changing existing references or storage strategy

### Negative / Trade-offs
- Requires a category resolution/view helper to compute “effective categories”
- UI actions emit additional records instead of mutating objects (intentional)

---

## Invariants to Test
- Latest rename wins deterministically
- Latest archive state wins deterministically
- Archived categories remain resolvable for historical transactions
- Ordering is stable and deterministic even when snapshot is partial

---
