"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"

interface RevenueItem {
  id: number
  section: string
  name: string
  febPaid: number | null
  febExpected: number | null
  marExpected: number | null
  marBase: number | null
  notes: string | null
}

interface ExpenseItem {
  id: number
  name: string
  type: string
  febPaid: number | null
  febExpected: number | null
  marExpected: number | null
  marBase: number | null
  notes: string | null
}

type NumericField = "febPaid" | "febExpected" | "marExpected" | "marBase"
const numericFields: NumericField[] = [
  "febPaid",
  "febExpected",
  "marExpected",
  "marBase",
]

const REVENUE_SECTIONS = [
  "Recurring Hosting",
  "Recurring Projects",
  "One-Time Projects",
] as const

const EXPENSE_SECTIONS = [
  { label: "Recurring Expenses", type: "recurring" },
  { label: "One-Time Expenses", type: "one-time" },
] as const

function formatCurrency(value: number | null): string {
  if (value == null) return ""
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

interface HasNumericFields {
  febPaid: number | null
  febExpected: number | null
  marExpected: number | null
  marBase: number | null
}

function sumField(items: HasNumericFields[], field: NumericField): number {
  return items.reduce((s, item) => s + (item[field] ?? 0), 0)
}

// ── Editable Cell ──────────────────────────────────────────────────────────
function EditableCell({
  value,
  onSave,
  isNumeric = true,
}: {
  value: string | number | null
  onSave: (value: string) => void
  isNumeric?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const display = isNumeric
    ? formatCurrency(value as number | null)
    : ((value as string) ?? "")

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    const current = isNumeric ? String(value ?? "") : String(value ?? "")
    if (trimmed !== current) {
      onSave(trimmed)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        step="any"
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
      />
    )
  }

  return (
    <span
      className="block cursor-pointer rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
      onClick={() => {
        setDraft(value != null ? String(value) : "")
        setEditing(true)
      }}
    >
      {display || <span className="text-gray-300 dark:text-gray-600">--</span>}
    </span>
  )
}

// ── Chevron Icon ───────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

// ── Column Headers ─────────────────────────────────────────────────────────
const COLUMNS = ["Name", "Feb Paid", "Feb Expected", "Mar Expected", "Mar Base/Mo", "Notes"]

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-gray-200 dark:border-gray-800">
        {COLUMNS.map((col) => (
          <th
            key={col}
            className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ── Subtotal Row ───────────────────────────────────────────────────────────
function SubtotalRow({
  label,
  items,
}: {
  label: string
  items: HasNumericFields[]
}) {
  return (
    <tr className="font-semibold bg-gray-50 dark:bg-gray-900">
      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-50">
        {label}
      </td>
      {numericFields.map((f) => (
        <td
          key={f}
          className="px-3 py-2 text-sm text-gray-900 dark:text-gray-50"
        >
          {formatCurrency(sumField(items, f))}
        </td>
      ))}
      <td />
    </tr>
  )
}

// ── Total Row ──────────────────────────────────────────────────────────────
function TotalRow({
  label,
  items,
  highlight,
}: {
  label: string
  items: HasNumericFields[]
  highlight?: boolean
}) {
  const cls = highlight
    ? "text-emerald-600 dark:text-emerald-400 font-bold"
    : "font-bold text-gray-900 dark:text-gray-50"

  return (
    <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <td className={`px-3 py-2 text-sm ${cls}`}>{label}</td>
      {numericFields.map((f) => (
        <td key={f} className={`px-3 py-2 text-sm ${cls}`}>
          {formatCurrency(sumField(items, f))}
        </td>
      ))}
      <td />
    </tr>
  )
}

// ── Net Income Row ─────────────────────────────────────────────────────────
function NetIncomeRow({
  revenue,
  expenses,
}: {
  revenue: RevenueItem[]
  expenses: ExpenseItem[]
}) {
  return (
    <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
      <td className="px-3 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
        NET INCOME
      </td>
      {numericFields.map((f) => (
        <td
          key={f}
          className="px-3 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400"
        >
          {formatCurrency(sumField(revenue, f) - sumField(expenses, f))}
        </td>
      ))}
      <td />
    </tr>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function BusinessPLPage() {
  const [revenue, setRevenue] = useState<RevenueItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data
  useEffect(() => {
    async function load() {
      try {
        const [revRes, expRes] = await Promise.all([
          fetch("/api/revenue"),
          fetch("/api/business-expenses"),
        ])
        if (!revRes.ok || !expRes.ok) throw new Error("Failed to load data")
        setRevenue(await revRes.json())
        setExpenses(await expRes.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Save handlers
  const saveRevenue = useCallback(
    async (id: number, field: string, value: string) => {
      const isNumeric = numericFields.includes(field as NumericField)
      let parsed: string | number | null = value
      if (isNumeric) {
        if (value === "") {
          parsed = null
        } else {
          const num = parseFloat(value)
          parsed = isNaN(num) ? null : num
        }
      }
      const prev = revenue.find((r) => r.id === id)
      setRevenue((all) => all.map((r) => (r.id === id ? { ...r, [field]: parsed } : r)))
      try {
        const res = await fetch("/api/revenue", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, [field]: parsed }),
        })
        if (!res.ok) throw new Error("Save failed")
        const updated = await res.json()
        setRevenue((all) => all.map((r) => (r.id === id ? updated : r)))
      } catch {
        if (prev) setRevenue((all) => all.map((r) => (r.id === id ? prev : r)))
      }
    },
    [revenue],
  )

  const saveExpense = useCallback(
    async (id: number, field: string, value: string) => {
      const isNumeric = numericFields.includes(field as NumericField)
      let parsed: string | number | null = value
      if (isNumeric) {
        if (value === "") {
          parsed = null
        } else {
          const num = parseFloat(value)
          parsed = isNaN(num) ? null : num
        }
      }
      const prev = expenses.find((e) => e.id === id)
      setExpenses((all) => all.map((e) => (e.id === id ? { ...e, [field]: parsed } : e)))
      try {
        const res = await fetch("/api/business-expenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, [field]: parsed }),
        })
        if (!res.ok) throw new Error("Save failed")
        const updated = await res.json()
        setExpenses((all) => all.map((e) => (e.id === id ? updated : e)))
      } catch {
        if (prev) setExpenses((all) => all.map((e) => (e.id === id ? prev : e)))
      }
    },
    [expenses],
  )

  // Add row handlers
  const addRevenueRow = async (section: string) => {
    try {
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, name: "New Item" }),
      })
      if (!res.ok) throw new Error("Failed to add row")
      const created = await res.json()
      setRevenue((prev) => [...prev, created])
    } catch {
      setError("Failed to add revenue row")
    }
  }

  const addExpenseRow = async (type: string) => {
    try {
      const res = await fetch("/api/business-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: "New Expense" }),
      })
      if (!res.ok) throw new Error("Failed to add row")
      const created = await res.json()
      setExpenses((prev) => [...prev, created])
    } catch {
      setError("Failed to add expense row")
    }
  }

  // Render rows for a set of items
  const renderRows = (
    items: (RevenueItem | ExpenseItem)[],
    saveFn: (id: number, field: string, value: string) => void,
  ) =>
    items.map((item) => (
      <tr
        key={item.id}
        className="border-b border-gray-200 dark:border-gray-800"
      >
        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          <EditableCell
            value={item.name}
            isNumeric={false}
            onSave={(v) => saveFn(item.id, "name", v)}
          />
        </td>
        {numericFields.map((f) => (
          <td
            key={f}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <EditableCell
              value={item[f]}
              onSave={(v) => saveFn(item.id, f, v)}
            />
          </td>
        ))}
        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          <EditableCell
            value={item.notes}
            isNumeric={false}
            onSave={(v) => saveFn(item.id, "notes", v)}
          />
        </td>
      </tr>
    ))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        GoodCraft - Business P&L
      </h1>

      {error && (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <TableHeader />
          <tbody>
            {/* ── Revenue ───────────────────────────────────────────── */}
            <tr>
              <td
                colSpan={6}
                className="px-3 pt-6 pb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
              >
                Revenue
              </td>
            </tr>

            {REVENUE_SECTIONS.map((section) => {
              const items = revenue.filter((r) => r.section === section)
              const open = openSections[section] !== false // default open
              return (
                <Fragment key={section}>
                  <tr>
                    <td colSpan={6}>
                      <button
                        onClick={() => toggle(section)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <Chevron open={open} />
                        {section}
                        <span className="ml-auto text-xs text-gray-400">
                          {formatCurrency(sumField(items, "marExpected"))} expected
                        </span>
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <>
                      {renderRows(items, saveRevenue)}
                      <SubtotalRow
                        label={`${section} Subtotal`}
                        items={items}
                      />
                      <tr>
                        <td colSpan={6} className="px-3 py-1">
                          <button
                            onClick={() => addRevenueRow(section)}
                            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            + Add row
                          </button>
                        </td>
                      </tr>
                    </>
                  )}
                </Fragment>
              )
            })}

            <TotalRow label="TOTAL INCOME" items={revenue} />

            {/* ── Expenses ──────────────────────────────────────────── */}
            <tr>
              <td
                colSpan={6}
                className="px-3 pt-8 pb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
              >
                Expenses
              </td>
            </tr>

            {EXPENSE_SECTIONS.map(({ label, type }) => {
              const items = expenses.filter((e) => e.type === type)
              const open = openSections[label] !== false
              return (
                <Fragment key={label}>
                  <tr>
                    <td colSpan={6}>
                      <button
                        onClick={() => toggle(label)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <Chevron open={open} />
                        {label}
                        <span className="ml-auto text-xs text-gray-400">
                          {formatCurrency(sumField(items, "marExpected"))} expected
                        </span>
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <>
                      {renderRows(items, saveExpense)}
                      <SubtotalRow label={`${label} Subtotal`} items={items} />
                      <tr>
                        <td colSpan={6} className="px-3 py-1">
                          <button
                            onClick={() => addExpenseRow(type)}
                            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            + Add row
                          </button>
                        </td>
                      </tr>
                    </>
                  )}
                </Fragment>
              )
            })}

            <TotalRow label="TOTAL EXPENSES" items={expenses} />

            {/* ── Net Income ────────────────────────────────────────── */}
            <NetIncomeRow revenue={revenue} expenses={expenses} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
