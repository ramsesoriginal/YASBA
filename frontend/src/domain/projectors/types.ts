import type { CategoryId, MonthKey, MoneyCents } from "../types";

export type CategorySnapshot = {
  categoryId: CategoryId;
  name: string;

  rolloverCents: MoneyCents; // carried from previous month available
  budgetedCents: MoneyCents; // sum of BudgetAssigned for this month
  activityCents: MoneyCents; // sum of tx amounts for this month (usually negative)
  availableCents: MoneyCents; // rollover + budgeted + activity
};

export type MonthSnapshot = {
  monthKey: MonthKey;

  // ReadyToAssign = uncategorized inflows - sum(budget assignments in month)
  readyToAssignCents: MoneyCents;

  categories: CategorySnapshot[];
};
