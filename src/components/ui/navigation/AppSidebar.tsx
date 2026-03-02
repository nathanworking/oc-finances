"use client"
import { Divider } from "@/components/Divider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/Sidebar"
import {
  Banknote,
  CalendarDays,
  CreditCard,
  House,
  Inbox,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { DropdownUserProfile } from "./DropdownUserProfile"

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
  },
  {
    name: "Triage",
    href: "/triage",
    icon: Inbox,
  },
  {
    name: "Business P&L",
    href: "/business",
    icon: TrendingUp,
  },
  {
    name: "Profit First",
    href: "/profit-first",
    icon: PiggyBank,
  },
  {
    name: "Personal Budget",
    href: "/personal",
    icon: Banknote,
  },
  {
    name: "Debt Tracker",
    href: "/debt",
    icon: CreditCard,
  },
  {
    name: "Cash Flow",
    href: "/cashflow",
    icon: CalendarDays,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar {...props} className="bg-gray-50 dark:bg-gray-925">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-emerald-600 p-1.5 text-white shadow-sm">
            <House className="size-5" />
          </span>
          <div>
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">
              OC Finances
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              GoodCraft
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-3">
          <Divider className="my-0 py-0" />
        </div>
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink
                    href={item.href}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                    icon={item.icon}
                  >
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="border-t border-gray-200 dark:border-gray-800" />
        <DropdownUserProfile>
          <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-gray-900 hover:bg-gray-200/50 dark:text-gray-50 hover:dark:bg-gray-900">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              NC
            </span>
            <span>Nathan</span>
          </button>
        </DropdownUserProfile>
      </SidebarFooter>
    </Sidebar>
  )
}
