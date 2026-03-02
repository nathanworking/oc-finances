"use client"

import { useEffect, useState, useRef } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface Debt {
  id: number
  account: string
  balance: number
  apr: number
  minPayment: number
  interestPerMonth: number | null
  lastUpdated: string | null
  priority: number | null
}

interface EditingCell {
  id: number
  field: "balance" | "apr" | "minPayment"
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" })

const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`

function dailyCost(d: { balance: number; apr: number }) {
  return (d.balance * d.apr) / 365
}

const EXTRA_MONTHLY = 500

function computePayoff(debts: Debt[], extraMonthly: number) {
  // Clone debts for simulation, sorted by daily cost descending
  let remaining = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({
      account: d.account,
      balance: d.balance,
      apr: d.apr,
      minPayment: d.minPayment,
    }))
    .sort((a, b) => dailyCost(b) - dailyCost(a))

  const data: { month: string; balance: number }[] = []
  let month = 0
  let totalInterest = 0
  const maxMonths = 600

  const initialBalance = remaining.reduce((s, d) => s + d.balance, 0)
  data.push({ month: "Month 0", balance: initialBalance })

  while (remaining.length > 0 && month < maxMonths) {
    month++

    // 1. Accrue interest
    for (const d of remaining) {
      const interest = (d.balance * d.apr) / 12
      d.balance += interest
      totalInterest += interest
    }

    // 2. Pay minimums
    let extra = extraMonthly
    for (const d of remaining) {
      const payment = Math.min(d.minPayment, d.balance)
      d.balance -= payment
    }

    // 3. Apply extra to highest daily cost first
    const activeDebts = remaining.filter((d) => d.balance > 0)
    const freedMinimums = remaining
      .filter((d) => d.balance <= 0)
      .reduce((s, d) => s + d.minPayment, 0)
    extra += freedMinimums

    if (activeDebts.length > 0) {
      activeDebts.sort((a, b) => dailyCost(b) - dailyCost(a))
      let leftover = extra
      for (const d of activeDebts) {
        if (leftover <= 0) break
        const payment = Math.min(leftover, d.balance)
        d.balance -= payment
        leftover -= payment
      }
    }

    remaining = remaining.filter((d) => d.balance > 0.01)

    const totalBalance = remaining.reduce((s, d) => s + d.balance, 0)
    data.push({ month: `Month ${month}`, balance: Math.max(0, totalBalance) })

    if (totalBalance <= 0.01) break
  }

  return { data, months: month, totalInterest }
}

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState("")
  const [extraMonthly, setExtraMonthly] = useState(EXTRA_MONTHLY)
  const [paymentId, setPaymentId] = useState<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const paymentRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/debts")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load debts (${res.status})`)
        return res.json()
      })
      .then((data: Debt[]) => {
        setDebts(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load debts")
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (paymentId != null && paymentRef.current) {
      paymentRef.current.focus()
    }
  }, [paymentId])

  // Sort by daily cost descending
  const sorted = [...debts].sort((a, b) => dailyCost(b) - dailyCost(a))

  const totals = debts.reduce(
    (acc, d) => ({
      balance: acc.balance + d.balance,
      minPayment: acc.minPayment + d.minPayment,
      interestPerMonth:
        acc.interestPerMonth + (d.interestPerMonth ?? (d.balance * d.apr) / 12),
      dailyCost: acc.dailyCost + dailyCost(d),
    }),
    { balance: 0, minPayment: 0, interestPerMonth: 0, dailyCost: 0 },
  )

  const maxBalance = Math.max(...debts.map((d) => d.balance), 1)

  const payoff = computePayoff(debts, extraMonthly)

  // The #1 target is the highest daily cost with balance > 0
  const attackingId =
    sorted.length > 0 && sorted[0].balance > 0 ? sorted[0].id : null

  function startEdit(id: number, field: EditingCell["field"], currentValue: number) {
    setEditing({ id, field })
    setEditValue(String(currentValue))
  }

  async function saveEdit() {
    if (!editing) return
    const numVal = parseFloat(editValue)
    if (isNaN(numVal)) {
      setEditing(null)
      return
    }

    const debt = debts.find((d) => d.id === editing.id)
    if (!debt) {
      setEditing(null)
      return
    }

    const updated = { ...debt, [editing.field]: numVal }
    updated.interestPerMonth = (updated.balance * updated.apr) / 12
    updated.lastUpdated = new Date().toISOString().slice(0, 10)

    const prevDebts = debts
    setDebts((prev) => prev.map((d) => (d.id === editing.id ? updated : d)))
    const editingField = editing.field
    setEditing(null)

    try {
      const res = await fetch("/api/debts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          [editingField]: numVal,
          interestPerMonth: updated.interestPerMonth,
          lastUpdated: updated.lastUpdated,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
    } catch {
      setDebts(prevDebts)
    }
  }

  async function recordPayment(id: number) {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setPaymentId(null)
      setPaymentAmount("")
      return
    }

    const debt = debts.find((d) => d.id === id)
    if (!debt) return

    const newBalance = Math.max(0, debt.balance - amount)
    const newInterest = (newBalance * debt.apr) / 12
    const today = new Date().toISOString().slice(0, 10)

    const updated = {
      ...debt,
      balance: newBalance,
      interestPerMonth: newInterest,
      lastUpdated: today,
    }

    const prevDebts = debts
    setDebts((prev) => prev.map((d) => (d.id === id ? updated : d)))
    setPaymentId(null)
    setPaymentAmount("")

    try {
      const res = await fetch("/api/debts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          balance: newBalance,
          interestPerMonth: newInterest,
          lastUpdated: today,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
    } catch {
      setDebts(prevDebts)
    }
  }

  async function addDebt() {
    try {
      const newDebt = {
        account: "New Account",
        balance: 0,
        apr: 0,
        minPayment: 0,
        interestPerMonth: 0,
        lastUpdated: new Date().toISOString().slice(0, 10),
        priority: debts.length + 1,
      }
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDebt),
      })
      if (!res.ok) throw new Error("Failed to add debt")
      const created = await res.json()
      setDebts((prev) => [...prev, created])
    } catch {
      setError("Failed to add debt")
    }
  }

  async function deleteDebt(id: number) {
    const prev = debts
    setDebts((all) => all.filter((d) => d.id !== id))
    try {
      const res = await fetch("/api/debts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
    } catch {
      setDebts(prev)
    }
  }

  function renderEditableCell(
    debt: Debt,
    field: EditingCell["field"],
    value: number,
    formatter: (n: number) => string,
  ) {
    const isEditing = editing?.id === debt.id && editing?.field === field
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit()
            if (e.key === "Escape") setEditing(null)
          }}
          className="w-24 rounded border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-50"
        />
      )
    }
    return (
      <button
        onClick={() => startEdit(debt.id, field, value)}
        className="cursor-pointer rounded px-1 py-0.5 transition hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {formatter(value)}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
        <p className="text-lg text-gray-500 dark:text-gray-400">Loading debts...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-gray-50">
          Debt Tracker
        </h1>

        {error && (
          <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* ── DEBT TABLE (sorted by daily cost) ── */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              Debts (by Daily Cost)
            </h2>
            <button
              onClick={addDebt}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              + Add Debt
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Account
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Balance
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    APR
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Daily Cost
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Interest/Mo
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Min Payment
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Updated
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Progress
                  </th>
                  <th className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((debt) => {
                  const dc = dailyCost(debt)
                  const interestMo =
                    debt.interestPerMonth ?? (debt.balance * debt.apr) / 12
                  const pct = (debt.balance / maxBalance) * 100
                  const isAttacking = debt.id === attackingId
                  return (
                    <tr
                      key={debt.id}
                      className={`border-b border-gray-200 last:border-b-0 dark:border-gray-800 ${isAttacking ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                    >
                      <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-50">
                        <div className="flex items-center gap-2">
                          {debt.account}
                          {isAttacking && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                              ATTACKING
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                        {renderEditableCell(debt, "balance", debt.balance, fmt)}
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                        {renderEditableCell(debt, "apr", debt.apr, fmtPct)}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-50">
                        {fmt(dc)}
                        <span className="ml-1 text-xs text-gray-400">/day</span>
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                        {fmt(interestMo)}
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                        {renderEditableCell(debt, "minPayment", debt.minPayment, fmt)}
                      </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {debt.lastUpdated ?? "—"}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="h-2 w-32 rounded-full bg-gray-200 dark:bg-gray-800">
                          <div
                            className="h-2 rounded-full bg-red-500 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {paymentId === debt.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                ref={paymentRef}
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") recordPayment(debt.id)
                                  if (e.key === "Escape") {
                                    setPaymentId(null)
                                    setPaymentAmount("")
                                  }
                                }}
                                className="w-20 rounded border border-emerald-400 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-50"
                              />
                              <button
                                onClick={() => recordPayment(debt.id)}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => {
                                  setPaymentId(null)
                                  setPaymentAmount("")
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPaymentId(debt.id)}
                              className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => deleteDebt(debt.id)}
                            className="text-sm font-medium text-red-500 transition hover:text-red-700 dark:hover:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold dark:bg-gray-900">
                  <td className="p-4 text-sm text-gray-900 dark:text-gray-50">Totals</td>
                  <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                    {fmt(totals.balance)}
                  </td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400">—</td>
                  <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                    {fmt(totals.dailyCost)}
                    <span className="ml-1 text-xs font-normal text-gray-400">/day</span>
                  </td>
                  <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                    {fmt(totals.interestPerMonth)}
                  </td>
                  <td className="p-4 text-sm text-gray-900 dark:text-gray-50">
                    {fmt(totals.minPayment)}
                  </td>
                  <td className="p-4 text-sm" />
                  <td className="p-4 text-sm" />
                  <td className="p-4 text-sm" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── PAYOFF PROJECTION ── */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
            Payoff Projection
          </h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Debt-free in</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {payoff.months} months
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total interest</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {fmt(payoff.totalInterest)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monthly payment</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {fmt(totals.minPayment + extraMonthly)}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400">
                  Extra/mo
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={extraMonthly}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 0) setExtraMonthly(v)
                    }}
                    className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
                  />
                </div>
              </div>
            </div>
            {payoff.data.length > 1 && (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={payoff.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      tickLine={false}
                      interval={Math.max(Math.floor(payoff.data.length / 12) - 1, 0)}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#f9fafb",
                      }}
                      formatter={(value: number) => [fmt(value), "Balance"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
