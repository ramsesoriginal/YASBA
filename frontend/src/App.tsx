import { useEffect, useMemo, useState } from "react";
import type { DomainRecord } from "./domain/types";
import { projectMonth } from "./domain/projectors/projectMonth";
import { appendRecord, listAllRecords } from "./storage";
import { cmdAddExpense, cmdAddIncome, cmdCreateCategory } from "./app/commands";
import { currentMonthKey, isoFromDateInput, todayIsoDate } from "./app/month";
import { formatCents } from "./app/moneyFormat";

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

  // Default expense category selection to first available
  useEffect(() => {
    if (!expenseCategoryId && snapshot.categories.length > 0) {
      setExpenseCategoryId(snapshot.categories[0].categoryId);
    }
  }, [expenseCategoryId, snapshot.categories]);

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

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

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

          {snapshot.categories.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {snapshot.categories.map((c) => (
                  <tr key={c.categoryId}>
                    <td style={{ padding: "8px 4px", borderBottom: "1px solid #f3f3f3" }}>
                      {c.name}
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
                  </tr>
                ))}
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
                {snapshot.categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
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
      </main>

      <footer style={{ marginTop: 24, opacity: 0.7, fontSize: 12 }}>
        Phase 1 Slice 1: offline-only records → deterministic projection.
      </footer>
    </div>
  );
}
