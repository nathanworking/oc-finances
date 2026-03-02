import { db } from "@/db"
import {
  personalIncome,
  personalExpenses,
  revenueItems,
  businessExpenses,
  debts,
  savingsGoals,
} from "@/db/schema"
import { NextRequest, NextResponse } from "next/server"

interface CashflowEvent {
  date: string // YYYY-MM-DD
  label: string
  source: string
  amount: number
  type: "inflow" | "outflow"
}

interface WeekData {
  weekLabel: string // e.g. "Mar 3 – Mar 9"
  isoWeek: string // e.g. "2026-W10"
  events: CashflowEvent[]
  inflows: number
  outflows: number
  netFlow: number
  runningBalance: number
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getISOWeek(d: Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function makeDateForDay(year: number, month: number, day: number): Date {
  // Clamp day to last day of month
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const startBalance = parseFloat(
    req.nextUrl.searchParams.get("startBalance") ?? "0",
  )

  // Fetch all tables
  const [incomeRows, expenseRows, revenueRows, bizExpRows, debtRows, savingsRows] =
    await Promise.all([
      db.select().from(personalIncome).all(),
      db.select().from(personalExpenses).all(),
      db.select().from(revenueItems).all(),
      db.select().from(businessExpenses).all(),
      db.select().from(debts).all(),
      db.select().from(savingsGoals).all(),
    ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 35) // ~5 weeks

  const events: CashflowEvent[] = []

  // Helper: generate events for a day-of-month across the window
  function addMonthlyEvent(
    dayOfMonth: number,
    label: string,
    source: string,
    amount: number,
    type: "inflow" | "outflow",
  ) {
    // Check current month and next month
    for (let mOffset = 0; mOffset <= 1; mOffset++) {
      const d = makeDateForDay(
        today.getFullYear(),
        today.getMonth() + mOffset,
        dayOfMonth,
      )
      if (d >= today && d <= endDate) {
        events.push({ date: dateStr(d), label, source, amount, type })
      }
    }
  }

  // Personal Income
  for (const inc of incomeRows) {
    const amount = inc.monthly ?? (inc.perPaycheck ? inc.perPaycheck * 2 : 0)
    if (amount <= 0) continue

    if (inc.perPaycheck && inc.perPaycheck > 0) {
      // Biweekly: two pay days
      const day1 = inc.payDay1 ?? 1
      const day2 = inc.payDay2 ?? 15
      addMonthlyEvent(day1, inc.source, "Personal Income", inc.perPaycheck, "inflow")
      addMonthlyEvent(day2, inc.source, "Personal Income", inc.perPaycheck, "inflow")
    } else {
      const day = inc.payDay1 ?? 1
      addMonthlyEvent(day, inc.source, "Personal Income", amount, "inflow")
    }
  }

  // Revenue Items (business income)
  for (const rev of revenueRows) {
    const amount = rev.marExpected ?? rev.marBase ?? 0
    if (amount <= 0) continue
    const day = rev.arrivalDay ?? 1
    addMonthlyEvent(day, rev.name, "Business Revenue", amount, "inflow")
  }

  // Personal Expenses
  for (const exp of expenseRows) {
    const amount = exp.monthly ?? 0
    if (amount <= 0) continue
    // dueDate is text, could be "15", "1,15", etc.
    const days = (exp.dueDate ?? "1")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
    for (const day of days) {
      addMonthlyEvent(day, exp.name, "Personal Expense", amount / days.length, "outflow")
    }
  }

  // Business Expenses
  for (const biz of bizExpRows) {
    const amount = biz.marExpected ?? biz.marBase ?? 0
    if (amount <= 0) continue
    const day = biz.dueDay ?? 15
    addMonthlyEvent(day, biz.name, "Business Expense", amount, "outflow")
  }

  // Debts (min payments)
  for (const debt of debtRows) {
    if (debt.minPayment <= 0) continue
    const day = debt.dueDay ?? 1
    addMonthlyEvent(day, debt.account, "Debt Payment", debt.minPayment, "outflow")
  }

  // Savings Goals
  for (const goal of savingsRows) {
    const amount = goal.monthlyTarget ?? (goal.perPaycheck ? goal.perPaycheck * 2 : 0)
    if (amount <= 0) continue
    const day = goal.transferDay ?? 1
    addMonthlyEvent(day, goal.name, "Savings Transfer", amount, "outflow")
  }

  // Sort events by date
  events.sort((a, b) => a.date.localeCompare(b.date))

  // Group into ISO weeks
  const weekMap = new Map<string, WeekData>()

  // Pre-populate weeks for the 5-week window
  const mondayStart = getMonday(today)
  for (let w = 0; w < 5; w++) {
    const weekStart = new Date(mondayStart)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const isoWeek = getISOWeek(weekStart)
    weekMap.set(isoWeek, {
      weekLabel: `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`,
      isoWeek,
      events: [],
      inflows: 0,
      outflows: 0,
      netFlow: 0,
      runningBalance: 0,
    })
  }

  for (const event of events) {
    const eventDate = new Date(event.date + "T00:00:00")
    const isoWeek = getISOWeek(eventDate)
    const week = weekMap.get(isoWeek)
    if (!week) continue
    week.events.push(event)
    if (event.type === "inflow") {
      week.inflows += event.amount
    } else {
      week.outflows += event.amount
    }
  }

  // Compute running balance and net flow
  const weeks = Array.from(weekMap.values()).sort((a, b) =>
    a.isoWeek.localeCompare(b.isoWeek),
  )

  let balance = startBalance
  let totalInflows = 0
  let totalOutflows = 0

  for (const week of weeks) {
    week.netFlow = week.inflows - week.outflows
    balance += week.netFlow
    week.runningBalance = Math.round(balance * 100) / 100
    totalInflows += week.inflows
    totalOutflows += week.outflows
  }

  return NextResponse.json({
    weeks,
    summary: {
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
    },
  })
}
