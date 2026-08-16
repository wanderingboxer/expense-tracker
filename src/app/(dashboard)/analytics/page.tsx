"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  CreditCard,
  Store,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";

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

type SpendingTrend = { month: string; amount: number };
type IncomeExpense = { month: string; income: number; expense: number };
type SavingsRate = { month: string; rate: number };
type CategoryBreakdown = {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
};
type MonthStats = {
  month: string;
  spent: number;
  income: number;
  savings: number;
  topCategory: string;
  largestTx: number;
};
type MerchantData = {
  merchant: string;
  totalSpent: number;
  txCount: number;
  avgTransaction: number;
  trend: "up" | "down" | "stable";
};
type PaymentMethodData = {
  method: string;
  amount: number;
  count: number;
  percentage: number;
};

type AnalyticsData = {
  spendingTrend: SpendingTrend[];
  incomeExpense: IncomeExpense[];
  savingsRate: SavingsRate[];
  categories: CategoryBreakdown[];
  monthlyStats: MonthStats[];
  merchants: MerchantData[];
  paymentMethods: PaymentMethodData[];
};

const MOCK_DATA: AnalyticsData = {
  spendingTrend: [
    { month: "Mar", amount: 38500 },
    { month: "Apr", amount: 42200 },
    { month: "May", amount: 35800 },
    { month: "Jun", amount: 44100 },
    { month: "Jul", amount: 39900 },
    { month: "Aug", amount: 45230 },
  ],
  incomeExpense: [
    { month: "Mar", income: 85000, expense: 38500 },
    { month: "Apr", income: 85000, expense: 42200 },
    { month: "May", income: 87000, expense: 35800 },
    { month: "Jun", income: 85000, expense: 44100 },
    { month: "Jul", income: 85000, expense: 39900 },
    { month: "Aug", income: 85000, expense: 45230 },
  ],
  savingsRate: [
    { month: "Mar", rate: 54.7 },
    { month: "Apr", rate: 50.4 },
    { month: "May", rate: 58.9 },
    { month: "Jun", rate: 48.1 },
    { month: "Jul", rate: 53.1 },
    { month: "Aug", rate: 46.8 },
  ],
  categories: [
    { category: "Housing", amount: 25000, percentage: 55.3, transactionCount: 1 },
    { category: "Food & Dining", amount: 8500, percentage: 18.8, transactionCount: 24 },
    { category: "Shopping", amount: 5200, percentage: 11.5, transactionCount: 8 },
    { category: "Transport", amount: 3800, percentage: 8.4, transactionCount: 15 },
    { category: "Utilities", amount: 1500, percentage: 3.3, transactionCount: 5 },
    { category: "Entertainment", amount: 1230, percentage: 2.7, transactionCount: 3 },
  ],
  monthlyStats: [
    { month: "Aug 2026", spent: 45230, income: 85000, savings: 39770, topCategory: "Housing", largestTx: 25000 },
    { month: "Jul 2026", spent: 39900, income: 85000, savings: 45100, topCategory: "Housing", largestTx: 25000 },
    { month: "Jun 2026", spent: 44100, income: 85000, savings: 40900, topCategory: "Housing", largestTx: 25000 },
    { month: "May 2026", spent: 35800, income: 87000, savings: 51200, topCategory: "Housing", largestTx: 25000 },
    { month: "Apr 2026", spent: 42200, income: 85000, savings: 42800, topCategory: "Housing", largestTx: 25000 },
    { month: "Mar 2026", spent: 38500, income: 85000, savings: 46500, topCategory: "Housing", largestTx: 25000 },
  ],
  merchants: [
    { merchant: "House Rent", totalSpent: 25000, txCount: 1, avgTransaction: 25000, trend: "stable" },
    { merchant: "Swiggy", totalSpent: 4500, txCount: 12, avgTransaction: 375, trend: "up" },
    { merchant: "Amazon India", totalSpent: 3200, txCount: 4, avgTransaction: 800, trend: "down" },
    { merchant: "Zomato", totalSpent: 3100, txCount: 10, avgTransaction: 310, trend: "up" },
    { merchant: "Uber", totalSpent: 2400, txCount: 8, avgTransaction: 300, trend: "stable" },
    { merchant: "Flipkart", totalSpent: 1800, txCount: 3, avgTransaction: 600, trend: "down" },
    { merchant: "BigBasket", totalSpent: 1500, txCount: 4, avgTransaction: 375, trend: "up" },
    { merchant: "Netflix", totalSpent: 649, txCount: 1, avgTransaction: 649, trend: "stable" },
    { merchant: "Jio Recharge", totalSpent: 299, txCount: 1, avgTransaction: 299, trend: "stable" },
    { merchant: "Spotify", totalSpent: 119, txCount: 1, avgTransaction: 119, trend: "stable" },
  ],
  paymentMethods: [
    { method: "UPI", amount: 18500, count: 35, percentage: 40.9 },
    { method: "Credit Card", amount: 12800, count: 12, percentage: 28.3 },
    { method: "Bank Transfer", amount: 10200, count: 5, percentage: 22.5 },
    { method: "Debit Card", amount: 3730, count: 8, percentage: 8.3 },
  ],
};

