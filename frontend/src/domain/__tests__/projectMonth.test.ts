import { describe, expect, it } from "vitest";
import type { DomainRecord } from "../types";
import { projectMonth } from "../projectors/projectMonth";

describe("projectMonth", () => {
  it("computes readyToAssign from uncategorized inflows and applies categorized expenses to category balances", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "TransactionCreated",
        id: "r-income-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: 100_00,
      },
      {
        type: "TransactionCreated",
        id: "r-exp-1",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -25_50,
        categoryId: "cat-groceries",
        payee: "Supermarket",
      },
    ];

    const snap = projectMonth(records, "2026-01");
    expect(snap.readyToAssignCents).toBe(100_00);

    const groceries = snap.categories.find((c) => c.categoryId === "cat-groceries");
    expect(groceries?.budgetedCents).toBe(0);
    expect(groceries?.rolloverCents).toBe(0);
    expect(groceries).toBeTruthy();
    expect(groceries?.activityCents).toBe(-25_50);
    expect(groceries?.availableCents).toBe(-25_50);
  });

  it("rolls over previous month available into the requested month (activity remains month-local)", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "TransactionCreated",
        id: "r-exp-dec",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2025-12-31T23:59:59.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },
    ];

    const snap = projectMonth(records, "2026-01");
    const groceries = snap.categories.find((c) => c.categoryId === "cat-groceries");

    // Month-local activity ignores December tx
    expect(groceries?.activityCents).toBe(0);

    // But available rolls over previous month available (December = -10.00)
    expect(groceries?.availableCents).toBe(-10_00);
  });

  it("is deterministic under timestamp collisions using id as final tie-breaker", () => {
    const base = {
      type: "CategoryCreated" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      categoryId: "cat-groceries",
      name: "Groceries",
    };

    const recordsA: DomainRecord[] = [
      { ...base, id: "b" },
      {
        type: "TransactionCreated",
        id: "a",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T00:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },
      {
        type: "TransactionCreated",
        id: "b",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T00:00:00.000Z",
        amountCents: -5_00,
        categoryId: "cat-groceries",
      },
    ];

    const recordsB: DomainRecord[] = [recordsA[0], recordsA[2], recordsA[1]];

    const snapA = projectMonth(recordsA, "2026-01");
    const snapB = projectMonth(recordsB, "2026-01");

    expect(snapA).toEqual(snapB);
  });

  it("does not wipe balances if CategoryCreated sorts after a transaction (occurredAt earlier than createdAt)", () => {
    const records: DomainRecord[] = [
      {
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-16T13:50:48.172Z",
        occurredAt: "2026-01-16T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },
      {
        type: "CategoryCreated",
        id: "catrec-1",
        createdAt: "2026-01-16T13:49:47.316Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
    ];

    const snap = projectMonth(records, "2026-01");
    const groceries = snap.categories.find((c) => c.categoryId === "cat-groceries");
    expect(groceries?.name).toBe("Groceries");
    expect(groceries?.activityCents).toBe(-10_00);
    expect(groceries?.availableCents).toBe(-10_00);
  });

  it("adds budget assignments to budgeted and available for the month", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "BudgetAssigned",
        id: "r-bud-1",
        createdAt: "2026-01-01T01:00:00.000Z",
        monthKey: "2026-01",
        categoryId: "cat-groceries",
        amountCents: 50_00,
      },
    ];

    const snap = projectMonth(records, "2026-01");
    expect(snap.readyToAssignCents).toBe(-50_00);

    const groceries = snap.categories.find((c) => c.categoryId === "cat-groceries");
    expect(groceries?.budgetedCents).toBe(50_00);
    expect(groceries?.activityCents).toBe(0);
    expect(groceries?.rolloverCents).toBe(0);
    expect(groceries?.availableCents).toBe(50_00);
  });

  it("reduces ready-to-assign by the sum of budget assignments (income minus budgeted)", () => {
    const records: DomainRecord[] = [
      {
        type: "TransactionCreated",
        id: "r-income-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: 100_00,
      },
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-02T12:01:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "BudgetAssigned",
        id: "r-bud-1",
        createdAt: "2026-01-02T12:02:00.000Z",
        monthKey: "2026-01",
        categoryId: "cat-groceries",
        amountCents: 30_00,
      },
    ];

    const snap = projectMonth(records, "2026-01");
    expect(snap.readyToAssignCents).toBe(70_00);
  });

  it("rolls over previous month available into the next month", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      // January: budget 50, spend 10 => available 40
      {
        type: "BudgetAssigned",
        id: "r-bud-jan",
        createdAt: "2026-01-01T01:00:00.000Z",
        monthKey: "2026-01",
        categoryId: "cat-groceries",
        amountCents: 50_00,
      },
      {
        type: "TransactionCreated",
        id: "r-exp-jan",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },

      // February: no budget/no activity -> should roll over 40
      {
        type: "CategoryCreated",
        id: "r-cat-1b",
        createdAt: "2026-02-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
    ];

    const feb = projectMonth(records, "2026-02");
    const groceries = feb.categories.find((c) => c.categoryId === "cat-groceries");

    expect(groceries?.activityCents).toBe(0);
    expect(groceries?.budgetedCents).toBe(0);
    expect(groceries?.rolloverCents).toBe(40_00);
    expect(groceries?.availableCents).toBe(40_00);
  });

  it("supports multi-month planning: rollover chains when projecting far months directly", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "r-cat-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      // January: budget 50, spend 10 => available 40
      {
        type: "BudgetAssigned",
        id: "r-bud-jan",
        createdAt: "2026-01-01T01:00:00.000Z",
        monthKey: "2026-01",
        categoryId: "cat-groceries",
        amountCents: 50_00,
      },
      {
        type: "TransactionCreated",
        id: "r-exp-jan",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-groceries",
      },

      // Ensure category exists in later months too (name is stable)
      {
        type: "CategoryCreated",
        id: "r-cat-2",
        createdAt: "2026-02-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
      {
        type: "CategoryCreated",
        id: "r-cat-3",
        createdAt: "2026-03-01T00:00:00.000Z",
        categoryId: "cat-groceries",
        name: "Groceries",
      },
    ];

    const mar = projectMonth(records, "2026-03");
    const groceries = mar.categories.find((c) => c.categoryId === "cat-groceries");

    // Jan available 40 -> Feb rollover 40 -> Mar rollover 40 (no activity/budget in Feb/Mar)
    expect(groceries?.rolloverCents).toBe(40_00);
    expect(groceries?.budgetedCents).toBe(0);
    expect(groceries?.activityCents).toBe(0);
    expect(groceries?.availableCents).toBe(40_00);
  });
});
