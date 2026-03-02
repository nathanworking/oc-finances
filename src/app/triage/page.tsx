"use client"

import { useCallback, useEffect, useState } from "react"

interface Expense {
  id: number
  month: string | null
  date: string | null
  vendor: string | null
  amount: number | null
  category: string | null
  client: string | null
  clientPays: boolean | null
  notes: string | null
  gmailLink: string | null
  status: string | null
}

const CATEGORIES = [
  { label: "Biz Subscription", key: "1", border: "border-blue-500", bg: "bg-blue-500/10 hover:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  { label: "Biz Per-Client", key: "2", border: "border-purple-500", bg: "bg-purple-500/10 hover:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
  { label: "Biz One-Time", key: "3", border: "border-cyan-500", bg: "bg-cyan-500/10 hover:bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400" },
  { label: "Personal", key: "4", border: "border-amber-500", bg: "bg-amber-500/10 hover:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  { label: "Income", key: "5", border: "border-emerald-500", bg: "bg-emerald-500/10 hover:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
] as const

export default function TriagePage() {
  const [queue, setQueue] = useState<Expense[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/expenses")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load expenses (${res.status})`)
        return res.json()
      })
      .then((data: Expense[]) => {
        const uncat = data.filter((e) => !e.category)
        setQueue(uncat)
        setTotalCount(uncat.length)
        setCurrentIndex(0)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load expenses")
        setLoading(false)
      })
  }, [])

  const processed = currentIndex
  const current = queue[currentIndex] ?? null
  const done = !loading && (queue.length === 0 || currentIndex >= queue.length)

  const advance = useCallback((label: string) => {
    setLastAction(label)
    setTimeout(() => {
      setCurrentIndex((i) => i + 1)
      setLastAction(null)
    }, 400)
  }, [])

  async function handleCategorize(category: string) {
    if (!current || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, category }),
      })
      if (!res.ok) throw new Error("Failed to categorize expense")
      setError(null)
      advance(category)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSkipPermanent() {
    if (!current || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, category: "Skipped" }),
      })
      if (!res.ok) throw new Error("Failed to skip expense")
      setError(null)
      advance("Skipped")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  function handleSkipTemp() {
    if (!current || saving) return
    advance("Skipped for now")
  }

  // Keyboard shortcuts: 1-5 for categories, s for skip permanent, space for skip temp
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (saving || !current || done) return
      // Don't capture if user is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const cat = CATEGORIES.find((c) => c.key === e.key)
      if (cat) {
        e.preventDefault()
        handleCategorize(cat.label)
        return
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault()
        handleSkipPermanent()
        return
      }
      if (e.key === " ") {
        e.preventDefault()
        handleSkipTemp()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saving, done])

  const progressPercent = totalCount > 0 ? Math.round((processed / totalCount) * 100) : 100

  // Peek at next item
  const next = queue[currentIndex + 1] ?? null

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
        <p className="text-lg text-gray-500 dark:text-gray-400">Loading expenses...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-50">Triage</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Keyboard: <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">1-5</kbd> categories, <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">S</kbd> skip permanently, <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">Space</kbd> skip for now
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {processed} of {totalCount} done
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Last action feedback */}
        {lastAction && (
          <div className="mb-4 flex items-center justify-center">
            <span className="animate-pulse rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {lastAction}
            </span>
          </div>
        )}

        {done ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-12 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-50">All caught up!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">No uncategorized expenses remaining.</p>
            <a href="/expenses" className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              View all expenses &rarr;
            </a>
          </div>
        ) : current ? (
          <>
            {/* Expense card */}
            <div className={`rounded-xl border border-gray-200 bg-gray-50 p-6 transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 ${lastAction ? "scale-95 opacity-50" : "scale-100 opacity-100"}`}>
              <div className="flex items-start justify-between">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {current.vendor || "Unknown Vendor"}
                </p>
                {current.amount == null && (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    No charge
                  </span>
                )}
              </div>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-50">
                {current.amount != null ? `$${Math.abs(current.amount).toFixed(2)}` : "—"}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {current.date && <span>{current.date}</span>}
                {current.month && !current.date && <span>{current.month}</span>}
                {current.status && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {current.status}
                  </span>
                )}
              </div>
              {current.notes && (
                <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
                  {current.notes}
                </p>
              )}
            </div>

            {/* Category buttons */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => handleCategorize(cat.label)}
                  disabled={saving || !!lastAction}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition ${cat.border} ${cat.bg} ${cat.text} disabled:opacity-50`}
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-gray-900/10 text-xs font-bold dark:bg-white/10">
                    {cat.key}
                  </span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Skip buttons */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={handleSkipPermanent}
                disabled={saving || !!lastAction}
                className="rounded-lg border-2 border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 transition hover:border-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800"
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-gray-900/10 text-xs font-bold dark:bg-white/10">
                  S
                </span>
                Skip Permanently
              </button>
              <button
                onClick={handleSkipTemp}
                disabled={saving || !!lastAction}
                className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-400 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:text-gray-500 dark:hover:bg-gray-900"
              >
                Skip for Now
              </button>
            </div>

            {/* Next up preview */}
            {next && (
              <div className="mt-6 rounded-lg border border-dashed border-gray-200 px-4 py-2 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Up next
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {next.vendor || "Unknown"}{" "}
                  {next.amount != null ? `— $${Math.abs(next.amount).toFixed(2)}` : "— no charge"}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
