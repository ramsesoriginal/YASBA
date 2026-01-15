# ADR 0002: Deterministic Domain Model via Event-Like Records

- **Status:** Accepted
- **Date:** 2026-01-15
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 0 → Phase 1

---

## Context

YASBA is an **offline-first budgeting application** (see ADR 0001) that must provide:

- predictable financial calculations
- explainable state transitions
- reproducible results across sessions, devices, and time

Budgeting logic is particularly sensitive to:
- hidden state
- implicit recalculation
- UI-driven side effects
- order-dependent mutations

Traditional CRUD-style mutable models (e.g. “current balance” fields updated in-place) tend to obscure how a given financial state was reached, making debugging, testing, and future sync behavior significantly harder.

To support:
- deterministic behavior
- offline-first guarantees
- future sync and conflict resolution
- strong testability

the core domain model must be designed deliberately.

---

## Decision

**YASBA models user intent as immutable, event-like domain records.**

Instead of mutating “current state” directly, the system records **what happened**, and derives state from those records in a deterministic way.

Derived views (e.g. monthly budgets, category balances) are computed projections, not sources of truth.

---

## What “Event-Like” Means (in YASBA)

This is **not** full Event Sourcing in the enterprise sense.

For YASBA, it means:

- Domain actions are stored as immutable records
- Records represent *user intent*, not UI state
- Records are append-only
- State is derived by replaying records into projections

Examples of domain records:

- `TransactionCreated`
- `BudgetAssigned`
- `CategoryCreated`
- `CategoryRenamed`
- `AccountCreated`

Each record:
- has a stable ID
- has an explicit timestamp
- is never modified after creation

---

## Derived State & Projections

All user-visible state is derived by applying domain records to **pure projection functions**.

Example (conceptual):

```text
project_month(records, month) -> MonthSnapshot
```

Properties of projections:
- deterministic (same input → same output)
- pure (no side effects)
- testable in isolation
- rebuildable at any time

Projections may be cached for performance, but caches are:
- disposable
- rebuildable
- never authoritative

---

## Consequences

### Positive

- Financial state is always explainable
- Bugs are easier to trace (“which record caused this?”)
- Testing is straightforward (records in → snapshot out)
- Offline-first behavior is naturally supported
- Future sync/conflict resolution is feasible and explicit

### Negative / Trade-offs

- Higher upfront modeling effort
- Requires discipline to avoid “quick mutable shortcuts”
- Projection logic must be carefully designed and tested
- Some UI patterns feel less immediate without mutable state

These trade-offs are **intentional and accepted**.

---

## Architectural Implications

### Domain Layer
- Domain logic must be UI-agnostic
- No direct reads/writes to persistence from domain logic
- Domain functions accept records and return derived state

### Persistence
- Domain records are stored locally as append-only data
- Ordering rules must be explicit and deterministic
- IDs must be stable across devices (UUID/ULID)

### UI
- UI dispatches domain actions (records)
- UI renders derived projections
- UI never mutates domain state directly

---

## Invariants Enforced by This Decision

- No financial value is stored as a mutable “current” field
- All balances are derived, never manually edited
- Replaying all records from scratch must always produce the same result
- Projection output must not depend on external state (time, network, UI)

---

## Alternatives Considered

### Mutable State with Derived Fixups
Rejected.

This approach:
- obscures causality
- introduces order-dependent bugs
- complicates offline usage
- makes future sync fragile

### Full Event Sourcing Framework
Rejected.

This would:
- introduce unnecessary complexity
- obscure intent for a small, focused application
- reduce approachability without meaningful benefit

The chosen approach is a **lightweight, pragmatic middle ground**.

---

## Future Considerations

This decision intentionally enables, but does not mandate:

- deterministic sync reconciliation (Phase 2+)
- conflict resolution via record ordering rules
- time-travel debugging for domain logic
- export/import via raw domain records

All future features must preserve the determinism guarantees established here.

---

## Summary

YASBA’s domain model is built around **immutable, event-like records** and **pure projections**.

This ensures:
- correctness
- explainability
- offline-first integrity
- long-term architectural flexibility

Any change that violates these properties must explicitly revisit this ADR.

---

*This ADR defines the core domain modeling philosophy of YASBA.*
