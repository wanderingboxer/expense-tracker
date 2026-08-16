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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  period: "monthly" | "weekly" | "yearly";
};

const MOCK_BUDGETS: Budget[] = [
  { id: "1", category: "Food & Dining", limit: 10000, spent: 8500, period: "monthly" },
  { id: "2", category: "Shopping", limit: 8000, spent: 5200, period: "monthly" },
  { id: "3", category: "Transport", limit: 5000, spent: 3800, period: "monthly" },
  { id: "4", category: "Entertainment", limit: 3000, spent: 1230, period: "monthly" },
  { id: "5", category: "Utilities", limit: 3000, spent: 1500, period: "monthly" },
  { id: "6", category: "Housing", limit: 26000, spent: 25000, period: "monthly" },
];

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transport",
  "Entertainment",
  "Utilities",
  "Housing",
  "Health & Fitness",
  "Education",
  "Groceries",
  "Other",
];

function getProgressColor(percentage: number) {
  if (percentage > 90) return "text-red-600 dark:text-red-400";
  if (percentage > 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function getProgressBarColor(percentage: number) {
  if (percentage > 90) return "[&>div]:bg-red-500";
  if (percentage > 75) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-emerald-500";
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState({ category: "", limit: "", period: "monthly" });

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBudgets(d?.budgets ?? MOCK_BUDGETS))
      .catch(() => setBudgets(MOCK_BUDGETS))
      .finally(() => setLoading(false));
  }, []);

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const handleCreate = () => {
    if (!form.category || !form.limit) return;
    const b: Budget = {
      id: Date.now().toString(),
      category: form.category,
      limit: parseFloat(form.limit),
      spent: 0,
      period: form.period as Budget["period"],
    };
    setBudgets((prev) => [...prev, b]);
    setForm({ category: "", limit: "", period: "monthly" });
    setCreateOpen(false);
  };

  const handleEdit = () => {
    if (!editBudget || !form.limit) return;
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === editBudget.id
          ? { ...b, limit: parseFloat(form.limit), period: form.period as Budget["period"] }
          : b
      )
    );
    setEditBudget(null);
    setForm({ category: "", limit: "", period: "monthly" });
  };

  const handleDelete = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Set spending limits and track your progress
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.filter((c) => !budgets.some((b) => b.category === c)).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Budget Limit
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.limit}
                  onChange={(e) => setForm((p) => ({ ...p, limit: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Period
                </label>
                <select
                  value={form.period}
                  onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Overall Monthly Budget
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalSpent)} of {formatCurrency(totalLimit)}
              </p>
            </div>
            <span className={cn("text-2xl font-bold", getProgressColor(overallPct))}>
              {overallPct}%
            </span>
          </div>
          <Progress value={Math.min(overallPct, 100)} className={cn("h-3", getProgressBarColor(overallPct))} />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {formatCurrency(Math.max(totalLimit - totalSpent, 0))} remaining
          </p>
        </CardContent>
      </Card>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No budgets yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
              Create budgets for your spending categories to stay on track with your financial goals.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const pct = Math.round((budget.spent / budget.limit) * 100);
            const remaining = budget.limit - budget.spent;
            return (
              <Card key={budget.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {budget.category}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">{budget.period}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditBudget(budget);
                          setForm({
                            category: budget.category,
                            limit: budget.limit.toString(),
                            period: budget.period,
                          });
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(budget.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                    </span>
                    <span className={cn("text-sm font-bold", getProgressColor(pct))}>
                      {pct}%
                    </span>
                  </div>

                  <Progress
                    value={Math.min(pct, 100)}
                    className={cn("h-2 mb-2", getProgressBarColor(pct))}
                  />

                  <p
                    className={cn(
                      "text-xs",
                      remaining >= 0
                        ? "text-gray-500 dark:text-gray-400"
                        : "text-red-600 dark:text-red-400 font-medium"
                    )}
                  >
                    {remaining >= 0
                      ? `${formatCurrency(remaining)} remaining`
                      : `${formatCurrency(Math.abs(remaining))} over budget`}
                  </p>

                  {pct > 90 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Approaching limit</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editBudget} onOpenChange={(open) => !open && setEditBudget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget - {editBudget?.category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Budget Limit
              </label>
              <Input
                type="number"
                value={form.limit}
                onChange={(e) => setForm((p) => ({ ...p, limit: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Period
              </label>
              <select
                value={form.period}
                onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudget(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
