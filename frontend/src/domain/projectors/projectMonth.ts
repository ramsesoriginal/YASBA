import type { DomainRecord, IsoDateTime, MonthKey, MoneyCents } from "../types";
import { assertMoneyCents } from "../money";
import { monthKeyFromIso } from "../month";
import type { MonthSnapshot, CategorySnapshot } from "./types";

type SortKey = {
  // Prefer occurredAt for tx ordering; else fall back to createdAt.
  primaryTime: IsoDateTime;
  createdAt: IsoDateTime;
  id: string;
};

/**
 * Deterministic record ordering:
 * 1) occurredAt (if present) else createdAt
 * 2) createdAt
 * 3) id (lexicographic)
 */
function sortKey(r: DomainRecord): SortKey {
  if (r.type === "TransactionCreated") {
    return { primaryTime: r.occurredAt, createdAt: r.createdAt, id: r.id };
  }
  return { primaryTime: r.createdAt, createdAt: r.createdAt, id: r.id };
}

function compareSortKey(a: SortKey, b: SortKey): number {
  if (a.primaryTime < b.primaryTime) return -1;
  if (a.primaryTime > b.primaryTime) return 1;

  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;

  // Final deterministic tie-breaker
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function projectMonth(records: readonly DomainRecord[], monthKey: MonthKey): MonthSnapshot {
  const ordered = [...records].sort((a, b) => compareSortKey(sortKey(a), sortKey(b)));

  const categoriesById = new Map<
    string,
    { categoryId: string; name: string; activityCents: MoneyCents; availableCents: MoneyCents }
  >();

  let readyToAssignCents: MoneyCents = 0;

  for (const r of ordered) {
    if (r.type === "CategoryCreated") {
      // Preserve balances if we already saw transactions referencing this categoryId.
      const existing = categoriesById.get(r.categoryId);
      categoriesById.set(r.categoryId, {
        categoryId: r.categoryId,
        name: r.name,
        activityCents: existing?.activityCents ?? 0,
        availableCents: existing?.availableCents ?? 0,
      });
      continue;
    }

    // TransactionCreated
    assertMoneyCents(r.amountCents);

    // Only apply transactions whose occurredAt month matches
    if (monthKeyFromIso(r.occurredAt) !== monthKey) continue;

    const amount = r.amountCents;

    // Slice 1 semantics:
    // - uncategorized inflow => Ready to Assign
    // - categorized tx affects category activity/available
    if (!r.categoryId) {
      if (amount > 0) {
        readyToAssignCents += amount;
      } else {
        // Uncategorized outflow isn't modeled in Slice 1; ignore for now.
        // (UI should prevent it.)
      }
      continue;
    }

    // Ensure category exists in snapshot even if tx references unknown id
    const existing =
      categoriesById.get(r.categoryId) ??
      ({
        categoryId: r.categoryId,
        name: "(uncategorized category)",
        activityCents: 0,
        availableCents: 0,
      } as const);

    const next = {
      ...existing,
      activityCents: existing.activityCents + amount,
      availableCents: existing.availableCents + amount,
    };

    categoriesById.set(r.categoryId, next);
  }

  const categories: CategorySnapshot[] = [...categoriesById.values()].map((c) => ({
    categoryId: c.categoryId,
    name: c.name,
    activityCents: c.activityCents,
    availableCents: c.availableCents,
  }));

  // Stable category ordering for UI: by name then id.
  categories.sort((a, b) =>
    a.name === b.name ? (a.categoryId < b.categoryId ? -1 : 1) : a.name < b.name ? -1 : 1
  );

  return { monthKey, readyToAssignCents, categories };
}
