import { describe, expect, it } from "vitest";
import type { DomainRecord } from "../../types";
import { projectSpendingByCategory } from "../projectSpendingByCategory";

describe("projectSpendingByCategory", () => {
  it("counts only expenses (amountCents < 0) and ignores income", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "TransactionCreated",
        id: "tx-income",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: 100_00,
        categoryId: "cat-groceries",
        payee: "Salary",
      },
      {
        type: "TransactionCreated",
        id: "tx-exp",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -12_34,
        categoryId: "cat-groceries",
        payee: "Rewe",
      },
    ];

    const rows = projectSpendingByCategory(records, "2026-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].categoryId).toBe("cat-groceries");
    expect(rows[0].spentCents).toBe(12_34);
  });

  it("ignores transactions outside the requested month (by occurredAt)", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "TransactionCreated",
        id: "tx-jan",
        createdAt: "2026-01-10T00:00:00.000Z",
        occurredAt: "2026-01-10T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },
      {
        type: "TransactionCreated",
        id: "tx-feb",
        createdAt: "2026-02-10T00:00:00.000Z",
        occurredAt: "2026-02-10T12:00:00.000Z",
        amountCents: -20_00,
        categoryId: "cat-groceries",
      },
    ];

    const jan = projectSpendingByCategory(records, "2026-01");
    expect(jan).toHaveLength(1);
    expect(jan[0].spentCents).toBe(10_00);

    const feb = projectSpendingByCategory(records, "2026-02");
    expect(feb).toHaveLength(1);
    expect(feb[0].spentCents).toBe(20_00);
  });

  it("applies TransactionCorrected (amount and category), and can move spending across months", () => {
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
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-31T10:00:00.000Z",
        occurredAt: "2026-01-31T09:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCorrected",
        id: "corr-1",
        createdAt: "2026-01-31T10:01:00.000Z",
        transactionId: "tx-1",
        replacement: {
          occurredAt: "2026-02-01T09:00:00.000Z",
          amountCents: -12_00,
          categoryId: "cat-b",
          payee: "x",
          memo: "y",
        },
      },
    ];

    const jan = projectSpendingByCategory(records, "2026-01");
    expect(jan).toHaveLength(0);

    const feb = projectSpendingByCategory(records, "2026-02");
    expect(feb).toHaveLength(1);
    expect(feb[0].categoryId).toBe("cat-b");
    expect(feb[0].spentCents).toBe(12_00);
  });

  it("void wins: TransactionVoided removes spending even if corrected", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
      {
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCorrected",
        id: "corr-1",
        createdAt: "2026-01-02T12:01:00.000Z",
        transactionId: "tx-1",
        replacement: {
          occurredAt: "2026-01-02T12:00:00.000Z",
          amountCents: -99_00,
          categoryId: "cat-a",
        },
      },
      {
        type: "TransactionVoided",
        id: "void-1",
        createdAt: "2026-01-02T12:02:00.000Z",
        transactionId: "tx-1",
      },
    ];

    const rows = projectSpendingByCategory(records, "2026-01");
    expect(rows).toHaveLength(0);
  });

  it("rolls up subcategory spending into parent totals", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-parent",
        name: "Groceries",
      },
      {
        type: "CategoryCreated",
        id: "c2",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-child",
        name: "Snacks",
      },
      {
        type: "CategoryReparented",
        id: "p1",
        createdAt: "2026-01-01T01:00:00.000Z",
        categoryId: "cat-child",
        parentCategoryId: "cat-parent",
      },
      {
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-child",
      },
      {
        type: "TransactionCreated",
        id: "tx-2",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -5_00,
        categoryId: "cat-parent",
      },
    ];

    const rows = projectSpendingByCategory(records, "2026-01");

    const parent = rows.find((r) => r.categoryId === "cat-parent");
    const child = rows.find((r) => r.categoryId === "cat-child");

    expect(child?.spentCents).toBe(10_00);
    // parent includes own direct (5) + child rollup (10) = 15
    expect(parent?.spentCents).toBe(15_00);
  });
});
