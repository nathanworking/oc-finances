import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month"),
  date: text("date"),
  vendor: text("vendor").notNull(),
  amount: real("amount"),
  category: text("category"),
  client: text("client"),
  clientPays: real("client_pays"),
  notes: text("notes"),
  gmailLink: text("gmail_link"),
  status: text("status"),
})

export const revenueItems = sqliteTable("revenue_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull(),
  name: text("name").notNull(),
  febPaid: real("feb_paid"),
  febExpected: real("feb_expected"),
  marExpected: real("mar_expected"),
  marBase: real("mar_base"),
  notes: text("notes"),
  arrivalDay: integer("arrival_day"),
})

export const businessExpenses = sqliteTable("business_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  febPaid: real("feb_paid"),
  febExpected: real("feb_expected"),
  marExpected: real("mar_expected"),
  marBase: real("mar_base"),
  notes: text("notes"),
  dueDay: integer("due_day"),
})

export const profitFirstConfig = sqliteTable("profit_first_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  account: text("account").notNull(),
  targetPercent: real("target_percent").notNull(),
  description: text("description"),
})

export const personalIncome = sqliteTable("personal_income", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  monthly: real("monthly"),
  perPaycheck: real("per_paycheck"),
  notes: text("notes"),
  payDay1: integer("pay_day_1"),
  payDay2: integer("pay_day_2"),
})

export const personalExpenses = sqliteTable("personal_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthly: real("monthly"),
  dueDate: text("due_date"),
  notes: text("notes"),
})

export const savingsGoals = sqliteTable("savings_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlyTarget: real("monthly_target"),
  perPaycheck: real("per_paycheck"),
  notes: text("notes"),
  transferDay: integer("transfer_day"),
})

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  account: text("account").notNull(),
  balance: real("balance").notNull(),
  apr: real("apr").notNull(),
  minPayment: real("min_payment").notNull(),
  interestPerMonth: real("interest_per_month"),
  lastUpdated: text("last_updated"),
  priority: integer("priority"),
  dueDay: integer("due_day"),
})
