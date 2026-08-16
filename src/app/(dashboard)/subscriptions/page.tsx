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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CreditCard,
  Plus,
  Pause,
  XCircle,
  Edit2,
  Calendar,
  RefreshCw,
  IndianRupee,
  Repeat,
} from "lucide-react";

type Subscription = {
  id: string;
  merchant: string;
  amount: number;
  frequency: "monthly" | "yearly" | "weekly";
  nextDate: string;
  category: string;
  status: "active" | "paused" | "cancelled";
};

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: "1", merchant: "Netflix", amount: 649, frequency: "monthly", nextDate: "2026-09-01", category: "Entertainment", status: "active" },
  { id: "2", merchant: "Spotify", amount: 119, frequency: "monthly", nextDate: "2026-09-05", category: "Entertainment", status: "active" },
  { id: "3", merchant: "Amazon Prime", amount: 1499, frequency: "yearly", nextDate: "2027-01-15", category: "Shopping", status: "active" },
  { id: "4", merchant: "YouTube Premium", amount: 129, frequency: "monthly", nextDate: "2026-09-10", category: "Entertainment", status: "paused" },
  { id: "5", merchant: "iCloud Storage", amount: 75, frequency: "monthly", nextDate: "2026-09-03", category: "Technology", status: "active" },
  { id: "6", merchant: "Gym Membership", amount: 2000, frequency: "monthly", nextDate: "2026-09-01", category: "Health & Fitness", status: "active" },
  { id: "7", merchant: "Hotstar", amount: 299, frequency: "monthly", nextDate: "2026-09-12", category: "Entertainment", status: "cancelled" },
];

const frequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  weekly: "Weekly",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSub, setNewSub] = useState({ merchant: "", amount: "", frequency: "monthly", category: "" });

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSubscriptions(d?.subscriptions ?? MOCK_SUBSCRIPTIONS))
      .catch(() => setSubscriptions(MOCK_SUBSCRIPTIONS))
      .finally(() => setLoading(false));
  }, []);

  const active = subscriptions.filter((s) => s.status === "active");
  const monthlyCost = active.reduce((sum, s) => {
    if (s.frequency === "monthly") return sum + s.amount;
    if (s.frequency === "yearly") return sum + s.amount / 12;
    if (s.frequency === "weekly") return sum + s.amount * 4.33;
    return sum;
  }, 0);
  const yearlyCost = monthlyCost * 12;

  const handleAction = (id: string, action: "pause" | "cancel" | "resume") => {
    setSubscriptions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (action === "pause") return { ...s, status: "paused" as const };
        if (action === "cancel") return { ...s, status: "cancelled" as const };
        return { ...s, status: "active" as const };
      })
    );
  };

  const handleAdd = () => {
    if (!newSub.merchant || !newSub.amount) return;
    const sub: Subscription = {
      id: Date.now().toString(),
      merchant: newSub.merchant,
      amount: parseFloat(newSub.amount),
      frequency: newSub.frequency as Subscription["frequency"],
      nextDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      category: newSub.category || "Other",
      status: "active",
    };
    setSubscriptions((prev) => [sub, ...prev]);
    setNewSub({ merchant: "", amount: "", frequency: "monthly", category: "" });
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscriptions
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track and manage your recurring payments
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Merchant Name
                </label>
                <Input
                  placeholder="e.g. Netflix"
                  value={newSub.merchant}
                  onChange={(e) => setNewSub((p) => ({ ...p, merchant: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newSub.amount}
                  onChange={(e) => setNewSub((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Frequency
                </label>
                <select
                  value={newSub.frequency}
                  onChange={(e) => setNewSub((p) => ({ ...p, frequency: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Category
                </label>
                <Input
                  placeholder="e.g. Entertainment"
                  value={newSub.category}
                  onChange={(e) => setNewSub((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{active.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(monthlyCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Yearly Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(yearlyCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription list */}
      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No subscriptions yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
              Add your recurring payments to track how much you spend on subscriptions each month.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Subscription
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className={cn(sub.status === "cancelled" && "opacity-60")}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{sub.merchant}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{frequencyLabels[sub.frequency]}</p>
                  </div>
                  <Badge className={cn("text-xs", statusColors[sub.status])}>
                    {sub.status}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {formatCurrency(sub.amount)}
                  <span className="text-sm font-normal text-gray-400">
                    /{sub.frequency === "yearly" ? "yr" : sub.frequency === "weekly" ? "wk" : "mo"}
                  </span>
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Next: {sub.nextDate}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {sub.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {sub.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleAction(sub.id, "pause")}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                    {sub.status === "paused" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleAction(sub.id, "resume")}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    {sub.status !== "cancelled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => handleAction(sub.id, "cancel")}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
