# ADR 0001: Offline-First as a Non-Negotiable Constraint

- **Status:** Accepted
- **Date:** 2026-01-15
- **Decision Makers:** Project Maintainer
- **Context Phase:** Phase 0 → Phase 1

---

## Context

YASBA is a personal budgeting application intended for **daily use**, including situations with unreliable or unavailable network connectivity.

Budgeting is a **stateful, cognitive task** that users often perform:
- on the go
- under mild stress
- with limited attention
- without guaranteed internet access

Any failure to access or manipulate data due to network conditions would significantly degrade trust in the application.

Additionally, the project aims to demonstrate **engineering maturity** through:
- deterministic domain logic
- explicit state transitions
- clear architectural boundaries
- testable, explainable behavior

These goals strongly influence data ownership and system architecture.

---

## Decision

**YASBA is offline-first by design.**

This means:

- Local storage is the **source of truth**
- All core functionality must work **without network access**
- Network connectivity is treated as an **optional enhancement**, not a prerequisite
- The application must remain usable and correct in **airplane mode**

This constraint applies to:
- data modeling
- persistence
- UI behavior
- architectural decisions

It is **non-negotiable** for Phase 1.

---

## Definition of Offline-First (for YASBA)

Offline-first does **not** mean “has an offline mode”.

For YASBA, it means:

- All reads and writes operate on **local data**
- User actions never block on network calls
- The UI never reflects “pending” financial state due to sync
- Calculations are derived solely from locally available data
- Network features (sync, sharing) are **additive**, not foundational

---

## Consequences

### Positive

- Predictable, low-latency UX
- Deterministic calculations independent of network timing
- Clear separation between domain logic and infrastructure
- Simplified testing (no network in core tests)
- Higher user trust (“my data is always there”)

### Negative / Trade-offs

- Increased responsibility on the client for data integrity
- More careful modeling of persistence and migrations
- Sync logic (Phase 2+) becomes more complex
- Cannot rely on server-side validation as a primary safeguard

These trade-offs are **accepted intentionally**.

---

## Architectural Implications

### Persistence
- IndexedDB (or equivalent) is the primary persistence layer
- Local data schemas must be versioned and migratable
- Data export/import must be possible without a backend

### Domain Logic
- Core budgeting logic must be:
  - pure
  - deterministic
  - replayable from local records
- No implicit recalculation triggered by UI events

### UI
- UI reflects **local state only**
- Network indicators must never block user actions
- Sync status (later) is informational, not authoritative

---

## Future Considerations (Phase 2+)

When sync is introduced:

- Local data remains authoritative
- Sync operates as:
  - reconciliation
  - backup
  - collaboration aid
- Conflicts must be resolved deterministically
- Offline usage must never be degraded to “read-only”

This ADR intentionally **does not prescribe** a specific sync strategy, but constrains all future strategies to respect offline-first invariants.

---

## Invariants Enforced by This Decision

- Budget calculations must be reproducible from local data alone
- The app must remain fully functional with networking disabled
- No user action may depend on server availability
- Backend outages must not prevent local usage

---

## Alternatives Considered

### Online-First with Offline Support
Rejected.

This would:
- complicate core logic
- introduce implicit failure modes
- degrade trust under poor connectivity

### Server-Authoritative Model
Rejected.

This conflicts with:
- offline usage requirements
- deterministic local behavior
- user ownership of financial data

---

## Summary

Offline-first is not a feature of YASBA — it is a **foundational constraint**.

All future architectural decisions must be compatible with this principle, or explicitly revisit this ADR.

---

*This ADR establishes the baseline for all subsequent architectural decisions.*
