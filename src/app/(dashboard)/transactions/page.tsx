"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  type: "expense" | "income";
  paymentMethod: string;
  confidence: number;
};

const transactions: Transaction[] = [
  { id: "1", date: "2026-08-15", merchant: "Swiggy", amount: -450, category: "Food & Dining", type: "expense", paymentMethod: "UPI", confidence: 95 },
  { id: "2", date: "2026-08-14", merchant: "Amazon India", amount: -2999, category: "Shopping", type: "expense", paymentMethod: "Credit Card", confidence: 98 },
  { id: "3", date: "2026-08-14", merchant: "Uber", amount: -320, category: "Transport", type: "expense", paymentMethod: "UPI", confidence: 92 },
  { id: "4", date: "2026-08-13", merchant: "Flipkart", amount: -1499, category: "Shopping", type: "expense", paymentMethod: "Debit Card", confidence: 97 },
  { id: "5", date: "2026-08-12", merchant: "Zomato", amount: -680, category: "Food & Dining", type: "expense", paymentMethod: "UPI", confidence: 94 },
  { id: "6", date: "2026-08-10", merchant: "Jio Recharge", amount: -299, category: "Utilities", type: "expense", paymentMethod: "UPI", confidence: 99 },
  { id: "7", date: "2026-08-01", merchant: "Salary - TCS", amount: 85000, category: "Income", type: "income", paymentMethod: "Bank Transfer", confidence: 100 },
  { id: "8", date: "2026-08-01", merchant: "House Rent", amount: -25000, category: "Housing", type: "expense", paymentMethod: "Bank Transfer", confidence: 96 },
  { id: "9", date: "2026-08-01", merchant: "Netflix", amount: -649, category: "Entertainment", type: "expense", paymentMethod: "Credit Card", confidence: 99 },
  { id: "10", date: "2026-07-30", merchant: "BigBasket", amount: -1850, category: "Groceries", type: "expense", paymentMethod: "UPI", confidence: 91 },
];

const categories = ["All", "Food & Dining", "Shopping", "Transport", "Housing", "Utilities", "Entertainment", "Groceries", "Income"];
const types = ["All", "expense", "income"];
const paymentMethods = ["All", "UPI", "Credit Card", "Debit Card", "Bank Transfer"];

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");

  const filtered = transactions.filter((tx) => {
    if (search && !tx.merchant.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "All" && tx.category !== categoryFilter) return false;
    if (typeFilter !== "All" && tx.type !== typeFilter) return false;
    if (methodFilter !== "All" && tx.paymentMethod !== methodFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select label="Category" value={categoryFilter} options={categories} onChange={setCategoryFilter} />
        <Select label="Type" value={typeFilter} options={types} onChange={setTypeFilter} />
        <Select label="Payment" value={methodFilter} options={paymentMethods} onChange={setMethodFilter} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              {["Date", "Merchant", "Amount", "Category", "Type", "Payment Method", "Confidence"].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                      {col}
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <tr
                  key={tx.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {tx.merchant}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 font-semibold whitespace-nowrap",
                      isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-900 dark:text-white"
                    )}
                  >
                    {isIncome ? "+" : ""}
                    {formatCurrency(Math.abs(tx.amount))}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {tx.category}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        isIncome
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {tx.paymentMethod}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            tx.confidence >= 95 ? "bg-emerald-500" : tx.confidence >= 85 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${tx.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {tx.confidence}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filtered.length} of {transactions.length} transactions
        </p>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50" disabled>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            1
          </span>
          <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50" disabled>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {label}: {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
