"use client";

import { useState, useEffect, useCallback } from "react";
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
  name: string;
  amount: number;
  spent: number;
  period: string;
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  percentUsed: number;
  remaining: number;
};

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

const PERIOD_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
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
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", period: "MONTHLY" });

  const fetchBudgets = useCallback(async () => {
    try {
      const r = await fetch("/api/budgets");
      if (r.ok) {
        const data = await r.json();
        setBudgets(
          (Array.isArray(data) ? data : []).map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: (b.name as string) || (b.category as Record<string, unknown>)?.name as string || "Budget",
            amount: Number(b.amount),
            spent: Number(b.spent ?? 0),
            period: b.period as string,
            category: b.category as Budget["category"],
            categoryId: b.categoryId as string | null,
            percentUsed: Number(b.percentUsed ?? 0),
            remaining: Number(b.remaining ?? 0),
          }))
        );
      } else {
        setBudgets([]);
      }
    } catch {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const totalLimit = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const handleCreate = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    try {
      const r = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          amount: parseFloat(form.amount),
          period: form.period,
          startDate: new Date().toISOString(),
        }),
      });
      if (r.ok) {
        setForm({ name: "", amount: "", period: "MONTHLY" });
        setCreateOpen(false);
        await fetchBudgets();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editBudget || !form.amount) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/budgets/${editBudget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          period: form.period,
          ...(form.name !== editBudget.name ? { name: form.name } : {}),
        }),
      });
      if (r.ok) {
        setEditBudget(null);
        setForm({ name: "", amount: "", period: "MONTHLY" });
        await fetchBudgets();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const r = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (r.ok) {
        await fetchBudgets();
      }
    } catch {
      // silently fail
    }
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
                  Name
                </label>
                <Input
                  placeholder="e.g. Food & Dining"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Budget Limit
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
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
                  {PERIOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create"}
              </Button>
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
            const pct = Math.round(budget.percentUsed);
            const remaining = budget.remaining;
            const displayName = budget.category?.name || budget.name;
            const periodLabel = PERIOD_OPTIONS.find((o) => o.value === budget.period)?.label || budget.period;
            return (
              <Card key={budget.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {displayName}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">{periodLabel}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditBudget(budget);
                          setForm({
                            name: budget.name,
                            amount: budget.amount.toString(),
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
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
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
            <DialogTitle>Edit Budget - {editBudget?.category?.name || editBudget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Budget Limit
              </label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
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
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudget(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
