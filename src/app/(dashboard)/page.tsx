"use client";

import { useSession } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  CheckCircle,
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Zap,
} from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const stats = [
  {
    label: "Total Spent",
    amount: 45230,
    change: -12.5,
    icon: TrendingDown,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  {
    label: "Total Income",
    amount: 85000,
    change: 5.2,
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    label: "Net Cash Flow",
    amount: 39770,
    change: 22.1,
    icon: TrendingUp,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "Savings Rate",
    amount: 46.8,
    change: 8.3,
    isSavingsRate: true,
    icon: TrendingUp,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
];

const recentTransactions = [
  { merchant: "Swiggy", amount: -450, category: "Food & Dining", date: "Today", icon: Utensils },
  { merchant: "Amazon India", amount: -2999, category: "Shopping", date: "Yesterday", icon: ShoppingBag },
  { merchant: "Uber", amount: -320, category: "Transport", date: "Yesterday", icon: Car },
  { merchant: "Salary - TCS", amount: 85000, category: "Income", date: "1 Aug", icon: Zap },
  { merchant: "House Rent", amount: -25000, category: "Housing", date: "1 Aug", icon: Home },
];

const categories = [
  { name: "Housing", amount: 25000, percent: 55, color: "bg-blue-500" },
  { name: "Food & Dining", amount: 8500, percent: 19, color: "bg-orange-500" },
  { name: "Shopping", amount: 5200, percent: 11, color: "bg-purple-500" },
  { name: "Transport", amount: 3800, percent: 8, color: "bg-emerald-500" },
  { name: "Other", amount: 2730, percent: 7, color: "bg-gray-400" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {firstName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Here&apos;s your financial summary for this month.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isPositive = stat.change >= 0;
          return (
            <div
              key={stat.label}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {stat.label}
                </span>
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {"isSavingsRate" in stat && stat.isSavingsRate
                  ? `${stat.amount}%`
                  : formatCurrency(stat.amount)}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {Math.abs(stat.change)}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  vs last month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending by category */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Spending by Category
          </h3>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {cat.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} rounded-full`}
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Recent Transactions
            </h3>
            <a
              href="/transactions"
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx, i) => {
              const Icon = tx.icon;
              const isIncome = tx.amount > 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {tx.merchant}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tx.category} &middot; {tx.date}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {isIncome ? "+" : ""}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly trend placeholder */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Monthly Trend
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
          Chart coming soon
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Sync Gmail", icon: RefreshCw, desc: "Fetch latest transactions" },
          { label: "Add Manual Transaction", icon: Plus, desc: "Record a cash payment" },
          { label: "Review Items", icon: CheckCircle, desc: "3 items need review" },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {action.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {action.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