const dateRanges = [
  { label: "This Month", value: "month" },
  { label: "Last 3 Months", value: "3months" },
  { label: "Last 6 Months", value: "6months" },
  { label: "This Year", value: "year" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("6months");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?range=${dateRange}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d ?? MOCK_DATA))
      .catch(() => setData(MOCK_DATA))
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) return <LoadingSkeleton />;

  const d = data!;

  return (
    <div className="space-y-6">
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
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending Trend</CardTitle>
              <CardDescription>Your spending over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.spendingTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Spending"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.incomeExpense}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="income" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Income" />
                      <Bar dataKey="expense" fill="hsl(346, 87%, 43%)" radius={[4, 4, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Savings Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.savingsRate}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="hsl(217, 91%, 60%)"
                        fill="hsl(217, 91%, 60%)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        name="Savings Rate"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={d.categories}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {d.categories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
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
                      {d.categories.map((cat, i) => (
                        <tr
                          key={cat.category}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        >
                          <td className="py-3 flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full inline-block"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="text-gray-900 dark:text-white">{cat.category}</span>
                          </td>
                          <td className="text-right text-gray-900 dark:text-white font-medium">
                            {formatCurrency(cat.amount)}
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
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" fontSize={12} tickFormatter={(v) => v.split(" ")[0]} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="spent" fill="hsl(346, 87%, 43%)" radius={[4, 4, 0, 0]} name="Spent" />
                    <Bar dataKey="savings" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Savings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
                      <th className="text-left py-2 font-medium text-gray-500 hidden md:table-cell">Top Category</th>
                      <th className="text-right py-2 font-medium text-gray-500 hidden md:table-cell">Largest Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.monthlyStats.map((m) => (
                      <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-3 text-gray-900 dark:text-white font-medium">{m.month}</td>
                        <td className="text-right text-red-600 dark:text-red-400">{formatCurrency(m.spent)}</td>
                        <td className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(m.income)}</td>
                        <td className="text-right text-blue-600 dark:text-blue-400">{formatCurrency(m.savings)}</td>
                        <td className="text-left text-gray-500 hidden md:table-cell">{m.topCategory}</td>
                        <td className="text-right text-gray-500 hidden md:table-cell">{formatCurrency(m.largestTx)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="mt-6">
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
                      <th className="text-center py-2 font-medium text-gray-500 hidden sm:table-cell">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.merchants.map((m, i) => (
                      <tr key={m.merchant} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-3 text-gray-400">{i + 1}</td>
                        <td className="py-3 text-gray-900 dark:text-white font-medium">{m.merchant}</td>
                        <td className="text-right text-gray-900 dark:text-white font-medium">
                          {formatCurrency(m.totalSpent)}
                        </td>
                        <td className="text-right text-gray-500">{m.txCount}</td>
                        <td className="text-right text-gray-500 hidden sm:table-cell">
                          {formatCurrency(m.avgTransaction)}
                        </td>
                        <td className="text-center hidden sm:table-cell">
                          {m.trend === "up" && <ArrowUpRight className="w-4 h-4 text-red-500 inline" />}
                          {m.trend === "down" && <ArrowDownRight className="w-4 h-4 text-emerald-500 inline" />}
                          {m.trend === "stable" && <span className="text-gray-400">--</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={d.paymentMethods}
                        dataKey="amount"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {d.paymentMethods.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {d.paymentMethods.map((pm, i) => (
                    <div key={pm.method}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{pm.method}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(pm.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pm.percentage}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{pm.percentage}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{pm.count} transactions</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
