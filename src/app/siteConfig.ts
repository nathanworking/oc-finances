export const siteConfig = {
  name: "OC Finances",
  url: "http://localhost:3000",
  description: "GoodCraft financial management dashboard",
  baseLinks: {
    dashboard: "/",
    expenses: "/expenses",
    triage: "/triage",
    business: "/business",
    profitFirst: "/profit-first",
    personal: "/personal",
    debt: "/debt",
  },
}

export type siteConfig = typeof siteConfig
