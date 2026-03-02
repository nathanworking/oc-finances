export type ProfitFirstAllocation = {
  ownersPay: number
  tax: number
  profit: number
  opex: number
}

export function calculateProfitFirst(
  revenue: number,
  percentages: {
    ownersPay: number
    tax: number
    profit: number
    opex: number
  },
): ProfitFirstAllocation {
  return {
    ownersPay: revenue * percentages.ownersPay,
    tax: revenue * percentages.tax,
    profit: revenue * percentages.profit,
    opex: revenue * percentages.opex,
  }
}

export type DebtPayoffMonth = {
  month: number
  totalBalance: number
  interest: number
  totalPayment: number
  snowball: number
  targetCard: string
  paidOff: string | null
}

export function calculateAvalanchePayoff(
  debtsInput: {
    account: string
    balance: number
    apr: number
    minPayment: number
  }[],
  extraMonthly: number,
): DebtPayoffMonth[] {
  const debts = debtsInput.map((d) => ({ ...d, balance: d.balance }))
  const months: DebtPayoffMonth[] = []
  let month = 0

  while (debts.some((d) => d.balance > 0) && month < 360) {
    month++
    const totalBalance = debts.reduce((s, d) => s + Math.max(0, d.balance), 0)
    let totalInterest = 0
    let totalPayment = 0
    let paidOff: string | null = null

    // Calculate interest
    for (const d of debts) {
      if (d.balance > 0) {
        const interest = (d.balance * d.apr) / 12
        d.balance += interest
        totalInterest += interest
      }
    }

    // Sort by APR descending (avalanche)
    const active = debts.filter((d) => d.balance > 0)
    active.sort((a, b) => b.apr - a.apr)

    // Pay minimums first
    let remaining = extraMonthly
    for (const d of active) {
      const payment = Math.min(d.minPayment, d.balance)
      d.balance -= payment
      totalPayment += payment
      if (d.balance <= 0.01) {
        d.balance = 0
        remaining += d.minPayment
        if (!paidOff) paidOff = d.account
      }
    }

    // Apply extra to highest APR
    const target = debts
      .filter((d) => d.balance > 0)
      .sort((a, b) => b.apr - a.apr)[0]
    if (target) {
      const extra = Math.min(remaining, target.balance)
      target.balance -= extra
      totalPayment += extra
      if (target.balance <= 0.01) {
        target.balance = 0
        if (!paidOff) paidOff = target.account
      }

      months.push({
        month,
        totalBalance,
        interest: totalInterest,
        totalPayment,
        snowball: extraMonthly,
        targetCard: target.account,
        paidOff,
      })
    } else {
      break
    }
  }

  return months
}

export function calculateDailyCost(balance: number, apr: number): number {
  return (balance * apr) / 365
}

export function calculateMonthlyInterest(
  balance: number,
  apr: number,
): number {
  return (balance * apr) / 12
}
