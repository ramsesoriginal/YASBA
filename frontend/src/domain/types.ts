export type RecordId = string;
export type CategoryId = string;

// Must be ISO-8601 UTC strings (e.g. "2026-01-16T12:34:56.000Z")
export type IsoDateTime = string;

// "YYYY-MM"
export type MonthKey = string;

export type MoneyCents = number;

export type DomainRecord =
  | CategoryCreated
  | CategoryRenamed
  | CategoryArchived
  | CategoryReordered
  | TransactionCreated
  | BudgetAssigned
  | TransactionVoided
  | TransactionCorrected
  | CategoryReparented;

export type CategoryCreated = {
  type: "CategoryCreated";
  id: RecordId;
  createdAt: IsoDateTime;

  categoryId: CategoryId;
  name: string;
};

export type TransactionCreated = {
  type: "TransactionCreated";
  id: RecordId;
  createdAt: IsoDateTime;

  occurredAt: IsoDateTime;

  /**
   * Positive for inflow, negative for outflow.
   * In Slice 1:
   * - inflow is expected to have categoryId undefined (Ready to Assign)
   * - outflow is expected to have categoryId defined (spending)
   */
  amountCents: MoneyCents;
  categoryId?: CategoryId;

  payee?: string;
  memo?: string;
};

export type BudgetAssigned = {
  type: "BudgetAssigned";
  id: RecordId;
  createdAt: IsoDateTime;

  monthKey: MonthKey;
  categoryId: CategoryId;

  // positive to assign, negative to unassign
  amountCents: MoneyCents;
};

export type TransactionVoided = {
  type: "TransactionVoided";
  id: RecordId;
  createdAt: IsoDateTime;

  transactionId: RecordId; // references TransactionCreated.id
};

export type TransactionCorrected = {
  type: "TransactionCorrected";
  id: RecordId;
  createdAt: IsoDateTime;

  transactionId: RecordId; // references TransactionCreated.id
  replacement: {
    occurredAt: IsoDateTime;
    amountCents: MoneyCents;
    categoryId?: CategoryId;
    payee?: string;
    memo?: string;
  };
};

export type CategoryRenamed = {
  type: "CategoryRenamed";
  id: RecordId;
  createdAt: IsoDateTime;

  categoryId: CategoryId;
  name: string;
};

export type CategoryArchived = {
  type: "CategoryArchived";
  id: RecordId;
  createdAt: IsoDateTime;

  categoryId: CategoryId;
  archived: boolean;
};

export type CategoryReordered = {
  type: "CategoryReordered";
  id: RecordId;
  createdAt: IsoDateTime;

  orderedCategoryIds: CategoryId[];
};

export type CategoryReparented = {
  type: "CategoryReparented";
  id: RecordId;
  createdAt: IsoDateTime;

  categoryId: CategoryId;
  parentCategoryId?: CategoryId; // undefined = top-level
};
