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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  name: string;
  amount: number;
  frequency: string;
  nextExpectedDate: string | null;
  category?: { id: string; name: string } | null;
  merchant?: { id: string; name: string } | null;
  isActive: boolean;
};

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

const frequencyLabels: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSub, setNewSub] = useState({ name: "", amount: "", frequency: "MONTHLY", category: "" });

  const fetchSubscriptions = useCallback(async () => {
    try {
      const r = await fetch("/api/subscriptions");
      if (r.ok) {
        const data = await r.json();
        setSubscriptions(
          (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: (s.name as string) || (s.merchant as Record<string, unknown>)?.name as string || "Subscription",
            amount: Number(s.amount),
            frequency: s.frequency as string,
            nextExpectedDate: s.nextExpectedDate as string | null,
            category: s.category as Subscription["category"],
            merchant: s.merchant as Subscription["merchant"],
            isActive: s.isActive as boolean,
          }))
        );
      } else {
        setSubscriptions([]);
      }
    } catch {
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const active = subscriptions.filter((s) => s.isActive);
  const monthlyCost = active.reduce((sum, s) => {
    const amt = s.amount;
    switch (s.frequency) {
      case "DAILY": return sum + amt * 30;
      case "WEEKLY": return sum + amt * 4.33;
      case "BIWEEKLY": return sum + amt * 2.17;
      case "MONTHLY": return sum + amt;
      case "QUARTERLY": return sum + amt / 3;
      case "YEARLY": return sum + amt / 12;
      default: return sum + amt;
    }
  }, 0);
  const yearlyCost = monthlyCost * 12;

  const handleAdd = async () => {
    if (!newSub.name || !newSub.amount) return;
    setSaving(true);
    try {
      const r = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSub.name,
          amount: parseFloat(newSub.amount),
          frequency: newSub.frequency,
        }),
      });
      if (r.ok) {
        setNewSub({ name: "", amount: "", frequency: "MONTHLY", category: "" });
        setDialogOpen(false);
        await fetchSubscriptions();
      }
    } finally {
      setSaving(false);
    }
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
    <TooltipProvider>
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
                    Name
                  </label>
                  <Input
                    placeholder="e.g. Netflix"
                    value={newSub.name}
                    onChange={(e) => setNewSub((p) => ({ ...p, name: e.target.value }))}
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
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={saving}>
                  {saving ? "Adding..." : "Add"}
                </Button>
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
            {subscriptions.map((sub) => {
              const freqLabel = frequencyLabels[sub.frequency] || sub.frequency;
              const freqShort = sub.frequency === "YEARLY" ? "yr" : sub.frequency === "WEEKLY" ? "wk" : "mo";
              return (
                <Card key={sub.id} className={cn(!sub.isActive && "opacity-60")}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {sub.merchant?.name || sub.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{freqLabel}</p>
                      </div>
                      <Badge className={cn(
                        "text-xs",
                        sub.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {sub.isActive ? "active" : "inactive"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      {formatCurrency(sub.amount)}
                      <span className="text-sm font-normal text-gray-400">
                        /{freqShort}
                      </span>
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {sub.nextExpectedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Next: {new Date(sub.nextExpectedDate).toLocaleDateString()}
                          </span>
                        )}
                        {sub.category && (
                          <Badge variant="outline" className="text-xs">
                            {sub.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {sub.isActive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-50 cursor-not-allowed"
                                  disabled
                                >
                                  <Pause className="w-4 h-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Coming soon</TooltipContent>
                          </Tooltip>
                        )}
                        {!sub.isActive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-50 cursor-not-allowed"
                                  disabled
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Coming soon</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 opacity-50 cursor-not-allowed"
                                disabled
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Coming soon</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
