import type { DomainRecord, MonthKey, TransactionCreated, IsoDateTime } from "../types";
import { monthKeyFromIso } from "../month";

export type MonthTransaction = {
  transactionId: string;
  occurredAt: IsoDateTime;
  createdAt: IsoDateTime;

  amountCents: number;
  categoryId?: string;
  payee?: string;
  memo?: string;
};

function cmpDesc(a: string, b: string): number {
  // ISO strings compare lexicographically for time ordering.
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

function toMonthTransaction(tx: TransactionCreated): MonthTransaction {
  return {
    transactionId: tx.id,
    occurredAt: tx.occurredAt,
    createdAt: tx.createdAt,
    amountCents: tx.amountCents,
    categoryId: tx.categoryId,
    payee: tx.payee,
    memo: tx.memo,
  };
}

/**
 * Slice 3: list raw TransactionCreated items for a month.
 * Later slices will resolve voids/corrections into an "effective transaction" view.
 */
export function listMonthTransactions(
  records: readonly DomainRecord[],
  monthKey: MonthKey
): MonthTransaction[] {
  const items: MonthTransaction[] = [];
  const voidedTxIds = new Set<string>();
  for (const r of records) {
    if (r.type === "TransactionVoided") {
      voidedTxIds.add(r.transactionId);
    }
  }

  for (const r of records) {
    if (r.type !== "TransactionCreated") continue;
    if (voidedTxIds.has(r.id)) continue;
    if (monthKeyFromIso(r.occurredAt) !== monthKey) continue;
    items.push(toMonthTransaction(r));
  }

  // Deterministic display ordering (newest first).
  items.sort((a, b) => {
    const c1 = cmpDesc(a.occurredAt, b.occurredAt);
    if (c1 !== 0) return c1;

    const c2 = cmpDesc(a.createdAt, b.createdAt);
    if (c2 !== 0) return c2;

    // final tie-breaker
    return a.transactionId > b.transactionId ? -1 : a.transactionId < b.transactionId ? 1 : 0;
  });

  return items;
}
