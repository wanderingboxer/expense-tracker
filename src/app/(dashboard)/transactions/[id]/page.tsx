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
} from "lucide-react";

type Evidence = {
  id: string;
  sender: string;
  subject: string;
  date: string;
  matchConfidence: number;
  matchReasons: string[];
};

type TransactionDetail = {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  time: string;
  type: "expense" | "income" | "transfer" | "refund";
  category: string;
  paymentMethod: string;
  account: string;
  status: "confirmed" | "pending" | "excluded";
  confidence: number;
  evidence: Evidence[];
  matchExplanation: string[];
  relatedTransactions: { id: string; merchant: string; amount: number; date: string; type: string }[];
};

const MOCK_TX: TransactionDetail = {
  id: "1",
  merchant: "Amazon India",
  amount: -2999,
  date: "2026-08-14",
  time: "14:32",
  type: "expense",
  category: "Shopping",
  paymentMethod: "Credit Card",
  account: "HDFC Credit Card ****4521",
  status: "confirmed",
  confidence: 98,
  evidence: [
    {
      id: "e1",
      sender: "auto-confirm@amazon.in",
      subject: "Your Amazon.in order #402-1234567-8901234 has been placed",
      date: "2026-08-14",
      matchConfidence: 98,
      matchReasons: ["Amount matches order total", "Date matches order date", "Merchant name in sender domain"],
    },
    {
      id: "e2",
      sender: "noreply@hdfcbank.net",
      subject: "Transaction Alert: INR 2,999.00 debited from your HDFC Credit Card",
      date: "2026-08-14",
      matchConfidence: 95,
      matchReasons: ["Amount matches exactly", "Same date", "Credit card number matches"],
    },
  ],
  matchExplanation: [
    "Two emails received within 30 minutes of each other on the same date",
    "Transaction amount of 2,999.00 matches across both sources",
    "Amazon order confirmation correlates with HDFC bank debit alert",
    "Credit card ending 4521 identified in both emails",
  ],
  relatedTransactions: [
    { id: "r1", merchant: "Amazon India - Refund", amount: 499, date: "2026-08-16", type: "refund" },
  ],
};

const typeColors: Record<string, string> = {
  expense: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  income: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  transfer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  refund: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const statusColors: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  excluded: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ category: "", paymentMethod: "" });

  useEffect(() => {
    fetch(`/api/transactions/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTx(d?.transaction ?? MOCK_TX))
      .catch(() => setTx(MOCK_TX))
      .finally(() => setLoading(false));
  }, [params.id]);

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

  if (!tx) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Transaction not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/transactions")}>
          Back to Transactions
        </Button>
      </div>
    );
  }

  const isIncome = tx.amount > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/transactions")} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Transactions
      </Button>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{tx.merchant}</h2>
        <p
          className={cn(
            "text-3xl font-bold mt-1",
            isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"
          )}
        >
          {isIncome ? "+" : ""}
          {formatCurrency(Math.abs(tx.amount))}
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
                  {formatDate(tx.date)} at {tx.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <Badge className={cn("text-xs", typeColors[tx.type])}>{tx.type}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.paymentMethod}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Account</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.account}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge className={cn("text-xs", statusColors[tx.status])}>{tx.status}</Badge>
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <p className="text-xs text-gray-500 mb-1">Match Confidence</p>
            <div className="flex items-center gap-3">
              <Progress value={tx.confidence} className="h-2 flex-1" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.confidence}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence */}
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
                    {ev.subject}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    From: {ev.sender} &middot; {formatDate(ev.date)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <Progress value={ev.matchConfidence} className="h-1.5 w-20" />
                    <span className="text-xs font-medium">{ev.matchConfidence}%</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {ev.matchReasons.map((reason, i) => (
                      <p key={i} className="text-xs text-gray-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Match explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matching Explanation</CardTitle>
          <CardDescription>Why these emails were merged into one transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {tx.matchExplanation.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Shield className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
                setEditForm({ category: tx.category, paymentMethod: tx.paymentMethod });
                setEditOpen(true);
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Category
            </Button>
            <Button variant="outline" size="sm">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Mark as Transfer
            </Button>
            <Button variant="outline" size="sm">
              <EyeOff className="w-4 h-4 mr-2" />
              Exclude
            </Button>
            <Button variant="outline" size="sm">
              <Briefcase className="w-4 h-4 mr-2" />
              Mark Business
            </Button>
            <Button variant="outline" size="sm">
              <User className="w-4 h-4 mr-2" />
              Mark Personal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Related */}
      {tx.relatedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.relatedTransactions.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 -mx-2"
                  onClick={() => router.push(`/transactions/${rel.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{rel.merchant}</p>
                    <p className="text-xs text-gray-500">{formatDate(rel.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs", typeColors[rel.type] || typeColors.expense)}>
                      {rel.type}
                    </Badge>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        rel.amount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-900 dark:text-white"
                      )}
                    >
                      {rel.amount > 0 ? "+" : ""}
                      {formatCurrency(Math.abs(rel.amount))}
                    </span>
                  </div>
                </div>
              ))}
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
                value={editForm.category}
                onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {["Food & Dining", "Shopping", "Transport", "Housing", "Utilities", "Entertainment", "Groceries", "Health & Fitness", "Education", "Other"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
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
              onClick={() => {
                setTx((prev) =>
                  prev
                    ? { ...prev, category: editForm.category, paymentMethod: editForm.paymentMethod }
                    : prev
                );
                setEditOpen(false);
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
