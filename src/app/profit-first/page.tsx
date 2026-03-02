"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatCurrency, formatPercent } from "@/lib/formatters"

interface ProfitFirstRow {
  id: number
  account: string
  targetPercent: number
  description: string | null
}

interface RevenueItem {
  id: number
  marExpected: number | null
}

interface BusinessExpense {
  id: number
  marExpected: number | null
}

const ACCOUNT_COLORS: Record<
  string,
  {
    bg: string
    ring: string
    text: string
    slider: string
    bar: string
  }
> = {
  "Owner's Pay": {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    ring: "ring-blue-200 dark:ring-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    slider: "accent-blue-600",
    bar: "bg-blue-500",
  },
  Tax: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    ring: "ring-amber-200 dark:ring-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    slider: "accent-amber-600",
    bar: "bg-amber-500",
  },
  Profit: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    slider: "accent-emerald-600",
    bar: "bg-emerald-500",
  },
  "Operating Expenses": {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    ring: "ring-violet-200 dark:ring-violet-800",
    text: "text-violet-700 dark:text-violet-400",
    slider: "accent-violet-600",
    bar: "bg-violet-500",
  },
}

const DISPLAY_LABELS: Record<string, string> = {
  "Owner's Pay": "Owner's Pay",
  Tax: "Tax Reserve",
  Profit: "Profit",
  "Operating Expenses": "Operating Expenses",
}

function getColor(account: string) {
  return (
    ACCOUNT_COLORS[account] ?? {
      bg: "bg-gray-50 dark:bg-gray-900/20",
      ring: "ring-gray-200 dark:ring-gray-800",
      text: "text-gray-700 dark:text-gray-400",
      slider: "accent-gray-600",
      bar: "bg-gray-500",
    }
  )
}

