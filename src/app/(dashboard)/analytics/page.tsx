"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Store,
  CreditCard,
  BarChart3,
} from "lucide-react";

// ── Types matching real API responses ──

type OverviewData = {
  totalSpent: number;
  totalIncome: number;
  netCashFlow: number;
  savingsRate: number;
  transactionCount: number;
  topCategory: { id: string; name: string; total: number } | null;
  topMerchant: { id: string; name: string; total: number } | null;
  previousPeriod: { totalSpent: number; spendingChange: number };
};

type CategoryData = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  total: number;
  percentage: number;
  transactionCount: number;
};

type MerchantData = {
  merchantId: string;
  merchantName: string;
  total: number;
  transactionCount: number;
  avgTransaction: number;
};

type MonthlyData = {
  month: number;
  year: number;
  totalSpent: number;
  totalIncome: number;
  savings: number;
  transactionCount: number;
};

const CHART_COLORS = [
  "hsl(142, 76%, 36%)",
  "hsl(217, 91%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(25, 95%, 53%)",
  "hsl(346, 87%, 43%)",
  "hsl(47, 96%, 53%)",
  "hsl(186, 73%, 46%)",
  "hsl(330, 81%, 60%)",
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dateRanges = [
  { label: "This Month", value: "month" },
  { label: "Last 3 Months", value: "3months" },
  { label: "Last 6 Months", value: "6months" },
  { label: "This Year", value: "year" },
];

function getDateRange(range: string): { dateFrom: string; dateTo: string; months: number } {
  const now = new Date();
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  let dateFrom: Date;
  let months: number;

  switch (range) {
    case "month":
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      months = 1;
      break;
    case "3months":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      months = 3;
      break;
    case "6months":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      months = 6;
      break;
    case "year":
      dateFrom = new Date(now.getFullYear(), 0, 1);
      months = now.getMonth() + 1;
      break;
    default:
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      months = 6;
  }

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    months,
  };
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("6months");

  const fetchData = useCallback(async (range: string) => {
    setLoading(true);
    const { dateFrom, dateTo, months } = getDateRange(range);
    const qs = `dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

    try {
      const [ovRes, catRes, merRes, moRes] = await Promise.all([
        fetch(`/api/analytics/overview?${qs}`),
        fetch(`/api/analytics/categories?${qs}`),
        fetch(`/api/analytics/merchants?${qs}&limit=10`),
        fetch(`/api/analytics/monthly?months=${months}`),
      ]);

      const [ovData, catData, merData, moData] = await Promise.all([
        ovRes.ok ? ovRes.json() : null,
        catRes.ok ? catRes.json() : [],
        merRes.ok ? merRes.json() : [],
        moRes.ok ? moRes.json() : [],
      ]);

      setOverview(ovData);
      setCategories(catData ?? []);
      setMerchants(merData ?? []);
      setMonthly(moData ?? []);
    } catch {
      setOverview(null);
      setCategories([]);
      setMerchants([]);
      setMonthly([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange, fetchData]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Deep dive into your spending patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {dateRanges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {overview ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Spending"
                  value={formatCurrency(overview.totalSpent)}
                  change={overview.previousPeriod.spendingChange}
                  icon={<CreditCard className="w-4 h-4" />}
                />
                <StatCard
                  label="Total Income"
                  value={formatCurrency(overview.totalIncome)}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <StatCard
                  label="Net Cash Flow"
                  value={formatCurrency(overview.netCashFlow)}
                  positive={overview.netCashFlow >= 0}
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <StatCard
                  label="Savings Rate"
                  value={`${overview.savingsRate}%`}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Transactions</CardDescription>
                    <CardTitle className="text-2xl">{overview.transactionCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Top Category</CardDescription>
                    <CardTitle className="text-lg">
                      {overview.topCategory?.name ?? "N/A"}
                    </CardTitle>
                    {overview.topCategory && (
                      <p className="text-sm text-gray-500">{formatCurrency(overview.topCategory.total)}</p>
                    )}
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Top Merchant</CardDescription>
                    <CardTitle className="text-lg">
                      {overview.topMerchant?.name ?? "N/A"}
                    </CardTitle>
                    {overview.topMerchant && (
                      <p className="text-sm text-gray-500">{formatCurrency(overview.topMerchant.total)}</p>
                    )}
                  </CardHeader>
                </Card>
              </div>

              {/* Monthly spending bar chart */}
              {monthly.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Spending Trend</CardTitle>
                    <CardDescription>Monthly spending over the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CSSBarChart
                      data={monthly.map((m) => ({
                        label: `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`,
                        value: m.totalSpent,
                      }))}
                      color="hsl(346, 87%, 43%)"
                      formatValue={formatCurrency}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Income vs Expense */}
              {monthly.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Income vs Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CSSDoubleBarChart
                      data={monthly.map((m) => ({
                        label: `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`,
                        value1: m.totalIncome,
                        value2: m.totalSpent,
                      }))}
                      label1="Income"
                      label2="Expenses"
                      color1="hsl(142, 76%, 36%)"
                      color2="hsl(346, 87%, 43%)"
                      formatValue={formatCurrency}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <EmptyState message="No analytics data available for this period." />
          )}
        </TabsContent>

        {/* ── Categories Tab ── */}
        <TabsContent value="categories" className="space-y-6 mt-6">
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spending by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.map((cat, i) => (
                      <div key={cat.categoryId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                              style={{ backgroundColor: cat.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="text-sm text-gray-900 dark:text-white">{cat.categoryName}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(cat.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${cat.percentage}%`,
                                backgroundColor: cat.color ?? CHART_COLORS[i % CHART_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">{cat.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 font-medium text-gray-500">Category</th>
                          <th className="text-right py-2 font-medium text-gray-500">Amount</th>
                          <th className="text-right py-2 font-medium text-gray-500">%</th>
                          <th className="text-right py-2 font-medium text-gray-500">Txns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat, i) => (
                          <tr
                            key={cat.categoryId}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <td className="py-3 flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: cat.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="text-gray-900 dark:text-white">{cat.categoryName}</span>
                            </td>
                            <td className="text-right text-gray-900 dark:text-white font-medium">
                              {formatCurrency(cat.total)}
                            </td>
                            <td className="text-right text-gray-500">{cat.percentage}%</td>
                            <td className="text-right text-gray-500">{cat.transactionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState message="No category data available for this period." />
          )}
        </TabsContent>

        {/* ── Monthly Tab ── */}
        <TabsContent value="monthly" className="space-y-6 mt-6">
          {monthly.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <CSSStackedBarChart
                    data={monthly.map((m) => ({
                      label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
                      values: [
                        { value: m.totalIncome, color: "hsl(142, 76%, 36%)", name: "Income" },
                        { value: m.totalSpent, color: "hsl(346, 87%, 43%)", name: "Spent" },
                        { value: Math.max(0, m.savings), color: "hsl(217, 91%, 60%)", name: "Savings" },
                      ],
                    }))}
                    formatValue={formatCurrency}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Month Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 font-medium text-gray-500">Month</th>
                          <th className="text-right py-2 font-medium text-gray-500">Spent</th>
                          <th className="text-right py-2 font-medium text-gray-500">Income</th>
                          <th className="text-right py-2 font-medium text-gray-500">Savings</th>
                          <th className="text-right py-2 font-medium text-gray-500 hidden md:table-cell">Txns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthly].reverse().map((m) => (
                          <tr key={`${m.year}-${m.month}`} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 text-gray-900 dark:text-white font-medium">
                              {MONTH_NAMES[m.month - 1]} {m.year}
                            </td>
                            <td className="text-right text-red-600 dark:text-red-400">
                              {formatCurrency(m.totalSpent)}
                            </td>
                            <td className="text-right text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(m.totalIncome)}
                            </td>
                            <td className="text-right text-blue-600 dark:text-blue-400">
                              {formatCurrency(m.savings)}
                            </td>
                            <td className="text-right text-gray-500 hidden md:table-cell">
                              {m.transactionCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState message="No monthly data available for this period." />
          )}
        </TabsContent>

        {/* ── Merchants Tab ── */}
        <TabsContent value="merchants" className="mt-6">
          {merchants.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Merchants</CardTitle>
                <CardDescription>Your most frequented merchants this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-500">#</th>
                        <th className="text-left py-2 font-medium text-gray-500">Merchant</th>
                        <th className="text-right py-2 font-medium text-gray-500">Total Spent</th>
                        <th className="text-right py-2 font-medium text-gray-500">Txns</th>
                        <th className="text-right py-2 font-medium text-gray-500 hidden sm:table-cell">Avg Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {merchants.map((m, i) => (
                        <tr key={m.merchantId} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 text-gray-400">{i + 1}</td>
                          <td className="py-3 text-gray-900 dark:text-white font-medium">{m.merchantName}</td>
                          <td className="text-right text-gray-900 dark:text-white font-medium">
                            {formatCurrency(m.total)}
                          </td>
                          <td className="text-right text-gray-500">{m.transactionCount}</td>
                          <td className="text-right text-gray-500 hidden sm:table-cell">
                            {formatCurrency(m.avgTransaction)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual bar breakdown for merchants */}
                <div className="mt-6 space-y-3">
                  {(() => {
                    const maxTotal = Math.max(...merchants.map((m) => m.total), 1);
                    return merchants.map((m, i) => (
                      <div key={m.merchantId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-28 truncate flex-shrink-0">
                          {m.merchantName}
                        </span>
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{
                              width: `${(m.total / maxTotal) * 100}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0">
                          {formatCurrency(m.total)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No merchant data available for this period." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── CSS Bar Chart Components ──

function CSSBarChart({
  data,
  color,
  formatValue,
}: {
  data: { label: string; value: number }[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-52">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <span className="text-xs text-gray-500 truncate max-w-full">{formatValue(d.value)}</span>
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{
              height: `${(d.value / maxVal) * 80}%`,
              backgroundColor: color,
              minHeight: d.value > 0 ? "4px" : "0",
            }}
          />
          <span className="text-xs text-gray-500 truncate max-w-full">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function CSSDoubleBarChart({
  data,
  label1,
  label2,
  color1,
  color2,
  formatValue,
}: {
  data: { label: string; value1: number; value2: number }[];
  label1: string;
  label2: string;
  color1: string;
  color2: string;
  formatValue: (v: number) => string;
}) {
  const maxVal = Math.max(...data.flatMap((d) => [d.value1, d.value2]), 1);
  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: color1 }} /> {label1}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: color2 }} /> {label2}
        </span>
      </div>
      <div className="flex items-end gap-3 h-48">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="flex gap-1 w-full h-full items-end justify-center">
              <div
                className="flex-1 rounded-t transition-all duration-500"
                style={{
                  height: `${(d.value1 / maxVal) * 100}%`,
                  backgroundColor: color1,
                  minHeight: d.value1 > 0 ? "4px" : "0",
                }}
                title={`${label1}: ${formatValue(d.value1)}`}
              />
              <div
                className="flex-1 rounded-t transition-all duration-500"
                style={{
                  height: `${(d.value2 / maxVal) * 100}%`,
                  backgroundColor: color2,
                  minHeight: d.value2 > 0 ? "4px" : "0",
                }}
                title={`${label2}: ${formatValue(d.value2)}`}
              />
            </div>
            <span className="text-xs text-gray-500 truncate max-w-full">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CSSStackedBarChart({
  data,
  formatValue,
}: {
  data: { label: string; values: { value: number; color: string; name: string }[] }[];
  formatValue: (v: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(...d.values.map((v) => v.value))), 1);

  // Legend
  const legendItems = data[0]?.values.map((v) => ({ name: v.name, color: v.color })) ?? [];

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        {legendItems.map((l) => (
          <span key={l.name} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} /> {l.name}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-3 h-48">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="flex gap-1 w-full h-full items-end justify-center">
              {d.values.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all duration-500"
                  style={{
                    height: `${(v.value / maxVal) * 100}%`,
                    backgroundColor: v.color,
                    minHeight: v.value > 0 ? "4px" : "0",
                  }}
                  title={`${v.name}: ${formatValue(v.value)}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-full">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  change,
  positive,
  icon,
}: {
  label: string;
  value: string;
  change?: number;
  positive?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
          <span className="text-gray-400">{icon}</span>
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {change > 0 ? (
              <ArrowUpRight className="w-3 h-3 text-red-500" />
            ) : change < 0 ? (
              <ArrowDownRight className="w-3 h-3 text-emerald-500" />
            ) : null}
            <span
              className={`text-xs ${
                change > 0
                  ? "text-red-500"
                  : change < 0
                  ? "text-emerald-500"
                  : "text-gray-400"
              }`}
            >
              {change > 0 ? "+" : ""}
              {change}% vs prev period
            </span>
          </div>
        )}
        {positive !== undefined && change === undefined && (
          <span className={`text-xs ${positive ? "text-emerald-500" : "text-red-500"}`}>
            {positive ? "Positive" : "Negative"}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

// ── Empty State ──

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">{message}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Try selecting a different date range or add some transactions.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ──

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
