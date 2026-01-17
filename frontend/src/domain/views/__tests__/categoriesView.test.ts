import { describe, expect, it } from "vitest";
import type { DomainRecord } from "../../types";
import { listCategories } from "../categoriesView";

describe("listCategories", () => {
  it("uses CategoryCreated name by default", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
    ];

    const cats = listCategories(records);
    expect(cats).toEqual([{ categoryId: "cat-groceries", name: "Groceries", archived: false }]);
  });

  it("applies latest CategoryRenamed deterministically", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "CategoryRenamed",
        id: "r1",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Food",
      },
      {
        type: "CategoryRenamed",
        id: "r2",
        createdAt: "2026-01-03T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries & Food",
      },
    ];

    const cats = listCategories(records);
    expect(cats[0].name).toBe("Groceries & Food");
  });

  it("breaks rename ties by id deterministically when createdAt collides", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "CategoryRenamed",
        id: "b",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "B-name",
      },
      {
        type: "CategoryRenamed",
        id: "c",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "C-name",
      },
    ];

    const cats = listCategories(records);
    // id "c" is later than "b"
    expect(cats[0].name).toBe("C-name");
  });

  it("applies latest CategoryArchived deterministically", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "CategoryArchived",
        id: "a1",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-groceries",
        archived: true,
      },
      {
        type: "CategoryArchived",
        id: "a2",
        createdAt: "2026-01-03T00:00:00.000Z",
        categoryId: "cat-groceries",
        archived: false,
      },
    ];

    const cats = listCategories(records);
    expect(cats[0].archived).toBe(false);
  });

  it("returns archived categories (flagged) so history can still resolve names", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "CategoryArchived",
        id: "a1",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-groceries",
        archived: true,
      },
    ];

    const cats = listCategories(records);
    expect(cats).toHaveLength(1);
    expect(cats[0].archived).toBe(true);
    expect(cats[0].name).toBe("Groceries");
  });

  it("applies CategoryReordered snapshot ordering", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
      {
        type: "CategoryCreated",
        id: "c2",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-b",
        name: "B",
      },
      {
        type: "CategoryCreated",
        id: "c3",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-c",
        name: "C",
      },
      {
        type: "CategoryReordered",
        id: "o1",
        createdAt: "2026-01-02T00:00:00.000Z",
        orderedCategoryIds: ["cat-c", "cat-a", "cat-b"],
      },
    ];

    const cats = listCategories(records);
    expect(cats.map((c) => c.categoryId)).toEqual(["cat-c", "cat-a", "cat-b"]);
  });

  it("puts categories missing from the snapshot at the end using stable fallback order", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
      {
        type: "CategoryCreated",
        id: "c2",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-b",
        name: "B",
      },
      {
        type: "CategoryCreated",
        id: "c3",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-c",
        name: "C",
      },
      {
        type: "CategoryCreated",
        id: "c4",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-d",
        name: "D",
      },
      {
        type: "CategoryReordered",
        id: "o1",
        createdAt: "2026-01-02T00:00:00.000Z",
        orderedCategoryIds: ["cat-b", "cat-d"],
      },
    ];

    const cats = listCategories(records);

    // first the snapshot entries in order: b, d
    // then remaining categories by fallback order: A, C
    expect(cats.map((c) => c.categoryId)).toEqual(["cat-b", "cat-d", "cat-a", "cat-c"]);
  });

  it("uses the latest CategoryReordered snapshot deterministically", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
      {
        type: "CategoryCreated",
        id: "c2",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-b",
        name: "B",
      },
      {
        type: "CategoryCreated",
        id: "c3",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-c",
        name: "C",
      },

      {
        type: "CategoryReordered",
        id: "o-old",
        createdAt: "2026-01-02T00:00:00.000Z",
        orderedCategoryIds: ["cat-a", "cat-b", "cat-c"],
      },
      {
        type: "CategoryReordered",
        id: "o-new",
        createdAt: "2026-01-03T00:00:00.000Z",
        orderedCategoryIds: ["cat-c", "cat-b", "cat-a"],
      },
    ];

    const cats = listCategories(records);
    expect(cats.map((c) => c.categoryId)).toEqual(["cat-c", "cat-b", "cat-a"]);
  });

  it("breaks reorder snapshot ties by id deterministically when createdAt collides", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
      {
        type: "CategoryCreated",
        id: "c2",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-b",
        name: "B",
      },
      {
        type: "CategoryCreated",
        id: "c3",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-c",
        name: "C",
      },

      {
        type: "CategoryReordered",
        id: "b",
        createdAt: "2026-01-02T00:00:00.000Z",
        orderedCategoryIds: ["cat-a", "cat-b", "cat-c"],
      },
      {
        type: "CategoryReordered",
        id: "c",
        createdAt: "2026-01-02T00:00:00.000Z",
        orderedCategoryIds: ["cat-c", "cat-b", "cat-a"],
      },
    ];

    const cats = listCategories(records);
    // id "c" is later than "b"
    expect(cats.map((x) => x.categoryId)).toEqual(["cat-c", "cat-b", "cat-a"]);
  });
});
