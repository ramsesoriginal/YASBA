# ADR 0005: Append-only Transaction Corrections (Void + Corrected)

- **Status:** Accepted
- **Date:** 2026-01-16
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 1 (Offline MVP)

---

## Context

YASBA stores user actions as immutable domain records (ADR-0002) and persists them offline in an append-only IndexedDB log (ADR-0001, ADR-0003). In this model, we must support the common workflow of fixing mistakes:

- removing a transaction entered by accident
- editing amount/date/category/payee/memo after entry

We must do this without mutating existing records, and without introducing nondeterminism.

---

## Decision

### New record types

We introduce two new record types that reference an existing `TransactionCreated.id`:

1) **TransactionVoided**
- Logically deletes a transaction.
- The transaction is ignored by all projections and views.

2) **TransactionCorrected**
- Logically replaces a transaction’s effective fields.
- The original transaction remains in the log, but its effects are superseded.

All correction records are append-only.

### Deterministic resolution rules

When producing an **effective** transaction stream:

- If a transaction has a `TransactionVoided` record, it is ignored entirely.
- Otherwise, if a transaction has one or more `TransactionCorrected` records:
  - the **latest correction wins**, using the global deterministic ordering rule from ADR-0004:
    1) primary time (`occurredAt` if present else `createdAt`)
    2) `createdAt`
    3) `id` (tie-breaker)

Voids take precedence over corrections (void wins).

### Scope

- Phase 1 uses this mechanism for:
  - hiding mistaken transactions (“delete”)
  - editing transaction fields without mutation
- We do not implement splits, scheduled/recurring, or account transfers in Phase 1.

---

## Consequences

### Positive
- Preserves append-only storage and offline-first behavior
- Keeps the domain deterministic and replayable
- Makes daily usage viable (mistakes are fixable)
- Prepares for future sync/merge strategies

### Negative / Trade-offs
- Projections must resolve void/correction state
- Multiple records may represent one “effective” transaction (requires view helper)

---

## Notes

- Projection code remains pure: no IO, no time/random during projection.
- Time/ID generation happens at the UI/command boundary (ADR-0004).
