import type { CategoryId, DomainRecord, IsoDateTime, MonthKey, MoneyCents } from "../types";
import { listCategories } from "../views/categoriesView";
import { monthKeyFromIso } from "../month";

export type CategorySpendingRow = {
  categoryId: CategoryId;
  name: string;
  parentCategoryId?: CategoryId;
  spentCents: MoneyCents; // positive number (absolute value of expenses)
};

type SortKey = { createdAt: IsoDateTime; id: string };

function compareSortKey(a: SortKey, b: SortKey): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

type Replacement = {
  occurredAt: IsoDateTime;
  amountCents: MoneyCents;
  categoryId?: CategoryId;
};

function buildEffectiveTransactionMaps(records: readonly DomainRecord[]) {
  const voided = new Set<string>();
  const latestCorrection = new Map<string, { key: SortKey; replacement: Replacement }>();

  for (const r of records) {
    if (r.type === "TransactionVoided") {
      voided.add(r.transactionId);
      continue;
    }
    if (r.type === "TransactionCorrected") {
      const next = {
        key: { createdAt: r.createdAt, id: r.id },
        replacement: {
          occurredAt: r.replacement.occurredAt,
          amountCents: r.replacement.amountCents,
          categoryId: r.replacement.categoryId,
        },
      };
      const prev = latestCorrection.get(r.transactionId);
      if (!prev || compareSortKey(prev.key, next.key) < 0)
        latestCorrection.set(r.transactionId, next);
    }
  }

  return { voided, latestCorrection };
}

export function projectSpendingByCategory(
  records: readonly DomainRecord[],
  monthKey: MonthKey
): CategorySpendingRow[] {
  const categories = listCategories(records);
  const categoryById = new Map<CategoryId, (typeof categories)[number]>();
  for (const c of categories) categoryById.set(c.categoryId, c);

  const { voided, latestCorrection } = buildEffectiveTransactionMaps(records);

  // Direct spending per category (excluding rollups)
  const directSpent = new Map<CategoryId, MoneyCents>();

  for (const r of records) {
    if (r.type !== "TransactionCreated") continue;
    if (voided.has(r.id)) continue;

    const corr = latestCorrection.get(r.id)?.replacement;

    const occurredAt = corr?.occurredAt ?? r.occurredAt;
    const amountCents = corr?.amountCents ?? r.amountCents;
    const categoryId = corr?.categoryId ?? r.categoryId;

    if (!categoryId) continue; // uncategorized is not "category spending"
    if (monthKeyFromIso(occurredAt) !== monthKey) continue;
    if (amountCents >= 0) continue; // expenses only

    const spent = Math.abs(amountCents) as MoneyCents;
    directSpent.set(categoryId, ((directSpent.get(categoryId) ?? 0) + spent) as MoneyCents);
  }

  // Build initial rows for any category that has direct spending
  const rows = new Map<CategoryId, CategorySpendingRow>();
  for (const [categoryId, spentCents] of directSpent.entries()) {
    const meta = categoryById.get(categoryId);
    rows.set(categoryId, {
      categoryId,
      name: meta?.name ?? "(unknown category)",
      parentCategoryId: meta?.parentCategoryId,
      spentCents,
    });
  }

  // Roll up to parents: parent total = own direct + sum(child totals)
  // We'll compute totals in a second map to avoid mutating row objects during iteration.
  const totalSpent = new Map<CategoryId, MoneyCents>();
  for (const [categoryId, row] of rows.entries()) totalSpent.set(categoryId, row.spentCents);

  // Helper: accumulate a child's total into all ancestors (1-level is enough for MVP, but this supports multiple levels)
  const parentOf = (id: CategoryId): CategoryId | undefined =>
    categoryById.get(id)?.parentCategoryId;

  for (const [categoryId, spentCents] of totalSpent.entries()) {
    let p = parentOf(categoryId);
    while (p) {
      totalSpent.set(p, ((totalSpent.get(p) ?? 0) + spentCents) as MoneyCents);
      p = parentOf(p);
    }
  }

  // Emit rows: include any parent that only has rolled-up spending
  const out: CategorySpendingRow[] = [];
  for (const [categoryId, spentCents] of totalSpent.entries()) {
    const meta = categoryById.get(categoryId);
    out.push({
      categoryId,
      name: meta?.name ?? "(unknown category)",
      parentCategoryId: meta?.parentCategoryId,
      spentCents,
    });
  }

  // Stable ordering: reuse categories view order, then by id
  const orderIndex = new Map<string, number>();
  categories.forEach((c, i) => orderIndex.set(c.categoryId, i));

  out.sort((a, b) => {
    const ia = orderIndex.get(a.categoryId) ?? 1e9;
    const ib = orderIndex.get(b.categoryId) ?? 1e9;
    if (ia !== ib) return ia - ib;
    return a.categoryId < b.categoryId ? -1 : 1;
  });

  return out;
}
