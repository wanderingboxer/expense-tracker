"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Copy,
  Tag,
  Store,
  ArrowLeftRight,
  RotateCcw,
  Merge,
  Split,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  Loader2,
} from "lucide-react";

type ReviewItem = {
  id: string;
  type: string;
  status: string;
  transaction?: {
    merchant?: { name: string } | null;
    amount: number;
    transactionDate: string;
    category?: { id: string; name: string } | null;
  } | null;
  relatedTransaction?: {
    merchant?: { name: string } | null;
    amount: number;
    transactionDate: string;
  } | null;
  matchScore?: number | null;
  matchReasons?: string[] | null;
  suggestedAction?: Record<string, unknown> | null;
  description?: string | null;
};

const TYPE_MAP: Record<string, string> = {
  POSSIBLE_DUPLICATE: "duplicate",
  UNCERTAIN_CATEGORY: "category",
  UNKNOWN_MERCHANT: "merchant",
  POSSIBLE_TRANSFER: "transfer",
  POSSIBLE_REFUND: "refund",
};

const TYPE_ICONS: Record<string, typeof Copy> = {
  duplicate: Copy,
  category: Tag,
  merchant: Store,
  transfer: ArrowLeftRight,
  refund: RotateCcw,
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch("/api/review");
      if (r.ok) {
        const data = await r.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resolve = async (id: string, action: string, categoryId?: string) => {
    setResolving(id);
    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewItemId: id, action, ...(categoryId ? { categoryId } : {}) }),
      });
      if (r.ok) {
        // Remove resolved item from list
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setResolving(null);
    }
  };

  const normalizedType = (item: ReviewItem) => TYPE_MAP[item.type] || item.type;

  const pending = items.filter((i) => i.status === "PENDING");
  const resolved = items.filter((i) => i.status !== "PENDING");
  const pendingByType = (type: string) => pending.filter((i) => normalizedType(i) === type);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  const renderItem = (item: ReviewItem) => {
    const type = normalizedType(item);
    const isResolving = resolving === item.id;
    const isPending = item.status === "PENDING";

    if (type === "duplicate") {
      const tx1 = item.transaction;
      const tx2 = item.relatedTransaction;
      return (
        <Card key={item.id} className={cn(!isPending && "opacity-60")}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Possible Duplicate
                  </h3>
                  {item.matchScore != null && (
                    <Badge variant="outline" className="text-xs">
                      {item.matchScore}% match
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[tx1, tx2].map((tx, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {tx?.merchant?.name || "Unknown"}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(tx?.amount ?? 0))}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tx?.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : ""}
                  </p>
                </div>
              ))}
            </div>

            {item.matchReasons && item.matchReasons.length > 0 && (
              <div className="mb-4 space-y-1">
                {item.matchReasons.map((r, i) => (
                  <p key={i} className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                    {r}
                  </p>
                ))}
              </div>
            )}

            {isPending && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => resolve(item.id, "accept_merge")} disabled={isResolving}>
                  {isResolving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Merge className="w-4 h-4 mr-1" />}
                  Merge
                </Button>
                <Button variant="outline" size="sm" onClick={() => resolve(item.id, "keep_separate")} disabled={isResolving}>
                  <Split className="w-4 h-4 mr-1" />
                  Keep Separate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (type === "category") {
      const tx = item.transaction;
      const suggested = item.suggestedAction as Record<string, unknown> | null;
      const suggestedCategoryName = (suggested?.categoryName as string) || "Suggested";
      const currentCategoryName = tx?.category?.name || "Uncategorized";
      const confidence = suggested?.confidence as number | undefined;
      return (
        <Card key={item.id} className={cn(!isPending && "opacity-60")}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Category Suggestion
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">{tx?.merchant?.name || "Unknown"}</span> &middot;{" "}
                  {formatCurrency(Number(tx?.amount ?? 0))} &middot;{" "}
                  {tx?.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : ""}
                </p>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {currentCategoryName}
                  </Badge>
                  <span className="text-gray-400">&rarr;</span>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {suggestedCategoryName}
                  </Badge>
                  {confidence != null && (
                    <span className="text-xs text-gray-500">
                      ({confidence}% confidence)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={() => resolve(item.id, "accept_category")} disabled={isResolving}>
                  {isResolving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Accept
                </Button>
                <Button variant="outline" size="sm" onClick={() => resolve(item.id, "dismiss")} disabled={isResolving}>
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (type === "merchant") {
      const suggested = item.suggestedAction as Record<string, unknown> | null;
      const merchantName = item.description || item.transaction?.merchant?.name || "Unknown";
      return (
        <Card key={item.id} className={cn(!isPending && "opacity-60")}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Unknown Merchant
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                    {merchantName}
                  </code>
                </p>
                {suggested?.suggestedMerchantName ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Suggestion: Map to {String(suggested.suggestedMerchantName)}
                  </p>
                ) : null}
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={() => resolve(item.id, "accept_category")} disabled={isResolving}>
                  {isResolving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Accept Suggestion
                </Button>
                <Button variant="outline" size="sm" onClick={() => resolve(item.id, "dismiss")} disabled={isResolving}>
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review Center</h2>
            {pending.length > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {pending.length}
              </Badge>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review and resolve flagged items
          </p>
        </div>
      </div>

      {pending.length === 0 && resolved.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PartyPopper className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              All caught up!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              There are no items requiring your review. We will notify you when new items need attention.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">
              All {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicates {pendingByType("duplicate").length > 0 && `(${pendingByType("duplicate").length})`}
            </TabsTrigger>
            <TabsTrigger value="categories">
              Categories {pendingByType("category").length > 0 && `(${pendingByType("category").length})`}
            </TabsTrigger>
            <TabsTrigger value="merchants">
              Merchants {pendingByType("merchant").length > 0 && `(${pendingByType("merchant").length})`}
            </TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
          </TabsList>

          {["all", "duplicates", "categories", "merchants", "transfers", "refunds"].map((tab) => {
            const typeMap: Record<string, string> = {
              duplicates: "duplicate",
              categories: "category",
              merchants: "merchant",
              transfers: "transfer",
              refunds: "refund",
            };
            const filtered =
              tab === "all" ? pending : pending.filter((i) => normalizedType(i) === typeMap[tab]);

            return (
              <TabsContent key={tab} value={tab} className="space-y-4 mt-6">
                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">No pending items here</p>
                    </CardContent>
                  </Card>
                ) : (
                  filtered.map(renderItem)
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showResolved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Resolved Items ({resolved.length})
          </button>
          {showResolved && (
            <div className="space-y-4 mt-4">{resolved.map(renderItem)}</div>
          )}
        </div>
      )}
    </div>
  );
}
