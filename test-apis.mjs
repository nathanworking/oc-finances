const BASE = "http://localhost:3001"

async function testApi(path, checks) {
  try {
    const res = await fetch(BASE + path)
    const data = await res.json()
    console.log(`\n=== ${path} (HTTP ${res.status}) ===`)
    checks(data)
  } catch (e) {
    console.error(`FAIL ${path}:`, e.message)
  }
}

await testApi("/api/dashboard", (d) => {
  console.log("Business grossRevenue:", d.business.grossRevenue)
  console.log("Business totalBizExpenses:", d.business.totalBizExpenses)
  console.log("Business netBusinessIncome:", d.business.netBusinessIncome)
  console.log("PF ownersPay:", d.profitFirst.ownersPay)
  console.log("PF taxReserve:", d.profitFirst.taxReserve)
  console.log("PF profit:", d.profitFirst.profit)
  console.log("PF opex:", d.profitFirst.opex)
  console.log("Personal totalIncome:", d.personal.totalIncome)
  console.log("Personal totalExpenses:", d.personal.totalExpenses)
  console.log("Personal remaining:", d.personal.remaining)
  console.log("Debt totalBalance:", d.debt.totalBalance)
  console.log("Debt monthlyMinPayments:", d.debt.monthlyMinPayments)
  console.log("Debt monthlyInterest:", d.debt.monthlyInterest)
  console.log("Uncategorized:", d.uncategorizedCount)
})

await testApi("/api/expenses", (d) => {
  console.log("Count:", d.length)
  console.log("First:", d[0]?.vendor, "$" + d[0]?.amount)
  console.log("With category:", d.filter((e) => e.category).length)
  console.log("Without category:", d.filter((e) => !e.category).length)
  const warnings = d.filter((e) => e.status === "warning")
  console.log("Warnings:", warnings.length, warnings.map((w) => w.vendor))
})

await testApi("/api/revenue", (d) => {
  console.log("Count:", d.length)
  const sections = [...new Set(d.map((r) => r.section))]
  console.log("Sections:", sections)
  console.log("Total marExpected:", d.reduce((s, r) => s + (r.marExpected || 0), 0))
  console.log("Total marBase:", d.reduce((s, r) => s + (r.marBase || 0), 0))
})

await testApi("/api/business-expenses", (d) => {
  console.log("Count:", d.length)
  console.log("Types:", [...new Set(d.map((e) => e.type))])
  console.log("Total marExpected:", d.reduce((s, e) => s + (e.marExpected || 0), 0))
})

await testApi("/api/profit-first", (d) => {
  d.forEach((r) => console.log(r.account + ":", r.targetPercent))
  const total = d.reduce((s, r) => s + r.targetPercent, 0)
  console.log("Total:", total, total === 1 ? "OK" : "MISMATCH!")
})

await testApi("/api/personal-income", (d) => {
  d.forEach((r) => console.log(r.source + ": $" + r.monthly))
  console.log("Total:", d.reduce((s, r) => s + (r.monthly || 0), 0))
})

await testApi("/api/personal-expenses", (d) => {
  console.log("Count:", d.length)
  console.log("Total:", d.reduce((s, e) => s + (e.monthly || 0), 0))
})

await testApi("/api/savings-goals", (d) => {
  d.forEach((r) => console.log(r.name + ": $" + r.monthlyTarget))
  console.log("Total:", d.reduce((s, g) => s + (g.monthlyTarget || 0), 0))
})

await testApi("/api/debts", (d) => {
  console.log("Count:", d.length)
  console.log("Total balance:", d.reduce((s, d2) => s + d2.balance, 0))
  console.log("Total minPayment:", d.reduce((s, d2) => s + d2.minPayment, 0))
  console.log("Total interest/mo:", d.reduce((s, d2) => s + (d2.interestPerMonth || 0), 0))
  console.log("Highest APR:", d.sort((a, b) => b.apr - a.apr)[0]?.account, d.sort((a, b) => b.apr - a.apr)[0]?.apr)
})

// Test PUT on expenses (category update)
console.log("\n=== CRUD TESTS ===")
try {
  const expRes = await fetch(BASE + "/api/expenses")
  const expenses = await expRes.json()
  const testExp = expenses.find((e) => !e.category)
  if (testExp) {
    console.log("Testing category update on expense:", testExp.id, testExp.vendor)
    const putRes = await fetch(BASE + "/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: testExp.id, category: "Biz Subscription" }),
    })
    const updated = await putRes.json()
    console.log("Updated category:", updated.category, updated.category === "Biz Subscription" ? "OK" : "FAIL")

    // Revert
    await fetch(BASE + "/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: testExp.id, category: null }),
    })
    console.log("Reverted category back to null")
  }
} catch (e) {
  console.error("CRUD test failed:", e.message)
}

// Test page HTML content
console.log("\n=== PAGE CONTENT CHECKS ===")
for (const page of ["/", "/expenses", "/triage", "/business", "/profit-first", "/personal", "/debt"]) {
  const res = await fetch(BASE + page)
  const html = await res.text()
  const hasError = html.includes("Application error") || html.includes("Internal Server Error") || html.includes("Unhandled Runtime Error")
  const hasContent = html.length > 1000
  console.log(`${page}: ${res.status} | ${html.length} bytes | ${hasError ? "HAS ERRORS!" : "Clean"} | ${hasContent ? "Has content" : "EMPTY!"}`)
}
