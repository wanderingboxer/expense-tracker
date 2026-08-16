"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  X,
  RefreshCw,
  ShieldAlert,
  ArrowUpRight,
  Zap,
} from "lucide-react";

type Insight = {
  id: string;
  title: string;
  description: string;
  type: "alert" | "trend" | "recommendation" | "anomaly";
  priority: "high" | "medium" | "low";
  data?: { label: string; value: number; max?: number };
};

const TYPE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  alert: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  trend: { icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
  recommendation: { icon: Lightbulb, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  anomaly: { icon: ShieldAlert, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const MOCK_INSIGHTS: Insight[] = [
  {
    id: "1",
    title: "Food spending up 23% this month",
    description: "You have spent 23% more on Food & Dining compared to last month. Your average was around 6,900 per month. Consider setting a budget alert.",
    type: "alert",
    priority: "high",
    data: { label: "Food & Dining", value: 8500, max: 10000 },
  },
  {
    id: "2",
    title: "Savings rate declining",
    description: "Your savings rate has dropped from 58.9% in May to 46.8% in August. At this rate, you might want to review discretionary spending.",
    type: "trend",
    priority: "high",
    data: { label: "Current Savings Rate", value: 46.8, max: 100 },
  },
  {
    id: "3",
    title: "Consider switching to annual Netflix plan",
    description: "You have been paying monthly for Netflix for 8 months. Switching to an annual plan could save you approximately 1,200 per year.",
    type: "recommendation",
    priority: "medium",
  },
  {
    id: "4",
    title: "Unusual Flipkart transaction",
    description: "A transaction of 1,499 at Flipkart on Aug 13 is higher than your typical spending there (average 600). This might be worth reviewing.",
    type: "anomaly",
    priority: "low",
  },
  {
    id: "5",
    title: "Transport costs are stable",
    description: "Your transport spending has remained consistent at around 3,800 per month for the last 3 months. You are within your budget.",
    type: "trend",
    priority: "low",
  },
  {
    id: "6",
    title: "Set up an emergency fund budget",
    description: "Based on your income and expenses, you could save an additional 10,000 per month towards an emergency fund. We recommend 3-6 months of expenses.",
    type: "recommendation",
    priority: "medium",
  },
];

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInsights(d?.insights ?? MOCK_INSIGHTS))
      .catch(() => setInsights(MOCK_INSIGHTS))
      .finally(() => setLoading(false));
  }, []);

  const dismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  const generateNew = async () => {
    setGenerating(true);
    try {
      const r = await fetch("/api/insights", { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        if (d?.insights) setInsights(d.insights);
      }
    } catch {
      // keep existing
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered analysis of your financial patterns
          </p>
        </div>
        <Button onClick={generateNew} disabled={generating}>
          {generating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {generating ? "Generating..." : "Generate New Insights"}
        </Button>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No insights yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
              Click "Generate New Insights" to analyze your spending patterns and get personalized recommendations.
            </p>
            <Button onClick={generateNew}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const config = TYPE_CONFIG[insight.type];
            const Icon = config.icon;
            return (
              <Card key={insight.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {insight.title}
                          </h3>
                          <Badge className={cn("text-xs", PRIORITY_COLORS[insight.priority])}>
                            {insight.priority}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => dismiss(insight.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {insight.description}
                      </p>
                      {insight.data && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">{insight.data.label}</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {insight.data.max && insight.data.max <= 100
                                ? `${insight.data.value}%`
                                : formatCurrency(insight.data.value)}
                            </span>
                          </div>
                          <Progress
                            value={
                              insight.data.max
                                ? (insight.data.value / insight.data.max) * 100
                                : insight.data.value
                            }
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
