"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { ChevronDown, ChevronRight } from "lucide-react"

interface CashflowEvent {
  date: string
  label: string
  source: string
  amount: number
  type: "inflow" | "outflow"
}

interface WeekData {
  weekLabel: string
  isoWeek: string
  events: CashflowEvent[]
  inflows: number
  outflows: number
  netFlow: number
  runningBalance: number
}

interface CashflowResponse {
  weeks: WeekData[]
  summary: {
    totalInflows: number
    totalOutflows: number
    endingBalance: number
  }
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

const fmtExact = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" })

const STORAGE_KEY = "cashflow-start-balance"

export default function CashFlowPage() {
  const [startBalance, setStartBalance] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? parseFloat(saved) : 5000
    }
    return 5000
  })
  const [inputValue, setInputValue] = useState(String(startBalance))
  const [data, setData] = useState<CashflowResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  const fetchData = useCallback(
    (balance: number) => {
      setLoading(true)
      fetch(`/api/cashflow?startBalance=${balance}`)
        .then((res) => res.json())
        .then((d: CashflowResponse) => {
          setData(d)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    fetchData(startBalance)
  }, [startBalance, fetchData])

  function applyBalance() {
    const val = parseFloat(inputValue)
    if (isNaN(val)) return
    setStartBalance(val)
    localStorage.setItem(STORAGE_KEY, String(val))
  }

  function toggleWeek(isoWeek: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(isoWeek)) next.delete(isoWeek)
      else next.add(isoWeek)
      return next
    })
  }

  const chartData =
    data?.weeks.map((w) => ({
      name: w.weekLabel.split(" – ")[0],
      inflows: Math.round(w.inflows),
      outflows: Math.round(w.outflows),
      balance: w.runningBalance,
    })) ?? []

  const minBalance = Math.min(
    startBalance,
    ...chartData.map((d) => d.balance),
  )
  const yMin = Math.floor(minBalance / 1000) * 1000

  return (
    <div className="min-h-screen bg-white px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-gray-50">
          Cash Flow Timeline
        </h1>

        {/* Starting balance input */}
        <div className="mb-6 flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Starting Balance
            </label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="number"
                step="100"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={applyBalance}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyBalance()
                }}
                className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading cash flow...</p>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KpiCard
                label="Starting Balance"
                value={fmt(startBalance)}
                color="text-gray-900 dark:text-gray-50"
              />
              <KpiCard
                label="Total Inflows"
                value={fmt(data.summary.totalInflows)}
                color="text-emerald-600 dark:text-emerald-400"
              />
              <KpiCard
                label="Total Outflows"
                value={fmt(data.summary.totalOutflows)}
                color="text-red-600 dark:text-red-400"
              />
              <KpiCard
                label="Ending Balance"
                value={fmt(data.summary.endingBalance)}
                color={
                  data.summary.endingBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              />
            </div>

            {/* Chart */}
            <section className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
                5-Week Overview
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      tickLine={false}
                      domain={[yMin, "auto"]}
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
                      formatter={(value: number, name: string) => [
                        fmtExact(value),
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="inflows"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      name="Inflows"
                    />
                    <Bar
                      dataKey="outflows"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      name="Outflows"
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      name="Balance"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Weekly Detail */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
                Weekly Detail
              </h2>
              <div className="space-y-2">
                {data.weeks.map((week) => {
                  const expanded = expandedWeeks.has(week.isoWeek)
                  return (
                    <div
                      key={week.isoWeek}
                      className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      <button
                        onClick={() => toggleWeek(week.isoWeek)}
                        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center gap-3">
                          {expanded ? (
                            <ChevronDown className="size-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="size-4 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                            {week.weekLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{fmt(week.inflows)}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            -{fmt(week.outflows)}
                          </span>
                          <span
                            className={`font-medium ${
                              week.runningBalance >= 0
                                ? "text-gray-900 dark:text-gray-50"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {fmt(week.runningBalance)}
                          </span>
                        </div>
                      </button>
                      {expanded && week.events.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-800">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Date
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Item
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Source
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {week.events
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((event, i) => (
                                  <tr
                                    key={`${event.date}-${event.label}-${i}`}
                                    className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                                  >
                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                      {new Date(
                                        event.date + "T00:00:00",
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-50">
                                      {event.label}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                      {event.source}
                                    </td>
                                    <td
                                      className={`px-4 py-2 text-right text-sm font-medium ${
                                        event.type === "inflow"
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {event.type === "inflow" ? "+" : "-"}
                                      {fmtExact(event.amount)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {expanded && week.events.length === 0 && (
                        <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
                          <p className="text-sm text-gray-400">
                            No events this week
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
