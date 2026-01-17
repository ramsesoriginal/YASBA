import type {
  CategoryCreated,
  TransactionCreated,
  CategoryId,
  MoneyCents,
  IsoDateTime,
  BudgetAssigned,
  MonthKey,
  TransactionVoided,
} from "../domain/types";

function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export function cmdCreateCategory(name: string, categoryId?: CategoryId): CategoryCreated {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");

  return {
    type: "CategoryCreated",
    id: newId(),
    createdAt: nowIso(),
    categoryId: categoryId ?? newId(),
    name: trimmed,
  };
}

export function cmdAddIncome(params: {
  occurredAtIso: IsoDateTime;
  amountCents: MoneyCents; // positive
  payee?: string;
  memo?: string;
}): TransactionCreated {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw new Error("Income amount must be a positive integer (cents)");
  }

  return {
    type: "TransactionCreated",
    id: newId(),
    createdAt: nowIso(),
    occurredAt: params.occurredAtIso,
    amountCents: params.amountCents,
    payee: params.payee?.trim() || undefined,
    memo: params.memo?.trim() || undefined,
  };
}

export function cmdAddExpense(params: {
  occurredAtIso: IsoDateTime;
  amountCents: MoneyCents; // positive input, we store negative
  categoryId: CategoryId;
  payee?: string;
  memo?: string;
}): TransactionCreated {
  if (!params.categoryId) throw new Error("categoryId is required");
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw new Error("Expense amount must be a positive integer (cents)");
  }

  return {
    type: "TransactionCreated",
    id: newId(),
    createdAt: nowIso(),
    occurredAt: params.occurredAtIso,
    amountCents: -params.amountCents,
    categoryId: params.categoryId,
    payee: params.payee?.trim() || undefined,
    memo: params.memo?.trim() || undefined,
  };
}

export function cmdAssignBudget(params: {
  monthKey: MonthKey;
  categoryId: string;
  amountCents: number; // positive input, can be negative if you want to allow "unbudget"
}): BudgetAssigned {
  if (!params.monthKey) throw new Error("monthKey is required");
  if (!params.categoryId) throw new Error("categoryId is required");
  if (!Number.isInteger(params.amountCents)) throw new Error("Budget amount must be integer cents");
  if (params.amountCents === 0) throw new Error("Budget amount must be non-zero");

  return {
    type: "BudgetAssigned",
    id: newId(),
    createdAt: nowIso(),
    monthKey: params.monthKey,
    categoryId: params.categoryId,
    amountCents: params.amountCents,
  };
}

export function cmdVoidTransaction(transactionId: string): TransactionVoided {
  const trimmed = transactionId.trim();
  if (!trimmed) throw new Error("transactionId is required");

  return {
    type: "TransactionVoided",
    id: newId(),
    createdAt: nowIso(),
    transactionId: trimmed,
  };
}
