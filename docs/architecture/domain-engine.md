# Domain engine (Phase 1)

YASBA Phase 1 is **offline-first** and **deterministic**:
- The source of truth is a local **append-only record log** (IndexedDB).
- All user-visible state (month balances, category activity/available, ready-to-assign) is derived by **pure projection** functions.

## Records → Projection

The app stores immutable `DomainRecord` items such as:
- `CategoryCreated`
- `TransactionCreated`
- `BudgetAssigned` (monthKey, categoryId, amountCents)
- `TransactionVoided` (transactionId)
- `TransactionCorrected` (transactionId, replacement payload)

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

## Envelope math (current)

For each month + category:

- `budgetedCents` = sum(BudgetAssigned.amountCents for monthKey+categoryId)
- `activityCents` = sum(TransactionCreated.amountCents for monthKey+categoryId)
- `rolloverCents` = previous month `availableCents` for that category
- `availableCents` = rolloverCents + budgetedCents + activityCents

For the month:

- `readyToAssignCents` = sum(uncategorized inflow transactions in month) − sum(all BudgetAssigned in month)

## Effective transaction resolution

Transactions are append-only. To derive the effective transaction stream:

1) If a transaction has a `TransactionVoided`, it is ignored.
2) Else if it has one or more `TransactionCorrected`, the latest correction wins.
3) Else the original `TransactionCreated` is applied.

Ordering / “latest” is determined by the global deterministic ordering rule (ADR-0004).
Semantics are defined in ADR-0005.

## References

- ADR-0001 Offline-first
- ADR-0002 Deterministic domain model
- ADR-0003 IndexedDB schema and record storage
- ADR-0004 Record IDs and ordering strategy
- ADR-0005 Append-only Transaction Corrections (Void + Corrected)
- ADR 0006 Category Lifecycle, Hierarchy, and Ordering
