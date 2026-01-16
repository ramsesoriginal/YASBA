import type { CategoryId, MonthKey, MoneyCents } from "../types";

export type CategorySnapshot = {
  categoryId: CategoryId;
  name: string;

  activityCents: MoneyCents; // sum of tx amounts for this month (usually negative)
  availableCents: MoneyCents; // running balance (Slice 1: starts at 0)
};

export type MonthSnapshot = {
  monthKey: MonthKey;

  readyToAssignCents: MoneyCents;

  categories: CategorySnapshot[];
};
