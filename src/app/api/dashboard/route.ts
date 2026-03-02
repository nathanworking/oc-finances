import { db } from "@/db"
import {
  revenueItems,
  businessExpenses,
  profitFirstConfig,
  personalIncome,
  personalExpenses,
  savingsGoals,
  debts,
  expenses,
} from "@/db/schema"
import { isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const revenue = await db.select().from(revenueItems).all()
  const bizExp = await db.select().from(businessExpenses).all()
  const pfConfig = await db.select().from(profitFirstConfig).all()
  const persIncome = await db.select().from(personalIncome).all()
  const persExpenses = await db.select().from(personalExpenses).all()
  const savings = await db.select().from(savingsGoals).all()
  const debtRows = await db.select().from(debts).all()
  const uncategorized = await db
    .select()
    .from(expenses)
    .where(isNull(expenses.category))
    .all()

  // Business summary (Mar Expected)
  const grossRevenue = revenue.reduce(
    (s, r) => s + (r.marExpected ?? 0),
    0,
  )
  const totalBizExpenses = bizExp.reduce(
    (s, e) => s + (e.marExpected ?? 0),
    0,
  )
  const netBusinessIncome = grossRevenue - totalBizExpenses

  // Base/Mo
  const grossRevenueBase = revenue.reduce(
    (s, r) => s + (r.marBase ?? 0),
    0,
  )
  const totalBizExpensesBase = bizExp.reduce(
    (s, e) => s + (e.marBase ?? 0),
    0,
  )

  // Profit First allocations
  const pfMap: Record<string, number> = {}
  for (const pf of pfConfig) {
    pfMap[pf.account] = pf.targetPercent
  }
  const ownersPay = grossRevenue * (pfMap["Owner's Pay"] ?? 0.6)
  const taxReserve = grossRevenue * (pfMap["Tax"] ?? 0.15)
  const profit = grossRevenue * (pfMap["Profit"] ?? 0.05)
  const opex = grossRevenue * (pfMap["Operating Expenses"] ?? 0.2)

  // Personal summary
  const totalPersonalIncome = persIncome.reduce(
    (s, i) => s + (i.monthly ?? 0),
    0,
  )
  const totalPersonalExpenses = persExpenses.reduce(
    (s, e) => s + (e.monthly ?? 0),
    0,
  )
  const totalSavings = savings.reduce(
    (s, g) => s + (g.monthlyTarget ?? 0),
    0,
  )
  const remaining =
    totalPersonalIncome - totalPersonalExpenses - totalSavings

  // Debt overview
  const totalDebt = debtRows.reduce((s, d) => s + d.balance, 0)
  const totalMinPayments = debtRows.reduce(
    (s, d) => s + d.minPayment,
    0,
  )
  const totalInterest = debtRows.reduce(
    (s, d) => s + (d.interestPerMonth ?? 0),
    0,
  )

  return NextResponse.json({
    business: {
      grossRevenue,
      grossRevenueBase,
      totalBizExpenses,
      totalBizExpensesBase,
      netBusinessIncome,
      netBusinessIncomeBase: grossRevenueBase - totalBizExpensesBase,
    },
    profitFirst: {
      ownersPay,
      ownersPayPct: pfMap["Owner's Pay"] ?? 0.6,
      taxReserve,
      taxPct: pfMap["Tax"] ?? 0.15,
      profit,
      profitPct: pfMap["Profit"] ?? 0.05,
      opex,
      opexPct: pfMap["Operating Expenses"] ?? 0.2,
    },
    personal: {
      totalIncome: totalPersonalIncome,
      totalExpenses: totalPersonalExpenses,
      savingsGoals: totalSavings,
      remaining,
    },
    debt: {
      totalBalance: totalDebt,
      monthlyMinPayments: totalMinPayments,
      monthlyInterest: totalInterest,
    },
    uncategorizedCount: uncategorized.length,
  })
}