export default function ProfitFirstPage() {
  const [allocations, setAllocations] = useState<ProfitFirstRow[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [pfRes, revRes, expRes] = await Promise.all([
          fetch("/api/profit-first"),
          fetch("/api/revenue"),
          fetch("/api/business-expenses"),
        ])
        if (!pfRes.ok || !revRes.ok || !expRes.ok) throw new Error("Failed to load data")
        const pfData: ProfitFirstRow[] = await pfRes.json()
        const revData: RevenueItem[] = await revRes.json()
        const expData: BusinessExpense[] = await expRes.json()

        setAllocations(pfData)
        setTotalRevenue(revData.reduce((s, r) => s + (r.marExpected ?? 0), 0))
        setTotalExpenses(expData.reduce((s, e) => s + (e.marExpected ?? 0), 0))
      } catch (err) {
        console.error("Failed to load profit-first data", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPercent = useMemo(
    () => allocations.reduce((s, a) => s + a.targetPercent, 0),
    [allocations],
  )

  const percentOk = Math.abs(totalPercent - 1) < 0.001

  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const timers = debounceTimers
    return () => {
      Object.values(timers.current).forEach((t) => clearTimeout(t))
    }
  }, [])

  const updatePercent = useCallback(
    (id: number, newPercent: number) => {
      setAllocations((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, targetPercent: newPercent } : a,
        ),
      )
      // Debounce the API call to avoid flooding during slider drag
      if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id])
      debounceTimers.current[id] = setTimeout(async () => {
        try {
          const res = await fetch("/api/profit-first", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, targetPercent: newPercent }),
          })
          if (!res.ok) throw new Error("Failed to update allocation")
        } catch (err) {
          console.error("Failed to update allocation", err)
        }
      }, 300)
    },
    [],
  )

  const opexRow = allocations.find((a) => a.account === "Operating Expenses")
  const opexBudget = totalRevenue * (opexRow?.targetPercent ?? 0.2)
  const opexDiff = opexBudget - totalExpenses
  const opexUtilization =
    opexBudget > 0 ? Math.min(totalExpenses / opexBudget, 1.5) : 0

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Profit First Allocations
      </h1>

      {/* ALLOCATION PERCENTAGES */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Allocation Percentages
        </h2>

        {!percentOk && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            Percentages sum to {formatPercent(totalPercent)} — they should total
            100%.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {allocations.map((alloc) => {
            const color = getColor(alloc.account)
            const pctDisplay = Math.round(alloc.targetPercent * 100)

            return (
              <div
                key={alloc.id}
                className={`rounded-lg border border-gray-200 p-4 dark:border-gray-800 ${color.bg}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className={`text-sm font-semibold ${color.text}`}
                    >
                      {DISPLAY_LABELS[alloc.account] ?? alloc.account}
                    </h3>
                    {alloc.description && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {alloc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={pctDisplay}
                      onChange={(e) =>
                        updatePercent(
                          alloc.id,
                          parseInt(e.target.value, 10) / 100,
                        )
                      }
                      className={`h-2 w-32 cursor-pointer ${color.slider}`}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={pctDisplay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            updatePercent(alloc.id, val / 100)
                          }
                        }}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* mini bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full ${color.bar}`}
                    style={{ width: `${Math.min(pctDisplay, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Total bar */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total:
          </span>
          <span
            className={`text-sm font-semibold ${percentOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {formatPercent(totalPercent)}
          </span>
        </div>
      </section>

      {/* MONTHLY ALLOCATION */}
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Monthly Allocation
        </h2>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  Category
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  Percent
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue & Expenses */}
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-50">
                  Total Revenue
                </td>
                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                  —
                </td>
                <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalRevenue)}
                </td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-50">
                  Total Expenses
                </td>
                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                  —
                </td>
                <td className="px-4 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalExpenses)}
                </td>
              </tr>

              {/* Allocation rows */}
              {allocations.map((alloc) => {
                const color = getColor(alloc.account)
                const amount = totalRevenue * alloc.targetPercent
                return (
                  <tr
                    key={alloc.id}
                    className="border-b border-gray-200 last:border-0 dark:border-gray-800"
                  >
                    <td className={`px-4 py-2 font-medium ${color.text}`}>
                      {DISPLAY_LABELS[alloc.account] ?? alloc.account}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                      {formatPercent(alloc.targetPercent)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${color.text}`}
                    >
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* OPEX CHECK */}
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          OpEx Check
        </h2>

        <div className="mt-4 rounded-lg border border-gray-200 p-5 dark:border-gray-800">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* OpEx Budget */}
            <div>
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                OpEx Budget
              </p>
              <p className="mt-1 text-xl font-semibold text-violet-700 dark:text-violet-400">
                {formatCurrency(opexBudget)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatPercent(opexRow?.targetPercent ?? 0.2)} of revenue
              </p>
            </div>

            {/* Actual Expenses */}
            <div>
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Actual Expenses
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-50">
                {formatCurrency(totalExpenses)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                from P&L
              </p>
            </div>

            {/* Over/Under */}
            <div>
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                {opexDiff >= 0 ? "Under Budget" : "Over Budget"}
              </p>
              <p
                className={`mt-1 text-xl font-semibold ${opexDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {formatCurrency(Math.abs(opexDiff))}
              </p>
              <p
                className={`text-xs ${opexDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {opexDiff >= 0 ? "within budget" : "exceeds budget"}
              </p>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Budget Utilization</span>
              <span>
                {opexBudget > 0
                  ? `${Math.round((totalExpenses / opexBudget) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-3 rounded-full transition-all ${
                  totalExpenses <= opexBudget
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.min(opexUtilization * 100, 100)}%`,
                }}
              />
            </div>
            {/* Budget marker at 100% */}
            {opexUtilization > 0 && (
              <div className="relative mt-0.5">
                <div
                  className="absolute -top-4 h-3 w-px bg-gray-400 dark:bg-gray-500"
                  style={{ left: `${Math.min(100 / (opexUtilization > 1 ? opexUtilization : 1), 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
