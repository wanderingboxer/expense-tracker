"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Tag,
  Building2,
  Mail,
  Shield,
  Edit2,
  ArrowLeftRight,
  EyeOff,
  Briefcase,
  User,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

// Matches the Prisma model shape returned by GET /api/transactions/[id]
type ApiTransaction = {
  id: string;
  amount: number | string;
  currency: string;
  type: string;
  transactionDate: string;
  transactionTime: string | null;
  paymentMethod: string;
  status: string;
  confidence: number | null;
  isExcluded: boolean;
  isReviewed: boolean;
  personalBusiness: string;
  notes: string | null;
  categoryId: string | null;
  accountLast4: string | null;
  cardLast4: string | null;
  merchant: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  financialAccount?: { id: string; name: string; accountLast4?: string } | null;
  evidence: {
    id: string;
    matchConfidence: number;
    matchReasons: string[];
    financialEmail: {
      id: string;
      senderEmail: string;
      subject: string;
      receivedAt: string;
    };
  }[];
  linkedTransaction: {
    id: string;
    amount: number | string;
    type: string;
    transactionDate: string;
    merchant?: { name: string } | null;
  } | null;
};

const typeColors: Record<string, string> = {
  EXPENSE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  INCOME: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  TRANSFER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REFUND: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function formatPaymentMethod(method: string): string {
  return method
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatType(type: string): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tx, setTx] = useState<ApiTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ categoryId: "", paymentMethod: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/transactions/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Transaction not found" : "Failed to load transaction");
        return r.json();
      })
      .then((data) => setTx(data))
      .catch((err) => setError(err.message ?? "Failed to load transaction"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function patchTransaction(body: Record<string, unknown>) {
    const res = await fetch(`/api/transactions/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ? JSON.stringify(err.error) : "Update failed");
    }
    return res.json();
  }

  async function handleAction(actionKey: string, action: () => Promise<void>) {
    setActionLoading(actionKey);
    try {
      await action();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">{error ?? "Transaction not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/transactions")}>
          Back to Transactions
        </Button>
      </div>
    );
  }

  const amount = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
  const isIncome = amount > 0 || tx.type === "INCOME";
  const merchantName = tx.merchant?.name ?? "Unknown Merchant";
  const categoryName = tx.category?.name ?? "Uncategorized";
  const accountLabel = tx.accountLast4
    ? `Account ****${tx.accountLast4}`
    : tx.cardLast4
      ? `Card ****${tx.cardLast4}`
      : "N/A";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/transactions")} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Transactions
      </Button>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{merchantName}</h2>
        <p
          className={cn(
            "text-3xl font-bold mt-1",
            isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"
          )}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(Math.abs(amount))}
        </p>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Date &amp; Time</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(tx.transactionDate)}{tx.transactionTime ? ` at ${tx.transactionTime}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <Badge className={cn("text-xs", typeColors[tx.type] ?? typeColors.EXPENSE)}>
                  {formatType(tx.type)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{categoryName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatPaymentMethod(tx.paymentMethod)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Account</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{accountLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge className={cn("text-xs", statusColors[tx.status] ?? statusColors.COMPLETED)}>
                  {formatType(tx.status)}
                </Badge>
              </div>
            </div>
          </div>
          {tx.confidence != null && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Match Confidence</p>
                <div className="flex items-center gap-3">
                  <Progress value={tx.confidence} className="h-2 flex-1" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(tx.confidence)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Evidence */}
      {tx.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Evidence</CardTitle>
            <CardDescription>Emails that were matched to create this transaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tx.evidence.map((ev) => (
              <div
                key={ev.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {ev.financialEmail.subject}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      From: {ev.financialEmail.senderEmail} &middot;{" "}
                      {formatDate(ev.financialEmail.receivedAt)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Confidence:</span>
                      <Progress value={ev.matchConfidence} className="h-1.5 w-20" />
                      <span className="text-xs font-medium">{Math.round(ev.matchConfidence)}%</span>
                    </div>
                    {Array.isArray(ev.matchReasons) && ev.matchReasons.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ev.matchReasons.map((reason, i) => (
                          <p key={i} className="text-xs text-gray-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            {reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditForm({ categoryId: tx.categoryId ?? "", paymentMethod: tx.paymentMethod });
                setEditOpen(true);
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Category
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading === "transfer" || tx.type === "TRANSFER"}
              onClick={() =>
                handleAction("transfer", async () => {
                  const updated = await patchTransaction({ type: "TRANSFER" });
                  setTx(updated);
                })
              }
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              {actionLoading === "transfer" ? "Saving..." : "Mark as Transfer"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading === "exclude" || tx.isExcluded}
              onClick={() =>
                handleAction("exclude", async () => {
                  const res = await fetch(`/api/transactions/${params.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Failed to exclude transaction");
                  router.push("/transactions");
                })
              }
            >
              <EyeOff className="w-4 h-4 mr-2" />
              {actionLoading === "exclude" ? "Excluding..." : "Exclude"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading === "business" || tx.personalBusiness === "BUSINESS"}
              onClick={() =>
                handleAction("business", async () => {
                  const updated = await patchTransaction({ personalBusiness: "BUSINESS" });
                  setTx(updated);
                })
              }
            >
              <Briefcase className="w-4 h-4 mr-2" />
              {actionLoading === "business" ? "Saving..." : "Mark Business"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading === "personal" || tx.personalBusiness === "PERSONAL"}
              onClick={() =>
                handleAction("personal", async () => {
                  const updated = await patchTransaction({ personalBusiness: "PERSONAL" });
                  setTx(updated);
                })
              }
            >
              <User className="w-4 h-4 mr-2" />
              {actionLoading === "personal" ? "Saving..." : "Mark Personal"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Related (linked transaction) */}
      {tx.linkedTransaction && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 -mx-2"
                onClick={() => router.push(`/transactions/${tx.linkedTransaction!.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {tx.linkedTransaction.merchant?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(tx.linkedTransaction.transactionDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-xs",
                      typeColors[tx.linkedTransaction.type] ?? typeColors.EXPENSE
                    )}
                  >
                    {formatType(tx.linkedTransaction.type)}
                  </Badge>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      Number(tx.linkedTransaction.amount) > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-900 dark:text-white"
                    )}
                  >
                    {Number(tx.linkedTransaction.amount) > 0 ? "+" : ""}
                    {formatCurrency(Math.abs(Number(tx.linkedTransaction.amount)))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Category
              </label>
              <select
                value={editForm.categoryId}
                onChange={(e) => setEditForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Payment Method
              </label>
              <Input
                value={editForm.paymentMethod}
                onChange={(e) => setEditForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const body: Record<string, unknown> = {
                    categoryId: editForm.categoryId || null,
                  };
                  const updated = await patchTransaction(body);
                  setTx(updated);
                  setEditOpen(false);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to save");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
