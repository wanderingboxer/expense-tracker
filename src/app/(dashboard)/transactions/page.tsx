"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type TransactionResponse = {
  id: string;
  amount: string;
  currency: string;
  type: string;
  transactionDate: string;
  transactionTime: string | null;
  paymentMethod: string;
  confidence: number | null;
  notes: string | null;
  merchant: { id: string; name: string } | null;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
};

type ApiResponse = {
  transactions: TransactionResponse[];
  total: number;
  page: number;
  pageSize: number;
};

type CategoryOption = {
  id: string;
  name: string;
};

const TRANSACTION_TYPES = [
  { value: "", label: "All Types" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "REFUND", label: "Refund" },
  { value: "CASH_WITHDRAWAL", label: "Cash Withdrawal" },
  { value: "CASHBACK", label: "Cashback" },
  { value: "FEE", label: "Fee" },
  { value: "INTEREST", label: "Interest" },
  { value: "LOAN_PAYMENT", label: "Loan Payment" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "UNKNOWN", label: "Unknown" },
];

const PAYMENT_METHODS = [
  { value: "", label: "All Methods" },
  { value: "UPI", label: "UPI" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "WALLET", label: "Wallet" },
  { value: "CASH", label: "Cash" },
  { value: "UNKNOWN", label: "Unknown" },
];

const SORTABLE_COLUMNS: Record<string, string> = {
  Date: "transactionDate",
  Merchant: "merchant",
  Amount: "amount",
  Category: "category",
  Type: "type",
  "Payment Method": "paymentMethod",
  Confidence: "confidence",
};

const PAGE_SIZE = 20;

function formatPaymentMethod(method: string): string {
  return method
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function isIncomeType(type: string): boolean {
  return ["INCOME", "CASHBACK", "REFUND", "INTEREST"].includes(type);
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Derive state from URL search params
  const page = parseInt(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const typeFilter = searchParams.get("type") ?? "";
  const methodFilter = searchParams.get("paymentMethod") ?? "";
  const sort = searchParams.get("sort") ?? "transactionDate";
  const order = (searchParams.get("order") ?? "desc") as "asc" | "desc";

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: "1" });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Sync searchInput when URL changes externally
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`/transactions?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Fetch categories for filter dropdown
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        const cats = Array.isArray(data) ? data : data.categories ?? [];
        setCategories(cats.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  // Fetch transactions
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    params.set("order", order);
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (methodFilter) params.set("paymentMethod", methodFilter);

    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        setTransactions(data.transactions ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE)));
      })
      .catch(() => {
        setTransactions([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [page, search, categoryFilter, typeFilter, methodFilter, sort, order]);

  const handleSort = (column: string) => {
    const field = SORTABLE_COLUMNS[column];
    if (!field) return;
    if (sort === field) {
      updateParams({ order: order === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: field, order: "desc" });
    }
  };

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Category"
          value={categoryFilter}
          options={[{ value: "", label: "All Categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => updateParams({ category: v, page: "1" })}
        />
        <FilterSelect
          label="Type"
          value={typeFilter}
          options={TRANSACTION_TYPES}
          onChange={(v) => updateParams({ type: v, page: "1" })}
        />
        <FilterSelect
          label="Payment"
          value={methodFilter}
          options={PAYMENT_METHODS}
          onChange={(v) => updateParams({ paymentMethod: v, page: "1" })}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              {["Date", "Merchant", "Amount", "Category", "Type", "Payment Method", "Confidence"].map(
                (col) => {
                  const field = SORTABLE_COLUMNS[col];
                  const isActive = sort === field;
                  return (
                    <th
                      key={col}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      <span
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort(col)}
                      >
                        {col}
                        {isActive ? (
                          order === "asc" ? (
                            <ArrowUp className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-emerald-500" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  );
                }
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: j === 1 ? "120px" : j === 6 ? "80px" : "70px" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const income = isIncomeType(tx.type);
                const amount = parseFloat(tx.amount);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => router.push(`/transactions/${tx.id}`)}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {tx.merchant?.name ?? "Unknown"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-semibold whitespace-nowrap",
                        income
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-900 dark:text-white"
                      )}
                    >
                      {income ? "+" : "-"}
                      {formatCurrency(Math.abs(amount))}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {tx.category?.name ?? "Uncategorized"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          income
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                      >
                        {formatType(tx.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatPaymentMethod(tx.paymentMethod)}
                    </td>
                    <td className="px-4 py-3">
                      {tx.confidence != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                tx.confidence >= 95
                                  ? "bg-emerald-500"
                                  : tx.confidence >= 85
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              )}
                              style={{ width: `${tx.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(tx.confidence * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total === 0
            ? "No transactions"
            : `Showing ${startItem}–${endItem} of ${total} transactions`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
              acc.push(p);
              return acc;
            }, [])
            .map((item, i) =>
              item === "ellipsis" ? (
                <span key={`e${i}`} className="px-1 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => updateParams({ page: String(item) })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium",
                    item === page
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  {item}
                </button>
              )
            )}
          <button
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
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
          <option key={opt.value} value={opt.value}>
            {label}: {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
