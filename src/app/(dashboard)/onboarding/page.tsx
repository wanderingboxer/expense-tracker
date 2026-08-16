"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Tags,
  BarChart3,
  Clock,
  SkipForward,
  PartyPopper,
  Eye,
  ChevronRight,
  Lock,
} from "lucide-react";

interface SyncStats {
  emailsScanned: number;
  financialEmailsFound: number;
  transactionsCreated: number;
  duplicatesMerged: number;
  itemsForReview: number;
}

interface ReviewItem {
  id: string;
  type: string;
  description: string;
  amount?: number;
  merchantRaw?: string;
  suggestedCategory?: string;
}

const STEPS = ["welcome", "connect", "progress", "review", "ready"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    emailsScanned: 0,
    financialEmailsFound: 0,
    transactionsCreated: 0,
    duplicatesMerged: 0,
    itemsForReview: 0,
  });
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(currentStep);
  const overallProgress = ((stepIndex + 1) / STEPS.length) * 100;

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  }, [currentStep]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  }, [currentStep]);

  // Connect Gmail
  const handleConnectGmail = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/connect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error(data.error || "Failed to connect Gmail");
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  // Sync Gmail
  useEffect(() => {
    if (currentStep !== "progress") return;
    let cancelled = false;

    const runSync = async () => {
      setSyncing(true);
      setSyncComplete(false);
      setError(null);
      try {
        const res = await fetch("/api/gmail/sync", { method: "POST" });
        if (!res.ok) throw new Error("Sync failed");
        const data = await res.json();
        if (!cancelled) {
          setSyncStats({
            emailsScanned: data.emailsScanned ?? 0,
            financialEmailsFound: data.financialEmailsFound ?? 0,
            transactionsCreated: data.transactionsCreated ?? 0,
            duplicatesMerged: data.duplicatesMerged ?? 0,
            itemsForReview: data.itemsForReview ?? 0,
          });
          setSyncComplete(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Sync failed");
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };

    // Animate stats incrementally
    const animateStats = () => {
      const stages = [
        { emailsScanned: 47 },
        { emailsScanned: 128, financialEmailsFound: 12 },
        { emailsScanned: 256, financialEmailsFound: 31 },
        { emailsScanned: 384, financialEmailsFound: 48, transactionsCreated: 15 },
        { emailsScanned: 512, financialEmailsFound: 64, transactionsCreated: 38, duplicatesMerged: 4 },
      ];

      stages.forEach((stage, i) => {
        setTimeout(() => {
          if (!cancelled) {
            setSyncStats((prev) => ({ ...prev, ...stage }));
          }
        }, (i + 1) * 800);
      });
    };

    animateStats();
    runSync();

    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  // Fetch review items
  useEffect(() => {
    if (currentStep !== "review") return;
    let cancelled = false;

    const fetchReview = async () => {
      setReviewLoading(true);
      try {
        const res = await fetch("/api/review?limit=5");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setReviewItems(data.items ?? []);
        }
      } catch {
        // Non-critical, user can skip
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    };

    fetchReview();
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  const handleReviewLater = (id: string) => {
    setResolvedItems((prev) => new Set(prev).add(id));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span>{Math.round(overallProgress)}% complete</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors",
                  i <= stepIndex
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < stepIndex ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        {currentStep === "welcome" && (
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="text-6xl mb-2">
                <span role="img" aria-label="money">💰📊✨</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome to FinanceFlow
                </h1>
                <p className="text-muted-foreground text-lg">
                  Understand where your money goes
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 pt-4">
                <Card className="border bg-muted/50">
                  <CardContent className="pt-6 text-center space-y-2">
                    <Search className="w-8 h-8 mx-auto text-emerald-600" />
                    <h3 className="font-semibold text-sm">Automatic Discovery</h3>
                    <p className="text-xs text-muted-foreground">
                      We scan your emails to find transactions automatically
                    </p>
                  </CardContent>
                </Card>
                <Card className="border bg-muted/50">
                  <CardContent className="pt-6 text-center space-y-2">
                    <Tags className="w-8 h-8 mx-auto text-emerald-600" />
                    <h3 className="font-semibold text-sm">Smart Categorization</h3>
                    <p className="text-xs text-muted-foreground">
                      Transactions are categorized using intelligent rules
                    </p>
                  </CardContent>
                </Card>
                <Card className="border bg-muted/50">
                  <CardContent className="pt-6 text-center space-y-2">
                    <BarChart3 className="w-8 h-8 mx-auto text-emerald-600" />
                    <h3 className="font-semibold text-sm">Financial Insights</h3>
                    <p className="text-xs text-muted-foreground">
                      Visualize spending patterns and track budgets
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                onClick={goNext}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === "connect" && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">Connect Your Gmail</CardTitle>
              <CardDescription className="text-base">
                FinanceFlow reads your financial emails to automatically detect
                and categorize transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                <Lock className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  We only read financial emails. We never send, delete, or modify your emails.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Read financial emails", icon: Eye },
                  { label: "Detect transactions", icon: Search },
                  { label: "Sync new activity", icon: Sparkles },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex flex-col items-center gap-3 pt-2">
                <Button
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleConnectGmail}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Connect Gmail
                    </>
                  )}
                </Button>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                  onClick={() => {
                    setCurrentStep("ready");
                  }}
                >
                  Skip for now
                </button>
              </div>

              <div className="flex justify-start pt-2">
                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "progress" && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Importing Your Data</CardTitle>
              <CardDescription>
                Scanning your Gmail for financial emails...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {syncComplete ? "Complete" : "Scanning..."}
                  </span>
                </div>
                <Progress
                  value={syncComplete ? 100 : Math.min(90, (syncStats.emailsScanned / 600) * 100)}
                  className="h-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: "Emails scanned", value: syncStats.emailsScanned, icon: Mail },
                  { label: "Financial emails", value: syncStats.financialEmailsFound, icon: ShieldCheck },
                  { label: "Transactions", value: syncStats.transactionsCreated, icon: ArrowRight },
                  { label: "Duplicates merged", value: syncStats.duplicatesMerged, icon: CheckCircle2 },
                  { label: "For review", value: syncStats.itemsForReview, icon: Eye },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-lg border p-3 text-center space-y-1"
                  >
                    <Icon className="w-4 h-4 mx-auto text-muted-foreground" />
                    <p className="text-2xl font-bold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {syncing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>This may take a minute...</span>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {syncComplete && (
                <div className="flex justify-center pt-2">
                  <Button
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={goNext}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === "review" && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Quick Review</CardTitle>
              <CardDescription>
                These items need your attention. You can review them now or later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviewLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviewItems.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
                  <p className="font-medium">Nothing to review right now</p>
                  <p className="text-sm text-muted-foreground">
                    All transactions were categorized automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 transition-opacity",
                        resolvedItems.has(item.id) && "opacity-40"
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.merchantRaw || item.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {item.type.replace(/_/g, " ")}
                          </Badge>
                          {item.suggestedCategory && (
                            <span className="text-xs text-muted-foreground">
                              {item.suggestedCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      {!resolvedItems.has(item.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReviewLater(item.id)}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Later
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={goNext}
                >
                  {reviewItems.length === 0 ? "Continue" : "Skip for Now"}
                  <SkipForward className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "ready" && (
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <PartyPopper className="w-10 h-10 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  You&apos;re all set!
                </h1>
                <p className="text-muted-foreground">
                  Your financial dashboard is ready.
                </p>
              </div>

              {(syncStats.transactionsCreated > 0 || syncStats.itemsForReview > 0) && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {syncStats.transactionsCreated} transactions imported
                  </Badge>
                  {syncStats.duplicatesMerged > 0 && (
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {syncStats.duplicatesMerged} duplicates merged
                    </Badge>
                  )}
                  {syncStats.itemsForReview > 0 && (
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {syncStats.itemsForReview} for review
                    </Badge>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => router.push("/")}
              >
                Go to Dashboard
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
