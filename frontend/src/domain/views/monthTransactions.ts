import type { DomainRecord, MonthKey, IsoDateTime, MoneyCents } from "../types";
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

type Replacement = {
  occurredAt: IsoDateTime;
  amountCents: MoneyCents;
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

  const latestCorrectionByTxId = new Map<string, Replacement>();
  for (const r of records) {
    if (r.type === "TransactionCorrected") {
      latestCorrectionByTxId.set(r.transactionId, r.replacement);
    }
  }

  for (const r of records) {
    if (r.type !== "TransactionCreated") continue;
    if (voidedTxIds.has(r.id)) continue;

    const corr = latestCorrectionByTxId.get(r.id);

    const occurredAt = corr?.occurredAt ?? r.occurredAt;
    const amountCents = corr?.amountCents ?? r.amountCents;
    const categoryId = corr?.categoryId ?? r.categoryId;
    const payee = corr?.payee ?? r.payee;
    const memo = corr?.memo ?? r.memo;

    if (monthKeyFromIso(occurredAt) !== monthKey) continue;

    items.push({
      transactionId: r.id,
      occurredAt,
      createdAt: r.createdAt, // keep original createdAt for deterministic tie-breaks (or use corr createdAt later if you prefer)
      amountCents,
      categoryId,
      payee,
      memo,
    });
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
