import Database from "better-sqlite3"
import * as XLSX from "xlsx"
import path from "path"
import fs from "fs"

const dbPath = path.join(process.cwd(), "data", "finances.db")
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// Remove existing DB
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

const sqlite = new Database(dbPath)
sqlite.pragma("journal_mode = WAL")

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT,
    date TEXT,
    vendor TEXT NOT NULL,
    amount REAL,
    category TEXT,
    client TEXT,
    client_pays REAL,
    notes TEXT,
    gmail_link TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS revenue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    name TEXT NOT NULL,
    feb_paid REAL,
    feb_expected REAL,
    mar_expected REAL,
    mar_base REAL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS business_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    feb_paid REAL,
    feb_expected REAL,
    mar_expected REAL,
    mar_base REAL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS profit_first_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL,
    target_percent REAL NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS personal_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    monthly REAL,
    per_paycheck REAL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS personal_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    monthly REAL,
    due_date TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    monthly_target REAL,
    per_paycheck REAL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL,
    balance REAL NOT NULL,
    apr REAL NOT NULL,
    min_payment REAL NOT NULL,
    interest_per_month REAL,
    last_updated TEXT,
    priority INTEGER
  );
`)

// Read Excel
const xlsxPath = path.join(
  process.env.HOME || "/Users/nathan",
  "Dropbox",
  "Master_Finances.xlsx",
)
if (!fs.existsSync(xlsxPath)) {
  console.error("Excel file not found at", xlsxPath)
  process.exit(1)
}
const wb = XLSX.readFile(xlsxPath)

function getSheet(name: string): any[][] {
  const ws = wb.Sheets[name]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })
}

function toNum(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toStr(v: any): string {
  return v == null ? "" : String(v).trim()
}

// --- Expense Log ---
const expenseData = getSheet("Expense Log")
const expenseInsert = sqlite.prepare(`
  INSERT INTO expenses (month, date, vendor, amount, category, client, client_pays, notes, gmail_link, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const summaryNames = new Set([
  "SUMMARY",
  "Biz Subscription",
  "Biz Per-Client",
  "Biz One-Time",
  "Personal",
  "Income",
  "Total Business",
  "Total Personal",
  "Uncategorized",
])

for (let i = 2; i < expenseData.length; i++) {
  const row = expenseData[i]
  const vendor = toStr(row[2])
  if (!vendor || summaryNames.has(vendor)) continue

  const statusRaw = toStr(row[9])
  let status = ""
  if (statusRaw.includes("\u26A0")) {
    status = "warning"
  }

  expenseInsert.run(
    toStr(row[0]),
    toStr(row[1]),
    vendor,
    toNum(row[3]),
    toStr(row[4]) || null,
    toStr(row[5]) || null,
    toNum(row[6]),
    toStr(row[7]) || null,
    toStr(row[8]) || null,
    status || null,
  )
}

// --- Business P&L: Revenue Items ---
const plData = getSheet("Business P&L")
const revenueInsert = sqlite.prepare(`
  INSERT INTO revenue_items (section, name, feb_paid, feb_expected, mar_expected, mar_base, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

let currentSection = ""
for (let i = 2; i < 24; i++) {
  const row = plData[i]
  const name = toStr(row[0])
  if (!name) continue

  if (name === "RECURRING HOSTING") {
    currentSection = "Recurring Hosting"
    continue
  }
  if (name === "RECURRING PROJECTS") {
    currentSection = "Recurring Projects"
    continue
  }
  if (name === "ONE-TIME PROJECTS") {
    currentSection = "One-Time Projects"
    continue
  }
  if (name.startsWith("Total ") || name === "TOTAL INCOME") continue

  revenueInsert.run(
    currentSection,
    name,
    toNum(row[1]),
    toNum(row[2]),
    toNum(row[3]),
    toNum(row[4]),
    toStr(row[5]) || null,
  )
}

// --- Business P&L: Business Expenses ---
const bizExpInsert = sqlite.prepare(`
  INSERT INTO business_expenses (name, type, feb_paid, feb_expected, mar_expected, mar_base, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

let expType = "recurring"
for (let i = 27; i < 52; i++) {
  const row = plData[i]
  if (!row) continue
  const name = toStr(row[0])
  if (!name) continue

  if (name === "RECURRING EXPENSES") {
    expType = "recurring"
    continue
  }
  if (name === "ONE-TIME EXPENSES") {
    expType = "one-time"
    continue
  }
  if (
    name.startsWith("Subtotal") ||
    name === "TOTAL EXPENSES" ||
    name === "NET INCOME"
  )
    continue

  bizExpInsert.run(
    name,
    expType,
    toNum(row[1]),
    toNum(row[2]),
    toNum(row[3]),
    toNum(row[4]),
    toStr(row[5]) || null,
  )
}

// --- Profit First Config ---
const pfData = getSheet("Profit First")
const pfInsert = sqlite.prepare(`
  INSERT INTO profit_first_config (account, target_percent, description) VALUES (?, ?, ?)
`)

for (let i = 3; i <= 6; i++) {
  const row = pfData[i]
  pfInsert.run(toStr(row[0]), toNum(row[1]) ?? 0, toStr(row[2]) || null)
}

// --- Personal Income ---
const pbData = getSheet("Personal Budget")
const piInsert = sqlite.prepare(`
  INSERT INTO personal_income (source, monthly, per_paycheck, notes) VALUES (?, ?, ?, ?)
`)

for (let i = 3; i <= 5; i++) {
  const row = pbData[i]
  const source = toStr(row[0])
  if (!source || source === "TOTAL INCOME") continue
  piInsert.run(source, toNum(row[1]), toNum(row[2]), toStr(row[3]) || null)
}

// --- Personal Expenses ---
const peInsert = sqlite.prepare(`
  INSERT INTO personal_expenses (name, monthly, due_date, notes) VALUES (?, ?, ?, ?)
`)

for (let i = 10; i <= 23; i++) {
  const row = pbData[i]
  const name = toStr(row[0])
  if (!name || name === "TOTAL EXPENSES") continue
  peInsert.run(name, toNum(row[1]), toStr(row[2]) || null, toStr(row[3]) || null)
}

// --- Savings Goals ---
const sgInsert = sqlite.prepare(`
  INSERT INTO savings_goals (name, monthly_target, per_paycheck, notes) VALUES (?, ?, ?, ?)
`)

for (let i = 28; i <= 32; i++) {
  const row = pbData[i]
  const name = toStr(row[0])
  if (!name || name === "TOTAL SAVINGS") continue
  sgInsert.run(name, toNum(row[1]), toNum(row[2]), toStr(row[3]) || null)
}

// --- Debt Tracker ---
const dtData = getSheet("Debt Tracker")
const debtInsert = sqlite.prepare(`
  INSERT INTO debts (account, balance, apr, min_payment, interest_per_month, last_updated, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

for (let i = 2; i <= 19; i++) {
  const row = dtData[i]
  const account = toStr(row[0])
  if (!account || account === "TOTALS") continue
  const balance = toNum(row[1])
  if (balance == null) continue

  debtInsert.run(
    account,
    balance,
    toNum(row[2]) ?? 0,
    toNum(row[3]) ?? 0,
    toNum(row[4]),
    toStr(row[5]) || null,
    toNum(row[6]),
  )
}

sqlite.close()
console.log("Database seeded successfully at", dbPath)
