# Domain engine (Phase 1)

YASBA Phase 1 is **offline-first** and **deterministic**:
- The source of truth is a local **append-only record log** (IndexedDB).
- All user-visible state (month balances, category activity/available, ready-to-assign) is derived by **pure projection** functions.

## Records → Projection

The app stores immutable `DomainRecord` items such as:
- `CategoryCreated`
- `TransactionCreated`

To render a month, the UI:
1) loads all records from IndexedDB
2) calls `projectMonth(records, monthKey)`
3) renders the returned `MonthSnapshot`

The domain code must be:
- pure (no time, random, IO)
- deterministic (stable ordering + stable tie-breakers)
- persistence/UI agnostic

## Deterministic ordering

For projection we use an explicit, stable ordering:
1) `occurredAt` (for transactions; otherwise `createdAt`)
2) `createdAt`
3) `id` (lexicographic tie-breaker)

This prevents nondeterminism when timestamps collide.

## References

- ADR-0001 Offline-first
- ADR-0002 Deterministic domain model
- ADR-0003 IndexedDB schema and record storage
