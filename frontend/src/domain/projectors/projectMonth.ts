import type { DomainRecord, IsoDateTime, MonthKey, MoneyCents } from "../types";
import { assertMoneyCents } from "../money";
import { monthKeyFromIso } from "../month";
import type { MonthSnapshot, CategorySnapshot } from "./types";

type SortKey = {
  primaryTime: IsoDateTime;
  createdAt: IsoDateTime;
  id: string;
};

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

  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function prevMonthKey(monthKey: MonthKey): MonthKey {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error(`Invalid MonthKey: ${monthKey}`);
  }

  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const mm = String(prevM).padStart(2, "0");
  return `${prevY}-${mm}`;
}

type WorkingCategory = {
  categoryId: string;
  name: string;

  rolloverCents: MoneyCents;
  budgetedCents: MoneyCents;
  activityCents: MoneyCents;
  availableCents: MoneyCents;
};

function ensureCategory(
  map: Map<string, WorkingCategory>,
  categoryId: string,
  nameFallback: string
): WorkingCategory {
  const existing = map.get(categoryId);
  if (existing) return existing;

  const created: WorkingCategory = {
    categoryId,
    name: nameFallback,
    rolloverCents: 0,
    budgetedCents: 0,
    activityCents: 0,
    availableCents: 0,
  };
  map.set(categoryId, created);
  return created;
}

function minMonthKeyFromRecords(records: readonly DomainRecord[]): MonthKey | null {
  let min: MonthKey | null = null;

  for (const r of records) {
    let mk: MonthKey | null = null;

    if (r.type === "BudgetAssigned") mk = r.monthKey;
    if (r.type === "TransactionCreated") mk = monthKeyFromIso(r.occurredAt);

    if (!mk) continue;
    if (!min || mk < min) min = mk;
  }

  return min;
}

/**
 * Month-local pass (no rollover):
 * - collects categories (names)
 * - sums budgeted/activity for the target month
 * - computes readyToAssign = inflowUncategorized - budgetedTotal
 */
function projectMonthBaseFromOrdered(
  ordered: readonly DomainRecord[],
  monthKey: MonthKey
): { readyToAssignCents: MoneyCents; categoriesById: Map<string, WorkingCategory> } {
  const categoriesById = new Map<string, WorkingCategory>();

  let inflowUncategorized: MoneyCents = 0;
  let budgetedTotal: MoneyCents = 0;

  for (const r of ordered) {
    if (r.type === "CategoryCreated") {
      const existing = categoriesById.get(r.categoryId);
      categoriesById.set(r.categoryId, {
        categoryId: r.categoryId,
        name: r.name,
        rolloverCents: existing?.rolloverCents ?? 0,
        budgetedCents: existing?.budgetedCents ?? 0,
        activityCents: existing?.activityCents ?? 0,
        availableCents: existing?.availableCents ?? 0,
      });
      continue;
    }

    if (r.type === "BudgetAssigned") {
      if (r.monthKey !== monthKey) continue;
      assertMoneyCents(r.amountCents);

      const cat = ensureCategory(categoriesById, r.categoryId, "(uncategorized category)");
      cat.budgetedCents += r.amountCents;
      budgetedTotal += r.amountCents;
      continue;
    }

    // TransactionCreated
    assertMoneyCents(r.amountCents);
    if (monthKeyFromIso(r.occurredAt) !== monthKey) continue;

    const amount = r.amountCents;

    // Uncategorized inflow contributes to ReadyToAssign
    if (!r.categoryId) {
      if (amount > 0) inflowUncategorized += amount;
      continue;
    }

    const cat = ensureCategory(categoriesById, r.categoryId, "(uncategorized category)");
    cat.activityCents += amount;
  }

  return { readyToAssignCents: inflowUncategorized - budgetedTotal, categoriesById };
}

/**
 * Rollover-aware month projection with memoization:
 * - available = rollover(prev.available) + budgeted + activity
 */
export function projectMonth(records: readonly DomainRecord[], monthKey: MonthKey): MonthSnapshot {
  const ordered = [...records].sort((a, b) => compareSortKey(sortKey(a), sortKey(b)));
  const minMonth = minMonthKeyFromRecords(ordered);

  const memo = new Map<MonthKey, MonthSnapshot>();

  const project = (mk: MonthKey): MonthSnapshot => {
    const cached = memo.get(mk);
    if (cached) return cached;

    const base = projectMonthBaseFromOrdered(ordered, mk);

    // Base case: no earlier month in records -> rollover treated as 0
    let rolloverSource = new Map<string, MoneyCents>();
    if (minMonth && mk > minMonth) {
      const prev = project(prevMonthKey(mk));
      rolloverSource = new Map(prev.categories.map((c) => [c.categoryId, c.availableCents]));
    }

    for (const cat of base.categoriesById.values()) {
      cat.rolloverCents = rolloverSource.get(cat.categoryId) ?? 0;
      cat.availableCents = cat.rolloverCents + cat.budgetedCents + cat.activityCents;
    }

    const categories: CategorySnapshot[] = [...base.categoriesById.values()].map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      rolloverCents: c.rolloverCents,
      budgetedCents: c.budgetedCents,
      activityCents: c.activityCents,
      availableCents: c.availableCents,
    }));

    categories.sort((a, b) =>
      a.name === b.name ? (a.categoryId < b.categoryId ? -1 : 1) : a.name < b.name ? -1 : 1
    );

    const snap: MonthSnapshot = {
      monthKey: mk,
      readyToAssignCents: base.readyToAssignCents,
      categories,
    };
    memo.set(mk, snap);
    return snap;
  };

  return project(monthKey);
}
