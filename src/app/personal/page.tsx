"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncomeRow {
  id: number
  source: string
  monthly: number | null
  perPaycheck: number | null
  notes: string | null
}

interface ExpenseRow {
  id: number
  name: string
  monthly: number | null
  dueDate: string | null
  notes: string | null
}

interface SavingsRow {
  id: number
  name: string
  monthlyTarget: number | null
  perPaycheck: number | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined): string {
  if (n == null) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ""))
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// EditableCell
// ---------------------------------------------------------------------------

function EditableCell({
  value,
  onSave,
  type = "text",
}: {
  value: string
  onSave: (v: string) => void
  type?: "text" | "number"
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setEditing(true)}
      >
        {value || "\u00A0"}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      type={type}
      step="any"
      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") {
          setDraft(value)
          setEditing(false)
        }
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PersonalBudgetPage() {
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [savings, setSavings] = useState<SavingsRow[]>([])
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [incRes, expRes, savRes] = await Promise.all([
        fetch("/api/personal-income"),
        fetch("/api/personal-expenses"),
        fetch("/api/savings-goals"),
      ])
      if (!incRes.ok || !expRes.ok || !savRes.ok) throw new Error("Failed to load data")
      setIncome(await incRes.json())
      setExpenses(await expRes.json())
      setSavings(await savRes.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budget data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Income handlers ----
  async function updateIncome(id: number, field: string, raw: string) {
    const val = ["monthly", "perPaycheck"].includes(field) ? parseNum(raw) : raw
    const prev = income.find((r) => r.id === id)
    setIncome((all) => all.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
    try {
      const res = await fetch("/api/personal-income", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: val }),
      })
      if (!res.ok) throw new Error("Update failed")
    } catch {
      if (prev) setIncome((all) => all.map((r) => (r.id === id ? prev : r)))
    }
  }

  async function addIncome() {
    try {
      const res = await fetch("/api/personal-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "New Income",
          monthly: 0,
          perPaycheck: 0,
          notes: "",
        }),
      })
      if (!res.ok) throw new Error("Failed to add income")
      const row: IncomeRow = await res.json()
      setIncome((prev) => [...prev, row])
    } catch {
      setError("Failed to add income row")
    }
  }

  async function deleteIncome(id: number) {
    const prev = income
    setIncome((all) => all.filter((r) => r.id !== id))
    try {
      const res = await fetch("/api/personal-income", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
    } catch {
      setIncome(prev)
    }
  }

  // ---- Expense handlers ----
  async function updateExpense(id: number, field: string, raw: string) {
    const val = field === "monthly" ? parseNum(raw) : raw
    const prev = expenses.find((r) => r.id === id)
    setExpenses((all) => all.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
    try {
      const res = await fetch("/api/personal-expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: val }),
      })
      if (!res.ok) throw new Error("Update failed")
    } catch {
      if (prev) setExpenses((all) => all.map((r) => (r.id === id ? prev : r)))
    }
  }

  async function addExpense() {
    try {
      const res = await fetch("/api/personal-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Expense",
          monthly: 0,
          dueDate: "",
          notes: "",
        }),
      })
      if (!res.ok) throw new Error("Failed to add expense")
      const row: ExpenseRow = await res.json()
      setExpenses((prev) => [...prev, row])
    } catch {
      setError("Failed to add expense row")
    }
  }

  async function deleteExpense(id: number) {
    const prev = expenses
    setExpenses((all) => all.filter((r) => r.id !== id))
    try {
      const res = await fetch("/api/personal-expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
    } catch {
      setExpenses(prev)
    }
  }

  // ---- Savings handlers ----
  async function updateSavings(id: number, field: string, raw: string) {
    const val = ["monthlyTarget", "perPaycheck"].includes(field)
      ? parseNum(raw)
      : raw
    const prev = savings.find((r) => r.id === id)
    setSavings((all) => all.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
    try {
      const res = await fetch("/api/savings-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: val }),
      })
      if (!res.ok) throw new Error("Update failed")
    } catch {
      if (prev) setSavings((all) => all.map((r) => (r.id === id ? prev : r)))
    }
  }

  async function addSavings() {
    try {
      const res = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Goal",
          monthlyTarget: 0,
          perPaycheck: 0,
          notes: "",
        }),
      })
      if (!res.ok) throw new Error("Failed to add savings goal")
      const row: SavingsRow = await res.json()
      setSavings((prev) => [...prev, row])
    } catch {
      setError("Failed to add savings goal")
    }
  }

  async function deleteSavings(id: number) {
    const prev = savings
    setSavings((all) => all.filter((r) => r.id !== id))
    try {
      const res = await fetch("/api/savings-goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
    } catch {
      setSavings(prev)
    }
  }

  // ---- Totals ----
  const totalIncome = income.reduce((s, r) => s + (r.monthly ?? 0), 0)
  const totalExpenses = expenses.reduce((s, r) => s + (r.monthly ?? 0), 0)
  const totalSavings = savings.reduce(
    (s, r) => s + (r.monthlyTarget ?? 0),
    0,
  )
  const remaining = totalIncome - totalExpenses - totalSavings

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Loading budget...
        </p>
      </div>
    )
  }

  const thClass =
    "px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50"
  const tdClass = "p-4 text-sm text-gray-600 dark:text-gray-400"
  const thAction = "px-4 py-3.5 text-right text-sm font-semibold"

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Personal Budget
      </h1>

      {error && (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* INCOME */}
      {/* ----------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Income
          </h2>
          <button
            onClick={addIncome}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className={thClass}>Source</th>
                <th className={thClass}>Monthly</th>
                <th className={thClass}>Per Paycheck</th>
                <th className={thClass}>Notes</th>
                <th className={thAction}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {income.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.source}
                      onSave={(v) => updateIncome(row.id, "source", v)}
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.monthly != null ? String(row.monthly) : ""}
                      onSave={(v) => updateIncome(row.id, "monthly", v)}
                      type="number"
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={
                        row.perPaycheck != null ? String(row.perPaycheck) : ""
                      }
                      onSave={(v) => updateIncome(row.id, "perPaycheck", v)}
                      type="number"
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.notes ?? ""}
                      onSave={(v) => updateIncome(row.id, "notes", v)}
                    />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteIncome(row.id)}
                      className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-900">
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  TOTAL INCOME
                </td>
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {fmt(totalIncome)}
                </td>
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={tdClass} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* FIXED EXPENSES */}
      {/* ----------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Fixed Expenses
          </h2>
          <button
            onClick={addExpense}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className={thClass}>Expense</th>
                <th className={thClass}>Monthly</th>
                <th className={thClass}>Due Date</th>
                <th className={thClass}>Notes</th>
                <th className={thAction}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {expenses.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.name}
                      onSave={(v) => updateExpense(row.id, "name", v)}
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.monthly != null ? String(row.monthly) : ""}
                      onSave={(v) => updateExpense(row.id, "monthly", v)}
                      type="number"
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.dueDate ?? ""}
                      onSave={(v) => updateExpense(row.id, "dueDate", v)}
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.notes ?? ""}
                      onSave={(v) => updateExpense(row.id, "notes", v)}
                    />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteExpense(row.id)}
                      className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-900">
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  TOTAL EXPENSES
                </td>
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {fmt(totalExpenses)}
                </td>
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={tdClass} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SAVINGS GOALS */}
      {/* ----------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Savings Goals
          </h2>
          <button
            onClick={addSavings}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className={thClass}>Goal</th>
                <th className={thClass}>Monthly Target</th>
                <th className={thClass}>Per Paycheck</th>
                <th className={thClass}>Notes</th>
                <th className={thAction}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {savings.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.name}
                      onSave={(v) => updateSavings(row.id, "name", v)}
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={
                        row.monthlyTarget != null
                          ? String(row.monthlyTarget)
                          : ""
                      }
                      onSave={(v) =>
                        updateSavings(row.id, "monthlyTarget", v)
                      }
                      type="number"
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={
                        row.perPaycheck != null ? String(row.perPaycheck) : ""
                      }
                      onSave={(v) => updateSavings(row.id, "perPaycheck", v)}
                      type="number"
                    />
                  </td>
                  <td className={tdClass}>
                    <EditableCell
                      value={row.notes ?? ""}
                      onSave={(v) => updateSavings(row.id, "notes", v)}
                    />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteSavings(row.id)}
                      className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-900">
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  TOTAL SAVINGS
                </td>
                <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {fmt(totalSavings)}
                </td>
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={tdClass} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SUMMARY */}
      {/* ----------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Monthly Summary
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Total Income
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-50">
                {fmt(totalIncome)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Total Expenses
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-50">
                - {fmt(totalExpenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Total Savings
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-50">
                - {fmt(totalSavings)}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-2 dark:border-gray-800">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  REMAINING
                </span>
                <span
                  className={`text-lg font-bold ${
                    remaining >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {fmt(remaining)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
