import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/generated/prisma/enums";
import { Frequency, ReviewType } from "@/generated/prisma/enums";

const AMOUNT_TOLERANCE = 0.05; // ±5%

interface IntervalSpec {
  frequency: Frequency;
  targetDays: number;
  toleranceDays: number;
}

const INTERVALS: IntervalSpec[] = [
  { frequency: Frequency.WEEKLY, targetDays: 7, toleranceDays: 3 },
  { frequency: Frequency.MONTHLY, targetDays: 30, toleranceDays: 3 },
  { frequency: Frequency.QUARTERLY, targetDays: 91, toleranceDays: 5 },
  { frequency: Frequency.YEARLY, targetDays: 365, toleranceDays: 7 },
];

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function matchInterval(gapDays: number): IntervalSpec | null {
  for (const spec of INTERVALS) {
    if (Math.abs(gapDays - spec.targetDays) <= spec.toleranceDays) {
      return spec;
    }
  }
  return null;
}

function addInterval(date: Date, frequency: Frequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case Frequency.WEEKLY:
      d.setDate(d.getDate() + 7);
      break;
    case Frequency.MONTHLY:
      d.setMonth(d.getMonth() + 1);
      break;
    case Frequency.QUARTERLY:
      d.setMonth(d.getMonth() + 3);
      break;
    case Frequency.YEARLY:
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d;
}

interface CandidateTransaction {
  id: string;
  amount: number;
  transactionDate: Date;
  categoryId: string | null;
}

/** Given a merchant's transactions (sorted ascending by date), decides
 * whether they form a recurring-charge pattern: every amount within ±5% of
 * the group's mean, and every consecutive gap matching the SAME interval
 * type within its tolerance. Returns the matched interval, or null if the
 * group isn't a consistent enough pattern. */
export function detectRecurringPattern(
  transactions: CandidateTransaction[]
): { frequency: Frequency } | null {
  if (transactions.length < 2) return null;

  const amounts = transactions.map((t) => t.amount);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  if (mean <= 0) return null;
  const amountsConsistent = amounts.every(
    (a) => Math.abs(a - mean) / mean <= AMOUNT_TOLERANCE
  );
  if (!amountsConsistent) return null;

  let matchedFrequency: Frequency | null = null;
  for (let i = 1; i < transactions.length; i++) {
    const gap = daysBetween(transactions[i - 1].transactionDate, transactions[i].transactionDate);
    const spec = matchInterval(gap);
    if (!spec) return null;
    if (matchedFrequency && matchedFrequency !== spec.frequency) return null;
    matchedFrequency = spec.frequency;
  }

  return matchedFrequency ? { frequency: matchedFrequency } : null;
}

export interface SubscriptionDetectionResult {
  merchantId: string;
  merchantName: string;
  created: boolean;
  frequency: Frequency;
}

/** Scans a user's transaction history grouped by merchant for recurring
 * charge patterns and upserts a Subscription row per detected merchant.
 * Meant to run after a Gmail sync completes. Not auto-trusted blindly for
 * the user's attention: a ReviewItem is created only the first time a given
 * merchant is newly detected (not on every subsequent sync), so the user is
 * notified once rather than repeatedly. */
export async function detectSubscriptions(
  userId: string
): Promise<SubscriptionDetectionResult[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      isExcluded: false,
      type: TransactionType.EXPENSE,
      merchantId: { not: null },
    },
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      categoryId: true,
      merchantId: true,
      merchant: { select: { id: true, name: true } },
    },
    orderBy: { transactionDate: "asc" },
  });

  const byMerchant = new Map<string, typeof transactions>();
  for (const t of transactions) {
    if (!t.merchantId) continue;
    const group = byMerchant.get(t.merchantId) ?? [];
    group.push(t);
    byMerchant.set(t.merchantId, group);
  }

  const results: SubscriptionDetectionResult[] = [];

  for (const [merchantId, group] of byMerchant) {
    const candidates: CandidateTransaction[] = group.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      transactionDate: t.transactionDate,
      categoryId: t.categoryId,
    }));

    const pattern = detectRecurringPattern(candidates);
    if (!pattern) continue;

    const latest = candidates[candidates.length - 1];
    const merchantName = group[0].merchant?.name ?? "Unknown";
    const meanAmount =
      candidates.reduce((sum, c) => sum + c.amount, 0) / candidates.length;

    const existing = await prisma.subscription.findFirst({
      where: { userId, merchantId },
    });

    const nextExpectedDate = addInterval(latest.transactionDate, pattern.frequency);

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          transactionId: latest.id,
          amount: meanAmount,
          frequency: pattern.frequency,
          lastChargeDate: latest.transactionDate,
          nextExpectedDate,
          categoryId: latest.categoryId,
          isActive: true,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          merchantId,
          transactionId: latest.id,
          name: merchantName,
          amount: meanAmount,
          frequency: pattern.frequency,
          lastChargeDate: latest.transactionDate,
          nextExpectedDate,
          categoryId: latest.categoryId,
          isActive: true,
        },
      });
    }

    if (!existing) {
      await prisma.reviewItem.create({
        data: {
          userId,
          type: ReviewType.POSSIBLE_SUBSCRIPTION,
          transactionId: latest.id,
          suggestedAction: {
            merchantId,
            merchantName,
            frequency: pattern.frequency,
            amount: meanAmount,
            occurrences: candidates.length,
          },
        },
      });
    }

    results.push({
      merchantId,
      merchantName,
      created: !existing,
      frequency: pattern.frequency,
    });
  }

  return results;
}
