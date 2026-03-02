"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

interface Expense {
  id: number
  month: string | null
  date: string | null
  vendor: string | null
  amount: number | null
  category: string | null
  client: string | null
  clientPays: number | null
  notes: string | null
  gmailLink: string | null
  status: string | null
}

const CATEGORIES = [
  "Biz Subscription",
  "Biz Per-Client",
  "Biz One-Time",
  "Personal",
  "Income",
  "Skipped",
] as const

type Category = (typeof CATEGORIES)[number]

const SUMMARY_BUCKETS: { label: string; match: (c: string | null) => boolean }[] = [
  { label: "Biz Subscription", match: (c) => c === "Biz Subscription" },
  { label: "Biz Per-Client", match: (c) => c === "Biz Per-Client" },
  { label: "Biz One-Time", match: (c) => c === "Biz One-Time" },
  { label: "Personal", match: (c) => c === "Personal" },
  { label: "Income", match: (c) => c === "Income" },
  { label: "Skipped", match: (c) => c === "Skipped" },
  { label: "Uncategorized", match: (c) => !c },
]

const EMPTY_FORM = {
  date: "",
  vendor: "",
  amount: "",
  category: "",
  client: "",
  notes: "",
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses")
      if (!res.ok) throw new Error(`Failed to load expenses (${res.status})`)
      const data = await res.json()
      setExpenses(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const summaries = useMemo(() => {
    return SUMMARY_BUCKETS.map((bucket) => {
      const matching = expenses.filter((e) => bucket.match(e.category))
      return {
        label: bucket.label,
        count: matching.length,
        total: matching.reduce((s, e) => s + (e.amount ?? 0), 0),
      }
    })
  }, [expenses])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (search && !(e.vendor ?? "").toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (filterCategory) {
        if (filterCategory === "Uncategorized") {
          if (e.category) return false
        } else if (e.category !== filterCategory) {
          return false
        }
      }
      return true
    })
  }, [expenses, search, filterCategory])

  async function handleCategoryChange(id: number, category: string) {
    const prev = expenses.find((e) => e.id === id)
    setExpenses((all) =>
      all.map((e) => (e.id === id ? { ...e, category: category || null } : e)),
    )
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, category: category || null }),
      })
      if (!res.ok) throw new Error("Failed to update category")
      const updated = await res.json()
      setExpenses((all) => all.map((e) => (e.id === id ? updated : e)))
    } catch {
      if (prev) setExpenses((all) => all.map((e) => (e.id === id ? prev : e)))
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this expense?")) return
    const prev = [...expenses]
    setExpenses((all) => all.filter((e) => e.id !== id))
    try {
      const res = await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Failed to delete expense")
    } catch {
      setExpenses(prev)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date || null,
          vendor: form.vendor || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          category: form.category || null,
          client: form.client || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to add expense")
      const created = await res.json()
      setExpenses((prev) => [created, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch {
      setError("Failed to add expense. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSkipAllNoCharge() {
    const noCharge = expenses.filter((e) => e.amount == null && !e.category)
    if (noCharge.length === 0) return
    const prev = [...expenses]
    setExpenses((all) =>
      all.map((e) =>
        e.amount == null && !e.category ? { ...e, category: "Skipped" } : e,
      ),
    )
    try {
      await Promise.all(
        noCharge.map((e) =>
          fetch("/api/expenses", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: e.id, category: "Skipped" }),
          }).then((res) => {
            if (!res.ok) throw new Error("Failed")
          }),
        ),
      )
    } catch {
      setExpenses(prev)
      setError("Failed to skip some expenses")
    }
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading expenses...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Expenses
        </h1>
        <div className="flex items-center gap-2">
          {expenses.some((e) => e.amount == null && !e.category) && (
            <button
              onClick={handleSkipAllNoCharge}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Skip All No-Charge ({expenses.filter((e) => e.amount == null && !e.category).length})
            </button>
          )}
          <a
            href="/triage"
            className="rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Triage Mode
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "Add Expense"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {summaries.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">{s.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-50">
              {formatCurrency(s.total)}
            </dd>
            <dd className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {s.count} expense{s.count !== 1 ? "s" : ""}
            </dd>
          </div>
        ))}
      </dl>

      {/* Add Expense Form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
            New Expense
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Vendor
              </label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="Vendor name"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              >
                <option value="">Uncategorized</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Client
              </label>
              <input
                type="text"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Client name"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">
                Notes
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      )}

      {/* Search + Filter */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 sm:max-w-xs"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="Uncategorized">Uncategorized</option>
          <option value="Skipped">Skipped</option>
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} of {expenses.length} expenses
        </span>
      </div>

      {/* Expense Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full caption-bottom border-b border-gray-200 dark:border-gray-800">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Date
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Vendor
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Amount
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Category
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Client
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Notes
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                Status
              </th>
              <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filtered.map((expense) => (
              <tr key={expense.id}>
                <td className="whitespace-nowrap p-4 text-sm text-gray-600 dark:text-gray-400">
                  {expense.date ?? ""}
                </td>
                <td className="whitespace-nowrap p-4 text-sm font-medium text-gray-900 dark:text-gray-50">
                  {expense.vendor ?? ""}
                </td>
                <td className="whitespace-nowrap p-4 text-sm text-gray-600 dark:text-gray-400">
                  {expense.amount != null ? formatCurrency(expense.amount) : ""}
                </td>
                <td className="whitespace-nowrap p-4 text-sm">
                  <select
                    value={expense.category ?? ""}
                    onChange={(e) =>
                      handleCategoryChange(expense.id, e.target.value)
                    }
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
                  >
                    <option value="">Uncategorized</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap p-4 text-sm text-gray-600 dark:text-gray-400">
                  {expense.client ?? ""}
                </td>
                <td className="max-w-xs truncate p-4 text-sm text-gray-600 dark:text-gray-400">
                  {expense.notes ?? ""}
                </td>
                <td className="whitespace-nowrap p-4 text-sm">
                  {expense.status ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800">
                      {expense.status}
                    </span>
                  ) : !expense.category ? (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-800">
                      Needs Category
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap p-4 text-sm">
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No expenses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
