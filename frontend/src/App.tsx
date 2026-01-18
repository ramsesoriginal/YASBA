import { useEffect, useMemo, useState } from "react";
import type { DomainRecord } from "./domain/types";
import { projectMonth } from "./domain/projectors/projectMonth";
import { appendRecord, listAllRecords } from "./storage";
import {
  cmdAddExpense,
  cmdAddIncome,
  cmdCreateCategory,
  cmdAssignBudget,
  cmdVoidTransaction,
  cmdCorrectTransaction,
  cmdRenameCategory,
  cmdArchiveCategory,
  cmdReorderCategories,
  cmdReparentCategory,
} from "./app/commands";
import { currentMonthKey, isoFromDateInput, todayIsoDate } from "./app/month";
import { formatCents } from "./app/moneyFormat";
import { listMonthTransactions } from "./domain/views/monthTransactions";
import { listCategories } from "./domain/views/categoriesView";
import { projectSpendingByCategory } from "./domain/projectors/projectSpendingByCategory";

type UiError = { message: string };

export default function App() {
  const [records, setRecords] = useState<DomainRecord[]>([]);
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<UiError | null>(null);

  // Forms
  const [newCategoryName, setNewCategoryName] = useState("");
  const [incomeDate, setIncomeDate] = useState(todayIsoDate());
  const [incomeAmountEuros, setIncomeAmountEuros] = useState("100.00");
  const [expenseDate, setExpenseDate] = useState(todayIsoDate());
  const [expenseAmountEuros, setExpenseAmountEuros] = useState("10.00");
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>("");
  const [expensePayee, setExpensePayee] = useState("");
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const [newSubcatParentId, setNewSubcatParentId] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState("");

  type EditDraft = {
    occurredDate: string; // YYYY-MM-DD
    amount: string; // euros string
    categoryId: string; // "" means Ready to Assign
    payee: string;
    memo: string;
  };

  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await listAllRecords();
        setRecords(all);
      } catch (e) {
        setErr({ message: e instanceof Error ? e.message : "Failed to load records" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const snapshot = useMemo(() => projectMonth(records, monthKey), [records, monthKey]);

  const categoriesView = useMemo(() => listCategories(records), [records]);

  const activeCategoriesView = useMemo(
    () => categoriesView.filter((c) => !c.archived),
    [categoriesView]
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesView) map.set(c.categoryId, c.name);
    return map;
  }, [categoriesView]);

  const categoryLabelById = useMemo(() => {
    const byId = new Map(categoriesView.map((c) => [c.categoryId, c]));
    const label = new Map<string, string>();

    for (const c of categoriesView) {
      const parent = c.parentCategoryId ? byId.get(c.parentCategoryId) : undefined;
      const text = parent ? `${parent.name} › ${c.name}` : c.name;
      label.set(c.categoryId, text);
    }
    return label;
  }, [categoriesView]);

  const monthTx = useMemo(() => listMonthTransactions(records, monthKey), [records, monthKey]);

  // Default expense category selection to first available
  useEffect(() => {
    if (!expenseCategoryId && activeCategoriesView.length > 0) {
      setExpenseCategoryId(activeCategoriesView[0].categoryId);
    }
  }, [expenseCategoryId, activeCategoriesView]);

  const monthCategoryRows = useMemo(() => {
    const snapById = new Map(snapshot.categories.map((s) => [s.categoryId, s]));

    return categoriesView
      .map((meta) => {
        const s = snapById.get(meta.categoryId);

        // if a category exists in the view but isn't in snapshot (should be rare),
        // fall back to zeroed money fields
        return {
          categoryId: meta.categoryId,
          name: meta.name,
          archived: meta.archived,
          budgetedCents: s?.budgetedCents ?? 0,
          activityCents: s?.activityCents ?? 0,
          availableCents: s?.availableCents ?? 0,
        };
      })
      .filter((r) => showArchivedCategories || !r.archived);
  }, [snapshot.categories, categoriesView, showArchivedCategories]);

  type UiCatRow = {
    categoryId: string;
    name: string;
    archived: boolean;
    parentCategoryId?: string;
    budgetedCents: number;
    activityCents: number;
    availableCents: number;
    depth: 0 | 1;
  };

  const groupedMonthCategoryRows = useMemo(() => {
    // Join amounts (snapshot) with category meta
    const metaById = new Map(categoriesView.map((c) => [c.categoryId, c]));

    const joined = monthCategoryRows
      .map((s) => {
        const meta = metaById.get(s.categoryId);
        return {
          categoryId: s.categoryId,
          name: meta?.name ?? s.name,
          archived: meta?.archived ?? false,
          parentCategoryId: meta?.parentCategoryId,
          budgetedCents: s.budgetedCents,
          activityCents: s.activityCents,
          availableCents: s.availableCents,
        };
      })
      .filter((r) => showArchivedCategories || !r.archived);

    const parents = joined.filter((c) => !c.parentCategoryId);
    const childrenByParent = new Map<string, typeof joined>();

    for (const c of joined) {
      if (!c.parentCategoryId) continue;
      const arr = childrenByParent.get(c.parentCategoryId) ?? [];
      arr.push(c);
      childrenByParent.set(c.parentCategoryId, arr);
    }

    // Preserve the existing global order by iterating categoriesView order
    const orderIndex = new Map<string, number>();
    categoriesView.forEach((c, i) => orderIndex.set(c.categoryId, i));
    const byGlobalOrder = (a: { categoryId: string }, b: { categoryId: string }) =>
      (orderIndex.get(a.categoryId) ?? 1e9) - (orderIndex.get(b.categoryId) ?? 1e9);

    parents.sort(byGlobalOrder);
    for (const [pid, kids] of childrenByParent) {
      kids.sort(byGlobalOrder);
      childrenByParent.set(pid, kids);
    }

    const out: UiCatRow[] = [];
    for (const p of parents) {
      out.push({ ...p, depth: 0 });
      const kids = childrenByParent.get(p.categoryId) ?? [];
      for (const k of kids) out.push({ ...k, depth: 1 });
    }

    // Orphans (parent missing/filtered) show as top-level to avoid disappearing
    const knownIds = new Set(out.map((x) => x.categoryId));
    const orphans = joined.filter((c) => !knownIds.has(c.categoryId));
    orphans.sort(byGlobalOrder);
    for (const o of orphans) out.push({ ...o, depth: 0 });

    return out;
  }, [categoriesView, monthCategoryRows, showArchivedCategories]);

  const categoryOptions = useMemo(
    () => activeCategoriesView.map((c) => ({ id: c.categoryId, name: c.name })),
    [activeCategoriesView]
  );

  const spendingRows = useMemo(() => {
    const rows = projectSpendingByCategory(records, monthKey);
    // hide zero-spend (shouldn’t exist, but defensive)
    return rows.filter((r) => r.spentCents > 0);
  }, [records, monthKey]);

  const spendingTotalCents = useMemo(
    () => spendingRows.reduce((sum, r) => sum + r.spentCents, 0),
    [spendingRows]
  );

  async function handleAppend(record: DomainRecord) {
    setErr(null);
    try {
      await appendRecord(record);
      setRecords((prev) => [...prev, record]);
    } catch (e) {
      setErr({ message: e instanceof Error ? e.message : "Failed to persist record" });
    }
  }

  function eurosToCents(input: string): number {
    const normalized = input.replace(",", ".").trim();
    if (!normalized) throw new Error("Amount is required");
    const n = Number(normalized);
    if (!Number.isFinite(n)) throw new Error("Amount must be a number");
    return Math.round(n * 100);
  }

  function centsToEurosString(cents: number): string {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const euros = Math.floor(abs / 100);
    const rem = abs % 100;
    return `${sign}${euros}.${String(rem).padStart(2, "0")}`;
  }

  function getBudgetInput(categoryId: string): string {
    return budgetInputs[categoryId] ?? "";
  }
  function setBudgetInput(categoryId: string, value: string) {
    setBudgetInputs((prev) => ({ ...prev, [categoryId]: value }));
  }

  function getRenameDraft(categoryId: string, fallback: string): string {
    return renameDrafts[categoryId] ?? fallback;
  }
  function setRenameDraft(categoryId: string, value: string) {
    setRenameDrafts((prev) => ({ ...prev, [categoryId]: value }));
  }

  function beginAddSubcategory(parentCategoryId: string) {
    setNewSubcatParentId(parentCategoryId);
    setNewSubcatName("");
  }

  function cancelAddSubcategory() {
    setNewSubcatParentId(null);
    setNewSubcatName("");
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  function startEdit(t: {
    occurredAt: string;
    amountCents: number;
    categoryId?: string;
    payee?: string;
    memo?: string;
    transactionId: string;
  }) {
    setEditingTxId(t.transactionId);
    setEditDraft({
      occurredDate: t.occurredAt.slice(0, 10),
      amount: centsToEurosString(t.amountCents),
      categoryId: t.categoryId ?? "",
      payee: t.payee ?? "",
      memo: t.memo ?? "",
    });
  }

  function cancelEdit() {
    setEditingTxId(null);
    setEditDraft(null);
  }

  function move<T>(arr: readonly T[], from: number, to: number): T[] {
    const a = arr.slice();
    const [item] = a.splice(from, 1);
    a.splice(to, 0, item);
    return a;
  }

  function reorderCategory(categoryId: string, dir: "up" | "down") {
    // Canonical current order across all categories (already snapshot-resolved)
    const allIds = categoriesView.map((c) => c.categoryId);

    const activeIds = categoriesView.filter((c) => !c.archived).map((c) => c.categoryId);
    const archivedIds = categoriesView.filter((c) => c.archived).map((c) => c.categoryId);

    const movableIds = showArchivedCategories ? allIds : activeIds;

    const idx = movableIds.indexOf(categoryId);
    if (idx === -1) return;

    const nextIdx = dir === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= movableIds.length) return;

    const moved = move(movableIds, idx, nextIdx);

    // If archived are hidden, keep them appended in existing order.
    const nextAll = showArchivedCategories ? moved : [...moved, ...archivedIds];

    try {
      const r = cmdReorderCategories(nextAll);
      void handleAppend(r);
    } catch (e) {
      setErr({ message: e instanceof Error ? e.message : "Failed to reorder categories" });
    }
  }

  return (
    <div
      style={{ maxWidth: 960, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}>
        <h1 style={{ margin: 0 }}>YASBA</h1>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Month</span>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            aria-label="Select month"
          />
        </label>
      </header>

      {err && (
        <div role="alert" style={{ marginTop: 12, padding: 12, border: "1px solid #c00" }}>
          {err.message}
        </div>
      )}

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Overview</h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Ready to Assign</div>
            <div style={{ fontSize: 24 }}>{formatCents(snapshot.readyToAssignCents)}</div>
          </div>
        </div>
      </section>

      <main style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 16 }}>
        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Categories</h2>

          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showArchivedCategories}
              onChange={(e) => setShowArchivedCategories(e.target.checked)}
            />
            Show archived categories
          </label>

          {monthCategoryRows.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No categories yet. Add one below.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Name
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Budgeted
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Activity
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Available
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Assign
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedMonthCategoryRows.map((c) => {
                  const movableIds = showArchivedCategories
                    ? categoriesView.map((x) => x.categoryId)
                    : categoriesView.filter((x) => !x.archived).map((x) => x.categoryId);

                  const idx = movableIds.indexOf(c.categoryId);
                  const isFirst = idx <= 0;
                  const isLast = idx === movableIds.length - 1;

                  return (
                    <tr key={c.categoryId}>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ paddingLeft: c.depth === 1 ? 18 : 0 }}>
                            {c.depth === 1 ? (
                              <span style={{ opacity: 0.7, marginRight: 6 }}>↳</span>
                            ) : null}
                            {c.name}
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              try {
                                const r = cmdRenameCategory({
                                  categoryId: c.categoryId,
                                  name: getRenameDraft(c.categoryId, c.name),
                                });
                                void handleAppend(r);
                              } catch (e2) {
                                setErr({
                                  message:
                                    e2 instanceof Error ? e2.message : "Failed to rename category",
                                });
                              }
                            }}
                            style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              value={getRenameDraft(c.categoryId, c.name)}
                              onChange={(e) => setRenameDraft(c.categoryId, e.target.value)}
                              aria-label={`Rename ${c.name}`}
                              style={{ width: 220 }}
                            />
                            <button type="submit">Rename</button>

                            <button
                              type="button"
                              onClick={() => {
                                const ok = window.confirm(
                                  c.archived ? "Unarchive this category?" : "Archive this category?"
                                );
                                if (!ok) return;
                                try {
                                  const r = cmdArchiveCategory({
                                    categoryId: c.categoryId,
                                    archived: !c.archived,
                                  });
                                  void handleAppend(r);
                                } catch (e2) {
                                  setErr({
                                    message:
                                      e2 instanceof Error
                                        ? e2.message
                                        : "Failed to archive category",
                                  });
                                }
                              }}>
                              {c.archived ? "Unarchive" : "Archive"}
                            </button>
                          </form>

                          {c.depth === 0 && (
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                marginTop: 6,
                              }}>
                              {newSubcatParentId === c.categoryId ? (
                                <>
                                  <input
                                    value={newSubcatName}
                                    onChange={(e) => setNewSubcatName(e.target.value)}
                                    placeholder="New subcategory name"
                                    aria-label={`New subcategory under ${c.name}`}
                                    style={{ width: 220 }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try {
                                        const created = cmdCreateCategory(newSubcatName);
                                        void handleAppend(created);

                                        const reparent = cmdReparentCategory({
                                          categoryId: created.categoryId,
                                          parentCategoryId: c.categoryId,
                                        });
                                        void handleAppend(reparent);

                                        cancelAddSubcategory();
                                      } catch (e2) {
                                        setErr({
                                          message:
                                            e2 instanceof Error
                                              ? e2.message
                                              : "Failed to create subcategory",
                                        });
                                      }
                                    }}>
                                    Add
                                  </button>
                                  <button type="button" onClick={cancelAddSubcategory}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => beginAddSubcategory(c.categoryId)}>
                                  + Subcategory
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => reorderCategory(c.categoryId, "up")}
                            disabled={isFirst}
                            aria-label={`Move ${c.name} up`}>
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() => reorderCategory(c.categoryId, "down")}
                            disabled={isLast}
                            aria-label={`Move ${c.name} down`}>
                            ↓
                          </button>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "8px 4px",
                          borderBottom: "1px solid #f3f3f3",
                          textAlign: "right",
                        }}>
                        {formatCents(c.budgetedCents)}
                      </td>
                      <td
                        style={{
                          padding: "8px 4px",
                          borderBottom: "1px solid #f3f3f3",
                          textAlign: "right",
                        }}>
                        {formatCents(c.activityCents)}
                      </td>
                      <td
                        style={{
                          padding: "8px 4px",
                          borderBottom: "1px solid #f3f3f3",
                          textAlign: "right",
                        }}>
                        {formatCents(c.availableCents)}
                      </td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            try {
                              const cents = eurosToCents(getBudgetInput(c.categoryId));
                              const r = cmdAssignBudget({
                                monthKey,
                                categoryId: c.categoryId,
                                amountCents: cents,
                              });
                              void handleAppend(r);
                              setBudgetInput(c.categoryId, "");
                            } catch (e2) {
                              setErr({
                                message: e2 instanceof Error ? e2.message : "Invalid budget amount",
                              });
                            }
                          }}
                          style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            value={getBudgetInput(c.categoryId)}
                            onChange={(e) => setBudgetInput(c.categoryId, e.target.value)}
                            placeholder="€"
                            aria-label={`Assign budget for ${c.name}`}
                            style={{ width: 110 }}
                          />
                          <button type="submit">Assign</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <form
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const r = cmdCreateCategory(newCategoryName);
              void handleAppend(r);
              setNewCategoryName("");
            }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 100 }}>New category</span>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Groceries"
              />
            </label>
            <button type="submit">Add</button>
          </form>
        </section>

        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Add income</h2>
          <form
            style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}
            onSubmit={(e) => {
              e.preventDefault();
              const cents = eurosToCents(incomeAmountEuros);
              const r = cmdAddIncome({
                occurredAtIso: isoFromDateInput(incomeDate),
                amountCents: cents,
              });
              void handleAppend(r);
            }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Date</div>
              <input
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Amount (€)</div>
              <input
                value={incomeAmountEuros}
                onChange={(e) => setIncomeAmountEuros(e.target.value)}
              />
            </label>
            <button type="submit">Add income</button>
          </form>
        </section>

        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Add expense</h2>
          <form
            style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}
            onSubmit={(e) => {
              e.preventDefault();
              const cents = eurosToCents(expenseAmountEuros);
              const r = cmdAddExpense({
                occurredAtIso: isoFromDateInput(expenseDate),
                amountCents: cents,
                categoryId: expenseCategoryId,
                payee: expensePayee,
              });
              void handleAppend(r);
              setExpensePayee("");
            }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Date</div>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Amount (€)</div>
              <input
                value={expenseAmountEuros}
                onChange={(e) => setExpenseAmountEuros(e.target.value)}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Category</div>
              <select
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}>
                {activeCategoriesView.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {categoryLabelById.get(c.categoryId) ?? c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Payee (optional)</div>
              <input
                value={expensePayee}
                onChange={(e) => setExpensePayee(e.target.value)}
                placeholder="e.g. Rewe"
              />
            </label>
            <button type="submit" disabled={!expenseCategoryId}>
              Add expense
            </button>
          </form>
        </section>

        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Transactions</h2>

          {monthTx.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No transactions in this month yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Payee / Memo
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Category
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Amount
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                      padding: "8px 4px",
                    }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthTx.map((t) => {
                  const categoryName = t.categoryId
                    ? (categoryNameById.get(t.categoryId) ?? "(unknown category)")
                    : "Ready to Assign";
                  const payeeMemo = t.payee?.trim()
                    ? t.memo?.trim()
                      ? `${t.payee} — ${t.memo}`
                      : t.payee
                    : t.memo?.trim()
                      ? t.memo
                      : "";

                  return (
                    <>
                      <tr key={t.transactionId}>
                        <td
                          style={{
                            padding: "8px 4px",
                            borderBottom: "1px solid #f3f3f3",
                            whiteSpace: "nowrap",
                          }}>
                          {t.occurredAt.slice(0, 10)}
                        </td>
                        <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                          {payeeMemo || <span style={{ opacity: 0.6 }}>(no details)</span>}
                        </td>
                        <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                          {categoryName}
                        </td>
                        <td
                          style={{
                            padding: "8px 4px",
                            borderBottom: "1px solid #f3f3f3",
                            textAlign: "right",
                          }}>
                          {formatCents(t.amountCents)}
                        </td>
                        <td
                          style={{
                            padding: "8px 4px",
                            borderBottom: "1px solid #f3f3f3",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}>
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            style={{ marginRight: 8 }}>
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                "Void this transaction? This cannot be undone (yet)."
                              );
                              if (!ok) return;
                              try {
                                const r = cmdVoidTransaction(t.transactionId);
                                void handleAppend(r);
                              } catch (e) {
                                setErr({
                                  message:
                                    e instanceof Error ? e.message : "Failed to void transaction",
                                });
                              }
                            }}>
                            Void
                          </button>
                        </td>
                      </tr>
                      {editingTxId === t.transactionId && editDraft && (
                        <tr key={`${t.transactionId}-edit`}>
                          <td
                            colSpan={5}
                            style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                try {
                                  const occurredAt = `${editDraft.occurredDate}T12:00:00.000Z`;
                                  const amountCents = eurosToCents(editDraft.amount);
                                  const categoryId = editDraft.categoryId || undefined;

                                  const r = cmdCorrectTransaction({
                                    transactionId: t.transactionId,
                                    occurredAt,
                                    amountCents,
                                    categoryId,
                                    payee: editDraft.payee,
                                    memo: editDraft.memo,
                                  });

                                  void handleAppend(r);
                                  cancelEdit();
                                } catch (e2) {
                                  setErr({
                                    message:
                                      e2 instanceof Error ? e2.message : "Invalid edit values",
                                  });
                                }
                              }}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "140px 140px 1fr 1fr auto",
                                gap: 8,
                                alignItems: "center",
                              }}>
                              <input
                                type="date"
                                value={editDraft.occurredDate}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, occurredDate: e.target.value })
                                }
                                aria-label="Transaction date"
                              />

                              <input
                                value={editDraft.amount}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, amount: e.target.value })
                                }
                                aria-label="Transaction amount"
                                placeholder="e.g. -10.00"
                              />

                              <select
                                value={editDraft.categoryId}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, categoryId: e.target.value })
                                }
                                aria-label="Transaction category">
                                <option value="">Ready to Assign</option>
                                {categoryOptions.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>

                              <input
                                value={editDraft.payee}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, payee: e.target.value })
                                }
                                aria-label="Payee"
                                placeholder="Payee"
                              />

                              <input
                                value={editDraft.memo}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, memo: e.target.value })
                                }
                                aria-label="Memo"
                                placeholder="Memo"
                              />

                              <div
                                style={{
                                  gridColumn: "1 / -1",
                                  display: "flex",
                                  gap: 8,
                                  justifyContent: "flex-end",
                                }}>
                                <button type="submit">Save</button>
                                <button type="button" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: "16px 0 8px" }}>Reports</h2>

          <h3 style={{ margin: "12px 0 8px" }}>Spending by category</h3>

          {spendingRows.length === 0 ? (
            <p style={{ opacity: 0.75 }}>No categorized spending in this month.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 4px",
                      borderBottom: "1px solid #eee",
                    }}>
                    Category
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 4px",
                      borderBottom: "1px solid #eee",
                    }}>
                    Spent
                  </th>
                </tr>
              </thead>
              <tbody>
                {spendingRows.map((r) => (
                  <tr key={r.categoryId}>
                    <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                      {categoryLabelById.get(r.categoryId) ?? r.name}
                    </td>
                    <td
                      style={{
                        padding: "8px 4px",
                        borderBottom: "1px solid #f3f3f3",
                        textAlign: "right",
                      }}>
                      {formatCents(r.spentCents)}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td style={{ padding: "10px 4px", fontWeight: 600 }}>Total</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 600 }}>
                    {formatCents(spendingTotalCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </main>

      <footer style={{ marginTop: 24, opacity: 0.7, fontSize: 12 }}>Phase 1 Slice 4.</footer>
    </div>
  );
}
