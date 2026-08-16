"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  CheckCircle,
  Wallet,
  DollarSign,
  PiggyBank,
  BarChart3,
} from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface OverviewData {
  totalSpent: number;
  totalIncome: number;
  netCashFlow: number;
  savingsRate: number;
  spentChange: number;
  incomeChange: number;
  cashFlowChange: number;
  savingsRateChange: number;
  transactionCount: number;
  topCategory: string | null;
  topMerchant: string | null;
}

interface CategorySpending {
  categoryName: string;
  total: number;
  percentage: number;
}

interface RecentTransaction {
  id: string;
  amount: number;
  type: string;
  transactionDate: string;
  merchant: { name: string } | null;
  category: { name: string } | null;
}

const COLORS = [
  "bg-blue-500", "bg-orange-500", "bg-purple-500",
  "bg-emerald-500", "bg-pink-500", "bg-yellow-500", "bg-gray-400",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [categories, setCategories] = useState<CategorySpending[]>([]);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ovRes, catRes, txRes] = await Promise.all([
          fetch("/api/analytics/overview"),
          fetch("/api/analytics/categories"),
          fetch("/api/transactions?pageSize=5&sort=transactionDate&order=desc"),
        ]);
        if (ovRes.ok) {
          const data = await ovRes.json();
          setOverview(data);
        }
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories((data as CategorySpending[]).slice(0, 5));
        }
        if (txRes.ok) {
          const data = await txRes.json();
          setTransactions(data.transactions ?? []);
        }
      } catch {
        // API not available yet — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/gmail/sync", { method: "POST" });
      window.location.reload();
    } catch {
      setSyncing(false);
    }
  };

  const stats = overview
    ? [
        {
          label: "Total Spent",
          amount: overview.totalSpent,
          change: overview.spentChange,
          icon: DollarSign,
          color: "text-red-600 dark:text-red-400",
          bg: "bg-red-50 dark:bg-red-900/20",
        },
        {
          label: "Total Income",
          amount: overview.totalIncome,
          change: overview.incomeChange,
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-900/20",
        },
        {
          label: "Net Cash Flow",
          amount: overview.netCashFlow,
          change: overview.cashFlowChange,
          icon: Wallet,
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
          label: "Savings Rate",
          amount: overview.savingsRate,
          change: overview.savingsRateChange,
          isSavingsRate: true,
          icon: PiggyBank,
          color: "text-purple-600 dark:text-purple-400",
          bg: "bg-purple-50 dark:bg-purple-900/20",
        },
      ]
    : [];

  const showEmptyState = !loading && !overview;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {firstName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {showEmptyState
            ? "Connect Gmail to see your financial overview."
            : "Here’s your financial summary for this month."}
        </p>
      </div>

      {showEmptyState ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No transactions yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Gmail to automatically discover and categorize your financial transactions.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  </div>
                ))
              : stats.map((stat) => {
                  const Icon = stat.icon;
                  const isPositive = stat.change >= 0;
                  return (
                    <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
                        <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {"isSavingsRate" in stat && stat.isSavingsRate
                          ? `${stat.amount.toFixed(1)}%`
                          : formatCurrency(stat.amount)}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {Math.abs(stat.change).toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">vs last month</span>
                      </div>
                    </div>
                  );
                })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Spending by category */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h3>
              {categories.length > 0 ? (
                <div className="space-y-3">
                  {categories.map((cat, i) => (
                    <div key={cat.categoryName}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{cat.categoryName}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${COLORS[i % COLORS.length]} rounded-full`} style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No spending data yet.</p>
              )}
            </div>

            {/* Recent transactions */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                <Link href="/transactions" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">View all</Link>
              </div>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isIncome = tx.type === "INCOME";
                    const amount = Number(tx.amount);
                    return (
                      <Link
                        key={tx.id}
                        href={`/transactions/${tx.id}`}
                        className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {tx.merchant?.name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tx.category?.name ?? "Uncategorized"} &middot; {new Date(tx.transactionDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"}`}>
                          {isIncome ? "+" : "-"}{formatCurrency(amount)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4">No transactions yet. Connect Gmail to get started.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left cursor-pointer disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{syncing ? "Syncing..." : "Sync Gmail"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fetch latest transactions</p>
          </div>
        </button>
        <Link
          href="/transactions"
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">View Transactions</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Browse all transactions</p>
          </div>
        </Link>
        <Link
          href="/review"
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Review Items</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Items needing attention</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
