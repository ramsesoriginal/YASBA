import type { CategoryId, DomainRecord, IsoDateTime } from "../types";

export type CategoryView = {
  categoryId: CategoryId;
  name: string;
  archived: boolean;
  parentCategoryId?: CategoryId;
};

type SortKey = { createdAt: IsoDateTime; id: string };

function compareSortKey(a: SortKey, b: SortKey): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Effective categories view (Slice 4):
 * - starts from CategoryCreated
 * - applies latest CategoryRenamed.name (deterministic)
 * - applies latest CategoryArchived.archived (deterministic)
 * - returns all categories (including archived) with a stable fallback ordering
 */
export function listCategories(records: readonly DomainRecord[]): CategoryView[] {
  const created = new Map<CategoryId, { name: string }>();
  const rename = new Map<CategoryId, { key: SortKey; name: string }>();
  const archive = new Map<CategoryId, { key: SortKey; archived: boolean }>();
  const parent = new Map<CategoryId, { key: SortKey; parentCategoryId?: CategoryId }>();

  let latestOrder: { key: SortKey; orderedCategoryIds: string[] } | null = null;

  for (const r of records) {
    if (r.type === "CategoryCreated") {
      created.set(r.categoryId, { name: r.name });
      continue;
    }

    if (r.type === "CategoryRenamed") {
      const prev = rename.get(r.categoryId);
      const next = { key: { createdAt: r.createdAt, id: r.id }, name: r.name };
      if (!prev || compareSortKey(prev.key, next.key) < 0) rename.set(r.categoryId, next);
      continue;
    }

    if (r.type === "CategoryArchived") {
      const prev = archive.get(r.categoryId);
      const next = { key: { createdAt: r.createdAt, id: r.id }, archived: r.archived };
      if (!prev || compareSortKey(prev.key, next.key) < 0) archive.set(r.categoryId, next);
      continue;
    }

    if (r.type === "CategoryReordered") {
      const next = {
        key: { createdAt: r.createdAt, id: r.id },
        orderedCategoryIds: r.orderedCategoryIds,
      };
      if (!latestOrder || compareSortKey(latestOrder.key, next.key) < 0) latestOrder = next;
      continue;
    }

    if (r.type === "CategoryReparented") {
      const next = {
        key: { createdAt: r.createdAt, id: r.id },
        parentCategoryId: r.parentCategoryId,
      };
      const prev = parent.get(r.categoryId);
      if (!prev || compareSortKey(prev.key, next.key) < 0) parent.set(r.categoryId, next);
      continue;
    }
  }

  const out: CategoryView[] = [];
  for (const [categoryId, c] of created.entries()) {
    const name = rename.get(categoryId)?.name ?? c.name;
    const archived = archive.get(categoryId)?.archived ?? false;
    const parentCategoryId = parent.get(categoryId)?.parentCategoryId;
    out.push({ categoryId, name, archived, parentCategoryId });
  }

  if (latestOrder) {
    const pos = new Map<string, number>();
    latestOrder.orderedCategoryIds.forEach((id, i) => pos.set(id, i));

    out.sort((a, b) => {
      const pa = pos.get(a.categoryId);
      const pb = pos.get(b.categoryId);

      const aIn = pa !== undefined;
      const bIn = pb !== undefined;

      if (aIn && bIn) return pa! - pb!;
      if (aIn) return -1;
      if (bIn) return 1;

      // stable fallback for categories not in snapshot
      return a.name === b.name ? (a.categoryId < b.categoryId ? -1 : 1) : a.name < b.name ? -1 : 1;
    });

    return out;
  }

  // fallback order (existing)
  out.sort((a, b) =>
    a.name === b.name ? (a.categoryId < b.categoryId ? -1 : 1) : a.name < b.name ? -1 : 1
  );
  return out;
}
