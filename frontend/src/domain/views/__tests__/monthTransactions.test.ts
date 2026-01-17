import { describe, expect, it } from "vitest";
import type { DomainRecord } from "../../types";
import { listMonthTransactions } from "../monthTransactions";

describe("listMonthTransactions", () => {
  it("filters TransactionCreated by occurredAt month", () => {
    const records: DomainRecord[] = [
      {
        type: "TransactionCreated",
        id: "tx-jan",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCreated",
        id: "tx-dec",
        createdAt: "2026-01-02T00:00:01.000Z",
        occurredAt: "2025-12-31T23:59:59.000Z",
        amountCents: -20_00,
        categoryId: "cat-a",
      },
      {
        type: "CategoryCreated",
        id: "cat-rec",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
    ];

    const jan = listMonthTransactions(records, "2026-01");
    expect(jan).toHaveLength(1);
    expect(jan[0].transactionId).toBe("tx-jan");
  });

  it("orders deterministically by occurredAt desc, then createdAt desc, then id desc", () => {
    const records: DomainRecord[] = [
      // Same occurredAt, different createdAt
      {
        type: "TransactionCreated",
        id: "b",
        createdAt: "2026-01-10T10:00:01.000Z",
        occurredAt: "2026-01-10T10:00:00.000Z",
        amountCents: -1_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCreated",
        id: "a",
        createdAt: "2026-01-10T10:00:00.000Z",
        occurredAt: "2026-01-10T10:00:00.000Z",
        amountCents: -2_00,
        categoryId: "cat-a",
      },
      // Later occurredAt should come first regardless of createdAt
      {
        type: "TransactionCreated",
        id: "later",
        createdAt: "2026-01-09T00:00:00.000Z",
        occurredAt: "2026-01-11T00:00:00.000Z",
        amountCents: -3_00,
        categoryId: "cat-a",
      },
      // Tie occurredAt and createdAt -> id desc
      {
        type: "TransactionCreated",
        id: "z",
        createdAt: "2026-01-12T00:00:00.000Z",
        occurredAt: "2026-01-12T00:00:00.000Z",
        amountCents: -4_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCreated",
        id: "y",
        createdAt: "2026-01-12T00:00:00.000Z",
        occurredAt: "2026-01-12T00:00:00.000Z",
        amountCents: -5_00,
        categoryId: "cat-a",
      },
    ];

    const jan = listMonthTransactions(records, "2026-01");
    const ids = jan.map((t) => t.transactionId);

    // Expected order:
    // occurredAt 2026-01-12: z then y (id desc)
    // occurredAt 2026-01-11: later
    // occurredAt 2026-01-10: b then a (createdAt desc)
    expect(ids).toEqual(["z", "y", "later", "b", "a"]);
  });

  it("excludes voided transactions from the month list", () => {
    const records: DomainRecord[] = [
      {
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionCreated",
        id: "tx-2",
        createdAt: "2026-01-03T00:00:00.000Z",
        occurredAt: "2026-01-03T12:00:00.000Z",
        amountCents: -20_00,
        categoryId: "cat-a",
      },
      {
        type: "TransactionVoided",
        id: "void-2",
        createdAt: "2026-01-03T12:01:00.000Z",
        transactionId: "tx-2",
      },
    ];

    const jan = listMonthTransactions(records, "2026-01");
    const ids = jan.map((t) => t.transactionId);

    expect(ids).toEqual(["tx-1"]);
  });

  it("applies corrections in the month transaction list (original values superseded)", () => {
    const records: DomainRecord[] = [
      {
        type: "TransactionCreated",
        id: "tx-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        occurredAt: "2026-01-02T12:00:00.000Z",
        amountCents: -10_00,
        categoryId: "cat-a",
        payee: "Rewe",
      },
      {
        type: "TransactionCorrected",
        id: "corr-1",
        createdAt: "2026-01-02T12:01:00.000Z",
        transactionId: "tx-1",
        replacement: {
          occurredAt: "2026-01-02T12:00:00.000Z",
          amountCents: -12_00,
          categoryId: "cat-b",
          payee: "Rewe",
          memo: "moved category + amount",
        },
      },
    ];

    const jan = listMonthTransactions(records, "2026-01");
    expect(jan).toHaveLength(1);
    expect(jan[0].transactionId).toBe("tx-1");
    expect(jan[0].amountCents).toBe(-12_00);
    expect(jan[0].categoryId).toBe("cat-b");
    expect(jan[0].memo).toBe("moved category + amount");
  });

  it("does not show transactions moved out of the month by correction", () => {
    const records: DomainRecord[] = [
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
          amountCents: -10_00,
          categoryId: "cat-a",
        },
      },
    ];

    const jan = listMonthTransactions(records, "2026-01");
    const feb = listMonthTransactions(records, "2026-02");

    expect(jan).toHaveLength(0);
    expect(feb).toHaveLength(1);
    expect(feb[0].transactionId).toBe("tx-1");
  });

  it("void wins over correction in the month list", () => {
    const records: DomainRecord[] = [
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
          amountCents: -999_00,
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

    const jan = listMonthTransactions(records, "2026-01");
    expect(jan).toHaveLength(0);
  });
});
