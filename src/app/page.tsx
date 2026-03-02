import { db } from "@/db"
import {
  revenueItems,
  businessExpenses,
  profitFirstConfig,
  personalIncome,
  personalExpenses as personalExpensesTable,
  savingsGoals,
  debts,
  expenses,
} from "@/db/schema"
import { isNull } from "drizzle-orm"
import { formatCurrency, formatPercent } from "@/lib/formatters"

async function getDashboardData() {
  const revenue = await db.select().from(revenueItems).all()
  const bizExp = await db.select().from(businessExpenses).all()
  const pfConfig = await db.select().from(profitFirstConfig).all()
  const persIncome = await db.select().from(personalIncome).all()
  const persExpenses = await db.select().from(personalExpensesTable).all()
  const savings = await db.select().from(savingsGoals).all()
  const debtRows = await db.select().from(debts).all()
  const uncategorized = await db
    .select()
    .from(expenses)
    .where(isNull(expenses.category))
    .all()

  const grossRevenue = revenue.reduce((s, r) => s + (r.marExpected ?? 0), 0)
  const grossRevenueBase = revenue.reduce((s, r) => s + (r.marBase ?? 0), 0)
  const totalBizExpenses = bizExp.reduce((s, e) => s + (e.marExpected ?? 0), 0)
  const totalBizExpensesBase = bizExp.reduce((s, e) => s + (e.marBase ?? 0), 0)

  const pfMap: Record<string, number> = {}
  for (const pf of pfConfig) pfMap[pf.account] = pf.targetPercent

  const ownersPay = grossRevenue * (pfMap["Owner's Pay"] ?? 0.6)
  const taxReserve = grossRevenue * (pfMap["Tax"] ?? 0.15)
  const profit = grossRevenue * (pfMap["Profit"] ?? 0.05)
  const opex = grossRevenue * (pfMap["Operating Expenses"] ?? 0.2)

  const totalPersonalIncome = persIncome.reduce(
    (s, i) => s + (i.monthly ?? 0),
    0,
  )
  const totalPersonalExpenses = persExpenses.reduce(
    (s, e) => s + (e.monthly ?? 0),
    0,
  )
  const totalSavings = savings.reduce((s, g) => s + (g.monthlyTarget ?? 0), 0)

  const totalDebt = debtRows.reduce((s, d) => s + d.balance, 0)
  const totalMinPayments = debtRows.reduce((s, d) => s + d.minPayment, 0)
  const totalInterest = debtRows.reduce(
    (s, d) => s + (d.interestPerMonth ?? 0),
    0,
  )

  return {
    grossRevenue,
    grossRevenueBase,
    totalBizExpenses,
    totalBizExpensesBase,
    netBusinessIncome: grossRevenue - totalBizExpenses,
    netBusinessIncomeBase: grossRevenueBase - totalBizExpensesBase,
    ownersPay,
    ownersPayPct: pfMap["Owner's Pay"] ?? 0.6,
    taxReserve,
    taxPct: pfMap["Tax"] ?? 0.15,
    profit,
    profitPct: pfMap["Profit"] ?? 0.05,
    opex,
    opexPct: pfMap["Operating Expenses"] ?? 0.2,
    totalPersonalIncome,
    totalPersonalExpenses,
    totalSavings,
    remaining: totalPersonalIncome - totalPersonalExpenses - totalSavings,
    totalDebt,
    totalMinPayments,
    totalInterest,
    uncategorizedCount: uncategorized.length,
  }
}

export default async function DashboardPage() {
  const d = await getDashboardData()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Financial Dashboard — Mar 2026
      </h1>

      {d.uncategorizedCount > 0 && (
        <a
          href="/triage"
          className="mt-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <span className="font-medium">
            {d.uncategorizedCount} uncategorized expenses
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            — Triage now &rarr;
          </span>
        </a>
      )}

      {/* BUSINESS */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Business (GoodCraft)
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Gross Revenue"
            value={formatCurrency(d.grossRevenue)}
            sub={`Base: ${formatCurrency(d.grossRevenueBase)}/mo`}
            color="emerald"
          />
          <KpiCard
            label="Business Expenses"
            value={formatCurrency(d.totalBizExpenses)}
            sub={`Base: ${formatCurrency(d.totalBizExpensesBase)}/mo`}
            color="rose"
          />
          <KpiCard
            label="Net Business Income"
            value={formatCurrency(d.netBusinessIncome)}
            sub={`Base: ${formatCurrency(d.netBusinessIncomeBase)}/mo`}
            color="blue"
          />
        </dl>
      </section>

      {/* PROFIT FIRST */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Profit First Allocations
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Owner's Pay"
            value={formatCurrency(d.ownersPay)}
            sub={formatPercent(d.ownersPayPct)}
            color="blue"
          />
          <KpiCard
            label="Tax Reserve"
            value={formatCurrency(d.taxReserve)}
            sub={formatPercent(d.taxPct)}
            color="amber"
          />
          <KpiCard
            label="Profit"
            value={formatCurrency(d.profit)}
            sub={formatPercent(d.profitPct)}
            color="emerald"
          />
          <KpiCard
            label="Operating Expenses"
            value={formatCurrency(d.opex)}
            sub={formatPercent(d.opexPct)}
            color="violet"
          />
        </dl>
      </section>

      {/* PERSONAL */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Personal Summary
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Total Income"
            value={formatCurrency(d.totalPersonalIncome)}
            color="emerald"
          />
          <KpiCard
            label="Total Expenses"
            value={formatCurrency(d.totalPersonalExpenses)}
            color="rose"
          />
          <KpiCard
            label="Savings Goals"
            value={formatCurrency(d.totalSavings)}
            color="blue"
          />
          <KpiCard
            label="Remaining"
            value={formatCurrency(d.remaining)}
            color={d.remaining >= 0 ? "emerald" : "rose"}
          />
        </dl>
      </section>

      {/* DEBT */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Debt Overview
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total Debt Balance"
            value={formatCurrency(d.totalDebt)}
            color="rose"
          />
          <KpiCard
            label="Monthly Min Payments"
            value={formatCurrency(d.totalMinPayments)}
            color="amber"
          />
          <KpiCard
            label="Monthly Interest Cost"
            value={formatCurrency(d.totalInterest)}
            sub={`${formatCurrency(d.totalInterest / 30)}/day`}
            color="rose"
          />
        </dl>
      </section>
    </div>
  )
}

const colorMap = {
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800",
  rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-800",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800",
  amber:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800",
} as const

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: keyof typeof colorMap
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">
        {value}
      </dd>
      {sub && (
        <dd className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {sub}
        </dd>
      )}
    </div>
  )
}
