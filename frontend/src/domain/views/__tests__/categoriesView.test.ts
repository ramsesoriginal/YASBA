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
});
